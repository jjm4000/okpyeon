# Roadmap

Working list of planned changes. Ordering within a release is not priority
order. The next store upload ships whatever is merged and verified when the
current review clears.

## Since 1.2: merged on main, not yet released

- **Phonetic component marker.** The Made of section marks which part
  gives the character its sound: 請 is 言 + 靑, and 靑 is there for 청.
  The collapsed row dotted-underlines that glyph at text color; its
  expanded row carries a small-caps PHONETIC marker; both cues carry the
  tooltip "靑 gives the character its sound". Detection is build-time
  from data already in the cache and rides decomp.json as a per-char row
  index: 7,165 characters pinned (78.1% of the 9,178 with a
  decomposition), 6,550 by Unihan kPhonetic series-sharing (sound-drift
  proof: 江 강 pins 工 공) and 615 by exact eum match under a rule that a
  single-stroke part never pins, plus 樂 curated to no pin. Only the
  phonetic is marked, never the semantic, and an unmarked section claims
  nothing. No toggle; unpinned cards render exactly as before. The SPEC
  addendum "Phonetic components" holds the contract and the tier
  spot-check (exact admitted at ~94% sample precision; a fuzzy onset-coda
  tier rejected at ~40-50%, since it latched onto semantically central
  parts whenever the true phonetic was oversplit away). Rejected in
  mockups: marking both roles, an accent-blue underline (reads as a
  link), marker text in the collapsed row (breaks on four-part
  characters), and the wording SOUND (in the JP/CN register it could read
  as labeling a reading). Suites: node 178, both harness pages five
  checks richer.
- **Test pages no longer download files.** embed.html's export checks
  exercise the real Anki/CSV path, which ends in a download click; the
  page now cancels that click's default action, so runs stop dropping
  okpyeon-anki files into Downloads. The checks assert the same things
  they always did.
- **Korean-language descriptions: project file.** korean-mode-kickoff.md
  is the full record of the spikes and decisions for the feature listed
  under Later below. Documentation only; no code yet.

## 1.2: shipped

Everything since the v1.1.0 tag went out as one release: the manifest
reads 1.2.0, the zip built as okpyeon-1.2.0.zip, the v1.2.0 tag marks the
release commit, and the store listing carries Jesse's own edit of the
text. Designed and QA'd with Jesse across 2026-08-31; the SPEC's
native-words, romanized-v2, and sibling-readings addenda hold the full
contracts. Suites at merge: node 176, index.html 613, embed.html 331,
plus the full-population romanization round trip and the build's 57
anchors.

- **Sibling Sino readings.** Two default-off settings (Character
  cards group) add each character's Japanese on'yomi and Mandarin
  pinyin as one muted line under the card head, marked JP and CN and
  ALIGNED to the eumhun order: 樂 reads 악·락 above ガク・ラク and
  yuè·lè, each reading's tooltip naming its correspondence
  (악 ↔ ガク ↔ yuè). Japanese is jōyō plus corpus-attested tier 2
  (3,566 chars); Mandarin covers 9,249. Alignment is baked at build
  time by the compound bridge (shared spelled words vote) and a
  correspondence scorer with a 26-char curated override table;
  sino.json is 0.4 MB, lazily loaded on the sino flag only. The same
  readings are available as Anki character-card back fields,
  independent of the display toggles, fetched at export only when
  checked.
- **Native Korean words.** One default-off setting ("Native Korean
  word search"). On: search gains All words / Hanja only scope pills
  (All words default; Hanja-only renders exactly today's results with
  a cross-scope hint row), the popup renders the same identity group
  with the lead rule (best non-rare hanja, else native, else rare
  hanja), native cards carry POS, NATIVE marker, and glosses, and
  cross-identity links live in a "Same sound" section pointing both
  ways. The rare-homograph hedge banner retires wherever a native
  entry states the fact it used to guess. The omnibox becomes the All
  words search remotely. native.json: 15,527 quality-filtered lemmas,
  1.24 MB, lazily loaded only when flagged; off is byte-identical.
  Known gap by design: no deconjugation, so native verbs/adjectives
  are reachable from typed search and exact-form selection only.
  Chips, char cards, and saved words are untouched (native cards ship
  without a star until a native key namespace exists).
- **Romanized search v2.** The rr maps are retired for a function:
  forward RR ported to JS (equivalence-swept against rr.py, the kept
  reference, over all 38,370 words), a generous letterwise-and-
  phonological inverse generator gated by the dictionary, and the
  parity rule: romanized input behaves exactly like the hangul it
  de-romanizes to, segmentation included, so inflected forms
  (mushihaesseo) finally resolve. Candidate collapse by coverage
  class keeps junk parses out of results and roots partial parses as
  the typed text; ambiguous romanizations render every maximal parse,
  ordered by anchored coverage then match frequency. A measured
  resolve cap holds garbage input near 57ms warm. rr.json and
  native.json's rr block are deleted; the extension is 1.5 MB
  lighter than it would have been.
- **Settings about footer.** One line in the format shared with
  Etymikon: name, manifest version, data note, GitHub link.
- **Listing, README, and screenshots refreshed.** Two brief OPTIONAL
  sections and the new counts in the listing; the README trimmed of
  implementation reassurances (josa handling, pictograph restraint,
  panel persistence, resize); six of the nine screenshots regenerated
  with the new features present but not singled out, and scenes now
  seed settings through a committed set= param instead of hand-edits.
- **Compound index as a view.** Beside "Show 5 more (N)" on char cards,
  a "Show all (T)" control opens the complete compound index as its own
  view: the used-in view with the char standing as the word ("161 words
  contain 無"), crumb "Used in", every row a drill-down. In-place reveal
  stays for small steps; the view serves the long tail. Both controls
  appear and disappear together.
- **Rare flag corrections.** Two fixes the show-all view surfaced.
  Curated inline compounds now carry the same rare flag the drill views
  join at runtime (the two surfaces could disagree on the same word; the
  joins were the SPEC-correct side, verified by a build anchor that makes
  disagreement impossible). And a hand-reviewed not-rare override list
  fixes the rare heuristic's worst misfires on native-contested hangul:
  거리(距離), 무리(無理), 대로(大路), 이래(以來) no longer render the
  "likely native Korean" hedge banner, and everyday words like 기자(記者),
  보통(普通), 지지(支持), 피해(被害), 전통(傳統), 포기(拋棄) lose their
  wrong RARE markers. 23 overrides, each verified to fire during the
  build (a dead override aborts it) and anchored not-rare in verify;
  舍廊, 假裝, 丁抹, and 生覺 are anchored still-rare so the hedge keeps
  doing its real job. Character levels were unaffected.

## 1.1: frozen at the v1.1.0 tag

Everything below is merged on `main` and verified; the v1.1.0 tag marks
it. It is one release: 1.0.1 was folded in rather than shipped
separately, since nothing went out until the 1.0 review cleared anyway.

- **Typed search in a sidebar.** Clicking the toolbar icon toggles a
  persistent side panel: a search box over the same cards, drill-downs and
  levels as selection lookup. The omnibox keyword (`hj 국민`) opens the
  panel with the query. The panel survives tab switches and navigation,
  which the earlier toolbar popup structurally could not; that popup was
  built first, shipped to no one, and was replaced by the sidebar before
  release. Both surfaces run on the same documented embed contract, and
  the sidebar page is a small registry-driven shell (views and header
  actions are declarative entries).
- **QWERTY-to-hangul search.** Typing `toddlf` with the keyboard still in
  English finds 생일. A query of nothing but Latin letters is read back
  through the 2-set Korean layout, which is safe because such a query
  matches nothing as it stands. The search box keeps what you typed. The
  omnibox converts on the same rule.
- **Romanized search.** Typing `gukmin`, `gungmin`, or `gugmin` finds
  국민: the three Revised Romanization conventions are indexed at build
  time, and a few common spelling habits (kukmin, guk-min) are accepted
  on top. A query that reads as both a keyboard mistype and a
  romanization (`su`) shows both result sets, most common first, each
  introduced by a small header naming its reading; long homophone lists
  preview five characters with a Show all link. Only typed input is
  interpreted. Navigation inside the dictionary never is.
- **Character decomposition.** Char cards carry a collapsed "Made of 囗 +
  或" row between the definitions and the compounds, expanding in place
  into part rows with readings, each an ordinary drill-down. Data is
  BabelStone IDS (public domain), built into decomp.json with pinned
  anchors: radical forms alias to their parent (亻 opens 人), parts that
  cannot render are skipped through to their own parts, and a card-less
  part whose split is entirely card-bearing shows the split instead
  (雙 = 隹 + 隹 + 又). Pictographs and stroke-soup splits show no row by
  rule. The section is one function behind one predicate, so a settings
  toggle later is a single schema entry.
- **Recomposition.** The upward mirror: "Part of 64 characters" on any
  character used inside others, opening a ranked list (most compounds
  first). Component-only characters like 辶 finally have card content.
  The lists are derived from decomp.json at runtime and stored nowhere,
  so decomposition edits reshape them automatically.
- **Whole-card compounds.** When a character's full compound index fits
  within what a card shows inline, it renders whole; the Show-more
  control only appears when there is a genuine second page. Curated-empty
  cards (又) no longer show a header with nothing under it.
- **Character level taxonomy.** Every character carries exactly one `lvl` of
  m/h/a/r, rendered as one of four level chips on char cards and reading-list
  rows: Middle school and High school (MOE curriculum tiers, from the CC BY-SA
  Korean Wikipedia table), Advanced (outside the curriculum, attested), Rare
  (archaic/specialist/reading-only). This REPLACES the old Basic-1800 badge
  and the edu/eduT tier badge; those labels are retired, and the earlier
  "level badges phase 1/2" plan is closed as delivered.
- **Exploration graph.** Compound lines and component-word rows are clickable,
  each character has a complete paginated compound index ("Show 5 more (N)"),
  word cards offer "Used in N larger words" as a dedicated ranked list, and a
  sticky breadcrumb trail with canonical labels, cycle handling and cached
  scroll positions holds the whole descent together. The trail elides by
  width, not depth: every level shows until the row actually runs out of
  room. Eumhun chips scroll to and flash their component card.
- **Card correctness.** Cards head with the canonical character; variant
  surfaces move to a view-scoped "国 → 國" note. "Wiktionary ↗" source links
  appear on every card and target the hanja-titled page where that page hosts
  the fuller CJK entry (`hp`). Badges became a declarative registry; gloss
  cleaning no longer eats quoted glosses.
- **Hedging is a group verdict.** The "likely native Korean" banner and
  the muted card styling appear only when every hanja spelling of a
  hangul-sourced word is rare. In a mixed group (가장: 家長 beside the
  rare 假裝) the card stays normal on every chip, and the chip's own
  RARE marker carries the rarity. The renderer had drifted to judging
  the selected spelling alone, which claimed a demonstrably Sino-Korean
  word was likely native.
- **Wiki links open in a background tab on every surface.** A foreground
  open would destroy ephemeral surfaces mid-read. Covered by the harness.
- **Resizable popup**: per-page-visit size. Persistence across visits was
  considered once storage existed and declined; the popup starting from
  its default each visit is the intended behavior.
- **Build hygiene**: deterministic data emit (`sort_keys`), canonical words
  keys, data-driven segmentation caps, geometry-derived expander state.
- **Card section convention** (internal): every card section is one
  function with one call site behind one settings predicate, verified by
  a byte-identical DOM snapshot refactor. Groundwork for reusing the
  shell in a possible future app around a different language; each
  future per-section toggle is now a single settings schema entry.
- Listing updates: DONE ahead of upload. store-listing.md rewritten to
  cover the sidebar, keyboard-free search, decomposition, saved words,
  export and settings; the privacy policy URL is live on GitHub Pages
  and the homepage field points at this repo. The store set is five of
  the nine committed shots (1, 2, 5, 6, 9): shot 2 is captured dark and
  the composites carry a 560px panel, both supported per-shot by
  pipeline/make_screenshots.py. Screenshot rule for future scenes: vary
  the featured characters across the set (the set once fronted 學 in
  three shots; shots 1 and 9 now feature 天 and 樂, and 學生 stays only
  in the Japanese shot, where the variant note is the point).

### Saved words and settings (merged and verified)

Merged to `main` after manual QA and an adversarial pass; ships with the
release:

- **Saved words.** A star on every card (selection popup and sidebar)
  saves the entry, with a bookmark-style bubble to pick or create a folder
  on the spot. Saved items are references into the dictionary, so the list
  always shows current data and duplicates cannot exist.
- **Folders.** Create, rename and delete (contents return to the default
  folder), collapse and expand, batch selection at the folder and item
  level, and batch move, delete (with confirmation) and export.
- **Export.** Anki (tab-separated, front and back shaped by settings, the
  folder carried as an Anki tag) or CSV (a full-data spreadsheet).
- **Settings page.** Schema-driven so each future setting is one entry:
  default save folder plus the Anki card layout for word and character
  cards.
- **Storage.** First use of the `storage` permission; everything stays in
  `chrome.storage.local` on the device. The privacy policy is updated to
  match (it also corrects the older "no permissions" wording that
  `sidePanel` had already outdated).

### Open question in this release

- **Reading-row chip weight.** RESOLVED: keep the chips as they are. The
  worst case (an all-Rare homophone list rendering a column of identical
  grey pills) was reviewed against two mitigations, suppressing the Rare
  chip on rows and de-filling row chips to plain text. Explicit labels on
  every row won; no change ships.

### Declined

- **Popup state restoration** (reopening the toolbar popup back on the last
  view). Declined: action popups are destroyed on any focus loss by browser
  design, and faking continuity in an ephemeral surface teaches the wrong
  model. The question later resolved itself when the toolbar popup was
  replaced by the sidebar, which persists for real.
- **One example sentence per word.** Declined after a mockup and a coverage
  measurement: the cached kaikki extracts carry sentences for only 7.8% of
  words, and a sentence on the card duplicates what one click into
  Wiktionary already gives. Simplicity won. If it ever returns, the natural
  home is Anki-export enrichment, not the card.

## 1.0: the first store submission

The base product, submitted to the store before this repository existed.
There is no v1.0.0 tag: the initial commit (eb46a4f, 2026-08-16) is the
1.0.0 submission plus three fixes queued as 1.0.1 (the canonical glyph
on variant char cards, Wiktionary source links, hanja-page link
targets). 1.0.1 never shipped on its own; those fixes are the "Card
correctness" bullet of 1.1, the same way 1.1.1 folded into 1.2.

- **Selection lookup.** Highlight hanja, hanzi, or kanji on any page for a
  popup card with the eumhun (나라 국 for 國), readings, English
  definitions, and most common compounds. Simplified Chinese and Japanese
  shinjitai forms resolve to the same entries through the variants map.
- **Reverse lookup.** Highlight a Sino-Korean word in hangul (국민) for its
  hanja (國民), meaning, and component characters, with grammatical
  endings stripped (자본주의는 finds 자본주의) and every spelling of a
  homograph offered as a chip.
- **Recursive breakdown.** Compounds split into component words (자본주의
  → 資本 + 主義), each clickable, with breadcrumb navigation.
- **Browse by sound.** A single hangul syllable lists every hanja read that
  way, ranked by frequency.
- **Rare-homograph hedging.** Native words show nothing rather than a
  forced match, and an obscure hanja homograph of a common native word
  (사랑 → 舍廊) is labelled rare instead of presented as etymology.
- **Private and offline.** The whole dictionary ships inside the
  extension: no network requests, no data collection, no permissions
  beyond the content script.
- **Data and build.** hanja.json, words.json, and variants.json built by
  pipeline/build.py from kaikki.org Wiktionary extracts and Unicode
  Unihan, with the icons, promo tiles, and store zip produced by the
  same pipeline.

## Later / unscheduled

- **Korean language mode.** DESIGNED, SPEC written 2026-09-01 ("Korean
  language mode" addendum), not built. Settled by mockups the same
  day: one Language control (English / 한국어) that switches the whole
  chrome AND the definitions, defaulting to the browser language on
  first run; Korean definitions replace English on word cards; char
  cards use the Urimalsaem gloss, else the hun, else English; a
  한국어 없음 marker over any English fallback; every string routed
  through one message-table lookup so a further language is one file.
  Rejected: separate chrome/definitions controls, a boolean mode
  toggle, follow-the-browser with no row, and an EN fallback marker
  (reads as a third pronunciation beside JP/CN). Earlier framing, kept
  for the record: aimed at the Korean home market, learners of hanja
  in Korea, for whom English glosses are the barrier and partly just
  clutter. korean-mode-kickoff.md is the spike record. The corpus is
  Urimalsaem (우리말샘, NIKL, CC BY-SA 2.0 KR), fetched from the
  spellcheck-ko/korean-dict-nikl mirror on GitHub because the official
  download demands Korean-carrier phone verification; its per-sense
  hanja-origin fields make matching exact, so homograph contamination
  is impossible by construction (ko-wiktionary was measured and
  demoted to reference material). Matching runs in TWO LANES: hanja-
  origin senses to words.json keys, 고유어 senses to native.json by
  (hangul, POS), since native homographs exist too (우리 the pronoun
  beside 우리 the animal pen). ONE CANONICAL ENTRY, TWO LANGUAGES: the
  Korean glosses are a field on the same entries the English glosses
  live on, attached worker-side from a lazy sidecar file, so the toggle
  is a gloss-language pick and English fallback is automatic. Measured
  coverage: ~92% of Sino words, flat across frequency buckets; native
  words well covered; only ~2,100 single characters glossed in Korean,
  and roughly 6,100 to 6,700 chars (two criteria, to reconcile) carry
  English as their only meaning text, so char cards need eumhun
  backfill or an English fallback. Remaining design (mockups first):
  replace or accompany English, char-card treatment, UI chrome
  language, settings shape, sense selection, coverage fallback.
- **Korean-language store listing**, the distribution companion of the
  feature above. Not dashboard-only: the store offers a listing
  language only for locales the package declares, so it needs
  `_locales/en` and `_locales/ko` message files, `default_locale` in
  the manifest, the manifest name and description moved to `__MSG_`
  keys, and a re-upload; the Korean detailed description and optional
  Korean screenshots then go in through the dashboard's language
  dropdown. Korean-browser visitors get the Korean listing, everyone
  else the English one. Natural to ship in the same release as the
  Korean descriptions.
- **Word-level sibling pronunciations** (음악 -> おんがく / yīnyuè), a
  follow-up to the char-level sino line, analysis recorded 2026-08-31:
  the two languages are asymmetric in opposite directions. Mandarin is
  nearly free and mostly correct BECAUSE of the eum alignment: naive
  per-char pinyin fails on polyphones (音樂 needs yuè, not lè), but the
  word's hangul names each char's eum and sino.json's aligned pairs
  select the right pinyin per position; unmodeled tone sandhi is a
  nicety, not an error. Japanese is the hard side: real readings
  involve rendaku and sokuon (がっこう), so synthesis from on'yomi is
  wrong too often to ship; attested kana exist for the ~11k
  shared-spelling words the bridge corpus already parses, partial
  coverage with no honest synthesis fallback. Ship shape when
  designed: zh broadly via alignment, ja attested-only.
- **Proper-noun hangul words** (서울, 부산, 한강). native.json is
  built from Wiktionary's common nouns, so these have no card at all
  in any language; the Korean-mode build found 서울's Urimalsaem
  sense with nothing to attach it to. A small proper-noun lane in
  the native build (Wiktionary tags them) would give them cards and
  Korean definitions in one step.
- **Deconjugation for native words.** Native verbs and adjectives are
  reachable only by their dictionary form (typed search or exact-form
  selection); a selected 먹었어 finds nothing. Romanized v2's
  segmentation machinery is the natural host if this is ever built.
- **Per-site disable**, and a hover mode with its own toggle (hover mode
  itself is further out). Each is one settings schema entry plus its
  feature code.
- Selection support inside `<textarea>`/`<input>`; `all_frames` for
  iframes.
- **대법원 인명용 badge** ("usable in given names", ~8,000 chars from the
  Supreme Court rules annex; Korean law excludes statutes and rules from
  copyright, so likely clean). Deliberately deferred; an optional badge
  long-term, not part of the level taxonomy that shipped.
- List views auto-growing taller than card views.

## Settled questions, kept so they are not relitigated

- **Romanized search: maps versus function.** Resolved for the function
  on 2026-08-31, the same day an earlier record here said the maps had
  won. The maps lost on composition, not on size or correctness: a map
  can only answer "is this exact string a dictionary word", so romanized
  input never got the span segmentation hangul input gets, and inflected
  forms (mushihaesseo) were unrepresentable in principle; three QA
  failures in one session were all map-coverage omissions. v2 shipped
  the function (see 1.2). The round-trip completeness test, every word
  reachable from each of its forms, is the safety story the maps used to
  provide by construction.
- **Phonetic marker scope.** Phonetic only, never the semantic; see the
  entry above and the SPEC addendum for the rejected alternatives.

## Non-goals for now

- The 어문회 검정시험 급수 ladder. CLOSED as won't-do: no openly licensed
  source exists (verified: Korean Wiktionary carries no level data; all
  compilations trace to the association unlicensed), and Korean
  database-producer rights (저작권법 제91조–98조, with case law) make
  unlicensed extraction indefensible for a distributed product. The MOE
  curriculum tiers in the level taxonomy are the recognized-ladder substitute.
- Live Wiktionary API fallback (offline-first is the point)
- Anything requiring network permissions or data collection
