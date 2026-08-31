# Roadmap

Working list of planned changes. Ordering within a release is not priority
order. The next store upload ships whatever is merged and verified when the
current review clears.

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
- Native Korean words (general dictionary mode). Unscheduled, but the
  design was settled by mockups with Jesse (2026-08-31); when it is
  scheduled, the SPEC section is written from these decisions:
  - One settings toggle, OFF by default. Off is byte-identical to today.
    Native entries live in their own lazily loaded native.json; the
    Sino lookup path never consults it. Data source is the already
    parsed Korean extract, so the build cost is a filter and an emit.
  - Sidebar search gains scope pills, "Hanja only" and "All words"
    (two, not three: a native-only scope reads as "the language" and
    All is a strict superset anyway). All words is the default and the
    scope resets to it whenever the panel opens (QA-adjusted
    2026-08-31: turning the toggle on IS choosing the wide dictionary,
    so Hanja only is the narrowing act); sticky within a panel
    session. Hanja-only scope renders exactly today's results, and
    when it hides native matches a quiet cross-scope hint row renders
    after the results; tapping it switches scope for that query.
    Never an auto-switch, and the hint exists only on the Hanja side.
  - The selection popup IS affected when the toggle is on: it renders
    the same identity group as the All words scope. Its one special
    rule is the default identity: best non-rare hanja spelling, else
    native, else the rare hanja. So 無理 and 家長 still lead, 사랑
    leads with the native card, and a native-only selection (하늘),
    which today shows nothing, renders the full native card.
  - Cross-identity links are a "Same sound" card section: nav rows in
    the used-in row's position, pointing both ways (hanja card to the
    native homograph, native card to the hanja homographs, rare ones
    muted). Tapping pushes the other card as its own view with a
    breadcrumb, like every other cross-entity link. The spelling chip
    row is UNTOUCHED: hanja spellings only, same population as today.
    Decided for consistency and no special cases over the rejected
    alternatives: native as a fifth chip (mixes "spellings of this
    word" with "a different word that sounds the same", and grows chip
    rows on cards that are chip-less today), whisper cards, disclosure
    rows, a separate sidebar tab, and a whole-panel mode switch.
  - The rare-homograph hedge banner retires wherever a native entry
    exists: the native card leading with the muted rare row states
    what the banner used to guess. The banner survives only with the
    toggle off, or for hangul our native data does not cover.
  - The native card is headword, part of speech, a NATIVE marker,
    glosses, and the Same sound section. A derived-words section
    (사랑하다 under 사랑) needs a derivation-link build step that does
    not exist yet; v1 may ship without it.
  - Saved words need a native key namespace before native cards get a
    star; v1 may omit the star from native cards instead.
  - Pill wording (decided): "All words" then "Hanja only", default first;
    tooltips carry
    the precision ("Sino-Korean entries, as before" / "includes native
    Korean words").
  - Omnibox (decided): with the toggle on, the omnibox IS the All
    words search, remote. Suggestions draw from the All-scope result
    set (native entries marked, non-rare first); picking a suggestion
    deep-links to that card (a literal lookup, no scope involved); raw
    enter opens the panel with the query IN All words scope. The
    Hanja-default reset governs fresh panel opens only; an
    omnibox-handed query carries its scope explicitly, so nothing
    auto-switches. Toggle off: omnibox unchanged.
  - Size (decided, measured 2026-08-31): no frequency cutoff. Quality
    filters are the bar (real gloss, no alt-of/form-of stubs, content
    POS, hangul-only): 16,331 lemmas, about 1.63 MB emitted, smaller
    than words.json. A frequency cutoff was rejected because the
    subtitle corpus counts conjugated surface forms, so rank-cutting
    would gut verbs and adjectives while sparing nouns.
  - Known gap, not a blocker: the 3,072 verbs and 1,101 adjectives are
    mostly unreachable from SELECTION without deconjugation (selecting
    사랑스러운 cannot find 사랑스럽다; josa stripping does not cover
    conjugation). Typed search reaches everything. Deconjugation is
    its own future item, possibly seedable from the kaikki `forms`
    arrays.
- Japanese and Chinese pronunciations on character cards, as an option
  (Unihan kMandarin / kJapaneseOn / kJapaneseKun: data is nearly free, but
  whether cross-language readings belong in a Korean-first tool is uncertain;
  would ride the options page whenever it exists)
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
