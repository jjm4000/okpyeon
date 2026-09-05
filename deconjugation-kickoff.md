# Deconjugation: project file

Written 2026-09-05, the day the feature was scoped and its spike ran.
Read this before any work on the feature; ROADMAP.md's Later entry is
the condensed pointer and the two should move together.

## What the feature is

Native verbs and adjectives are reachable only in dictionary form. A
selected or typed 먹었어, 좋은, 있는, 됐어, 공부했어 finds nothing (or,
worse, a partial hanja split). Deconjugation maps an inflected surface
form to its lemma so the lemma's card renders: 먹었어 opens 먹다, 좋은
opens 좋다, 공부했어 opens the 공부하다 hybrid card. Jesse chose this as
the next feature over cutting a 1.4 release (2026-09-05).

## The need, measured

Top 20,000 subtitle tokens (ko_full_opensubtitles.txt): 16,259 are
unknown to both words.json and native.json, 54.9% of the token mass;
8,701 of them end like a verb form, 31.6% of the mass. The most
frequent: 있어요 있는 없어 좋아 하는 알아 없어요 괜찮아 알고 있습니다
알았어 않아 있지 같아 했어 맞아 돼요 가자 없는 많은 알아요 했어요
같아요 있고 됐어. Noun-plus-particle forms (당신은, 그는, 일을) are a
separate, smaller class the existing josa stripping partly covers.

## Ground truth: Wiktionary's conjugation tables

The cached Korean extract (pipeline/cache/kaikki-Korean.jsonl) carries a
`forms` array on 4,714 of native.json's 4,385 verb/adjective lemmas
(plus hybrids): 418,594 inflected forms, each tagged (past, polite,
formal, interrogative, imperative, hortative, conditional, causative,
contrastive, determiner, noun-from-verb, and so on), about 89 forms per
lemma. Distinct (surface, lemma) pairs: 336,686. This is a complete test
set for any deconjugator, and it is NOT the mechanism: shipping the
tables would be several MB and only ever covers listed lemmas. The
separate form-of entries (493 pairs, mostly dialect) are useless.

## Design: a generous generator gated by the dictionary

The romanized-search v2 principle applied to inflection: generate every
plausible lemma from a surface form (strip endings, reverse fused
vowels and irregular stems), then keep only candidates that are
native.json verb/adjective headwords (hybrids included, so 공부했어
resolves to 공부하다). No data shipped; correctness comes from the gate.

Prototype (session scratchpad, deconj-spike.py, logic summarised here):
1. Ending stripping, longest first, up to three passes so stacked
   endings resolve (셨어요 = 시 + 었 + 어요): sentence enders (습니다
   ㅂ니다 어요 아요 여요 어 아 여 지 지요 죠 네 네요 군요 자 라 세요),
   tense/mood infixes (었 았 였 겠 시 으시 셨), connectives (고 서 면
   으면 며 니 니까 려고 러 게 든 거나 다가 지만 는데 은데 더니), adnominal
   and nominal (는 은 ㄴ 을 ㄹ 던 기 음 ㅁ), plus the jamo-initial
   endings (ㄴ다 ㄹ까 ㅂ니다 ㅁ) matched as the coda of the preceding
   syllable.
2. Stem restoration on the syllable left behind: fused past (갔 -> 가,
   했 -> 하, 됐 -> 되, 봤 -> 보, 줬 -> 주); fused infinitive vowels
   (봐 -> 보, 줘 -> 주, 해 -> 하, 돼 -> 되, 써 -> 쓰, 켜 -> 키); 으-drop
   (바빠 -> 바쁘); ㅎ-irregular (그래 -> 그렇, 빨간 -> 빨갛); 르-irregular
   (몰라 -> 모르); ㅂ-irregular (더워 -> 덥, 도와 -> 돕); ㅅ-irregular
   (나아 -> 낫); ㄷ-irregular (들어 -> 듣); ㄹ-drop (사는 -> 살, 압니다 ->
   알); ㄹ-stems kept (살 -> 살다); honorific fusion (하세 -> 하, 셔 -> 시).
3. Every restored stem + 다, intersected with the lemma set.

Measured 2026-09-05 against the 336,686 pairs: recall 91.6%; among
hits, one candidate 91%, two 6%, three or more 3%. Misses cluster in
endings the list lacks, not in the rules: bare 요 / 서 / 야 after a
fused vowel (해요, 가서, 해야: the prototype only listed 어요/어서/어야),
the honorific fusion 으셔 / 셔 followed by another ending (읽으셔서,
하셔야), the 읍시오 / ㅂ시오 formal imperative, 거라 imperative, and a
handful of dialect alternatives (허다, 카다 for 하다) that should stay
misses. Expect the second pass to land well above 97%.

## Design questions still open (mockup material)

1. How a deconjugated match renders: the lemma's ordinary card with a
   small note ("먹었어 → 먹다"), or the tags too ("past, informal")? The
   Wiktionary tables give the tags for listed lemmas; the generator
   knows which ending it stripped, which is enough for a plain note.
2. Which surfaces: the selection popup, typed search, and romanized
   search all go through the same hangul resolver, so all three; the
   omnibox follows. Deconjugation runs only when the whole-string and
   Sino paths find nothing (or beside them for a same-length hanja
   match, the identity-group rule).
3. Ambiguity: several lemmas for one form (사 -> 사다 / 살다). Render the
   identity group with the lead rule, as native homographs do today.
4. Interaction with the whole-word native precedence rule
   (2026-09-05): a resolved lemma is a whole-word native match and
   leads; the Sino split of the lemma is not rendered.
5. Korean mode: the lemma's 우리말샘 definition rides the lemma card; a
   conjugated surface needs no definition of its own.
6. Length floor and false positives: single-syllable surfaces (가, 사,
   해) are the reading-browse channel today and must stay so; the
   floor is two syllables, and a form that is also a real noun (가자
   Gaza was excluded from places for this reason) is an identity
   group, not an error.

## Tests to build

- Node: the generator's recall against the Wiktionary tables as a
  pinned number (a floor the build must clear, like the romanization
  round trip), ambiguity distribution reported; the gate rejects
  non-lemmas; pure hanja, noun, and whole-word native inputs are
  byte-identical to today.
- Harness: 먹었어 opens 먹다 with the note; 좋은 opens 좋다; 공부했어
  opens the 공부하다 hybrid card; a surface that is also a noun renders
  the identity group; English snapshots unchanged.

## House-process pointers

SPEC-first (write the addendum from this file plus the mockup
decisions; the romanized search v2 addendum is the model for a
generator-plus-gate contract); the native-words and whole-word
precedence addenda hold the lookup rules this extends; measure before
deciding; fable subagents in file-disjoint waves (lookup.js and tests
versus content.js); headless suites only, never the Browser pane.

## Chronology

2026-09-05: Jesse chose deconjugation over a 1.4 release. Spike: the
need measured from subtitles, the Wiktionary tables found and counted,
the generator prototyped and measured at 91.6% recall with the misses
diagnosed. Compaction followed; nothing designed or built yet.
