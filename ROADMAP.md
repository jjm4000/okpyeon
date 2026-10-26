# Roadmap

Working list of planned changes. Ordering within a release is not priority
order. The next store upload ships whatever is merged and verified when the
current review clears.

## Since 1.4: merged on main, not yet released

- **Native words on by default.** With native words off, 2.5% of the
  frequent subtitle token mass answered with a hanja fragment from
  inside a native word (이야기 showed 夜氣, 그대로 大路). Settings v2
  turns them on; one setting still turns them off.

- **A verb form plus 거야 is that verb.** 할거야, 않을거야 and 하는거야
  showed 去夜 (last night), the hanja word inside 거야. A verb's modifier
  form plus the bound noun 거, 것, 건, 걸 or 게 now opens the verb, with
  the note "할거야 → form of 하다". The same round added the ㄴ가 question
  ending (아닌가요), 얘기해 as a form of 이야기하다, and more copula
  endings and particles (사실이라면 is 事實 alone, 나에겐 is 나). Measured
  on the subtitle tokens: a mid-word fragment alone for 0.51% of the
  token mass, down from 0.91%.

- **Names and loanwords the dictionary lacks answer nothing.** 프랭크
  (Frank) showed 랭크 (rank), 브라이언 (Brian) 俚言, 엘리자베스 利子. A run
  holding a syllable that only loanwords use (스, 트, 크, 프 and 51
  more), where the words found leave that syllable or the run's start
  unexplained, now shows no card instead of a wrong one. Compounds such
  as 버스정류장 keep their words. Measured: 113 frequent subtitle tokens
  changed, all from a fragment to nothing, and the fragment share fell
  to 0.41%.

- **Particles and contractions.** With native words on, a one-syllable
  noun before a particle found nothing (집에, 돈을, 것을, 너도), nor did a
  contraction (그건, 거예요, 니가, 뭐야), and particles hid false matches
  (엄마한테 showed 馬韓, ancient Mahan; 일이에요 showed 一二). A second
  pass after the headword and verb-form claims now strips the particle or
  expands the contraction and answers with the word underneath. Measured
  on the 20,000 most frequent subtitle tokens: nothing found for 4.95% of
  the token mass, down from 10.65%.

- **Component words of three-character words.** 大學生's component row
  read 學生 and 韓國語's read 國語: a tie between the two possible splits
  always went to a bare first character. It now goes to the word plus a
  suffix, unless the first character is a bound prefix (不可能, 無關心),
  which agrees with Wiktionary's etymologies on 128 of 144 tied words
  instead of 25. Found by the harness change below.
- **The test pages run the real lookup code.** Their fake worker used to
  re-implement every lookup rule by hand, so each feature was written
  twice. The fixture is now one shared file that answers through the
  shipped lookup.js and background.js (860 lines of copies gone), which
  is how the component-word bug surfaced.

- **Readings follow the card; school characters get their 훈음.**
  Selecting 데 listed 大 待 臺 袋, because characters' reading lists
  carried vowel-merger spellings their cards never show (大 데, 色 섹,
  冊 첵). Those left the lists; word-initial forms (令 영, 年 연) stay.
  And 401 school-level characters had no eumhun at all (互 showed only
  호): Korean Wiktionary's 1,800-character appendix now supplies it, 407
  characters filled, the sound agreeing with existing data on 1,390 of
  1,391. Found in the cleanup survey of 2026-10-24.

- **Mandarin readings on character cards, corrected.** The Mandarin line
  paired readings with the card's Korean readings by phonetic scoring
  alone, which cannot tell dà from dài under 대, so 大 showed dài
  first, 和 huó, 傳 zhuàn, 其 jī, 校 jiào. Found while measuring
  word-level readings (2026-10-24). Mandarin now has the compound bridge
  Japanese always had: English Wiktionary's Chinese entries (128,031
  words with a Mandarin reading) are split per character, and the
  Sino-Korean words they attest vote on the pairing. 71 characters are
  repaired, 36 school-level ones change their first reading, and a
  dialect reading the card never shows (大's 데) can no longer take a
  pairing. Curated overrides still win; every existing anchor holds.
  New source: the kaikki Chinese dump, 1.2 GB, pinned in the cache.

- **Word-level Japanese and Mandarin readings.** Word cards get the
  character cards' JP · CN line (mockup A): 學校 がっこう · xuéxiào. Both
  languages are attested, never synthesized: aligning per-character
  readings, the original plan, was wrong 8 to 9% of the time. Mandarin
  comes from English Wiktionary's Chinese entries, Japanese from JMdict
  (which reading is everyday) plus English Wiktionary (Sino readings
  JMdict lacks). Japanese shows the everyday reading first with the
  Sino one in parentheses when they differ (明日 あした (みょうにち)),
  Jesse's call after first choosing Sino first. 19,484 of 27,620 words
  carry a reading; Korean-only words (代身) correctly get none. Same
  toggles and markers as the character line; nested word cards (a
  hybrid's 加工) carry it too.

## 1.4: packaged, not yet uploaded

The manifest reads 1.4.0; the packages are okpyeon-1.4.0.zip (Chrome)
and okpyeon-firefox-1.4.0.zip (Firefox, its first release), built
2026-10-14 from the commit tagged v1.4.0. The listing counts were
re-verified (two native-word counts moved) and both screenshot sets
retaken (two Korean shots changed). Firefox: submitted to
addons.mozilla.org on 2026-10-14 as a listed add-on, with the source
archive okpyeon-source-1.4.0.zip (tracked files as on disk, so a
rebuild with make_firefox.py is byte-identical to the package);
awaiting review. Chrome: okpyeon-1.4.0.zip uploaded 2026-10-15 with
both listings' counts edited and the changed Korean screenshot
replaced; awaiting review.

- **Korean Wiktionary glosses for characters.** Spike 2026-09-05: the
  cached ko-wiktionary dump is not a 훈음 table, but its 한자 section
  glosses 3,231 of our characters in Korean ("눕다.", "수은."). Where
  우리말샘 has no sense, ko.json's chars lane now takes those glosses
  (cap two, pointer glosses dropped): glossed characters 1,795 to
  3,983, and 1,556 characters that fell back to English under 한국어
  now read Korean. No hun is synthesized from a gloss (the adnominal
  conversion and its irregulars are a separate risk the card does not
  need). Residue with neither hun nor gloss: 4,471, nearly all rare.
  Needs a 1.3.1 package to reach users; the listing counts in
  store-listing.md already describe this build.

- **Place names and origin markers.** 서울 had no card in any
  language; foreign places in hangul likewise. native.json gains 604
  hangul-only place names (pos name, chip Place / 지명) from the
  Wiktionary extract, attested by a 우리말샘 지명 sense or the subtitle
  list, with hanja-spelled places, native homographs (나라, 파리),
  inflected forms (지난), and a subtitle-count cap (가자) keeping the
  lane clean, plus a four-word exclusion list (빠리 미러 순이 자이).
  573 of them get Korean definitions and the 우리말샘 link. The NATIVE
  marker used to mean "not hanja" and labelled 런던 and 가드 native;
  every non-hanja card now carries its actual origin from 우리말샘's
  word type or Wiktionary's etymology: NATIVE / 고유어, LOAN / 외래어,
  HYBRID / 혼종어 (user-decided: a hybrid like 가공되다 has a hanja root
  the card cannot otherwise show), and no marker when unknown (2,314
  rows). Follow-up recorded: show a hybrid's hanja part (加工 + 되다).

- **Whole-word native precedence and hybrid parts.** Typing 가공되다
  showed the 加工 card and a 되다 card and never the word itself: the
  Sino resolver owned any span it resolved. A native headword matching
  the whole input now leads and the split is not rendered; a hybrid
  card shows its mixed-script spelling (加工되다) and component chips
  that open the hanja word and the native part (mockup C, user-picked
  over head-spelling-only and chips-only). Parts come from 우리말샘's
  origin segments, or from Wiktionary's mixed form. Two gaps the work
  exposed and closed: 528 everyday words tagged only with a mixed
  hanja-hangul form (전혀, 별로, 특히, 선생님, 필요하다, 정말) had no card
  in either file because the native gate read any hanja tag as
  Sino-Korean; they now join native.json as hybrids. And a hangul key
  with several 우리말샘 homographs took the first (연습하다 wore 沿襲);
  it now takes the dominant one by words.json frequency for both the
  parts and the Korean definition (1,537 keys re-pointed). Hybrids
  with parts: 3,117 of 3,847. Suites: node 219, index.html 716,
  embed.html 395, build verify 122.

- **Deconjugation.** Native verbs and adjectives were reachable only
  in dictionary form: a selected 먹었어 found nothing and 공부했어 found
  the 工夫 split. 31.6% of the frequent subtitle tokens the dictionary
  could not reach were such forms. A pure generator
  (extension/deconjugate.js) strips endings under a layer grammar and
  reverses the fused vowels and irregular stems, and native.json is the
  only gate: 99.90% of the 335,835 form-lemma pairs in Wiktionary's
  conjugation tables resolve, pinned as a node test with a 99.5% floor.
  The lemma's ordinary card renders with a one-line note above the head
  ("먹었어 → form of 먹다", "먹다의 활용형"), mockup A, user-picked over
  the surface in the head and over naming the grammar (a Later item).
  Romanized input gets it through parity (mushihaesseo resolves to
  무시하다). Decided on measurement: a form that is also a dictionary
  word does not deconjugate (7.7% of hanja keys would otherwise grow
  lemma cards: 남자, 여자, 전화, 사실), except when every hanja spelling is
  rare. Ambiguous forms (사는: 살다, 사다) render one card each, ordered
  by a new frequency bucket on verb lemmas summed from their forms'
  subtitle counts. Side find: Wiktionary lists inflected forms as their
  own entries (있어 "present tense form of 있다", 사는 "topic-marked form
  of 사", 빨간 "realis adnominal of 빨갛다"); 49 such headwords left
  native.json, since each blocked the lemma card it pointed at. The
  design record is deconjugation-kickoff.md.

- **Hybrid card depth.** The hybrid card (전쟁하다) stopped at its head,
  gloss and two part rows while the hanja word card beside it nested
  component cards with compounds. Mockup A, user-picked as the most
  consistent with the design: a COMPONENT WORDS section nests the hanja
  word's full card (head with star and link, character chips, Used-in,
  its own COMPONENT HANJA cards) and the native part's card, the way a
  word card nests its characters. Each hybrid part carries a
  sub-lookup on the wire, the unflagged lookup of its hanja put
  through the same attach pipeline, so the nested card is exactly the
  card a direct lookup gives, Korean definitions included. Depth is
  bounded by construction (sub-lookups are unflagged, so never contain
  a hybrid). Same round: the head's hanja part became a nav chip (blue
  text must be clickable) and the part rows, now the fallback for
  parts the tables lack, carry glosses.

- **Firefox package, and "Korean" in the English name.** One source
  tree; pipeline/make_firefox.py generates the Firefox package by
  rewriting only the manifest (background script instead of a service
  worker, sidebar_action instead of the side panel, the add-on id and a
  data-collection declaration of none). The worker gains a Firefox
  branch for the toolbar button and omnibox Enter, behind feature
  checks, with the search tab as the fallback if Firefox refuses the
  omnibox gesture. Mozilla's linter refused ko.json (over its 5 MB text
  limit), so the natives table moved to ko-natives.json in both
  packages. Lint is clean apart from the guarded Chrome side-panel
  calls, and the package installs in Firefox. Jesse's smoke test in
  Firefox passed (popup, sidebar from the toolbar, omnibox Enter opening
  the sidebar, Korean mode); saved words across a restart wait for the
  first signed install. The English name becomes
  "Okpyeon: Korean Hanja Popup Dictionary" so the word Korean is in the
  title store search reads (Jesse, 2026-10-14); the Korean name is
  unchanged. Ships with the next release on both stores. Side find: the
  build's downloader spliced three cached dumps when kaikki published
  new ones; fixed, recovered, and recorded in pipeline/README.md.

## 1.3: shipped

Everything since the v1.2.0 tag went out as one release, uploaded
2026-09-01 with the English listing in Jesse's edit, the Korean listing
under 한국어, five screenshots per language, and bilingual promo tiles.
The manifest reads 1.3.0, the zip built as okpyeon-1.3.0.zip, and the
v1.3.0 tag marks the release commit. Built with Jesse across 2026-09-01; the SPEC's Korean
language mode, Phonetic components, Rare and lessCommon, and Glyph
aliases addenda hold the contracts. Suites at release: node 209,
index.html 691, embed.html 386, build verify 89, both screenshot sets
green. Dashboard steps at upload: package first (the listing's language
dropdown appears only for locales the uploaded package declares), then
the Korean detailed description and screenshots/ko under 한국어.

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
- **Korean language mode.** Built 2026-09-01 in three waves against the
  SPEC's "Korean language mode" addendum. One Language setting (English
  / 한국어, defaulting once from the browser language) switches the
  whole chrome AND the definitions. Chrome: every user-facing string
  renders through one lookup against _locales/en and _locales/ko message
  tables (159 keys; 짜임, 소리, 단어, 구성 한자, 같은 소리, 중학 /
  고등 / 고급 / 희귀, 일 / 중), served by the worker and carried
  built-in for English so the first render never waits; the manifest
  name and description follow the browser through __MSG_ keys, which is
  what unlocks the Korean store listing. Definitions: ko.json (5.9 MB,
  loaded only under 한국어) holds Urimalsaem senses for 25,510 Sino
  words (92.3%), 12,071 native rows, and 1,795 characters, matched in
  two lanes (hanja string; hangul plus POS), filtered to ordinary senses
  with place names surviving on otherwise-empty keys, 韓國 curated, and
  a Unihan glyph-form hop rescuing 146 keys like 映畵. Word cards
  replace English with numbered Korean senses and link 우리말샘 to the
  exact sense; char cards show the Korean gloss, else the hun alone,
  else English under a 한국어 없음 marker; rows show the first sense;
  exports follow the language; a Korean first run names its default
  folder 저장됨. English rendering is pinned byte-identical to pre-port
  snapshots. Rejected on the way: separate chrome/definitions controls,
  a boolean mode toggle, follow-the-browser with no row, an EN fallback
  marker. Suites: node 202, index.html 668, embed.html 365. Still to do
  before release: the Korean store listing text, screenshot scenes for
  the Korean UI (7-settings needs a taller solo viewport; 5-sidebar is
  stale from the phonetic pins), and a README paragraph.
- **Rare and lessCommon.** User rule: rare shows up only when a
  spelling is actually rare, not when it is less common than a native
  word. The one flag that did both jobs is now two: `rare` (the old
  unattested test plus fewer than two other Urimalsaem headwords using
  the spelling) keeps the marker, the grey rows, and the "obscure"
  banner; `lessCommon` (attested, but the hangul usually means
  something else) keeps only the ordering job, a truthful banner
  ("Usually the native word. This hanja spelling is a homograph."), and
  a hover tooltip. 2,263 sense-sets stay rare, 1,426 become lessCommon
  (肝臟, 假裝, 舍廊 among them); character levels unchanged. Rejected:
  Urimalsaem presence alone as the attestation test (unflags 佳芳 and
  牙旗 too, a 1.2M-entry dictionary contains everything), a single
  narrow flag (舍廊 would lead for 사랑), and a tuned higher bar. The
  name lessCommon was picked over shadowed, minor, secondary.
- **Glyph aliases.** User-raised: 黃 and 黄 were separate cards, the
  Japanese-form twin empty, because Wiktionary gives both a Korean
  entry and the variants build never shadows a character with one. A
  narrow exception folds 54 shinjitai and new-form twins (対, 説, 黄,
  変, 状, 処, 労, 当, 歩, 県, 宝 …) into their Korean-standard
  character when a jōyō old/new pair or Unihan kZVariant joins them,
  readings match, one side carries the vocabulary, and the folded side
  is neither a financial numeral nor a curriculum character (余 stays
  beside 餘). hanja.json 9,469 to 9,415; selecting 黄 opens 黃 with the
  variant note, as 学 opens 學. Rejected: Unihan semantic-variant links
  as a source (746 pairs including 面/麵 and 後/后, distinct
  characters). Balanced pairs like 晚/晩 stay separate.
- **Headless self-check runner.** `python pipeline/run_selfchecks.py`
  runs both test pages headless over the CDP client now shared with the
  screenshot tool (pipeline/cdp.py) and reports per-check results. It
  replaced the Browser pane as the way to run the suites, which also
  ended the stray Save dialogs. Its first run exposed three breadcrumb
  checks that had never passed here (the panel clamps at 280px, the
  checks assumed 210); they now descend six levels so the trail really
  overflows.

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
  Known gap by design at the time: no deconjugation, so native
  verbs/adjectives were reachable from typed search and exact-form
  selection only (closed on main after 1.3, see Since 1.3).
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

- **Grammar labels on the form note.** Deconjugation itself is done
  (Since 1.3). Mockup C from that round: "먹었어 → form of 먹다 ·
  past, casual" (한국어 "과거, 해체").
  Deferred because the labels are a taxonomy in two languages, not a
  lookup: every ending needs an English and a Korean name, stacked
  endings need an ordering rule, and the Korean side uses grammarians'
  terms native speakers may not want. Once the resolver has run for a
  while, a label table keyed on the endings actually stripped can be
  scored against Wiktionary's tags in the same pinned test as recall,
  and the note line already has the slot. A settings toggle was
  considered and rejected: it would not lower the cost of the table.
- **What the second pass leaves.** The particle and contraction pass
  and the bound-noun claim shipped (see Since 1.4). Still unresolved:
  verbs with a helper verb written without a space (살아있는, 들어봐요,
  보여주고 finds 驪州, 말해주지 海州; 왔다갔다), one-syllable hanja nouns
  before a particle (전에, 문을, 차를), the bound noun 리 (그럴리가),
  which names like 빌리가 make unsafe, and names spelled with Sino
  syllables only (헤일리 finds 一理, 라이언 俚言).
- **Keyboard shortcut for the current selection** (Chrome's commands
  API) and **per-site disable**: one settings row each plus a little
  glue, and both come up in extension reviews constantly.
- **Recent lookups** in the sidebar's empty search state, where today
  there is only a hint sentence. Every dictionary app has it.
- **Hun synthesis from Korean glosses.** About 4,470 characters still
  have neither a hun nor a Korean gloss after the Korean Wiktionary
  fill, and many of the filled ones show a gloss ("눕다.") rather than a
  proper hun ("누울 와"). Turning a dictionary-form gloss into an
  adnominal hun needs the conjugation table with its irregulars (ㅂ,
  ㄹ, ㅅ), so it waits on the same machinery as deconjugation.
- **Two small open calls**, either way is fine: whether a populated
  folder under its own filter shows its band (as now) or the old flat
  list; and whether words on the not-rare override list should keep
  leading over the native homograph now that lessCommon handles the
  marker (today they do).
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

## Design records

Decision trails for shipped features, kept so the reasoning is not
relitigated. The kickoff files hold the full spikes; these are the
short forms.

- **Korean language mode** (shipped in 1.3). Settled by mockups: one
  Language control (English / 한국어) that switches the whole chrome AND
  the definitions, defaulting to the browser language on first run; Korean definitions replace English on word cards; char
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
- **Place names and origin markers** (on main since 1.3): mockups
  settled NATIVE / LOAN / HYBRID markers with the hybrid marked at
  Jesse's insistence; the exclusion list and the 지명 attestation rule
  are in the SPEC addendum of 2026-09-05.
- **Deconjugation** (on main since 1.3): deconjugation-kickoff.md is
  the record (need measured from subtitles, Wiktionary tables as
  ground truth, the generator's two passes, mockup A over B and C, the
  form-that-is-also-a-word reversal, the inflected-stub cleanup).
- **Hybrid card depth** (on main since 1.3): mockup A (nest the hanja
  word's full card and the native part's card under COMPONENT WORDS)
  picked over B (the hanja word card's shape plus a word row) and C
  (rows kept, root's body under them) as the most consistent with how
  a word card nests its characters. B had been the recommendation for
  cost; A won on shape.

- **Word-level readings** (on main since 1.4): mockup A over B (inline
  in the head) and C (per character, ruby style). The roadmap's plan of
  aligning per-character readings measured wrong 8 to 9% of the time,
  so both languages are attested-only; pipeline/spike_word_readings.py
  is the record. Japanese order: Sino first was chosen, then reversed
  the same day to the everyday reading first. Wiktionary cannot say
  which reading is everyday (it orders by etymology: 相對 lists あいたい
  first), so JMdict decides.

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
