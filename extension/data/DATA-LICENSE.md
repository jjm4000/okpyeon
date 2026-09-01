# Dictionary data license and attribution

The JSON files in this directory (`hanja.json`, `words.json`, `variants.json`,
`decomp.json`, `native.json`, `sino.json`, `ko.json`) are a derived database
compiled from the following sources by `pipeline/build.py`:

- **English Wiktionary** (https://en.wiktionary.org) and the
  **Japanese-language Wiktionary** (https://ja.wiktionary.org), via the
  machine-readable extracts published by **kaikki.org** (https://kaikki.org),
  themselves produced by the wiktextract project. Wiktionary text is
  dual-licensed under the **Creative Commons Attribution-ShareAlike License
  (CC BY-SA)** and the GNU Free Documentation License. The Japanese extract
  supplies variant links plus the word-reading evidence that attests and
  aligns the Japanese readings in `sino.json`.
- **The Unicode Unihan Database** (https://www.unicode.org/charts/unihan.html),
  used under the Unicode License (https://www.unicode.org/license.txt) for
  variant mappings, supplementary definitions, and readings (including the
  Japanese and Mandarin readings behind `sino.json`).
- **Korean Wikipedia**, article 「대한민국 중고등학교 기초한자 목록」
  (https://ko.wikipedia.org/wiki/대한민국_중고등학교_기초한자_목록), used under
  the **Creative Commons Attribution-ShareAlike 4.0 International License**
  (https://creativecommons.org/licenses/by-sa/4.0/) for the middle-school /
  high-school tier (`eduT`) of the Ministry of Education basic-education hanja
  list. (The underlying 교육부 고시 list is itself excluded from copyright by
  저작권법 제7조.)
- **English Wikipedia**, article "List of jōyō kanji"
  (https://en.wikipedia.org/wiki/List_of_jōyō_kanji), used under
  the **Creative Commons Attribution-ShareAlike 4.0 International License**
  for the jōyō on'yomi sets and kyūjitai links in `sino.json`. (The
  underlying 常用漢字表 is a Japanese government notice, itself outside
  copyright.)
- **hermitdave/FrequencyWords** (MIT License, © 2016 Hermit Dave), derived from
  the OPUS OpenSubtitles 2018 corpus — used only as a build-time frequency
  signal: the Korean list decides the `rare` flag and the coarse `f` frequency
  bucket (a 0-9 log-scaled rank band), the Japanese list only weights the
  ordering of readings in `sino.json`, and no word, count or rank from either
  is copied into these files.

- **BabelStone IDS** (https://www.babelstone.co.uk/CJK/IDS.TXT, file date
  2025-06-27), Ideographic Description Sequences maintained by **Andrew West**.
  The only source of `decomp.json`. The file's own header waives copyright: it
  states that IDS descriptions are facts rather than creative compositions and
  so are not eligible for copyright protection, that anyone is free to use the
  data for personal or commercial purposes without permission or attribution,
  and that the author further waives any copyright claim to the presentation
  format. The credit here is given because it is deserved, not because it is
  required. `decomp.json` also carries short part names taken from the Unihan
  `kDefinition` field, covered by the Unicode License above.

`native.json` (native Korean words) is compiled solely from the English
Wiktionary extract via kaikki.org listed above, CC BY-SA, so it adds no new
licensing.

- **우리말샘 (Urimalsaem)** (https://opendict.korean.go.kr), the open Korean
  dictionary of the **National Institute of Korean Language** (국립국어원),
  used under the **Creative Commons Attribution-ShareAlike 2.0 Korea License**
  (https://creativecommons.org/licenses/by-sa/2.0/kr/) as the only source of
  `ko.json`: the Korean definitions shown for words, native words and single
  characters when the extension's language is 한국어. The data was obtained
  through the spellcheck-ko/korean-dict-nikl mirror on GitHub
  (https://github.com/spellcheck-ko/korean-dict-nikl, `opendict/`), a
  redistribution of NIKL's bulk download; the mirror is provenance only, and
  attribution belongs to NIKL / 우리말샘. The example sentences
  (`example_info`) and multimedia (`multimedia_info`) carried by the source
  are excluded from the license grant at the source and are not read by the
  pipeline; nothing from them is in `ko.json`. Each entry keeps the
  Urimalsaem sense code (`s`) so the popup can link the exact sense at
  `https://opendict.korean.go.kr/dictionary/view?sense_no=<s>`.

Accordingly, the derived dictionary data in this directory is distributed
under **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/).
This is separate from the license of the extension's source code (GPL-3.0;
see /LICENSE at the repository root).

Per-entry attribution: every entry links back to its source page on
en.wiktionary.org via the popup's "Wiktionary" link; a card showing a
Korean definition links its Urimalsaem sense instead via the "우리말샘" link.
