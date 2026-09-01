/*
 * Okpyeon — the side panel's SAVED view.
 *
 * A classic script loaded after sidepanel.js, which self-registers through
 * __okpyeonSidebar.registerView. Registering is the whole wiring: the nav row
 * appears by itself once a second view exists, and nothing in sidepanel.js
 * knows this file is here.
 *
 * This is PAGE chrome, not the shadow renderer: rows are plain elements styled
 * by sidepanel.css, so there are no level chips and no card markup here. The
 * secondary line carries the hangul (words) or the eumhun (characters), and a
 * row whose entry has left the dictionary says so instead of vanishing.
 *
 * Everything the view knows comes from the worker (`savedGet`), and everything
 * it changes goes back through the worker — the panel never touches storage.
 * A worker without chrome.storage answers {ok:false} to every one of these
 * messages, and that reads as "the feature is absent": one quiet line, never
 * an error.
 *
 * Exposed for the test harness as globalThis.__okpyeonSavedView:
 *
 *   refresh()                 re-read savedGet and re-render; -> Promise
 *   selection()               the checked item ids, as an array
 *   selectedFolders()         the folder ids checked for deletion, as an array
 *   folders()                 the folders from the last read
 *   items()                   the joined rows from the last read
 *   filter()                  the folder id the list is filtered to, or ""
 *   collapsed()               the ids of the folders currently collapsed
 *   effectiveIds()            what an action would act on right now
 *   lastDownload()            {filename, format, body, count, skipped} or null
 *   handleStorageChanged(c,a) the storage-change handler, driveable without a
 *                             real chrome.storage
 */
(function () {
  "use strict";

  var sidebar = globalThis.__okpyeonSidebar;
  if (!sidebar || typeof sidebar.registerView !== "function") return;

  // Copy comes through the message-table loader (i18n.js), which loads
  // before this script on every surface; keys stand in on a page without it.
  var I18N = globalThis.__okpyeonI18n || null;

  function t(key, subs) {
    return I18N ? I18N.t(key, subs) : String(key);
  }

  /* ------------------------------------------------------------------ *
   * Worker access — the same probe sidepanel.js uses.
   * ------------------------------------------------------------------ */

  function workerRuntime() {
    var chromeObj = globalThis.chrome;
    var runtime = chromeObj && chromeObj.runtime;
    if (runtime && runtime.id && typeof runtime.sendMessage === "function") {
      return runtime;
    }
    var fake = globalThis.__hanjaHoverTestRuntime;
    if (fake && typeof fake.sendMessage === "function") return fake;
    return null;
  }

  // Callback form first (both MV3 and the harness runtime support it), promise
  // form if one comes back, and every failure resolves null instead of
  // rejecting: a missing worker must read exactly like a worker that said no.
  function sendToWorker(payload) {
    var runtime = workerRuntime();
    if (!runtime) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        resolve(value);
      }
      var maybePromise;
      try {
        maybePromise = runtime.sendMessage(payload, function (response) {
          if (globalThis.chrome && globalThis.chrome.runtime &&
              globalThis.chrome.runtime.lastError) {
            done(null);
            return;
          }
          done(response || null);
        });
      } catch (e) {
        done(null);
        return;
      }
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(function (response) { done(response || null); },
                          function () { done(null); });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * View state
   *
   * Selection is held OUTSIDE the DOM (an id -> true map) because the list is
   * rebuilt wholesale on every refresh: a checked box that only lived in the
   * markup would be lost the moment a save arrived from a page. Ids that no
   * longer exist are pruned on each read, so a removed item cannot linger in
   * the selection and resurrect an action.
   *
   * Folder selection is its own map (folder id -> true), held the same way.
   * A folder's checkbox picks the folder AND its items; an empty folder has
   * no items to stand in for it, so the folder itself is what is selected,
   * and that is what lets an empty folder be deleted from the list. f0 is
   * never in this map: its checkbox picks items only.
   *
   * Collapse state is page-session-local by design (SPEC): default expanded,
   * held while the panel is open, gone on a fresh open. Hence a plain object,
   * never storage.
   * ------------------------------------------------------------------ */

  var ctx = null;
  var root = null;
  var visible = false;
  var available = true;      // false once the worker says "storage unavailable"

  var folders = [];
  var items = [];
  var selected = Object.create(null);
  var selectedFolders = Object.create(null);
  var collapsed = Object.create(null);
  var filterId = "";         // "" = All

  // A transient note in the actions bar's count slot ("Moved 2 to Exam
  // words"): holds off the normal count text until it expires, then the
  // next renderActions restores it.
  var flashUntil = 0;
  function flashCount(text) {
    flashUntil = Date.now() + 2500;
    if (els.count) els.count.textContent = text;
    setTimeout(function () {
      flashUntil = 0;
      renderActions();
    }, 2600);
  }

  // The seal only marks empty paper (SPEC "Corner seal"): with enough rows
  // the behind-content watermark read as clutter, so each render measures
  // the space left under the content and shows the seal only when it fits.
  var SEAL_ROOM = 230;
  function updateSealRoom() {
    if (!root || !root.getBoundingClientRect) return;
    var edge = 0;
    for (var i = 0; i < root.children.length; i++) {
      var r = root.children[i].getBoundingClientRect();
      if (r.height > 0 && r.bottom > edge) edge = r.bottom;
    }
    var room = root.getBoundingClientRect().bottom - edge;
    root.classList.toggle("view--roomy", room >= SEAL_ROOM);
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    var sealTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(sealTimer);
      sealTimer = setTimeout(updateSealRoom, 100);
    });
  }
  var lastDownload = null;

  // Bar / actions elements, built once in mount().
  var els = {};

  function folderById(id) {
    for (var i = 0; i < folders.length; i++) {
      if (folders[i] && folders[i].id === id) return folders[i];
    }
    return null;
  }

  function folderName(id) {
    var folder = folderById(id);
    return folder ? folder.name : id;
  }

  // The rows the current filter shows — the unit both the select-all checkbox
  // and "nothing checked" act on.
  function filteredItems() {
    if (!filterId) return items.slice();
    return items.filter(function (item) { return item.folderId === filterId; });
  }

  function itemsInFolder(id) {
    return items.filter(function (item) { return item.folderId === id; });
  }

  function selectedIds() {
    return items
      .filter(function (item) { return selected[item.id] === true; })
      .map(function (item) { return item.id; });
  }

  // In folder order, and never f0: the default folder cannot be deleted.
  function selectedFolderIds() {
    return folders
      .filter(function (folder) {
        return folder.id !== "f0" && selectedFolders[folder.id] === true;
      })
      .map(function (folder) { return folder.id; });
  }

  // The folders the list shows: every folder under All, the one folder
  // under a filter. Contents never gate this (user-directed): an empty
  // folder is still a folder, and hiding it is what made folders seem to
  // vanish when the last item left.
  function shownFolders() {
    if (!filterId) return folders.slice();
    return folders.filter(function (folder) { return folder.id === filterId; });
  }

  // Nothing checked means "the current filter", so every action has an obvious
  // target without the user having to select first. A checked folder counts
  // as something checked: with only an empty folder picked, an action must
  // not quietly widen to everything shown.
  function effectiveIds() {
    var picked = selectedIds();
    if (picked.length || selectedFolderIds().length) return picked;
    return filteredItems().map(function (item) { return item.id; });
  }

  /* ------------------------------------------------------------------ *
   * Small DOM helpers
   * ------------------------------------------------------------------ */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function button(className, label, title) {
    var node = el("button", className, label);
    node.type = "button";
    if (title) node.title = title;
    return node;
  }

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  // Korean language mode ADDENDUM: the language as the request flag, set
  // exactly when it is 한국어 (the search shell's rule), so only then do the
  // rows carry Korean entries.
  function koOn() {
    return !!I18N && I18N.language() === "ko";
  }

  // Dictionary text only ever reaches the DOM as text, never as markup.
  // Under 한국어 the first Korean sense when the row carries one, else the
  // English gloss; rows never carry the fallback marker.
  function firstGloss(item) {
    if (koOn() && item && item.ko && typeof item.ko === "object") {
      var senses = Array.isArray(item.ko.d) ? item.ko.d : [];
      for (var i = 0; i < senses.length; i++) {
        if (typeof senses[i] === "string" && senses[i] !== "") return senses[i];
      }
    }
    var glosses = item && item.glosses;
    return (glosses && glosses.length) ? String(glosses[0]) : "";
  }

  // Words carry their hangul; characters carry their eumhun, rendered the way
  // the cards say it ("하늘 천"), and both land in the same secondary slot.
  function secondaryText(item) {
    if (item.kind === "char") {
      return (item.eumhun || []).map(function (entry) {
        return ((entry && entry.hun ? entry.hun : "") + " " +
                (entry && entry.eum ? entry.eum : "")).trim();
      }).filter(Boolean).join(", ");
    }
    return item.hangul ? String(item.hangul) : "";
  }

  /* ------------------------------------------------------------------ *
   * Top bar
   *
   * Built once: the inline name inputs live in it, and a rebuild on every
   * refresh would yank a half-typed folder name out from under the user. Only
   * the option lists and the enabled states are re-rendered.
   * ------------------------------------------------------------------ */

  function buildBar() {
    var bar = el("div", "saved-bar");
    bar.id = "okp-saved-bar";

    var main = el("div", "saved-bar-main");

    // Labels and titles come later, from relabelChrome(): the bars are built
    // once, and a language change re-labels them in place.
    var filter = document.createElement("select");
    filter.id = "okp-saved-filter";
    filter.className = "saved-filter";
    filter.addEventListener("change", function () {
      filterId = filter.value;
      renderList();
      renderBar();
      renderActions();
    });
    main.appendChild(filter);

    var newBtn = button("saved-new", "");
    newBtn.id = "okp-saved-new";
    newBtn.addEventListener("click", function () { openNameForm("new"); });
    main.appendChild(newBtn);

    var renameBtn = button("saved-rename", "");
    renameBtn.id = "okp-saved-rename";
    renameBtn.addEventListener("click", function () { openNameForm("rename"); });
    main.appendChild(renameBtn);

    var deleteBtn = button("saved-delete", "");
    deleteBtn.id = "okp-saved-delete";
    deleteBtn.addEventListener("click", function () { openDeleteConfirm(); });
    main.appendChild(deleteBtn);

    var selectAllLabel = el("label", "saved-selectall");
    var selectAll = document.createElement("input");
    selectAll.type = "checkbox";
    selectAll.id = "okp-saved-selectall";
    selectAll.className = "saved-selectall-check";
    selectAll.addEventListener("change", function () {
      var rows = filteredItems();
      for (var i = 0; i < rows.length; i++) {
        if (selectAll.checked) selected[rows[i].id] = true;
        else delete selected[rows[i].id];
      }
      // Select-all is about items; folders are picked one by one. Clearing
      // it clears the folders too, so the clearing gesture leaves nothing
      // armed behind it.
      if (!selectAll.checked) selectedFolders = Object.create(null);
      renderList();
      renderActions();
    });
    selectAllLabel.appendChild(selectAll);
    var selectAllText = el("span", "saved-selectall-text");
    selectAllLabel.appendChild(selectAllText);
    main.appendChild(selectAllLabel);

    bar.appendChild(main);

    // One slot for whichever inline form is open — new folder, rename, or the
    // delete confirmation. Only one at a time, so one slot is enough.
    var inline = el("div", "saved-bar-inline");
    inline.id = "okp-saved-bar-inline";
    inline.hidden = true;
    bar.appendChild(inline);

    els.bar = bar;
    els.filter = filter;
    els.newBtn = newBtn;
    els.renameBtn = renameBtn;
    els.deleteBtn = deleteBtn;
    els.selectAll = selectAll;
    els.selectAllText = selectAllText;
    els.barInline = inline;
    return bar;
  }

  // Every fixed label on the two bars, from the message table. Called once
  // after both bars exist, then on every language change.
  function relabelChrome() {
    if (!els.filter || !els.move) return;
    els.filter.setAttribute("aria-label", t("saved.filter"));
    els.newBtn.textContent = t("saved.newFolder");
    els.newBtn.title = t("saved.newFolder.title");
    els.renameBtn.textContent = t("saved.rename");
    els.renameBtn.title = t("saved.rename.title");
    els.deleteBtn.textContent = t("saved.delete");
    els.deleteBtn.title = t("saved.delete.title");
    els.selectAllText.textContent = t("saved.selectAll");
    els.move.setAttribute("aria-label", t("saved.move.aria"));
    els.removeBtn.textContent = t("saved.delete");
    els.removeBtn.title = t("saved.deleteSelection.title");
    els.exportBtn.textContent = t("saved.export");
    els.exportBtn.title = t("saved.exportSelection.title");
  }

  function closeBarInline() {
    if (!els.barInline) return;
    clear(els.barInline);
    els.barInline.hidden = true;
    els.bar.classList.remove("saved-bar--inline");
  }

  function openBarInline(node) {
    clear(els.barInline);
    els.barInline.appendChild(node);
    els.barInline.hidden = false;
    els.bar.classList.add("saved-bar--inline");
  }

  // mode: "new" creates, "rename" renames the filtered folder. One builder,
  // because the two differ only in their starting value and their message.
  function openNameForm(mode) {
    if (mode === "rename" && !filterId) return;
    var form = el("div", "saved-nameform");
    form.setAttribute("data-mode", mode);

    var input = document.createElement("input");
    input.type = "text";
    input.className = "saved-name-input";
    input.id = "okp-saved-name-input";
    input.placeholder = t("saved.folderName");
    input.value = mode === "rename" ? folderName(filterId) : "";
    input.setAttribute("aria-label",
      t(mode === "new" ? "saved.newFolderName" : "saved.folderName"));
    form.appendChild(input);

    var okBtn = button("saved-name-ok", t(mode === "new" ? "saved.create" : "saved.save"));
    var cancelBtn = button("saved-name-cancel", t("saved.cancel"));
    var error = el("span", "saved-error");
    error.hidden = true;

    function submit() {
      var name = input.value.trim();
      if (!name) {
        error.textContent = t("saved.nameNeeded");
        error.hidden = false;
        input.focus();
        return;
      }
      var message = mode === "new"
        ? { type: "folderCreate", name: name }
        : { type: "folderRename", id: filterId, name: name };
      sendToWorker(message).then(function (res) {
        if (!res || res.ok !== true) {
          error.textContent = (res && res.error) ? String(res.error) : t("saved.failed");
          error.hidden = false;
          return;
        }
        // Creating a folder stays on the current filter (user-directed):
        // jumping into the new, empty folder abandoned the list the user was
        // looking at. Under "All" the new folder appears as its own group,
        // and it is in the filter and Move selects from here on.
        closeBarInline();
        refresh();
      });
    }

    okBtn.addEventListener("click", submit);
    cancelBtn.addEventListener("click", closeBarInline);
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); submit(); }
      else if (ev.key === "Escape") { ev.preventDefault(); closeBarInline(); }
    });

    form.appendChild(okBtn);
    form.appendChild(cancelBtn);
    form.appendChild(error);
    openBarInline(form);
    input.focus();
  }

  // Inline, never window.confirm: a modal dialog in a side panel is a much
  // bigger interruption than the thing it is guarding.
  function openDeleteConfirm() {
    if (!filterId || filterId === "f0") return;
    var box = el("div", "saved-confirm saved-confirm--folder");
    var count = itemsInFolder(filterId).length;
    // The items land in the folder that always exists, named by its stored
    // name (the worker's default, or whatever it was renamed to).
    box.appendChild(el("span", "saved-confirm-text",
      count
        ? t("saved.deleteFolderN", {
            FOLDER: folderName(filterId), COUNT: count, TARGET: folderName("f0")
          })
        : t("saved.deleteFolder", { FOLDER: folderName(filterId) })));
    var yes = button("saved-confirm-yes", t("saved.delete"));
    var no = button("saved-confirm-no", t("saved.cancel"));
    yes.addEventListener("click", function () {
      var target = filterId;
      sendToWorker({ type: "folderDelete", id: target }).then(function () {
        if (filterId === target) filterId = "";
        closeBarInline();
        refresh();
      });
    });
    no.addEventListener("click", closeBarInline);
    box.appendChild(yes);
    box.appendChild(no);
    openBarInline(box);
  }

  function renderBar() {
    var filter = els.filter;
    var wanted = filterId;
    clear(filter);
    var all = document.createElement("option");
    all.value = "";
    all.textContent = t("saved.all", { COUNT: items.length });
    filter.appendChild(all);
    var stillThere = false;
    for (var i = 0; i < folders.length; i++) {
      var option = document.createElement("option");
      option.value = folders[i].id;
      option.textContent = folders[i].name + " (" + itemsInFolder(folders[i].id).length + ")";
      filter.appendChild(option);
      if (folders[i].id === wanted) stillThere = true;
    }
    // A folder that was deleted under us falls back to All rather than leaving
    // the select pointing at nothing.
    if (wanted && !stillThere) filterId = "";
    filter.value = filterId;

    // Rename and Delete are about ONE folder, so they are inert on All; f0 is
    // the folder that always exists, so it offers no delete at all.
    els.renameBtn.disabled = !filterId;
    els.deleteBtn.hidden = !filterId || filterId === "f0";

    var rows = filteredItems();
    var picked = rows.filter(function (item) { return selected[item.id] === true; });
    els.selectAll.checked = rows.length > 0 && picked.length === rows.length;
    els.selectAll.indeterminate = picked.length > 0 && picked.length < rows.length;
    els.selectAll.disabled = rows.length === 0;
  }

  /* ------------------------------------------------------------------ *
   * The list — the view's own scroll region.
   * ------------------------------------------------------------------ */

  function buildItemRow(item) {
    var row = el("div", "saved-row");
    row.setAttribute("data-id", item.id);
    row.setAttribute("data-kind", item.kind);
    row.setAttribute("data-key", item.key);
    if (item.missing === true) row.classList.add("missing");

    var check = document.createElement("input");
    check.type = "checkbox";
    check.className = "saved-check";
    check.checked = selected[item.id] === true;
    check.setAttribute("aria-label", t("saved.select", { ITEM: item.key }));
    check.addEventListener("change", function () {
      if (check.checked) {
        selected[item.id] = true;
      } else {
        delete selected[item.id];
        // A folder is picked as a whole; taking one of its items out of the
        // selection takes the folder out of the delete set with it.
        delete selectedFolders[item.folderId];
      }
      syncSelectionUi();
    });
    // The label is a forgiving hit target (user-directed): a near-miss around
    // the small checkbox toggles selection instead of opening the card.
    var hit = document.createElement("label");
    hit.className = "saved-hit";
    hit.appendChild(check);
    row.appendChild(hit);

    var text = el("div", "saved-text");
    text.appendChild(el("span", "saved-primary", item.key));
    var secondary = secondaryText(item);
    if (secondary) text.appendChild(el("span", "saved-secondary", secondary));
    if (item.missing === true) {
      text.appendChild(el("span", "saved-missing", t("saved.missing")));
    } else {
      var gloss = firstGloss(item);
      if (gloss) text.appendChild(el("span", "saved-gloss", gloss));
    }
    row.appendChild(text);

    // The row is a link to the card: anywhere but the checkbox opens it in the
    // search view, with the searchbar showing what was searched.
    row.addEventListener("click", function (ev) {
      if (ev.target === check || (ev.target.closest && ev.target.closest(".saved-hit"))) {
        return;
      }
      openInSearch(item.key);
    });
    return row;
  }

  function buildFolderHeader(folder) {
    var header = el("div", "saved-folder");
    header.setAttribute("data-folder", folder.id);
    var isCollapsed = collapsed[folder.id] === true;
    if (isCollapsed) header.classList.add("saved-folder--collapsed");

    var rows = itemsInFolder(folder.id);

    var check = document.createElement("input");
    check.type = "checkbox";
    check.className = "saved-folder-check";
    setFolderCheckState(folder, check);
    // Every band is selectable, empty or not: that is how an empty folder
    // gets deleted. The one exception is an empty f0, which can neither be
    // deleted nor has anything to select, so its box has nothing to do.
    check.disabled = folder.id === "f0" && rows.length === 0;
    check.setAttribute("aria-label", t("saved.selectFolder", { FOLDER: folder.name }));
    check.addEventListener("change", function () {
      for (var i = 0; i < rows.length; i++) {
        if (check.checked) selected[rows[i].id] = true;
        else delete selected[rows[i].id];
      }
      // The folder itself joins the selection, except f0, whose box only
      // ever stands for its items: the default folder is never deleted.
      if (check.checked && folder.id !== "f0") selectedFolders[folder.id] = true;
      else delete selectedFolders[folder.id];
      renderList();
      renderActions();
      renderBar();
    });
    // Same forgiving hit target as item rows: a near-miss around the folder
    // checkbox selects the folder instead of folding it away.
    var hit = document.createElement("label");
    hit.className = "saved-hit";
    hit.appendChild(check);
    header.appendChild(hit);

    // The triangle is decorative; the header itself carries the state, so a
    // screen reader is told by aria-expanded rather than by a rotated glyph.
    header.appendChild(el("span", "saved-tri", "▸"));
    header.appendChild(el("span", "saved-folder-name", folder.name));
    header.appendChild(el("span", "saved-folder-count", String(rows.length)));
    header.setAttribute("aria-expanded", isCollapsed ? "false" : "true");

    // Clicking the header anywhere but its checkbox folds the folder away. The
    // count and the checkbox stay, so a collapsed folder is still a working
    // batch target.
    header.addEventListener("click", function (ev) {
      if (ev.target === check || (ev.target.closest && ev.target.closest(".saved-hit"))) {
        return;
      }
      if (collapsed[folder.id] === true) delete collapsed[folder.id];
      else collapsed[folder.id] = true;
      renderList();
    });
    return header;
  }

  // The header's checkbox reads checked for a folder picked as a whole, or
  // for one whose every item is picked; part of its items picked reads
  // indeterminate. Shared by the build and the cheap re-sync.
  function setFolderCheckState(folder, check) {
    var rows = itemsInFolder(folder.id);
    var picked = rows.filter(function (item) { return selected[item.id] === true; });
    var whole = selectedFolders[folder.id] === true ||
      (rows.length > 0 && picked.length === rows.length);
    check.checked = whole;
    check.indeterminate = !whole && picked.length > 0;
  }

  function renderList() {
    renderListBody();
    updateSealRoom();
  }

  function renderListBody() {
    var list = els.list;
    clear(list);

    // Item rows indent under the folder bands; the class keeps that a
    // stylesheet concern.
    list.classList.add("saved-list--grouped");

    if (!available) {
      list.appendChild(el("p", "saved-unavailable", t("saved.unavailable")));
      return;
    }

    // The hint for a user who has saved nothing yet: once, above the bands,
    // which render regardless (a folder shows whether or not it has items,
    // user-directed), so the folders a user made are still there after the
    // last item leaves them.
    if (!items.length) {
      list.appendChild(el("p", "saved-empty", t("saved.emptyAll")));
    }

    var shown = shownFolders();
    for (var f = 0; f < shown.length; f++) {
      var folder = shown[f];
      var inFolder = itemsInFolder(folder.id);
      list.appendChild(buildFolderHeader(folder));
      if (collapsed[folder.id] === true) continue;
      if (!inFolder.length) {
        list.appendChild(el("p", "saved-empty saved-empty--folder", t("saved.emptyFolder")));
        continue;
      }
      for (var j = 0; j < inFolder.length; j++) {
        list.appendChild(buildItemRow(inFolder[j]));
      }
    }
  }

  /* ------------------------------------------------------------------ *
   * Actions bar
   * ------------------------------------------------------------------ */

  function buildActions() {
    var bar = el("div", "saved-actions");
    bar.id = "okp-saved-actions";

    var main = el("div", "saved-actions-main");

    var move = document.createElement("select");
    move.id = "okp-saved-move";
    move.className = "saved-move";
    move.addEventListener("change", function () {
      var target = move.value;
      move.value = "";
      if (!target) return;
      var ids = effectiveIds();
      if (!ids.length) return;
      sendToWorker({ type: "savedMove", ids: ids, folderId: target }).then(function (res) {
        // Moves are reversible, so no confirmation — but not silent either:
        // under a folder filter the moved rows vanish from view, which reads
        // as deletion without this note (user-raised).
        if (res && res.ok === true) {
          var folder = folders.filter(function (f) { return f.id === target; })[0];
          flashCount(t("saved.moved", {
            COUNT: ids.length, FOLDER: folder ? folder.name : t("saved.folder")
          }));
        }
        refresh();
      });
    });
    main.appendChild(move);

    var removeBtn = button("saved-remove", "");
    removeBtn.id = "okp-saved-remove";
    removeBtn.addEventListener("click", openRemoveConfirm);
    main.appendChild(removeBtn);

    var exportBtn = button("saved-export", "");
    exportBtn.id = "okp-saved-export";
    exportBtn.addEventListener("click", openExportChoice);
    main.appendChild(exportBtn);

    main.appendChild(el("span", "saved-count", ""));

    bar.appendChild(main);

    var inline = el("div", "saved-actions-inline");
    inline.id = "okp-saved-actions-inline";
    inline.hidden = true;
    bar.appendChild(inline);

    // One anchor, reused: a fresh one per export would litter the view, and
    // keeping it means the filename the worker chose is inspectable after the
    // download has been handed to the browser.
    var anchor = document.createElement("a");
    anchor.id = "okp-saved-download";
    anchor.className = "saved-download";
    anchor.hidden = true;
    bar.appendChild(anchor);

    els.actions = bar;
    els.move = move;
    els.removeBtn = removeBtn;
    els.exportBtn = exportBtn;
    els.count = main.querySelector(".saved-count");
    els.actionsInline = inline;
    els.anchor = anchor;
    return bar;
  }

  // The inline row takes the main row's place rather than sitting beside it,
  // so the confirmation is where the button was.
  function setActionsMainHidden(hidden) {
    var main = els.actions && els.actions.querySelector(".saved-actions-main");
    if (main) main.hidden = hidden === true;
  }

  function closeActionsInline() {
    if (!els.actionsInline) return;
    clear(els.actionsInline);
    els.actionsInline.hidden = true;
    setActionsMainHidden(false);
  }

  function openActionsInline(node) {
    clear(els.actionsInline);
    els.actionsInline.appendChild(node);
    els.actionsInline.hidden = false;
    setActionsMainHidden(true);
  }

  // Two steps, in place: the first click arms, cancel disarms, confirm removes.
  // The confirmation is one sentence per part: the item count, then each
  // checked folder in the toolbar's own words, with the count of items that
  // will move to the default folder when the folder holds any that are not
  // themselves being deleted.
  function openRemoveConfirm() {
    var ids = effectiveIds();
    var folderIds = selectedFolderIds();
    if (!ids.length && !folderIds.length) return;
    var going = Object.create(null);
    for (var g = 0; g < ids.length; g++) going[ids[g]] = true;
    var parts = [];
    if (ids.length) parts.push(t("saved.deleteN", { COUNT: ids.length }));
    for (var f = 0; f < folderIds.length; f++) {
      var left = itemsInFolder(folderIds[f]).filter(function (item) {
        return going[item.id] !== true;
      }).length;
      parts.push(left
        ? t("saved.deleteFolderN", {
            FOLDER: folderName(folderIds[f]), COUNT: left, TARGET: folderName("f0")
          })
        : t("saved.deleteFolder", { FOLDER: folderName(folderIds[f]) }));
    }
    var box = el("div", "saved-confirm saved-confirm--remove");
    box.appendChild(el("span", "saved-confirm-text", parts.join(" ")));
    var yes = button("saved-confirm-yes", t("saved.delete"));
    var no = button("saved-confirm-no", t("saved.cancel"));
    yes.addEventListener("click", function () {
      // Items first, folders last: a folder deleted first would move its
      // items to f0 before the item deletion could reach them.
      var work = ids.length
        ? sendToWorker({ type: "savedRemove", ids: ids })
        : Promise.resolve(null);
      folderIds.forEach(function (folderId) {
        work = work.then(function () {
          return sendToWorker({ type: "folderDelete", id: folderId });
        });
      });
      work.then(function () {
        for (var i = 0; i < ids.length; i++) delete selected[ids[i]];
        for (var k = 0; k < folderIds.length; k++) {
          delete selectedFolders[folderIds[k]];
          if (filterId === folderIds[k]) filterId = "";
        }
        closeActionsInline();
        refresh();
      });
    });
    no.addEventListener("click", closeActionsInline);
    box.appendChild(yes);
    box.appendChild(no);
    openActionsInline(box);
  }

  function openExportChoice() {
    var ids = effectiveIds();
    if (!ids.length) return;
    var box = el("div", "saved-export-choice");
    box.appendChild(el("span", "saved-export-text", t("saved.exportN", { COUNT: ids.length })));
    var anki = button("saved-export-anki", t("saved.anki"), t("anki.desc"));
    var csv = button("saved-export-csv", t("saved.csv"), t("csv.desc"));
    var cancel = button("saved-export-cancel", t("saved.cancel"));
    anki.addEventListener("click", function () { runExport(ids, "anki"); });
    csv.addEventListener("click", function () { runExport(ids, "csv"); });
    cancel.addEventListener("click", closeActionsInline);
    box.appendChild(anki);
    box.appendChild(csv);
    box.appendChild(cancel);
    openActionsInline(box);
  }

  // Blob + a download click, filename from the worker, then revoke. The object
  // URL is released on a later turn: revoking it in the same tick can cancel
  // the download Chrome has only just started.
  function runExport(ids, format) {
    sendToWorker({ type: "savedExport", ids: ids, format: format }).then(function (res) {
      if (!res || res.ok !== true || typeof res.tsv !== "string") {
        var box = el("div", "saved-export-choice");
        box.appendChild(el("span", "saved-error",
          (res && res.error) ? String(res.error) : t("saved.exportUnavailable")));
        var back = button("saved-export-cancel", t("saved.close"));
        back.addEventListener("click", closeActionsInline);
        box.appendChild(back);
        openActionsInline(box);
        return;
      }
      var filename = res.filename ||
        (format === "csv" ? "okpyeon-saved.csv" : "okpyeon-anki.txt");
      var type = format === "csv" ? "text/csv" : "text/plain";
      var url = URL.createObjectURL(new Blob([res.tsv], { type: type + ";charset=utf-8" }));
      var anchor = els.anchor;
      anchor.href = url;
      anchor.download = filename;
      anchor.setAttribute("data-format", format);
      anchor.setAttribute("data-count", String(res.count == null ? "" : res.count));
      anchor.setAttribute("data-skipped", String(res.skipped == null ? "" : res.skipped));
      // The body is kept on the element so the file that was actually handed
      // to the browser is inspectable after the object URL is gone.
      anchor.setAttribute("data-body", res.tsv);
      anchor.textContent = filename;
      lastDownload = {
        filename: filename, format: format, body: res.tsv,
        count: res.count, skipped: res.skipped
      };
      anchor.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      closeActionsInline();
    });
  }

  function renderActions() {
    var move = els.move;
    clear(move);
    var head = document.createElement("option");
    head.value = "";
    head.textContent = t("saved.moveTo");
    move.appendChild(head);
    for (var i = 0; i < folders.length; i++) {
      var option = document.createElement("option");
      option.value = folders[i].id;
      option.textContent = folders[i].name;
      move.appendChild(option);
    }
    move.value = "";

    var picked = selectedIds();
    var pickedFolders = selectedFolderIds();
    var target = (picked.length || pickedFolders.length)
      ? picked.length
      : filteredItems().length;
    var counts = [];
    if (picked.length) counts.push(t("saved.selected", { COUNT: picked.length }));
    if (pickedFolders.length) {
      counts.push(t("saved.selectedFolders", { COUNT: pickedFolders.length }));
    }
    els.count.textContent = flashUntil > Date.now()
      ? els.count.textContent
      : counts.length
        ? counts.join(", ")
        : (target ? t("saved.allShown", { COUNT: target }) : "");
    // Move and Export act on items; Delete also takes folders, so a checked
    // empty folder is enough to arm it.
    var inert = target === 0 || !available;
    move.disabled = inert;
    els.removeBtn.disabled = !available || (target === 0 && !pickedFolders.length);
    els.exportBtn.disabled = inert;
    els.actions.hidden = !available;
    updateSealRoom();
  }

  // The cheap half of a refresh: checkbox states and the action labels, with
  // no list rebuild, so clicking one checkbox does not rebuild every row.
  function syncSelectionUi() {
    var headers = els.list.querySelectorAll(".saved-folder");
    for (var i = 0; i < headers.length; i++) {
      var folder = folderById(headers[i].getAttribute("data-folder"));
      var check = headers[i].querySelector(".saved-folder-check");
      if (folder && check) setFolderCheckState(folder, check);
    }
    renderBar();
    renderActions();
  }

  /* ------------------------------------------------------------------ *
   * Opening a row in the search view
   * ------------------------------------------------------------------ */

  function openInSearch(key) {
    var input = document.getElementById("okp-input");
    if (input) input.value = key;
    var shellModule = (ctx && ctx.shell) || globalThis.__okpyeonSearchShell;
    var controller = shellModule && typeof shellModule.controller === "function"
      ? shellModule.controller()
      : null;
    // The view switch happens either way: landing on the search view with the
    // query in the box is still the right place to be if the shell is missing.
    if (typeof sidebar.showView === "function") sidebar.showView("search");
    if (controller) {
      try { controller.search(key); } catch (e) { /* the shell reports its own errors */ }
    }
  }

  /* ------------------------------------------------------------------ *
   * Reading
   * ------------------------------------------------------------------ */

  function refresh() {
    // Under English the field is absent, so the request is byte-identical to
    // today's and only a flagged one may touch ko.json.
    var message = { type: "savedGet" };
    if (koOn()) message.ko = true;
    return sendToWorker(message).then(function (res) {
      if (!res || res.ok !== true) {
        // "storage unavailable" and "no worker at all" are the same thing to a
        // user: the feature is absent. One quiet line, no error styling.
        available = false;
        folders = [];
        items = [];
        renderBar();
        renderList();
        renderActions();
        els.bar.hidden = true;
        return false;
      }
      available = true;
      els.bar.hidden = false;
      folders = Array.isArray(res.folders) ? res.folders : [];
      items = Array.isArray(res.items) ? res.items : [];
      // Prune: an id that is gone must not sit in the selection and turn up in
      // the next batch action.
      var live = Object.create(null);
      for (var i = 0; i < items.length; i++) live[items[i].id] = true;
      Object.keys(selected).forEach(function (id) {
        if (!live[id]) delete selected[id];
      });
      Object.keys(selectedFolders).forEach(function (id) {
        if (!folderById(id)) delete selectedFolders[id];
      });
      renderBar();
      renderList();
      renderActions();
      return true;
    });
  }

  // Exposed so the harness can drive the live-refresh path without a real
  // chrome.storage, exactly as sidepanel.js exposes handleWorkerMessage.
  function handleStorageChanged(changes, area) {
    if (area && area !== "local") return false;
    if (changes && !changes.okpSaved && !changes.okpSettings) return false;
    if (!visible) return false;
    refresh();
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Registration
   * ------------------------------------------------------------------ */

  // A language change: the transient inline forms are dropped rather than
  // re-labelled mid-flight, the bars are re-labelled, and the list is
  // rebuilt from what was last read, then re-read under the new language's
  // flag (Korean language mode ADDENDUM: the rows' definitions follow it).
  if (I18N) {
    I18N.onChange(function () {
      if (!root) return;
      closeBarInline();
      closeActionsInline();
      relabelChrome();
      renderBar();
      renderList();
      renderActions();
      if (available) refresh();
    });
  }

  sidebar.registerView({
    key: "saved",
    labelKey: "tab.saved",
    titleKey: "title.saved",
    mount: function (container, viewCtx) {
      ctx = viewCtx;
      root = container;
      // The jade seal is a permanent fixture of this view (user-directed),
      // not an empty-state mark — see sidepanel.css .view--sealed.
      container.classList.add("view--sealed");
      container.appendChild(buildBar());
      var list = el("div", "saved-list");
      list.id = "okp-saved-list";
      els.list = list;
      container.appendChild(list);
      container.appendChild(buildActions());
      relabelChrome();

      // Real runtime only: the harness has no chrome.storage and drives
      // handleStorageChanged directly instead.
      var chromeObj = globalThis.chrome;
      var runtime = chromeObj && chromeObj.runtime;
      var storage = chromeObj && chromeObj.storage;
      if (runtime && runtime.id && storage && storage.onChanged &&
          typeof storage.onChanged.addListener === "function") {
        storage.onChanged.addListener(function (changes, area) {
          handleStorageChanged(changes, area);
        });
      }
      refresh();
    },
    onShow: function () {
      visible = true;
      // Saves made from a page while another view was up land here.
      refresh();
    },
    onHide: function () {
      visible = false;
      closeBarInline();
      closeActionsInline();
    }
  });

  globalThis.__okpyeonSavedView = {
    refresh: refresh,
    selection: selectedIds,
    selectedFolders: selectedFolderIds,
    folders: function () { return folders.slice(); },
    items: function () { return items.slice(); },
    filter: function () { return filterId; },
    collapsed: function () { return Object.keys(collapsed); },
    effectiveIds: effectiveIds,
    lastDownload: function () { return lastDownload; },
    handleStorageChanged: handleStorageChanged
  };
})();
