/*
 * Okpyeon: the message-table loader (SPEC "Korean language mode").
 *
 * One table per language, in Chrome's _locales format, and t(key, subs) as
 * the only path any surface reads copy through. A CLASSIC script, loaded
 * before content.js on every shipped surface (the manifest's content_scripts
 * list, the side panel page, the harnesses); in Node it is imported for its
 * one side effect, globalThis.__okpyeonI18n.
 *
 * Constraints this file lives under:
 * - A content script cannot fetch chrome-extension:// files that are not
 *   web_accessible_resources, so a table arrives through the worker
 *   ({type: "messagesGet", lang}), which fetches and caches it. A harness
 *   hands a table in directly with init(table, lang).
 * - Chrome accepts only [A-Za-z0-9_@] in message names; the SPEC names keys
 *   with dots. The files use "_", callers use ".", fileKey() maps.
 * - English is BUILT IN below, verbatim to _locales/en/messages.json (a Node
 *   test pins the two equal), so the first render is English with no round
 *   trip and a surface that never receives a table still renders.
 * - English plural forms are sibling keys, key.one and key.other, picked by
 *   the COUNT substitution (1 picks .one when it exists). Korean has none.
 * - t() never throws: a missing key in the active table falls back to the
 *   English table, then to the key itself.
 */
(function () {
  "use strict";

  var LANGUAGES = ["en", "ko"];

  var EN = {
    "appName": "Okpyeon: Hanja Popup Dictionary",
    "appDesc": "A study tool for Korean learners. Highlight hanja, hanzi, or kanji to read them in Korean, or a hangul word to see its hanja.",
    "level_m": "Middle school",
    "level_h": "High school",
    "level_a": "Advanced",
    "level_r": "Rare",
    "marker_ja": "JP",
    "marker_zh": "CN",
    "marker_rare": "rare",
    "marker_native": "native",
    "pos_noun": "Noun",
    "pos_verb": "Verb",
    "pos_adj": "Adj",
    "pos_adv": "Adv",
    "pos_intj": "Intj",
    "pos_pron": "Pron",
    "pos_num": "Num",
    "pos_det": "Det",
    "marker_phonetic": "PHONETIC",
    "marker_noKorean": "",
    "section_compounds": "Compounds",
    "section_componentHanja": "Component hanja",
    "section_componentWords": "Component words",
    "section_sameSound": "Same sound",
    "row_madeOf": "Made of $PARTS$",
    "row_partOf_one": "Part of $COUNT$ character",
    "row_partOf_other": "Part of $COUNT$ characters",
    "row_usedIn_one": "Used in $COUNT$ larger word",
    "row_usedIn_other": "Used in $COUNT$ larger words",
    "button_showMore": "Show $PAGE$ more ($COUNT$)",
    "button_showAll": "Show all ($COUNT$)",
    "hedge_label": "Rare hanja homograph",
    "hedge_note": "Likely native Korean. This hanja spelling is obscure.",
    "hedge_lessCommon_label": "Less common homograph",
    "hedge_lessCommon_note": "Usually the native word. This hanja spelling is a homograph.",
    "hint_nativeInAll_one": "$COUNT$ native word in All words",
    "hint_nativeInAll_other": "$COUNT$ native words in All words",
    "interp_keyboard": "(keyboard)",
    "tooltip_phonetic": "$GLYPH$ gives the character its sound",
    "tooltip_wiktionary": "Wiktionary entry for $WORD$ (opens in a new tab)",
    "tooltip_lessCommon": "A less common meaning of $HANGUL$",
    "bubble_savedTo": "Saved to",
    "bubble_create": "Create",
    "bubble_cancel": "Cancel",
    "bubble_remove": "Remove",
    "level_m_title": "MOE curriculum, middle school (중학교용)",
    "level_h_title": "MOE curriculum, high school (고등학교용)",
    "level_a_title": "Beyond the school curriculum; attested in real vocabulary (Okpyeon's classification)",
    "level_r_title": "Archaic, specialist, or reading-only (Okpyeon's classification)",
    "button_more": "more",
    "button_less": "less",
    "link_wiktionary": "Wiktionary ↗",
    "link_urimalsaem": "Urimalsaem ↗",
    "tooltip_urimalsaem": "Urimalsaem entry for $WORD$ (opens in a new tab)",
    "link_opened": "Opened ↗",
    "star_save": "Save $WORD$",
    "star_remove": "Remove $WORD$",
    "star_title_save": "Save",
    "star_title_saved": "Saved",
    "bubble_saved": "Saved",
    "bubble_folder": "Folder",
    "bubble_newFolder": "New folder…",
    "bubble_createFailed": "Could not create that folder",
    "tooltip_reading": "Characters read $SYLLABLE$",
    "tooltip_lookup": "Look up $WORD$",
    "aria_nativeWord": "$WORD$, native Korean word",
    "crumb_usedIn": "Used in",
    "crumb_partOf": "Part of",
    "title_usedIn_one": "$COUNT$ word contains $WORD$",
    "title_usedIn_other": "$COUNT$ words contain $WORD$",
    "title_partOf_one": "$COUNT$ character contains $GLYPH$",
    "title_partOf_other": "$COUNT$ characters contain $GLYPH$",
    "title_reading": "$COUNT$ hanja read $SYLLABLE$",
    "reading_showAll": "Show all $COUNT$",
    "reading_showAll_aria": "Show all $COUNT$ hanja read $SYLLABLE$",
    "crumb_showAll": "Show all $COUNT$ steps of the trail",
    "tooltip_sino_both": "$EUM$ ↔ $JA$ ↔ $ZH$",
    "tooltip_sino_ja": "$EUM$ ↔ $JA$",
    "tooltip_sino_zh": "$EUM$ ↔ $ZH$",
    "tab_search": "Search",
    "tab_saved": "Saved",
    "tab_settings": "Settings",
    "title_search": "Search hanja and words",
    "title_saved": "Saved words and characters",
    "title_settings": "Saving and export settings",
    "search_empty": "Search hanja, a Korean word, or a syllable.",
    "search_none": "No entry for “$QUERY$”.",
    "search_error": "Lookup failed. Try again.",
    "scope_all": "All words",
    "scope_hanja": "Hanja only",
    "scope_all_title": "Includes native Korean words",
    "scope_hanja_title": "Sino-Korean entries, as before",
    "about": "$WORDMARK$ $VERSION$. Data from English Wiktionary and Urimalsaem, CC BY-SA. $GITHUB$",
    "about_noVersion": "$WORDMARK$. Data from English Wiktionary and Urimalsaem, CC BY-SA. $GITHUB$",
    "wordmark": "Okpyeon",
    "link_github": "GitHub ↗",
    "page_title": "Okpyeon: Hanja search",
    "brand_title": "Look up 玉篇",
    "brand_aria": "Okpyeon: look up 玉篇",
    "nav_aria": "Views",
    "input_placeholder": "한자 · 한글 · 음절",
    "input_aria": "Search hanja, a sino-Korean word, or a single syllable",
    "scope_aria": "Search scope",
    "folder_default": "Saved",
    "omnibox_suggestion": "Search Okpyeon for <match>%s</match>",
    "saved_filter": "Filter by folder",
    "saved_newFolder": "New folder",
    "saved_rename": "Rename",
    "saved_delete": "Delete",
    "saved_selectAll": "Select all",
    "saved_folderName": "Folder name",
    "saved_newFolderName": "New folder name",
    "saved_create": "Create",
    "saved_save": "Save",
    "saved_cancel": "Cancel",
    "saved_close": "Close",
    "saved_failed": "That did not work.",
    "saved_all": "All ($COUNT$)",
    "saved_unavailable": "Saved words are not available in this browser session.",
    "saved_emptyFolder": "This folder is empty.",
    "saved_emptyAll": "Nothing saved yet. Tap the ☆ on a card to save it.",
    "saved_moveTo": "Move to…",
    "saved_moved": "Moved $COUNT$ to $FOLDER$",
    "saved_deleteN_one": "Delete $COUNT$ item?",
    "saved_deleteN_other": "Delete $COUNT$ items?",
    "saved_export": "Export",
    "saved_exportN": "Export $COUNT$ as",
    "saved_anki": "Anki",
    "anki_desc": "Anki tab-separated import file",
    "saved_csv": "CSV",
    "csv_desc": "Spreadsheet with every field",
    "saved_exportUnavailable": "Export is not available.",
    "saved_newFolder_title": "Create a folder",
    "saved_rename_title": "Rename this folder",
    "saved_delete_title": "Delete this folder",
    "saved_nameNeeded": "A folder needs a name.",
    "saved_deleteFolder": "Delete $FOLDER$?",
    "saved_deleteFolderN_one": "Delete $FOLDER$? $COUNT$ item moves to $TARGET$.",
    "saved_deleteFolderN_other": "Delete $FOLDER$? $COUNT$ items move to $TARGET$.",
    "saved_select": "Select $ITEM$",
    "saved_selectFolder": "Select everything in $FOLDER$",
    "saved_missing": "no longer in the dictionary",
    "saved_move_aria": "Move the selection to a folder",
    "saved_folder": "folder",
    "saved_deleteSelection_title": "Delete the selection",
    "saved_exportSelection_title": "Export the selection",
    "saved_selected": "$COUNT$ selected",
    "saved_selectedFolders_one": "$COUNT$ folder selected",
    "saved_selectedFolders_other": "$COUNT$ folders selected",
    "saved_allShown": "all $COUNT$ shown",
    "group_language": "Language / 언어",
    "language_label": "Language",
    "language_sub": "Menus, cards, and definitions",
    "group_search": "Search",
    "nativeWords_label": "Native Korean word search",
    "nativeWords_sub": "Adds native Korean words to the dictionary. Search shows all words, and highlighting a native word on a page shows its meaning.",
    "group_charCards": "Character cards",
    "jaReadings_label": "Japanese reading",
    "jaReadings_sub": "Shows the character's on'yomi reading, in katakana.",
    "zhReadings_label": "Chinese reading",
    "zhReadings_sub": "Shows the character's Mandarin reading, in pinyin.",
    "group_saving": "Saving",
    "defaultFolder_label": "By default, newly saved items go to",
    "anki_wordFront": "Word cards: front",
    "anki_wordBack": "Word cards: back",
    "anki_charFront": "Character cards: front",
    "anki_charBack": "Character cards: back",
    "anki_field_hanja": "Hanja",
    "anki_field_hangul": "Hangul",
    "anki_field_defs": "Definitions",
    "anki_field_char": "Character",
    "anki_field_eumhun": "Eum-hun",
    "anki_field_readings": "Readings",
    "anki_field_lvl": "Level",
    "anki_field_ja": "Japanese reading",
    "anki_field_zh": "Chinese reading",
    "group_anki": "Anki export",
    "language_en": "English",
    "language_ko": "한국어",
    "toggle_enabled": "Enabled",
    "settings_unavailable": "Settings are not available in this browser session."
  };

  var tables = { en: EN };
  var active = "en";
  var wanted = "en";
  var listeners = [];
  var loader = defaultLoader;

  function has(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  function fileKey(key) {
    return String(key).split(".").join("_");
  }

  function validLanguage(lang) {
    return LANGUAGES.indexOf(lang) >= 0 ? lang : "en";
  }

  // Accepts Chrome's {key: {message}} shape or a flat {key: "text"} map.
  // Keys are stored in file form, so a dotted key in a hand-built table
  // lands on the same slot as its file spelling.
  function normalizeTable(raw) {
    var out = {};
    if (!raw || typeof raw !== "object") return out;
    for (var key in raw) {
      if (!has(raw, key)) continue;
      var value = raw[key];
      if (value !== null && typeof value === "object") {
        value = value.message;
      }
      if (typeof value !== "string") continue;
      out[fileKey(key)] = value;
    }
    return out;
  }

  function templateIn(table, key, subs) {
    if (!table) return undefined;
    var fk = fileKey(key);
    var count = subs && typeof subs.COUNT === "number" ? subs.COUNT : null;
    if (count !== null) {
      if (count === 1 && has(table, fk + "_one")) return table[fk + "_one"];
      if (has(table, fk + "_other")) return table[fk + "_other"];
    }
    return has(table, fk) ? table[fk] : undefined;
  }

  function template(key, subs) {
    var found = templateIn(tables[active], key, subs);
    if (found === undefined && active !== "en") found = templateIn(tables.en, key, subs);
    return found === undefined ? null : found;
  }

  var PLACEHOLDER = /\$([A-Za-z][A-Za-z0-9_]*)\$/g;

  // The template split at its placeholders: [{text}] and [{name, value}]
  // pieces in order. A placeholder the caller did not supply stays literal,
  // so an unfilled slot is visible rather than silently blank.
  function segments(key, subs) {
    var tpl = template(key, subs);
    if (tpl === null) return [{ text: String(key) }];
    var out = [];
    var last = 0;
    var m;
    PLACEHOLDER.lastIndex = 0;
    while ((m = PLACEHOLDER.exec(tpl)) !== null) {
      if (m.index > last) out.push({ text: tpl.slice(last, m.index) });
      if (subs && has(subs, m[1]) && subs[m[1]] !== undefined && subs[m[1]] !== null) {
        out.push({ name: m[1], value: String(subs[m[1]]) });
      } else {
        out.push({ text: m[0] });
      }
      last = m.index + m[0].length;
    }
    if (last < tpl.length) out.push({ text: tpl.slice(last) });
    return out;
  }

  function t(key, subs) {
    try {
      var segs = segments(key, subs);
      var text = "";
      for (var i = 0; i < segs.length; i++) {
        text += segs[i].text !== undefined ? segs[i].text : segs[i].value;
      }
      return text;
    } catch (e) {
      return String(key);
    }
  }

  // DOM composition. Text runs become ONE text node each; a placeholder with
  // a builder in `build` becomes build[NAME](value) and splits the run. A
  // placeholder without a builder is plain text inside the run, so a message
  // with no builders at all appends exactly one text node.
  function render(parent, key, subs, build) {
    var segs = segments(key, subs);
    var buffer = "";
    function flush() {
      if (buffer === "") return;
      parent.appendChild(document.createTextNode(buffer));
      buffer = "";
    }
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg.text !== undefined) {
        buffer += seg.text;
      } else if (build && typeof build[seg.name] === "function") {
        flush();
        var node = build[seg.name](seg.value);
        if (node) parent.appendChild(node);
      } else {
        buffer += seg.value;
      }
    }
    flush();
    return parent;
  }

  function fire() {
    var list = listeners.slice();
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](active);
      } catch (e) { /* one listener's failure is not another's */ }
    }
  }

  function activate(lang) {
    if (active === lang) return false;
    active = lang;
    fire();
    return true;
  }

  // Installs a table for a language; with `lang` given it also becomes the
  // active language. The harness path, and the worker-answer path below.
  function init(table, lang) {
    var which = lang === undefined ? "en" : validLanguage(lang);
    tables[which] = normalizeTable(table);
    if (lang !== undefined) {
      wanted = which;
      activate(which);
    }
    return true;
  }

  // The same runtime probe the side panel scripts use: an extension context
  // has a runtime with an id; a harness page has the fake worker instead.
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

  // Resolves the raw table, or null for every kind of failure: no worker, a
  // worker too old for the message, a fetch that failed inside it.
  function defaultLoader(lang) {
    var runtime = workerRuntime();
    if (!runtime) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var settled = false;
      function done(response) {
        if (settled) return;
        settled = true;
        resolve(response && response.ok === true && response.messages &&
          typeof response.messages === "object" ? response.messages : null);
      }
      var maybePromise;
      try {
        maybePromise = runtime.sendMessage({ type: "messagesGet", lang: lang }, function (response) {
          if (globalThis.chrome && globalThis.chrome.runtime &&
              globalThis.chrome.runtime.lastError) {
            done(null);
            return;
          }
          done(response);
        });
      } catch (e) {
        done(null);
        return;
      }
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(done, function () { done(null); });
      }
    });
  }

  // Switches the active language, loading its table first when needed. The
  // English table is built in, so "en" never waits. Resolves true when the
  // requested language is active afterwards; a table that could not be
  // loaded leaves English active and resolves false. A newer request made
  // while a load is in flight wins: the stale answer is stored, not applied.
  function setLanguage(lang) {
    var next = validLanguage(lang);
    wanted = next;
    if (tables[next]) {
      activate(next);
      return Promise.resolve(true);
    }
    return loader(next).then(function (raw) {
      if (raw) tables[next] = normalizeTable(raw);
      if (wanted !== next) return active === wanted;
      if (tables[next]) {
        activate(next);
        return true;
      }
      activate("en");
      return false;
    }, function () {
      if (wanted === next) activate("en");
      return false;
    });
  }

  function onChange(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    return function () {
      var at = listeners.indexOf(fn);
      if (at >= 0) listeners.splice(at, 1);
    };
  }

  // Test seam: swap the table source (a function lang -> Promise<table|null>).
  function configure(options) {
    if (options && typeof options.load === "function") loader = options.load;
    else if (options && options.load === null) loader = defaultLoader;
  }

  // Test seam: back to the built-in English table only, no listeners.
  function reset() {
    tables = { en: EN };
    active = "en";
    wanted = "en";
    listeners = [];
    loader = defaultLoader;
  }

  globalThis.__okpyeonI18n = {
    t: t,
    segments: segments,
    render: render,
    init: init,
    setLanguage: setLanguage,
    language: function () { return active; },
    onChange: onChange,
    configure: configure,
    reset: reset,
    fileKey: fileKey,
    validLanguage: validLanguage,
    LANGUAGES: LANGUAGES.slice(),
    builtin: function () { return normalizeTable(EN); }
  };
})();
