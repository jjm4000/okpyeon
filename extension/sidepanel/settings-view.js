/*
 * Okpyeon — the side panel's SETTINGS view.
 *
 * A classic script loaded after sidepanel.js, self-registering the same way
 * saved-view.js does.
 *
 * The page is EXPECTED TO GROW, so it is a declarative schema plus one generic
 * renderer, in the same spirit as content.js's badge registry: a new setting is
 * ONE entry in SETTINGS_SCHEMA and nothing else. Groups are emitted in schema
 * order, so a new entry either slots into a section that already exists or
 * opens a new one, with no renderer change. A new setting TYPE is one more case
 * in the single control-builder switch — and that switch is the ONLY place in
 * this file allowed to branch. Nothing here may name an individual setting.
 *
 * Every control writes through `settingsSet` the moment it changes: there is no
 * save button, and no local copy of the settings that could drift.
 *
 * Exposed for the test harness as globalThis.__okpyeonSettingsView:
 *
 *   schema        the live SETTINGS_SCHEMA array
 *   render()      re-read settings + folders and rebuild the controls
 *   settings()    the settings object as last read
 *   folders()     the folders as last read
 *   controlId(k)  the DOM id the renderer gives an entry's control
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
   * The schema
   *
   * Entry: {
   *   key,            // dot-path into the settings object; also the control's id
   *   groupKey,       // message key of the heading it renders under; groups
   *                   //   appear in schema order
   *   type,           // "select" | "checkset" | "folder-select" | "toggle"
   *   labelKey,       // message key of the visible label
   *   descriptionKey, // optional: message key of the muted second line
   *   options,        // [{value, labelKey}] — omitted by folder-select, which
   *                   //   resolves its options from the worker's folders at
   *                   //   render time, and by toggle, which has none
   *   default         // what a settings object without the key reads as
   * }
   *
   * Copy is a KEY, never text (SPEC "Korean language mode"). withText()
   * gives each entry the matching plain property (group, label, description,
   * an option's label) as a getter over the loader, so the renderer and the
   * harness read finished text in the active language. An entry with a
   * literal group or label and no key (the harness's probe) still works: a
   * getter is installed only where a key is given.
   * ------------------------------------------------------------------ */

  function withText(spec) {
    [["group", "groupKey"], ["label", "labelKey"], ["description", "descriptionKey"]]
      .forEach(function (pair) {
        if (typeof spec[pair[1]] !== "string") return;
        Object.defineProperty(spec, pair[0], {
          enumerable: true,
          get: function () { return t(spec[pair[1]]); }
        });
      });
    if (Array.isArray(spec.options)) spec.options = spec.options.map(withText);
    return spec;
  }

  var SETTINGS_SCHEMA = [
    // Language (SPEC): one control, first group, drives chrome and
    // definitions together. The two option labels are each language's own
    // name and are the same in both tables.
    {
      key: "language",
      groupKey: "group.language",
      type: "select",
      labelKey: "language.label",
      descriptionKey: "language.sub",
      options: [
        { value: "en", labelKey: "language.en" },
        { value: "ko", labelKey: "language.ko" }
      ],
      default: "en"
    },
    {
      key: "nativeWords",
      groupKey: "group.search",
      type: "toggle",
      labelKey: "nativeWords.label",
      descriptionKey: "nativeWords.sub",
      default: false
    },
    {
      key: "jaReadings",
      groupKey: "group.charCards",
      type: "toggle",
      labelKey: "jaReadings.label",
      descriptionKey: "jaReadings.sub",
      default: false
    },
    {
      key: "zhReadings",
      groupKey: "group.charCards",
      type: "toggle",
      labelKey: "zhReadings.label",
      descriptionKey: "zhReadings.sub",
      default: false
    },
    {
      key: "defaultFolderId",
      groupKey: "group.saving",
      type: "folder-select",
      labelKey: "defaultFolder.label",
      default: "f0"
    },
    {
      key: "anki.wordFront",
      groupKey: "group.anki",
      type: "select",
      labelKey: "anki.wordFront",
      options: [
        { value: "hanja", labelKey: "anki.field.hanja" },
        { value: "hangul", labelKey: "anki.field.hangul" }
      ],
      default: "hanja"
    },
    {
      key: "anki.wordBack",
      groupKey: "group.anki",
      type: "checkset",
      labelKey: "anki.wordBack",
      options: [
        { value: "hanja", labelKey: "anki.field.hanja" },
        { value: "hangul", labelKey: "anki.field.hangul" },
        { value: "defs", labelKey: "anki.field.defs" }
      ],
      default: ["hangul", "defs"]
    },
    {
      key: "anki.charFront",
      groupKey: "group.anki",
      type: "select",
      labelKey: "anki.charFront",
      options: [
        { value: "char", labelKey: "anki.field.char" },
        { value: "eumhun", labelKey: "anki.field.eumhun" }
      ],
      default: "char"
    },
    {
      key: "anki.charBack",
      groupKey: "group.anki",
      type: "checkset",
      labelKey: "anki.charBack",
      options: [
        { value: "char", labelKey: "anki.field.char" },
        { value: "eumhun", labelKey: "anki.field.eumhun" },
        { value: "readings", labelKey: "anki.field.readings" },
        { value: "defs", labelKey: "anki.field.defs" },
        { value: "lvl", labelKey: "anki.field.lvl" },
        // Sibling Sino readings: always offered, default unchecked, and
        // independent of the jaReadings/zhReadings display toggles. The
        // checkset is its own per-field choice.
        { value: "ja", labelKey: "anki.field.ja" },
        { value: "zh", labelKey: "anki.field.zh" }
      ],
      default: ["eumhun", "defs"]
    }
  ].map(withText);

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
   * Dot-paths
   *
   * The schema addresses settings by path, so reading and patching are two
   * tiny generic functions rather than a switch over field names.
   * ------------------------------------------------------------------ */

  function readPath(source, path) {
    var parts = String(path).split(".");
    var value = source;
    for (var i = 0; i < parts.length; i++) {
      if (value == null || typeof value !== "object") return undefined;
      value = value[parts[i]];
    }
    return value;
  }

  // "anki.wordBack" + value -> {anki: {wordBack: value}}. The worker
  // shallow-merges the patch, so the nesting has to be built here.
  function buildPatch(path, value) {
    var parts = String(path).split(".");
    var patch = {};
    var node = patch;
    for (var i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    return patch;
  }

  function currentValue(entry) {
    var value = readPath(settings, entry.key);
    if (value !== undefined) return value;
    return Array.isArray(entry.default) ? entry.default.slice() : entry.default;
  }

  function controlId(key) {
    return "okp-set-" + String(key).split(".").join("-");
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  var root = null;
  var body = null;
  var settings = {};
  var folders = [];
  var available = true;

  function write(entry, value) {
    return sendToWorker({ type: "settingsSet", patch: buildPatch(entry.key, value) })
      .then(function (res) {
        if (res && res.ok === true && res.settings) {
          settings = res.settings;
          // The language takes effect from the answer itself, ahead of the
          // storage event every other surface waits for.
          if (I18N) I18N.setLanguage(settings.language);
        }
        return res;
      });
  }

  /* ------------------------------------------------------------------ *
   * The control builder — the one switch in this file.
   *
   * Adding a TYPE means one more case here. Adding a SETTING means no change
   * at all: the schema entry is the whole of it.
   * ------------------------------------------------------------------ */

  function optionsFor(entry) {
    if (entry.type === "folder-select") {
      return folders.map(function (folder) {
        return { value: folder.id, label: folder.name };
      });
    }
    return entry.options || [];
  }

  function buildSelect(entry) {
    var select = document.createElement("select");
    select.id = controlId(entry.key);
    select.className = "settings-select";
    var options = optionsFor(entry);
    for (var i = 0; i < options.length; i++) {
      var option = document.createElement("option");
      option.value = String(options[i].value);
      option.textContent = String(options[i].label);
      select.appendChild(option);
    }
    select.value = String(currentValue(entry));
    select.addEventListener("change", function () { write(entry, select.value); });
    return select;
  }

  function buildCheckset(entry) {
    var box = document.createElement("div");
    box.id = controlId(entry.key);
    box.className = "settings-checkset";
    var options = optionsFor(entry);
    var value = currentValue(entry);
    var chosen = Array.isArray(value) ? value : [];
    var boxes = [];
    for (var i = 0; i < options.length; i++) {
      var label = document.createElement("label");
      label.className = "settings-checkbox";
      var input = document.createElement("input");
      input.type = "checkbox";
      input.className = "settings-check";
      input.value = String(options[i].value);
      input.setAttribute("data-value", String(options[i].value));
      input.checked = chosen.indexOf(options[i].value) >= 0;
      var text = document.createElement("span");
      text.textContent = String(options[i].label);
      label.appendChild(input);
      label.appendChild(text);
      box.appendChild(label);
      boxes.push(input);
    }
    // The written value keeps the schema's option order, not the click order,
    // so the exported card fields come out in a stable arrangement.
    box.addEventListener("change", function () {
      var picked = boxes.filter(function (input) { return input.checked; })
        .map(function (input) { return input.value; });
      write(entry, picked);
    });
    return box;
  }

  // A boolean setting is one checkbox in the checkset's clothes: same label
  // wrapper, same accent, no option list. The write is the raw boolean.
  function buildToggle(entry) {
    var label = document.createElement("label");
    label.className = "settings-checkbox settings-toggle";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.className = "settings-check";
    input.id = controlId(entry.key);
    input.checked = currentValue(entry) === true;
    var text = document.createElement("span");
    text.textContent = t("toggle.enabled");
    label.appendChild(input);
    label.appendChild(text);
    input.addEventListener("change", function () { write(entry, input.checked); });
    return label;
  }

  function buildControl(entry) {
    switch (entry.type) {
      case "select":
      case "folder-select":
        return buildSelect(entry);
      case "checkset":
        return buildCheckset(entry);
      case "toggle":
        return buildToggle(entry);
      default:
        // An unknown type is a schema mistake, not a user-facing state: say so
        // quietly rather than dropping the row and hiding the bug.
        var unknown = document.createElement("span");
        unknown.className = "settings-unknown";
        unknown.textContent = "unsupported setting type: " + String(entry.type);
        return unknown;
    }
  }

  /* ------------------------------------------------------------------ *
   * The generic renderer
   * ------------------------------------------------------------------ */

  function renderSchema() {
    while (body.firstChild) body.removeChild(body.firstChild);

    if (!available) {
      var note = document.createElement("p");
      note.className = "settings-unavailable";
      note.textContent = t("settings.unavailable");
      body.appendChild(note);
      return 0;
    }

    var groups = Object.create(null);
    var rendered = 0;
    for (var i = 0; i < SETTINGS_SCHEMA.length; i++) {
      var entry = SETTINGS_SCHEMA[i];
      if (!entry || !entry.key) continue;
      var name = entry.group == null ? "" : String(entry.group);
      var group = groups[name];
      if (!group) {
        group = document.createElement("section");
        group.className = "settings-group";
        group.setAttribute("data-group", name);
        var heading = document.createElement("h2");
        heading.className = "settings-heading";
        heading.textContent = name;
        group.appendChild(heading);
        groups[name] = group;
        body.appendChild(group);      // schema order, by first appearance
      }
      var row = document.createElement("div");
      row.className = "settings-row settings-row--" + entry.type;
      row.setAttribute("data-key", entry.key);
      var label = document.createElement("label");
      label.className = "settings-label";
      label.textContent = entry.label == null ? entry.key : String(entry.label);
      label.setAttribute("for", controlId(entry.key));
      row.appendChild(label);
      if (entry.description != null && entry.description !== "") {
        var note = document.createElement("p");
        note.className = "settings-note";
        note.textContent = String(entry.description);
        row.appendChild(note);
      }
      var control = document.createElement("div");
      control.className = "settings-control";
      control.appendChild(buildControl(entry));
      row.appendChild(control);
      group.appendChild(row);
      rendered++;
    }
    body.appendChild(buildAbout());
    return rendered;
  }

  // The manifest version, reachable only inside the real extension page. The
  // harness and the staging replica have no chrome.*, and the about block
  // must render there too, just without a number.
  function extensionVersion() {
    try {
      if (typeof chrome !== "undefined" && chrome.runtime &&
          typeof chrome.runtime.getManifest === "function") {
        var v = chrome.runtime.getManifest().version;
        if (typeof v === "string" && v !== "") return v;
      }
    } catch (e) { /* fall through: no version line */ }
    return "";
  }

  // The one static block the schema-driven page allows: a single sentence in
  // Etymikon's about-line format (name, version, data note, Source link), so
  // the two sibling apps read the same. Rendered after the groups so it rides
  // the same seal-room measurement as everything else. The message carries
  // the sentence; the wordmark and the link are its two built slots, and a
  // page with no version (the harness, the staging replica) uses the
  // message without that slot.
  function buildAbout() {
    var about = document.createElement("footer");
    about.className = "settings-about";
    var line = document.createElement("p");
    line.className = "about-line";
    var version = extensionVersion();
    var build = {
      WORDMARK: function (text) {
        var wordmark = document.createElement("b");
        wordmark.textContent = text;
        return wordmark;
      },
      GITHUB: function (text) {
        var repo = document.createElement("a");
        repo.className = "about-link";
        repo.href = "https://github.com/jjm4000/okpyeon";
        repo.target = "_blank";
        repo.rel = "noreferrer";
        repo.textContent = text;
        return repo;
      }
    };
    var subs = { WORDMARK: t("wordmark"), VERSION: version, GITHUB: t("link.github") };
    if (I18N) {
      I18N.render(line, version ? "about" : "about.noVersion", subs, build);
    } else {
      line.textContent = t("about");
    }
    about.appendChild(line);
    return about;
  }

  // One read of each, then one render: folder-select needs the folders, and
  // every control needs the current settings, so neither can be rendered from
  // a stale copy.
  function render() {
    return Promise.all([
      sendToWorker({ type: "settingsGet" }),
      sendToWorker({ type: "savedGet" })
    ]).then(function (answers) {
      var settingsRes = answers[0];
      var savedRes = answers[1];
      if (!settingsRes || settingsRes.ok !== true || !settingsRes.settings) {
        available = false;
        settings = {};
        folders = [];
        renderSchema();
        updateSealRoom();
        return false;
      }
      available = true;
      settings = settingsRes.settings;
      folders = (savedRes && savedRes.ok === true && Array.isArray(savedRes.folders))
        ? savedRes.folders
        : [];
      renderSchema();
      updateSealRoom();
      return true;
    });
  }

  // Same rule as the other views (SPEC "Corner seal"): the seal shows only
  // when the space under the content fits it, re-measured after render and
  // on resize. Measured against the BODY'S CHILDREN, not the body: the
  // settings-body is a stretched flex scroller whose own box always reaches
  // the view bottom, which would report zero room forever.
  var SEAL_ROOM = 230;
  function updateSealRoom() {
    if (!root || !body || !root.getBoundingClientRect) return;
    var edge = 0;
    for (var i = 0; i < body.children.length; i++) {
      var r = body.children[i].getBoundingClientRect();
      if (r.height > 0 && r.bottom > edge) edge = r.bottom;
    }
    var room = root.getBoundingClientRect().bottom -
      (edge || body.getBoundingClientRect().top);
    root.classList.toggle("view--roomy", room >= SEAL_ROOM);
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    var sealTimer = null;
    window.addEventListener("resize", function () {
      clearTimeout(sealTimer);
      sealTimer = setTimeout(updateSealRoom, 100);
    });
  }

  /* ------------------------------------------------------------------ *
   * Registration
   * ------------------------------------------------------------------ */

  // A language change rebuilds the page: every label is a getter over the
  // loader, so one render is the whole of it.
  if (I18N) {
    I18N.onChange(function () {
      if (body) render();
    });
  }

  sidebar.registerView({
    key: "settings",
    labelKey: "tab.settings",
    titleKey: "title.settings",
    mount: function (container) {
      root = container;
      // The jade seal is a permanent fixture of this view (user-directed),
      // not an empty-state mark — see sidepanel.css .view--sealed.
      container.classList.add("view--sealed");
      body = document.createElement("div");
      body.id = "okp-settings";
      body.className = "settings-body";
      container.appendChild(body);
      render();
    },
    onShow: function () {
      // Folders and the default folder can both have changed in the saved
      // view since the last visit, so every show re-reads.
      render();
    }
  });

  globalThis.__okpyeonSettingsView = {
    schema: SETTINGS_SCHEMA,
    render: render,
    settings: function () { return settings; },
    folders: function () { return folders.slice(); },
    controlId: controlId
  };
})();
