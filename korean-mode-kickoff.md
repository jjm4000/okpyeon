# Korean-language descriptions: project file

Written 2026-09-01, the day the feature was scoped and both spikes ran.
This is the detailed record behind ROADMAP.md's condensed entry, meant
to be read before any work starts on the feature. The roadmap entry and
this file should move together if either changes.

## What the feature is

A settings option that serves Korean-language definitions instead of
(or beside) the current English ones, aimed at the Korean home market:
people in Korea learning hanja, for whom English glosses are the
barrier and partly just clutter. Status: fully de-risked by two
measurement spikes, design not yet started. Sequencing decision:
mockups first, and preferably after the 1.2 store review clears.

## The product framing (decided with Jesse)

The feature is addition AND subtraction:

- Addition: Korean definitions on word cards, native cards, and where
  possible char cards.
- Subtraction: the English gloss on a word card explains 국민 to
  someone who natively knows 국민. A Korean mode wants English
  de-emphasized or gone on word cards.
- BUT hide-English alone is NOT viable for char cards: roughly 6,100
  of 9,469 chars carry English as their ONLY meaning text (most chars
  have no eumhun hun). Two counts exist: the first spike computed
  6,146 by an "only meaning text" criterion; the second spike's
  no-eumhun proxy gives 6,735. Reconcile the criterion when building.
  Consequence: the design needs eumhun backfill for chars, or keeps
  English as the char-card fallback.

## Source decision: Urimalsaem (우리말샘)

The corpus is Urimalsaem, the National Institute of Korean Language's
open dictionary (opendict.korean.go.kr), 1,204,559 sense entries,
roughly 982k distinct headwords, CC BY-SA 2.0 KR since 2019-03-11.

How we get it: the OFFICIAL bulk download requires an account whose
signup demands Korean-carrier phone verification, which Jesse cannot
pass. The data is legitimately re-hosted (CC BY-SA permits it) by the
Korean spellchecker community at
github.com/spellcheck-ko/korean-dict-nikl, directory `opendict/`,
25 XML files named 0050000.xml .. (24 at ~77 MB plus a 6 MB tail),
1.73 GiB total, 50k entries per chunk, alphabetically ordered. The
repo was refreshed 2026-08-31. Raw URL pattern:
https://raw.githubusercontent.com/spellcheck-ko/korean-dict-nikl/master/opendict/0050000.xml
Verification that the mirror is the real thing: the XML matches NIKL's
publicly documented schema field for field, every entry's `link`
points back to opendict.korean.go.kr, and the counts match Urimalsaem's
published scale. Attribution names NIKL/우리말샘; the mirror is
provenance only.

ko-wiktionary (kaikki, cached as
pipeline/cache/kowiktionary-raw-wiktextract-data.jsonl.gz, 24.6 MB)
was spike 1's candidate and is now reference material only: good prose
but coverage collapses on the tail (85% of f<=5 words by loose hangul
match, 14% on the untagged tail), essentially no individual-hanja
glosses, and hangul-only matching contaminates homographs.

## The XML format (verified on 150k sampled entries)

- Each `<item>` is one SENSE, not one headword (`sense_no`; ~81.5% of
  items are distinct headwords).
- Headword: `wordInfo/word`. Carries markup to strip: `-` affix
  boundary, `^` compound spacing.
- Hanja origin: `wordInfo/original_language_info` with
  `original_language` + `language_type` pairs per etymological
  segment. language_type distribution in one chunk: 한자 108,314,
  고유어 23,662, 영어 20,736, 안 밝힘 4,336. Dual-notation origins
  join alternatives with `/` under a `/(병기)` language_type
  (가야 = 伽倻/伽耶): SPLIT the alternatives or lose those matches
  (the spike's parser skipped them; several "misses" were this).
- Definition: `senseInfo/definition` (non-empty on all 150k sampled).
  `definition_original` is a near-duplicate.
- Sense metadata for filtering: `pos`, `type` (일반어 vs 방언 vs
  옛말 etc.), `cat_info`.
- License carve-outs are SEPARABLE SUBTREES: `senseInfo/example_info`
  (example sentences, NOT open source per the license note) and
  `multimedia_info` (media, same). Drop both at parse time; one-line
  filter, the definitions themselves are clean CC BY-SA.

## Measured coverage (sampled chunks 0050000, 0600000, 1150000)

- Sino words: matching on the exact hanja-origin string against
  words.json keys (NFC; variants canonicalization added only 0.5%,
  our keys are already canonical). In-range hit rate: 92.2% of
  words.json keys whose hangul falls in the sampled alphabet slices
  (3,202 of 3,473). Nearly flat by frequency: f1-f3 100%, f4 91%,
  f5 96%, f6 97%, f7 96%, f8 95%, f9 94%, untagged 87%. Extrapolates
  to ~25,500 of 27,627 keys. Known genuine miss: 거란 (契丹), which
  Urimalsaem carries with no original_language_info.
- Native words: 고유어 entries all carry definitions; our native.json
  headwords are well covered; many 고유어 entries are dialect
  pointers, so prefer 일반어-type senses.
- Chars: single-syllable headwords with one-char hanja origins gloss
  individual characters in Korean (枷, 街 samples were real);
  extrapolated ~2,100 distinct chars corpus-wide, 259 of 265 sampled
  are in hanja.json. Softens but does not fill the char hole.
- Debris to filter: proper-noun and encyclopedic senses sharing a
  headword with the ordinary sense (가면 the 1925 magazine beside
  假面 the mask; 강산 a village beside 江山), dialect/archaic senses,
  ~0.4% cross-reference stubs.

## THE TWO-LANE MATCHING RULE (user-raised, binding)

Since native words shipped in 1.2, identities are first-class: 우리
the pronoun is a native.json citizen, 牛李 a words.json citizen, and
native homographs exist too (우리 the pronoun beside 우리 the animal
pen). So Urimalsaem senses route in two lanes:

- Hanja-origin entries -> words.json keys, matched on the hanja
  string. Homograph contamination impossible by construction.
- 고유어 entries -> native.json headwords, matched on (hangul, POS),
  both sides carry pos; plus the 일반어 sense filter.

Each identity's card gets its own definitions. The Same sound /
identity model from the native-words feature is the chassis; Korean
definitions attach per identity, never per hangul string.

## Build architecture (recommended by the spike, adopt unless design
changes it)

- One-time fetch of the 25 chunks into pipeline/cache/, stored gzipped
  (gzip -6 takes 77 MB to 8 MB; whole corpus ~195 MB in cache; python
  gzip.open + iterparse reads it directly). Transfer measured ~40 MB/s
  from raw.githubusercontent.
- A PREPROCESS step (not per-build): parse all chunks (~27 s pure
  parse), strip example_info and multimedia_info, split 병기
  alternatives, filter senses by type/pos, emit a small intermediate
  JSON in the cache keyed the way build.py wants (hanja key -> Korean
  senses; native (hangul,pos) -> senses; char -> gloss). Normal builds
  consume only the intermediate, near-zero cost. Reparse only when the
  mirror updates.
- Emitted runtime payload: Korean defs for ~25k Sino words + native +
  chars, cap 2-3 short defs per entry, order ~1 MB raw, well under
  0.5 MB gzipped. Own lazy file per the native.json/sino.json pattern,
  loaded behind the toggle flag only.

## Design questions still open (mockup material)

1. Replace or accompany: Korean defs instead of English, or above it,
   or a per-card reveal? (The subtraction argument says replace on
   word cards; chars may need English fallback anyway.)
2. Char cards: Urimalsaem gloss where present (~2,100), then what:
   eumhun-as-gloss, English fallback, or backfilled hun?
3. UI chrome: do COMPOUNDS / Made of / Same sound / settings copy
   localize too, or stay English in v1? (Korean UI is a bigger lift;
   could be a second phase. The Korean store listing on the roadmap
   is the distribution companion either way.)
4. Settings shape: one toggle ("한국어 정의"?) or a definitions-
   language control that could grow. Where it lives (Search group?
   its own?). Copy in which language?
5. Sense selection: how many defs per card, ordering (일반어 first,
   sense_no order), stub suppression.
6. Coverage honesty: what renders for the ~8% of words with no Korean
   def when the toggle is on (English fallback presumably; never a
   blank card).

## House-process pointers for the build

- SPEC-first: write the addendum from this file plus the mockup
  decisions; the native-words and sino-readings addenda are the
  models.
- Reuse by name: the lazy per-file cache + client-set flag pattern
  (native.json, sino.json), the guard-SPREADS-fields-through lesson
  (guardSino's comment explains why; add the drive-through-the-guard
  node test), one section function one call site behind a predicate,
  settings schema rows, the set= screenshot seeding param, byte-
  identical-when-off as a harness check.
- Spike scripts (temp, session-bound, logic summarized above):
  ko-spike-*.py and uri-spike-*.py in the session scratchpads; the
  sampled chunks live in pipeline/cache/urimalsaem/ with
  uri-spike-results.json beside them.

## Chronology, for context

2026-09-01: Jesse proposed the feature (Korean users as an untapped
market). Spike 1 measured ko-wiktionary and established the
subtraction finding and Urimalsaem's superiority. Jesse decided
Urimalsaem; the official signup demanded a Korean phone; the
spellcheck-ko mirror dissolved the gate the same day. Spike 2 verified
the corpus. Jesse raised the 우리-pronoun point that produced the
two-lane rule. Everything above was decided that day; nothing has
been designed or built.
