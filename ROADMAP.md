# Roadmap

Working list of planned changes. Ordering within a release is not priority
order. The next store upload ships whatever is merged and verified when the
current review clears.

## Merged on main, version call pending (fold into 1.1.1 or become 1.2)

Two features landed 2026-08-31, designed and QA'd with Jesse in one
session; the SPEC's native-words and romanized-v2 addenda hold the
full contracts. Suites at merge: node 166, index.html 591, embed.html
314, plus the full-population romanization round trip.

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

## 1.1.1: open, collecting fixes

Everything after the v1.1.0 tag lands here. The manifest is bumped to
1.1.1 and the zip builds as okpyeon-1.1.1.zip; more fixes may join
before this goes to the store.

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

## Future settings entries

The settings page and `storage` permission now exist, so each of these is
one schema entry plus its feature code:

- Per-site disable, hover-mode toggle (hover mode itself is further out)
- Japanese and Chinese pronunciations on character cards (see Later)

## Later / unscheduled

- Romanized search: maps versus function, RESOLVED THE OTHER WAY
  (2026-08-31, same day the record below first said "data won"; kept
  so the reversal is not relitigated either). The maps lost on
  composition, not on size or correctness: a map can only answer "is
  this exact string a dictionary word", so romanized input never got
  the span segmentation hangul input gets, and inflected forms
  (mushihaesseo) were unrepresentable in principle. Three QA failures
  in one session were all map-coverage omissions. v2 shipped the
  function: forward RR ported to JS (equivalence-swept against rr.py,
  the kept reference implementation, over the full word population), a
  generous inverse generator gated by the dictionary (the rule the
  keyboard channel always had), candidate collapse by coverage class,
  and a measured resolve cap (garbage worst case 57ms warm behind the
  debounce). rr.json and native.json's rr block are deleted, 1.5 MB
  lighter. The round-trip completeness test (every word reachable
  from each of its forms) is the safety story the maps used to
  provide by construction.
- Selection support inside `<textarea>`/`<input>`; `all_frames` for iframes
- 대법원 인명용 badge ("usable in given names", ~8,000 chars from the Supreme
  Court rules annex; Korean law excludes statutes/rules from copyright, so
  likely clean): deliberately deferred; an optional badge long-term, not part
  of the level taxonomy that shipped
- Sino readings across the sibling languages (design settled with Jesse
  2026-08-31; queued behind the native-words merge; mockups first):
  one quiet line on char cards showing the SAME Sino root's sound in
  Japanese and Mandarin beside the card's eum, so a learner who knows
  any of the three can ground the other two. Decided:
  - On'yomi ONLY, never kun: on'yomi is the Sino reading, the sibling
    of the eum; kun is a native gloss, the analog of the hun the card
    already shows in Korean. Kun-only jōyō chars (串 丼 咲, 78 of
    them) correctly get no line: there is no Sino sound to show.
  - Capped at two readings per language, primary first. 90%+ of
    covered chars have exactly one; the polyphonic minority (樂, 行,
    車) genuinely carry multiple Sino morphemes, mirrored in the
    card's own multi-eum row (악·락), so showing both is the truth
    (single-reading kMandarin hides the 음악 reading yuè on 16% of
    school chars).
  - Two tiers, one mechanism. The mechanism: align common Japanese
    words' kana (ja kaikki extract, cached) against candidate on'yomi
    with the regular transforms (sokuon, rendaku), weighted by a ja
    frequency list, the same method the Korean compound ranking uses.
    Tier 1: jōyō chars (2,121 of ours; 92% of m, 86% of h; kyūjitai
    column maps straight onto our canonical forms) keep the canonical
    jōyō reading set, ORDERED by corpus weight, table order as the
    tiebreak. Tier 2: beyond jōyō, corpus-attested readings above a
    pinned threshold (distinct-word count within a frequency band)
    extend coverage to chars a Japanese-knower actually meets (醤 in
    醤油), replacing the jōyō cliff with an evidence standard.
    Mandarin symmetrically: kHanyuPinlu frequencies order, kXHC1983
    supplies the set, kMandarin the fallback.
  - Data: jōyō table via the Wikipedia list (CC BY-SA, same pattern
    and license family as the MOE tier scrape), Unihan already cached
    and attributed. Emitted payload small (ja on'yomi alone measured
    36 KB); lazy-loaded behind a default-off settings row per the
    native.json pattern.
  - Spike gates before build: alignment anchors (学校 音楽 銀行,
    jukujikun like 今日 skipped), the validation property that the
    corpus's top reading is a jōyō reading for ~95% of jōyō chars
    (exceptions reported), and the measured tier-2 coverage.
  - Open: threshold value, whether tier-2 readings render identically
    (lean yes), display design (mockups), settings row wording.
- List views auto-growing taller than card views
- Korean-language store listing

## Non-goals for now

- The 어문회 검정시험 급수 ladder. CLOSED as won't-do: no openly licensed
  source exists (verified: Korean Wiktionary carries no level data; all
  compilations trace to the association unlicensed), and Korean
  database-producer rights (저작권법 제91조–98조, with case law) make
  unlicensed extraction indefensible for a distributed product. The MOE
  curriculum tiers in the level taxonomy are the recognized-ladder substitute.
- Live Wiktionary API fallback (offline-first is the point)
- Anything requiring network permissions or data collection
