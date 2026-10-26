/**
 * Hanja Hover — pure lookup logic.
 *
 * This module deliberately contains NO chrome.* API usage so that it can be
 * imported and unit-tested in plain Node (see test/lookup.test.mjs).
 * All chrome glue lives in background.js.
 *
 * Implements SPEC.md "Service worker behavior" rules 1-4 (including 3b).
 */

import { qwertyToHangul } from "./dubeolsik.js";
import { deromanize } from "./deromanize.js";
import { deconjugate } from "./deconjugate.js";

/** Rule 1: cap the input at 20 relevant (Han + Hangul) characters. */
export const MAX_RELEVANT_CHARS = 20;
/**
 * Rule 3: greedy longest-match over Han runs. FALLBACK ONLY — the real cap is
 * words.json's `maxWordLen` (the longest key actually shipped, currently 11:
 * 後天性免疫缺乏症候群). This 6 is what a bundle without the metadata gets, and
 * what the old hardcoded behavior was.
 */
export const MAX_WORD_LEN = 6;
/** words.json only contains hanja spellings of length >= 2. */
export const MIN_WORD_LEN = 2;
/** Rule 3b: hangul spans shorter than 2 syllables are skipped. */
export const MIN_HANGUL_WORD_LEN = 2;
/**
 * Rule 3b: hangul spans. FALLBACK ONLY, same rule as MAX_WORD_LEN — the real
 * cap is words.json's `maxHangulLen`.
 */
export const MAX_HANGUL_WORD_LEN = 6;

/**
 * Length metadata ADDENDUM: read a segmentation cap off words.json, falling
 * back to the documented constant when the bundle predates the field (old
 * fixtures, placeholder data).
 */
function lenMeta(value, fallback) {
  return Number.isInteger(value) && value >= MIN_WORD_LEN ? value : fallback;
}

/** Rule 3 cap for a given words.json object. */
export function maxWordLenOf(words) {
  return lenMeta(words && words.maxWordLen, MAX_WORD_LEN);
}

/** Rule 3b cap for a given words.json object. */
export function maxHangulLenOf(words) {
  return lenMeta(words && words.maxHangulLen, MAX_HANGUL_WORD_LEN);
}

/**
 * Native words ADDENDUM: fallback for native.json's `maxLen`, same rule as
 * MAX_WORD_LEN: the real cap is whatever the emitted file declares.
 */
export const MAX_NATIVE_WORD_LEN = 5;

/** Native longest-match cap for a given native.json object. */
export function nativeMaxLenOf(native) {
  return lenMeta(native && native.maxLen, MAX_NATIVE_WORD_LEN);
}

/**
 * Origin markers ADDENDUM: the three origin classes a native.json entry may
 * declare. Anything else reads as unknown, and an unknown origin is carried
 * nowhere: no field on the match, no marker on any surface.
 */
export const NATIVE_ORIGINS = Object.freeze(["native", "loan", "hybrid"]);

/** The entry's origin when it is one of the three classes, else null. */
export function nativeOriginOf(entry) {
  const origin = entry && typeof entry === "object" ? entry.origin : undefined;
  return typeof origin === "string" && NATIVE_ORIGINS.includes(origin) ? origin : null;
}
/** Word-parts addendum: sub-word glosses are capped at 2 (first sense). */
export const MAX_PART_GLOSSES = 2;
/**
 * Rule 3: when the selection contains <= 4 *Han* characters, characters that
 * only appeared inside a Han word match still get their own char card.
 * Hangul and other scripts do NOT count toward this threshold, so a selection
 * like 國民이라는 (2 Han + 3 hangul) still yields the 國/民 cards.
 */
export const CHAR_CARD_SELECTION_LIMIT = 4;

/** lvl ADDENDUM: the four character levels, curriculum first, then usage. */
export const LEVELS = ["m", "h", "a", "r"];

/** True for a valid `lvl` value. */
export function isLevel(v) {
  return v === "m" || v === "h" || v === "a" || v === "r";
}

const HAN_CHAR = /\p{Script=Han}/u;
const HANGUL_CHAR = /\p{Script=Hangul}/u;

const hasOwn = (obj, key) =>
  obj != null && Object.prototype.hasOwnProperty.call(obj, key);

/** True for a single Han code point (string of length 1 or a surrogate pair). */
export function isHan(ch) {
  return typeof ch === "string" && ch.length > 0 && HAN_CHAR.test(ch);
}

/** True for a single Hangul code point (syllable or jamo). */
export function isHangul(ch) {
  return typeof ch === "string" && ch.length > 0 && HANGUL_CHAR.test(ch);
}

/** Rule 2: NFC normalization. Non-strings normalize to "". */
export function normalize(text) {
  return typeof text === "string" ? text.normalize("NFC") : "";
}

/**
 * Rule 1: NFC-normalize, then split into runs of contiguous same-script
 * characters, preserving order. Anything that is neither Han nor Hangul breaks
 * a run, and a script change also breaks a run, so segmentation never spans a
 * boundary (e.g. "國A民" cannot match the word 國民, and "國민" yields two runs).
 * The cap applies to the total number of relevant characters across all runs.
 *
 * @returns {Array<{script:"han"|"hangul", chars:string[]}>}
 */
export function extractRuns(text, cap = MAX_RELEVANT_CHARS) {
  const runs = [];
  let current = null;
  let taken = 0;
  for (const ch of normalize(text)) {
    if (taken >= cap) break;
    const script = isHan(ch) ? "han" : isHangul(ch) ? "hangul" : null;
    if (script === null) {
      current = null;
      continue;
    }
    if (current === null || current.script !== script) {
      current = { script, chars: [] };
      runs.push(current);
    }
    current.chars.push(ch);
    taken += 1;
  }
  return runs;
}

/** Rule 2: map one character through variants.map to its canonical form. */
export function toCanonical(ch, variantMap) {
  const mapped = hasOwn(variantMap, ch) ? variantMap[ch] : ch;
  return typeof mapped === "string" && mapped.length > 0 ? mapped : ch;
}

/**
 * Shared greedy longest-match segmentation core. Used three times: rule 3
 * (Han runs), rule 3b (Hangul runs) and the word-parts addendum, which differ
 * only in their key table, length bounds and — for word parts — an exclusion.
 *
 * At each position it tries the longest candidate first and accepts the first
 * one `isWord` approves; a rejected position advances by a single item.
 *
 * @param {Array<{surface:string, canonical:string}>} items
 * @param {(key:string, start:number, len:number) => boolean} isWord
 * @param {number} minLen
 * @param {number} maxLen
 * @returns {Array<{kind:"word"|"char", start:number, length:number,
 *                  surface:string, canonical:string,
 *                  items:Array<{surface:string, canonical:string}>}>}
 */
function greedySegment(items, isWord, minLen, maxLen) {
  const segments = [];
  let i = 0;
  while (i < items.length) {
    let matchedLen = 0;
    const limit = Math.min(maxLen, items.length - i);
    for (let len = limit; len >= minLen; len -= 1) {
      const key = items.slice(i, i + len).map((it) => it.canonical).join("");
      if (isWord(key, i, len)) {
        matchedLen = len;
        break;
      }
    }
    const length = matchedLen || 1;
    const slice = items.slice(i, i + length);
    segments.push({
      kind: matchedLen ? "word" : "char",
      start: i,
      length,
      surface: slice.map((it) => it.surface).join(""),
      canonical: slice.map((it) => it.canonical).join(""),
      items: slice,
    });
    i += length;
  }
  return segments;
}

/** Wrap a plain char array as segmentation items with surface === canonical. */
const asItems = (chars) => chars.map((ch) => ({ surface: ch, canonical: ch }));

/**
 * Rule 3: greedy longest-match segmentation of a single Han run.
 *
 * Word keys are looked up in their canonical (variant-mapped) form, while each
 * segment also carries the original surface form for display.
 *
 * @param {string[]} run single Han run (array of code points)
 * @param {object} wordTable words.json `words` object
 * @param {object} variantMap variants.json `map` object
 * @param {number} [maxLen] longest span to try (words.json `maxWordLen`)
 */
export function segmentRun(run, wordTable, variantMap, maxLen = MAX_WORD_LEN) {
  const items = run.map((ch) => ({ surface: ch, canonical: toCanonical(ch, variantMap) }));
  return greedySegment(items, (key) => hasOwn(wordTable, key), MIN_WORD_LEN, maxLen);
}

/**
 * Rule 3b: greedy longest-match segmentation of a single Hangul run against
 * `byHangul`. Spans of 1 syllable are never matched; unmatched syllables
 * produce nothing at all (there are no hangul "char" cards).
 *
 * @param {string[]} run single Hangul run (array of syllables)
 * @param {object} byHangul words.json `byHangul` object
 * @param {number} [maxLen] longest span to try (words.json `maxHangulLen`)
 * @returns {Array<{start:number, length:number, surface:string}>} matched spans
 */
export function segmentHangulRun(run, byHangul, maxLen = MAX_HANGUL_WORD_LEN) {
  const isWord = (key) =>
    hasOwn(byHangul, key) && Array.isArray(byHangul[key]) && byHangul[key].length > 0;
  return greedySegment(asItems(run), isWord, MIN_HANGUL_WORD_LEN, maxLen)
    .filter((seg) => seg.kind === "word")
    .map((seg) => ({ start: seg.start, length: seg.length, surface: seg.surface }));
}

/** The first usable sense of a `words` entry (entries are homograph arrays). */
function firstSense(raw) {
  const list = Array.isArray(raw) ? raw : [raw];
  return list.find((e) => e && typeof e === "object") || null;
}

/**
 * Compare two candidate segmentations by the word-parts priority order:
 * (1) most chars covered by gloss-bearing sub-words, (2) most chars covered by
 * any sub-word, (3) fewest segments.
 */
function isBetterSegmentation(a, b) {
  if (a.glossed !== b.glossed) return a.glossed > b.glossed;
  if (a.covered !== b.covered) return a.covered > b.covered;
  return a.segs < b.segs;
}

/**
 * Word-parts tie-break ADDENDUM (2026-10-24, measured): when a word at this
 * position and a bare character here explain the rest equally well (大學生
 * as 大學 + 生 or 大 + 學生), the word wins, so the split is the word plus a
 * suffix: Wiktionary's etymologies give that shape for 119 of the 144 tied
 * three-character words they name (韓國語, 日本人, 月曜日). The exception is a
 * bound prefix, which stands alone in front of a word (不可能, 無關心, 再放送,
 * 一部分). With it the rule matches 128 of 144; the old tie-break, which kept
 * the bare character, matched 25. Three-character words only: inside longer
 * words the old tie-break is the better one (三民 + 主義, 人海 + 戰術), and
 * the measurement covered only three characters.
 */
const BOUND_PREFIXES = new Set(["不", "無", "未", "非", "再", "反", "一"]);

function isTiedSegmentation(a, b) {
  return a.glossed === b.glossed && a.covered === b.covered && a.segs === b.segs;
}

/**
 * Word-parts addendum: re-segment the interior of a word's canonical spelling.
 *
 * NOT greedy longest-match (unlike rules 3/3b). A small dynamic program over
 * the word picks the segmentation maximizing, in priority order: chars covered
 * by gloss-bearing sub-words, then chars covered by any sub-word, then fewest
 * segments. This prefers 資本 + 主義 over the greedy 資本主 + 義, because the
 * stub entry 資本主 carries no glosses and so explains nothing — while still
 * letting a gloss-less sub-word beat no split at all (priority 2).
 *
 * Only words of >= 3 characters get parts. The full span is excluded from the
 * candidate set so a word is never listed as its own part — the exclusion is by
 * span, not by key: for a 3-char word the length-3 candidate at offset 0 IS the
 * word and is rejected, but the same key appearing as a proper sub-span of a
 * longer word remains valid.
 *
 * Cost is O(n * maxLen) with n <= 20, i.e. negligible.
 *
 * @param {string} canonical the word's canonical hanja spelling
 * @param {object} wordTable words.json `words` object
 * @param {number} [maxLen] longest sub-word to try (words.json `maxWordLen`)
 * @returns {Array<object>|null} parts, or null when no multi-char sub-word exists
 */
export function buildWordParts(canonical, wordTable, maxLen = MAX_WORD_LEN) {
  const chars = [...canonical];
  const total = chars.length;
  if (total < 3) return null;

  // dp[i] = best segmentation of the suffix starting at i, plus the first
  // segment of that segmentation so the choice can be reconstructed.
  const dp = new Array(total + 1);
  dp[total] = { glossed: 0, covered: 0, segs: 0, len: 0, isWord: false };

  for (let i = total - 1; i >= 0; i -= 1) {
    let best = null;
    const consider = (len, isWord, glossedChars) => {
      const next = dp[i + len];
      const candidate = {
        glossed: glossedChars + next.glossed,
        covered: (isWord ? len : 0) + next.covered,
        segs: 1 + next.segs,
        len,
        isWord,
      };
      if (best === null || isBetterSegmentation(candidate, best) ||
          (total === 3 && isWord && !best.isWord && best.len === 1 &&
           isTiedSegmentation(candidate, best) && !BOUND_PREFIXES.has(chars[i]))) {
        best = candidate;
      }
    };

    // Leaving the char uncovered is always an option; considered first so that
    // exact ties resolve deterministically toward earlier candidates.
    consider(1, false, 0);

    const limit = Math.min(maxLen, total - i);
    for (let len = MIN_WORD_LEN; len <= limit; len += 1) {
      if (i === 0 && len === total) continue; // never a part of itself
      const key = chars.slice(i, i + len).join("");
      if (!hasOwn(wordTable, key)) continue;
      const sense = firstSense(wordTable[key]);
      if (sense === null) continue;
      const glossBearing = Array.isArray(sense.glosses) && sense.glosses.length > 0;
      consider(len, true, glossBearing ? len : 0);
    }

    dp[i] = best;
  }

  // Reconstruct, and bail out when the winning segmentation is all bare chars.
  const parts = [];
  let sawWord = false;
  for (let i = 0; i < total; ) {
    const step = dp[i];
    const key = chars.slice(i, i + step.len).join("");
    if (step.isWord) {
      sawWord = true;
      const sense = firstSense(wordTable[key]);
      parts.push({
        type: "word",
        hanja: key,
        hangul: typeof sense.hangul === "string" ? sense.hangul : "",
        glosses: Array.isArray(sense.glosses)
          ? sense.glosses.slice(0, MAX_PART_GLOSSES)
          : [],
      });
    } else {
      parts.push({ type: "char", char: key });
    }
    i += step.len;
  }
  return sawWord ? parts : null;
}

function buildWordMatch(
  { surface, canonical, hangul, glosses, rare, lessCommon, hp },
  wordTable,
  charTable,
  maxWordLen = MAX_WORD_LEN
) {
  const match = {
    kind: "word",
    surface,
    canonical,
    hangul: typeof hangul === "string" ? hangul : "",
    glosses: Array.isArray(glosses) ? glosses.slice() : [],
    chars: [...canonical],
  };
  // Rare flag addendum: propagated only when true, like `parts`. lessCommon
  // (rare and lessCommon ADDENDUM) rides the same way; a sense-set never
  // carries both.
  if (rare === true) match.rare = true;
  if (lessCommon === true) match.lessCommon = true;
  // Hanja-page flag addendum: the entry lives at the hanja-spelling title, so
  // the UI's Wiktionary link should target <canonical> instead of <hangul>.
  if (hp === true) match.hp = true;
  // Used-in addendum: how many larger words contain this one (self excluded),
  // so the UI can render the "Used in N larger words" disclosure without
  // requesting the list. Omitted when 0.
  const usedIn = usedInSpellings(canonical, charTable ?? {}, wordTable).length;
  if (usedIn > 0) match.usedInCount = usedIn;
  const parts = buildWordParts(canonical, wordTable, maxWordLen);
  if (parts) match.parts = parts;
  return match;
}

function buildCharMatch(item, entry) {
  const match = {
    kind: "char",
    surface: item.surface,
    canonical: item.canonical,
    eumhun: Array.isArray(entry.eumhun) ? entry.eumhun : [],
    readings: Array.isArray(entry.readings) ? entry.readings : [],
    glosses: Array.isArray(entry.glosses) ? entry.glosses : [],
    compounds: Array.isArray(entry.compounds) ? entry.compounds : [],
  };
  // cw ADDENDUM: total size of the full compound index, so the UI can render
  // "Show 5 more (N)" without requesting the list. Omitted when 0.
  if (Array.isArray(entry.cw) && entry.cw.length > 0) {
    match.cwCount = entry.cw.length;
  }
  // lvl ADDENDUM: character level taxonomy (m/h/a/r), one value per char.
  // Always present in real data; guarded so a placeholder bundle stays safe.
  if (isLevel(entry.lvl)) match.lvl = entry.lvl;
  return match;
}

/**
 * ADDENDUM {type:"compounds"}: join a char's complete `cw` index against
 * words.json. Pure; the chrome glue in background.js calls this. The incoming
 * char is NFC-normalized and variant-mapped like any lookup input. Returns
 * the SPEC response array (order = cw order); unknown char or missing index
 * yields [].
 */
/** Join an ordered list of spellings against words.json into SPEC row shape. */
function joinSpellings(spellings, wordTable) {
  const out = [];
  for (const spelling of spellings) {
    if (typeof spelling !== "string" || !hasOwn(wordTable, spelling)) continue;
    const senses = wordTable[spelling];
    const first = Array.isArray(senses) ? senses[0] : senses;
    if (!first || typeof first !== "object") continue;
    const row = {
      hanja: spelling,
      hangul: typeof first.hangul === "string" ? first.hangul : "",
      gloss:
        Array.isArray(first.glosses) && typeof first.glosses[0] === "string"
          ? first.glosses[0]
          : "",
    };
    // rare propagated only when every sense of the spelling is rare, matching
    // collapseEntries' any-attested-sense-clears-it semantics. lessCommon
    // follows the same every-sense rule on its own flag.
    const all = Array.isArray(senses) ? senses : [senses];
    if (all.length > 0 && all.every((s) => s && s.rare === true)) {
      row.rare = true;
    }
    if (all.length > 0 && all.every((s) => s && s.lessCommon === true)) {
      row.lessCommon = true;
    }
    out.push(row);
  }
  return out;
}

export function buildFullCompounds(char, data) {
  if (typeof char !== "string" || char.length === 0) return [];
  const variantMap = data?.variants?.map ?? {};
  const charTable = data?.hanja?.chars ?? {};
  const wordTable = data?.words?.words ?? {};
  const normalized = char.normalize("NFC");
  const canonical = hasOwn(variantMap, normalized)
    ? variantMap[normalized]
    : normalized;
  if (!hasOwn(charTable, canonical)) return [];
  const cw = charTable[canonical].cw;
  if (!Array.isArray(cw)) return [];
  return joinSpellings(cw, wordTable);
}

/**
 * Used-in ADDENDUM: every words.json spelling that STRICTLY contains `word`
 * (self excluded), in ranked order. Derived from the first char's `cw` index,
 * which is already frequency-sorted; falls back to a wordTable scan when that
 * char has no entry (order unranked there — acceptable for the rare case).
 */
function usedInSpellings(word, charTable, wordTable) {
  if (typeof word !== "string" || word.length < 2) return [];
  const first = [...word][0];
  const cw = hasOwn(charTable, first) ? charTable[first].cw : null;
  const pool = Array.isArray(cw) ? cw : Object.keys(wordTable ?? {});
  return pool.filter(
    (sp) =>
      typeof sp === "string" &&
      sp !== word &&
      sp.includes(word) &&
      hasOwn(wordTable, sp)
  );
}

export function buildUsedIn(word, data) {
  if (typeof word !== "string" || word.length === 0) return [];
  const charTable = data?.hanja?.chars ?? {};
  const wordTable = data?.words?.words ?? {};
  const normalized = word.normalize("NFC");
  return joinSpellings(
    usedInSpellings(normalized, charTable, wordTable),
    wordTable
  );
}

/**
 * Collapse the homograph entries of one hanja spelling down to a single sense
 * set for a hangul-sourced match. Entries whose `hangul` matches the selected
 * span win; if none do, all entries are used. Glosses are merged and deduped.
 */
function collapseEntries(entries, hangulSpan) {
  const list = (Array.isArray(entries) ? entries : [entries]).filter(
    (e) => e && typeof e === "object"
  );
  if (list.length === 0) return null;
  const preferred = list.filter((e) => e.hangul === hangulSpan);
  const chosen = preferred.length > 0 ? preferred : list;
  const glosses = [];
  for (const entry of chosen) {
    if (!Array.isArray(entry.glosses)) continue;
    for (const gloss of entry.glosses) {
      if (!glosses.includes(gloss)) glosses.push(gloss);
    }
  }
  return {
    hangul: typeof chosen[0].hangul === "string" ? chosen[0].hangul : hangulSpan,
    glosses,
    // Rare only when every contributing sense-set is flagged rare: a single
    // attested sense is enough to make the spelling a confident match.
    rare: chosen.every((e) => e.rare === true),
    lessCommon: chosen.every((e) => e.lessCommon === true),
    // hp when ANY contributing sense came from the hanja-spelling page: the
    // page's existence is what the link cares about, not which sense won.
    hp: chosen.some((e) => e.hp === true),
  };
}

/**
 * Rule 3c: derive the eum -> hanja index from hanja.json at runtime. This is
 * NOT a data file; callers should build it once and cache it (background.js
 * memoizes it module-level alongside the parsed data).
 *
 * Eums come from both `readings` and the `eum` of each `eumhun` entry. Each
 * candidate carries the `hun` of the eumhun entry that produced the eum (""
 * when the eum only appears in `readings`). Candidate lists are ranked by
 * compound count descending — a rough frequency proxy — with ties left in
 * hanja.json key order (Array#sort is stable).
 *
 * @param {object} hanjaData parsed hanja.json
 * @returns {Record<string, Array<{char:string, hun:string, eum:string, gloss:string}>>}
 */
export function buildReadingIndex(hanjaData) {
  const charTable = (hanjaData && hanjaData.chars) || {};
  /** @type {Record<string, Array<object>>} */
  const index = Object.create(null);
  const ranks = new Map();

  for (const char of Object.keys(charTable)) {
    const entry = charTable[char];
    if (!entry || typeof entry !== "object") continue;

    // eum -> hun, preferring the first eumhun entry that supplies a hun.
    const eums = new Map();
    if (Array.isArray(entry.eumhun)) {
      for (const pair of entry.eumhun) {
        if (!pair || typeof pair.eum !== "string" || pair.eum === "") continue;
        const hun = typeof pair.hun === "string" ? pair.hun : "";
        if (!eums.has(pair.eum) || (eums.get(pair.eum) === "" && hun !== "")) {
          eums.set(pair.eum, hun);
        }
      }
    }
    if (Array.isArray(entry.readings)) {
      for (const eum of entry.readings) {
        if (typeof eum !== "string" || eum === "") continue;
        if (!eums.has(eum)) eums.set(eum, "");
      }
    }
    if (eums.size === 0) continue;

    const gloss =
      Array.isArray(entry.glosses) && typeof entry.glosses[0] === "string"
        ? entry.glosses[0]
        : "";
    ranks.set(char, Array.isArray(entry.compounds) ? entry.compounds.length : 0);

    for (const [eum, hun] of eums) {
      if (index[eum] === undefined) index[eum] = [];
      const candidate = { char, hun, eum, gloss };
      // lvl ADDENDUM: the level chip renders on browse rows too.
      if (isLevel(entry.lvl)) candidate.lvl = entry.lvl;
      index[eum].push(candidate);
    }
  }

  for (const eum of Object.keys(index)) {
    index[eum].sort((a, b) => (ranks.get(b.char) || 0) - (ranks.get(a.char) || 0));
  }
  return index;
}

/**
 * Resolve the reading index for a bundle, preferring a caller-supplied cache.
 * Only called on the rule 3c path, so the index is never built unnecessarily.
 */
function resolveReadingIndex(bundle) {
  if (typeof bundle.getReadingIndex === "function") return bundle.getReadingIndex();
  if (bundle.readingIndex) return bundle.readingIndex;
  return buildReadingIndex(bundle.hanja);
}

/**
 * Build the `matches` array for a selection. Words first, then char cards.
 *
 * @param {string} text raw selected text
 * @param {{hanja?:object, words?:object, variants?:object}} data parsed data files
 * @param {boolean} [native] whole-word precedence ADDENDUM: true on the
 *        flagged path only, where a native headword for an entire hangul run
 *        keeps rule 3b off that run (nativeWholeLength). Absent or false
 *        (every unflagged caller), `data.native` is never read and the
 *        result is byte-identical to before the addendum.
 * @returns {Array<object>} matches (possibly empty)
 */
export function buildMatches(text, data, native) {
  const bundle = data || {};
  const charTable = (bundle.hanja && bundle.hanja.chars) || {};
  const wordTable = (bundle.words && bundle.words.words) || {};
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const variantMap = (bundle.variants && bundle.variants.map) || {};
  // Length metadata ADDENDUM: segmentation reaches as far as the data goes.
  const maxWordLen = maxWordLenOf(bundle.words);
  const maxHangulLen = maxHangulLenOf(bundle.words);

  const runs = extractRuns(text);
  const totalChars = runs.reduce((n, run) => n + run.chars.length, 0);
  if (totalChars === 0) return [];

  // Rule 3c: the entire extracted selection is exactly one hangul syllable →
  // homophone browse. No word or char matches are possible in this case.
  if (totalChars === 1 && runs[0].script === "hangul") {
    const eum = runs[0].chars[0];
    const candidates = resolveReadingIndex(bundle)[eum];
    if (!Array.isArray(candidates) || candidates.length === 0) return [];
    return [
      {
        kind: "reading",
        surface: eum,
        eum,
        candidates: candidates.map((c) => {
          const out = { char: c.char, hun: c.hun, eum: c.eum, gloss: c.gloss };
          if (isLevel(c.lvl)) out.lvl = c.lvl;
          return out;
        }),
      },
    ];
  }

  // Rule 3: the threshold counts Han characters ONLY — hangul (and anything
  // else) is excluded, so 國民이라는 still shows the 國/民 char cards.
  const hanCharCount = runs.reduce(
    (n, run) => (run.script === "han" ? n + run.chars.length : n),
    0
  );
  const showAllChars = hanCharCount <= CHAR_CARD_SELECTION_LIMIT;

  const wordMatches = [];
  /** @type {Map<string, object>} key -> the emitted match, for rare merging */
  const seenWords = new Map();
  /** @type {Array<{surface:string, canonical:string}>} */
  const charCandidates = [];

  const pushWord = (match) => {
    const key = `${match.canonical}|${match.hangul}|${match.surface}`;
    const existing = seenWords.get(key);
    if (existing !== undefined) {
      // Same headword reached twice (e.g. two Han-sourced homograph senses
      // sharing a hangul reading). Keep one card, but a single non-rare sense
      // clears the flag — matching collapseEntries' semantics on the hangul
      // path, so both paths agree on what "rare" means.
      if (existing.rare === true && match.rare !== true) delete existing.rare;
      if (existing.lessCommon === true && match.lessCommon !== true) delete existing.lessCommon;
      // hp is any-wins on both paths: one sense living at the hanja page is
      // enough to make that page the better link target.
      if (existing.hp !== true && match.hp === true) existing.hp = true;
      return false;
    }
    seenWords.set(key, match);
    wordMatches.push(match);
    return true;
  };

  for (const run of runs) {
    if (run.script === "han") {
      for (const segment of segmentRun(run.chars, wordTable, variantMap, maxWordLen)) {
        if (segment.kind === "word") {
          const raw = wordTable[segment.canonical];
          const entries = (Array.isArray(raw) ? raw : [raw]).filter(
            (e) => e && typeof e === "object"
          );
          for (const entry of entries) {
            pushWord(
              buildWordMatch(
                {
                  surface: segment.surface,
                  canonical: segment.canonical,
                  hangul: entry.hangul,
                  glosses: entry.glosses,
                  rare: entry.rare,
                  lessCommon: entry.lessCommon,
                  hp: entry.hp,
                },
                wordTable,
                charTable,
                maxWordLen
              )
            );
          }
          // Rule 3: chars covered only by a word match still get a card when
          // the selection is short (<= 4 Han chars).
          if (showAllChars) charCandidates.push(...segment.items);
        } else {
          // Unmatched char — always a candidate for a char card.
          charCandidates.push(...segment.items);
        }
      }
    } else {
      // Whole-word precedence (flagged only): a native headword for the
      // entire run keeps rule 3b off it; the native pass answers for it in
      // buildNativeMatches. What the claim leaves (a josa at most) is still
      // rule 3b's, so the two passes agree syllable for syllable.
      // Deconjugation ADDENDUM: a conjugated verb or adjective claims the
      // run the same way when no headword does (먹었어 is 먹다's, so rule 3b
      // never splits 工夫 off 공부했어). Flagged only, like the headword
      // claim, so the generator never runs on the unflagged path.
      let claimed = native === true ? nativeWholeLength(run.chars, bundle) : 0;
      if (native === true && claimed === 0) claimed = deconjugatedLength(run.chars, bundle);
      let rest = claimed > 0 ? run.chars.slice(claimed) : run.chars;
      // Second-pass resolver ADDENDUM: a particle comes off (rule 3b sees
      // only the remainder), and a native answer leaves rule 3b nothing.
      if (native === true && claimed === 0) {
        const second = secondPass(run.chars, bundle);
        if (second !== null) rest = second.keep || [];
        // Unknown loanwords ADDENDUM: a transliteration answers nothing.
        else if (unknownLoanword(run.chars, bundle)) rest = [];
        // Start-word ADDENDUM: the native pass answers for a start word.
        rest = rest.slice(startWordLength(rest, bundle));
      }
      // Rule 3b: hangul reverse lookup.
      for (const span of segmentHangulRun(rest, byHangul, maxHangulLen)) {
        // Rule 3b: ALL spellings, no cap — the UI renders a selector.
        const resolved = [];
        for (const spelling of byHangul[span.surface]) {
          if (typeof spelling !== "string" || spelling.length === 0) continue;
          const sense = collapseEntries(wordTable[spelling], span.surface);
          if (sense === null) continue;
          resolved.push({ spelling, sense });
        }
        if (resolved.length === 0) continue;

        // Rare flag addendum: unflagged spellings order FIRST, then lessCommon,
        // then rare (rare and lessCommon ADDENDUM), byHangul order preserved
        // within each group. `ordered[0]` is therefore the best unflagged
        // spelling, else the best lessCommon one, else the first rare one.
        const ordered = [
          ...resolved.filter((r) => !r.sense.rare && !r.sense.lessCommon),
          ...resolved.filter((r) => r.sense.lessCommon && !r.sense.rare),
          ...resolved.filter((r) => r.sense.rare),
        ];

        for (const { spelling, sense } of ordered) {
          pushWord(
            buildWordMatch(
              {
                surface: span.surface,
                canonical: spelling,
                hangul: sense.hangul,
                glosses: sense.glosses,
                rare: sense.rare,
                lessCommon: sense.lessCommon,
                hp: sense.hp,
              },
              wordTable,
              charTable,
              maxWordLen
            )
          );
        }

        // Component hanja cards are ALWAYS emitted for hangul-sourced matches,
        // regardless of selection length, but only for one spelling.
        for (const ch of ordered[0].spelling) {
          charCandidates.push({ surface: ch, canonical: ch });
        }
      }
    }
  }

  const charMatches = [];
  const seenChars = new Set();
  for (const item of charCandidates) {
    if (seenChars.has(item.canonical)) continue;
    if (!hasOwn(charTable, item.canonical)) continue; // Rule 4: skip unknown chars
    const entry = charTable[item.canonical];
    if (!entry || typeof entry !== "object") continue;
    seenChars.add(item.canonical);
    charMatches.push(buildCharMatch(item, entry));
  }

  return [...wordMatches, ...charMatches];
}

/* ---------------------------------------------------------------------------
 * Native words ADDENDUM: the second table.
 *
 * native.json is hangul-keyed and NEVER consulted unless the request is
 * flagged: unflagged responses must stay byte-identical to today's, so the
 * native pass is a separate function the flagged path calls alongside
 * buildMatches, not a change to buildMatches itself.
 *
 * Span rules: the Sino resolver is authoritative for the span when it
 * succeeds, and native joins on that resolved hangul: the rule 3b span
 * surface for a hangul-sourced match, the entry's `hangul` reading for a
 * Han-sourced one (that reading is what the hanja-led card's Same sound
 * section lists). Only where the Sino resolver found nothing does the native
 * table get its own greedy longest-match pass, under the same span rules as
 * rule 3b (min 2 syllables, longest first) but bounded by native.json's own
 * `maxLen`. So selecting 하늘이 finds 하늘, the greedy pass leaving the josa
 * unmatched exactly as rule 3b leaves it on 국민이.
 *
 * Deconjugation ADDENDUM (2026-09-05): the documented gap closed. A hangul
 * run no headword claims is offered to the generator (deconjugatedClaim),
 * and a conjugated verb or adjective claims the run for its lemmas the way
 * a headword does: 먹었어 answers with 먹다 carrying `form: "먹었어"`, and
 * 공부했어 with the 공부하다 hybrid, never the 工夫 split. Flagged path only,
 * so the generator never runs for an unflagged response.
 *
 * Whole-word precedence ADDENDUM (2026-09-05): ONE exception to the Sino
 * resolver's authority. Before rule 3b touches a hangul run, the native
 * table is asked for the entire run as a headword (nativeWholeLength). When
 * it holds one, that headword claims the run: the Sino resolver never sees
 * the prefix it would otherwise split off, so 가공되다 answers with the
 * hybrid entry and not with 加工 + 되다. The check is the flagged path's
 * alone (buildMatches takes the flag as its third argument), so unflagged
 * responses stay byte-identical.
 * ------------------------------------------------------------------------- */

/** Usable entries of one native key: objects with a string pos, else []. */
function usableNativeEntries(nativeWords, word) {
  if (!hasOwn(nativeWords, word)) return [];
  const raw = nativeWords[word];
  return (Array.isArray(raw) ? raw : []).filter(
    (e) => e && typeof e === "object" && typeof e.pos === "string"
  );
}

/** Longest key satisfying `isWord` at the run's first syllable, else 0. */
function anchoredLength(chars, isWord, minLen, maxLen) {
  const limit = Math.min(maxLen, chars.length);
  for (let len = limit; len >= minLen; len -= 1) {
    if (isWord(chars.slice(0, len).join(""))) return len;
  }
  return 0;
}

/**
 * The native whole-string check: how many syllables of a hangul run a native
 * headword claims before the Sino resolver runs, or 0 when none does.
 *
 * The run is "the entire josa-stripped candidate" in the sense every other
 * pass here already uses: greedy longest match leaves a trailing syllable
 * unmatched when nothing spans it, so a headword covering the run except a
 * remainder shorter than MIN_HANGUL_WORD_LEN (the josa of 가공되다가) claims
 * it too. A rule 3b span anchored at the same syllable and reaching as far
 * keeps its authority: at equal length the string is both a hanja word's
 * hangul and a native headword, and the ordinary flow joins the native
 * entry on the Sino span (the identity group the lead rule decides);
 * longer, the hanja word explains more than the native headword does.
 *
 * @param {string[]} chars one hangul run
 * @param {object} bundle parsed data bundle (`native` and `words` consulted)
 * @returns {number} claimed syllable count, 0 for no claim
 */
function nativeWholeLength(chars, bundle) {
  if (chars.length < MIN_HANGUL_WORD_LEN) return 0;
  const nativeWords = (bundle.native && bundle.native.words) || {};
  const isNativeWord = (key) => usableNativeEntries(nativeWords, key).length > 0;
  const claimed = anchoredLength(chars, isNativeWord, MIN_HANGUL_WORD_LEN, nativeMaxLenOf(bundle.native));
  if (claimed === 0 || chars.length - claimed >= MIN_HANGUL_WORD_LEN) return 0;
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const isSinoWord = (key) =>
    hasOwn(byHangul, key) && Array.isArray(byHangul[key]) && byHangul[key].length > 0;
  const sino = anchoredLength(chars, isSinoWord, MIN_HANGUL_WORD_LEN, maxHangulLenOf(bundle.words));
  return claimed > sino ? claimed : 0;
}

/**
 * Deconjugation ADDENDUM: the POS entries a form joins. A lemma's other
 * entries (the noun 사고 beside the verb 사다's forms) never come through a
 * form; only a verb or an adjective conjugates.
 */
const CONJUGATING_POS = Object.freeze(["verb", "adj"]);

/** The verb and adj entries of one native key, else []. */
function conjugatingEntries(nativeWords, lemma) {
  return usableNativeEntries(nativeWords, lemma).filter((e) => CONJUGATING_POS.includes(e.pos));
}

/**
 * The generator's output per form, remembered. The gate asks for one form
 * from three places (buildMatches, buildNativeMatches, coverageOf) and the
 * romanized path asks for up to RESOLVE_CAP candidates per query, so the
 * memo keeps the generator to one run per distinct form. Pure input to pure
 * output, so the memo can never go stale; it is bounded by being cleared
 * when it fills, which costs one recomputation and nothing else.
 */
const DECONJUGATE_MEMO_CAP = 1024;
const deconjugateMemo = new Map();

function deconjugateMemoized(form) {
  const known = deconjugateMemo.get(form);
  if (known !== undefined) return known;
  if (deconjugateMemo.size >= DECONJUGATE_MEMO_CAP) deconjugateMemo.clear();
  const lemmas = deconjugate(form);
  deconjugateMemo.set(form, lemmas);
  return lemmas;
}

/**
 * The deconjugation gate (SPEC "Deconjugation" addendum), flagged path only.
 * Runs on a hangul run the native whole-word check declined, and answers with
 * how many syllables a conjugated verb or adjective claims plus the lemmas
 * that explain it: 먹었어 is 먹다 (먹 + 었 + 어), 사는 is 살다 (ㄹ-drop) or
 * 사다. The generator proposes, native.json disposes: a candidate survives
 * only as a headword with a verb or adj entry.
 *
 * Two lengths are tried, the whole run and the run minus a one-syllable
 * remainder, the remainder rule nativeWholeLength has (먹기가 finds 먹다 at
 * 먹기 and the josa goes on to the ordinary flow). A run that a dictionary
 * word already explains at the tried length or further is that word and
 * never deconjugates (남자 is 男子, not 남다; 사고 is 事故, not 사다): a native
 * headword anchored at the first syllable blocks outright, and a rule 3b
 * span does unless every spelling of it is rare (collapseEntries' rule), in
 * which case the lemma leads as a native entry would. The block is by
 * length, so a shorter form can never slip in under a longer word: 학생은
 * cannot claim 학생 + 은 as a form when 學生 explains 학생.
 *
 * @param {string[]} chars one hangul run
 * @param {object} bundle parsed data bundle (`native` and `words` consulted)
 * @returns {{length:number, lemmas:string[]}} the claim; length 0 and no
 *          lemmas when nothing conjugated explains the run
 */
function deconjugatedClaim(chars, bundle) {
  const none = { length: 0, lemmas: [] };
  if (chars.length < MIN_HANGUL_WORD_LEN) return none;
  const nativeWords = (bundle.native && bundle.native.words) || {};
  const wordTable = (bundle.words && bundle.words.words) || {};
  const byHangul = (bundle.words && bundle.words.byHangul) || {};

  // The longest whole explanation anchored at the first syllable: any native
  // headword, or a hanja spelling with an attested (non-rare) sense.
  const isNativeWord = (key) => usableNativeEntries(nativeWords, key).length > 0;
  const nativeLen = anchoredLength(chars, isNativeWord, MIN_HANGUL_WORD_LEN, nativeMaxLenOf(bundle.native));
  const isAttestedSinoWord = (key) =>
    hasOwn(byHangul, key) &&
    Array.isArray(byHangul[key]) &&
    byHangul[key].some((spelling) => {
      const sense = typeof spelling === "string" ? collapseEntries(wordTable[spelling], key) : null;
      return sense !== null && sense.rare !== true;
    });
  const sinoLen = anchoredLength(chars, isAttestedSinoWord, MIN_HANGUL_WORD_LEN, maxHangulLenOf(bundle.words));
  const blocked = Math.max(nativeLen, sinoLen);

  // Bound-noun ADDENDUM: a run that is 건 or 걸 plus an ending is 것 (건가요
  // is 것인가요), which the second pass answers; 걸다's 건가요 is far rarer.
  if (hasOwn(TAIL_ONLY_CONTRACTIONS, chars[0]) &&
      BOUND_NOUN_TAILS[chars[0]].includes(chars.slice(1).join(""))) {
    return none;
  }

  // The whole run, then the whole run as a modifier form plus a bound noun
  // (할거야), then the run minus its last syllable.
  const tryForm = (length) => {
    const form = chars.slice(0, length).join("");
    const lemmas = dictionaryLemmas(deconjugateMemoized(form), nativeWords);
    return lemmas.length > 0 ? { length, lemmas } : null;
  };
  if (chars.length > blocked) {
    const whole = tryForm(chars.length);
    if (whole !== null) return whole;
  }
  const bound = boundNounClaim(chars, nativeWords, blocked);
  if (bound !== null) return bound;
  if (chars.length - 1 >= MIN_HANGUL_WORD_LEN && chars.length - 1 > blocked) {
    const shorter = tryForm(chars.length - 1);
    if (shorter !== null) return shorter;
  }
  return none;
}

/**
 * Bound-noun ADDENDUM (2026-10-25): 할거야 is 하다 in its modifier form (할)
 * plus the bound noun 거, short for 것, plus the copula 야. Written without
 * the space (할 거야), the run found 去夜 inside 거야. When a run ends in 거 or
 * 것 plus one of these tails, and the part in front closes in ㄴ or ㄹ (the
 * modifier endings: 할, 될, 하는, 같은, 있을) and deconjugates to a lemma,
 * the run claims that lemma, so the card reads "할거야 → form of 하다".
 * A word anchored at the first syllable that reaches the bound noun wins:
 * 선거야 is 選擧 plus 야, never 서다's 선 plus 거야.
 */
const BOUND_NOUN_TAILS = {
  거: ["잖아", "라고", "예요", "에요", "지요", "야", "죠", "지", "요", "다", "고", "니", "냐", "든", ""],
  것: ["입니다", "이에요", "이라고", "이야", "이다", "이죠", "이지", "이고", "은", "을", "이", "도", "만", ""],
  // 건 is 것은 or 것인 (하는건가요, 할건데), 걸 is 것을 (하는걸), 게 is 것이 (하는게).
  건: ["가요", "데요", "지도", "가", "데", "지", ""],
  걸: ["요", ""],
  게: [""],
};

function boundNounClaim(chars, nativeWords, blocked) {
  const run = chars.join("");
  for (const noun of Object.keys(BOUND_NOUN_TAILS)) {
    for (const tail of BOUND_NOUN_TAILS[noun]) {
      const end = noun + tail;
      if (!run.endsWith(end) || run.length <= end.length) continue;
      const prefix = run.slice(0, run.length - end.length);
      if (blocked > prefix.length) continue;
      const last = prefix.codePointAt(prefix.length - 1) - 0xac00;
      const coda = last >= 0 && last < 11172 ? last % 28 : -1;
      if (coda !== 4 && coda !== 8) continue;   // ㄴ and ㄹ
      const lemmas = dictionaryLemmas(deconjugate(prefix, { minSyllables: 1 }), nativeWords);
      if (lemmas.length > 0) return { length: chars.length, lemmas };
    }
  }
  return null;
}

/**
 * Contracted lemma heads (bound-noun ADDENDUM): 얘기해 deconjugates to
 * 얘기하다, which the dictionary holds as 이야기하다.
 */
const LEMMA_CONTRACTIONS = { 얘기: "이야기" };

/** The candidates the dictionary holds as verbs or adjectives, contractions expanded. */
function dictionaryLemmas(candidates, nativeWords) {
  const out = [];
  for (const candidate of candidates) {
    let lemma = candidate;
    if (conjugatingEntries(nativeWords, lemma).length === 0) {
      const head = Object.keys(LEMMA_CONTRACTIONS).find((h) => lemma.startsWith(h) && lemma.length > h.length + 1);
      if (head === undefined) continue;
      lemma = LEMMA_CONTRACTIONS[head] + lemma.slice(head.length);
      if (conjugatingEntries(nativeWords, lemma).length === 0) continue;
    }
    if (!out.includes(lemma)) out.push(lemma);
  }
  return out;
}

/** How many syllables of a hangul run a conjugated form claims, else 0. */
function deconjugatedLength(chars, bundle) {
  return deconjugatedClaim(chars, bundle).length;
}

/* ---------------------------------------------------------------------------
 * Second-pass resolver ADDENDUM (2026-10-24): particles and contractions.
 *
 * For a hangul run neither the headword claim nor the conjugated-form claim
 * takes, on the flagged path only: a trailing particle comes off when what
 * it leaves is a dictionary word (엄마한테 is 엄마, so rule 3b never finds
 * 馬韓 inside it), a one-syllable noun before a particle answers with its
 * native card (집에 is 집; the native pass's two-syllable floor missed it),
 * and a contraction answers with its full form (그건 is 그것, 니가 is 너).
 * Rendering is unchanged: the card of the word underneath, no note.
 * ------------------------------------------------------------------------- */

/** Particles, longest first (SPEC list). */
const SECOND_PASS_PARTICLES = [
  "에게서", "한테서", "들에게", "들한테", "에게", "한테", "에서", "까지", "부터",
  "으로", "처럼", "보다", "마다", "밖에", "조차", "마저", "이랑", "이나", "이든",
  "이야", "이에요", "예요", "이죠", "이지", "이고", "이란", "이며", "이면", "께서",
  "에는", "에도", "에만", "들이", "들은", "들을", "들의", "들도", "들과", "들로",
  "들에", "들만", "입니다", "인가", "인데", "이네", "이다",
  // Bound-noun ADDENDUM (2026-10-25): more copula endings (사실이라면, 말인지).
  "인지", "인가요", "인데요", "이라면", "이라고", "이라서", "이라도", "이라는",
  "이니까", "이지만", "이었다", "이었어", "이었고", "이잖아",
  "라면", "라고", "라서", "라도", "라는", "니까", "지만", "였다", "였어", "였고", "잖아",
  "보고", "이서",
  // Contracted and stacked particles (나에겐, 아무한테도, 학교에선).
  "에겐", "한텐", "에선", "으론", "에게도", "한테도", "에서도", "까지도", "에게는", "한테는",
  "에서는", "으로는", "으로도",
  "이", "가", "은", "는", "을", "를", "에", "의", "도", "와", "과", "로", "만", "야",
  "랑", "나", "들",
].sort((a, b) => b.length - a.length);

/** Copula endings that drop the 이 and so follow a vowel only (친구라면, never 컵라면). */
const AFTER_VOWEL_ONLY = new Set(["라면", "라고", "라서", "라도", "라는", "니까", "지만", "였다", "였어", "였고", "잖아"]);

/** Particles taken off a one-syllable word only (나보고, 둘이서), never a longer one. */
const AFTER_ONE_SYLLABLE_ONLY = new Set(["보고", "이서"]);

/** True when the last syllable of `text` closes in a consonant. */
function endsInCoda(text) {
  const cp = text.codePointAt(text.length - 1) - 0xac00;
  return cp >= 0 && cp < 11172 && cp % 28 !== 0;
}

/** Whole-run contractions: the run is the full form plus a fused particle. */
const WHOLE_CONTRACTIONS = {
  그건: "그것", 그걸: "그것", 이건: "이것", 이걸: "이것", 저건: "저것", 저걸: "저것",
  얘기: "이야기", 뭔가: "무엇",
};

/** Contracted remainders before a particle: 거예요 is 것 + 이에요. */
const BASE_CONTRACTIONS = { 거: "것", 뭐: "무엇", 뭔: "무엇", 뭔가: "무엇", 얘기: "이야기", 제: "저", 내: "나", 네: "너", 니: "너" };

/** Bases that take only the endings below, never a particle: 건가요, 건데, 걸요. */
const TAIL_ONLY_CONTRACTIONS = { 건: "것", 걸: "것" };

/** Endings a contracted base takes besides the particles: 거죠, 뭐지, 뭔데. */
const BASE_CONTRACTION_TAILS = [
  "라고요", "라구요", "냐고요", "라고", "라구", "냐고", "래요", "가요", "데요", "에요", "예요",
  "고요", "래", "죠", "요", "다", "고", "지", "든", "게", "데", "가",
];

/** POS a one-syllable remainder may answer with. */
const SECOND_PASS_SINGLE_POS = new Set(["noun", "pron", "num"]);

/** The native entries of `word` with one of the given POS. */
function entriesWithPos(nativeWords, word, posSet) {
  return usableNativeEntries(nativeWords, word).filter((e) => posSet.has(e.pos));
}

/**
 * The second-pass answer for one hangul run, or null.
 * { keep: [chars] }  resolve the run as these syllables (the remainder)
 * { word, pos }      answer with this native headword's entries (pos: a Set,
 *                    or null for every POS)
 */
function secondPass(chars, bundle) {
  if (chars.length < 2) return null;
  const nativeWords = (bundle.native && bundle.native.words) || {};
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const wordTable = (bundle.words && bundle.words.words) || {};
  const run = chars.join("");
  // A run that is itself a hanja word's hangul with a non-rare spelling is
  // that word: 수가 is never 수 + 가 when 酬價 is a common word.
  if (hasOwn(byHangul, run) && Array.isArray(byHangul[run]) && byHangul[run].some((sp) => {
    const sense = typeof sp === "string" ? collapseEntries(wordTable[sp], run) : null;
    return sense !== null && sense.rare !== true;
  })) {
    return null;
  }
  if (hasOwn(WHOLE_CONTRACTIONS, run) &&
      usableNativeEntries(nativeWords, WHOLE_CONTRACTIONS[run]).length > 0) {
    return { word: WHOLE_CONTRACTIONS[run], pos: SECOND_PASS_SINGLE_POS };
  }
  for (const tail of BASE_CONTRACTION_TAILS) {
    if (!run.endsWith(tail) || run.length <= tail.length) continue;
    const base = run.slice(0, run.length - tail.length);
    const full = hasOwn(BASE_CONTRACTIONS, base) ? BASE_CONTRACTIONS[base]
      : hasOwn(TAIL_ONLY_CONTRACTIONS, base) ? TAIL_ONLY_CONTRACTIONS[base] : null;
    if (full !== null && usableNativeEntries(nativeWords, full).length > 0) {
      return { word: full, pos: SECOND_PASS_SINGLE_POS };
    }
  }
  for (const particle of SECOND_PASS_PARTICLES) {
    if (!run.endsWith(particle) || run.length <= particle.length) continue;
    const rest = run.slice(0, run.length - particle.length);
    if (AFTER_VOWEL_ONLY.has(particle) && endsInCoda(rest)) continue;
    if (AFTER_ONE_SYLLABLE_ONLY.has(particle) && [...rest].length !== 1) continue;
    if (hasOwn(BASE_CONTRACTIONS, rest) &&
        usableNativeEntries(nativeWords, BASE_CONTRACTIONS[rest]).length > 0) {
      return { word: BASE_CONTRACTIONS[rest], pos: SECOND_PASS_SINGLE_POS };
    }
    const restChars = [...rest];
    if (restChars.length === 1) {
      if (entriesWithPos(nativeWords, rest, SECOND_PASS_SINGLE_POS).length > 0) {
        return { word: rest, pos: SECOND_PASS_SINGLE_POS };
      }
      continue;
    }
    const explained = usableNativeEntries(nativeWords, rest).length > 0 ||
      (hasOwn(byHangul, rest) && Array.isArray(byHangul[rest]) && byHangul[rest].length > 0);
    if (explained) return { keep: restChars };
  }
  return null;
}

/* ---------------------------------------------------------------------------
 * Unknown loanwords ADDENDUM (2026-10-25): names and loanwords the
 * dictionary lacks. 프랭크 (Frank) showed 랭크 (rank), 브라이언 (Brian)
 * 俚言, 엘리자베스 (Elizabeth) 利子: the longest-match passes find a word
 * inside a transliteration. These syllables are no hanja's reading and
 * lean hard to loanwords in native.json (at least 10 loanwords, at least
 * three times as many loanwords as native or hybrid words), so a run
 * holding one is a transliteration unless the words found explain it.
 * ------------------------------------------------------------------------- */
const LOANWORD_SYLLABLES = new Set([..."스트크프카테티플페케브커션클퍼즈블콘링늄폰륨쿠텔츠펜쇼콜슈롤즘웨센램핑랜셔텐벨멘켓킹킬팅딘몬팬턴큐벤릴셀닝딩컨"]);

/**
 * Two native suffixes spell with these syllables: the 스 of -스럽다
 * (사랑스런, 유감스럽게도) and the 컨 of -컨대 (맹세컨대). There the
 * syllable is no loanword's.
 */
function isLoanwordSyllable(chars, i) {
  const c = chars[i];
  if (!LOANWORD_SYLLABLES.has(c)) return false;
  const next = i + 1 < chars.length ? chars[i + 1] : "";
  if (c === "스" && "럽러런레".includes(next) && next !== "") return false;
  if (c === "컨" && "대데".includes(next) && next !== "") return false;
  return true;
}

/**
 * The covered intervals of a hangul run as the lookup answers it with no
 * claim: rule 3b spans, and on a flagged request native words in the gaps.
 */
function runIntervals(chars, bundle, native) {
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const intervals = [];
  const fill = (base, end) => {
    if (!native || end <= base) return;
    const nativeWords = (bundle.native && bundle.native.words) || {};
    const isNativeWord = (key) => usableNativeEntries(nativeWords, key).length > 0;
    for (const seg of greedySegment(asItems(chars.slice(base, end)), isNativeWord, MIN_HANGUL_WORD_LEN, nativeMaxLenOf(bundle.native))) {
      if (seg.kind === "word") intervals.push([base + seg.start, seg.length]);
    }
  };
  let cursor = 0;
  for (const span of segmentHangulRun(chars, byHangul, maxHangulLenOf(bundle.words))) {
    fill(cursor, span.start);
    intervals.push([span.start, span.length]);
    cursor = span.start + span.length;
  }
  fill(cursor, chars.length);
  return intervals.sort((a, b) => a[0] - b[0]);
}

/**
 * True when a run no claim covers is an unknown loanword: it holds a
 * loanword syllable, and the words found either leave one unexplained
 * (프랭크: 랭크 leaves 프) or miss the run's first syllable (빈센트: 센트
 * leaves 빈). Such a run answers nothing. 버스정류장 (버스 + 停留場) and
 * 드라마같은 (드라마 first) keep their words.
 */
function unknownLoanword(chars, bundle) {
  if (!chars.some((c, i) => isLoanwordSyllable(chars, i))) return false;
  const covered = new Array(chars.length).fill(false);
  for (const [start, length] of runIntervals(chars, bundle, true)) {
    for (let i = start; i < start + length; i += 1) covered[i] = true;
  }
  if (!covered[0]) return true;
  return chars.some((c, i) => isLoanwordSyllable(chars, i) && !covered[i]);
}

/**
 * Start-word ADDENDUM (2026-10-25): how many syllables a native headword
 * at the start of an unclaimed run keeps for itself, else 0. Rule 3b's
 * spans used to be placed first and native words only filled the gaps,
 * so a hanja word beginning inside the first native word won: 다음주에
 * (next week) showed 飮酒 (drinking) from 음주, 마찬가지예요 讚歌. When the
 * longest native headword at the start is shorter than the run and the
 * first rule 3b span begins inside it, the headword keeps its syllables.
 * A hanja word that itself starts the run still wins (대학에서 is 大學).
 */
function startWordLength(chars, bundle) {
  const nativeWords = (bundle.native && bundle.native.words) || {};
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const isNativeWord = (key) => usableNativeEntries(nativeWords, key).length > 0;
  const k = anchoredLength(chars, isNativeWord, MIN_HANGUL_WORD_LEN, nativeMaxLenOf(bundle.native));
  if (k === 0 || k >= chars.length) return 0;
  const spans = segmentHangulRun(chars, byHangul, maxHangulLenOf(bundle.words));
  if (!(spans.length > 0 && spans[0].start > 0 && spans[0].start < k)) return 0;
  // What follows the start word, when it is particles only (누구보다도 is
  // 누구 + 보다 + 도), is claimed with it, so nothing is found inside it.
  return onlyParticles(chars.slice(k).join(""), 3) ? chars.length : k;
}

/** The start word's own length, for the native answer (startWordLength may add particles). */
function startWordHead(chars, bundle) {
  const nativeWords = (bundle.native && bundle.native.words) || {};
  const isNativeWord = (key) => usableNativeEntries(nativeWords, key).length > 0;
  return anchoredLength(chars, isNativeWord, MIN_HANGUL_WORD_LEN, nativeMaxLenOf(bundle.native));
}

/** True when `text` is up to `depth` second-pass particles and nothing else. */
function onlyParticles(text, depth) {
  if (text === "") return true;
  if (depth === 0) return false;
  return SECOND_PASS_PARTICLES.some((p) => text.endsWith(p) &&
    onlyParticles(text.slice(0, text.length - p.length), depth - 1));
}

/**
 * The best (lowest) lemma frequency bucket among a lemma's conjugating
 * entries; absent compares as worst, the convention every f comparison here
 * follows.
 */
function lemmaFrequency(nativeWords, lemma) {
  let best = Infinity;
  for (const entry of conjugatingEntries(nativeWords, lemma)) {
    if (Number.isInteger(entry.f) && entry.f < best) best = entry.f;
  }
  return best;
}

/** True for a non-empty string of hangul only: what a `form` may carry. */
function isHangulString(text) {
  return typeof text === "string" && text !== "" && [...text].every(isHangul);
}

/**
 * Hybrid parts ADDENDUM (row glosses): the words.json sense set a hanja part
 * shows on its row. The entry whose `hangul` is the part's own (加工 read
 * 가공, not some homograph reading) wins; failing that, the first entry with
 * glosses; a hanja the table lacks, or one with no glossed entry, yields
 * null and the row stays bare.
 */
function hanjaPartGlosses(wordTable, part) {
  if (!hasOwn(wordTable, part.hanja)) return null;
  const raw = wordTable[part.hanja];
  const entries = (Array.isArray(raw) ? raw : [raw]).filter(
    (e) => e && typeof e === "object" && Array.isArray(e.glosses)
  );
  const chosen = entries.find((e) => e.hangul === part.hangul) || entries[0];
  return chosen === undefined ? null : chosen.glosses.slice();
}

/**
 * Hybrid parts ADDENDUM: the entry's `parts`, validated, for the wire. Each
 * part keeps its `hangul` and, for a hanja segment, its `hanja`; a hangul-only
 * part additionally carries `native: true` when the native table holds that
 * hangul as a headword, which is what tells the renderer the part's chip
 * opens a native card rather than sitting inert. Anything malformed means no
 * parts at all: the card degrades to the marker alone.
 *
 * Row glosses (2026-09-05): a part the tables know also carries `glosses`,
 * so its row renders in the component-word idiom (加工 가공 processing; 되다
 * to become). A hanja part's come from words.json (hanjaPartGlosses); a
 * native part's from the first usable native.json entry of its hangul,
 * together with that entry's `pos`, the half of the "hangul|pos" key the
 * worker needs to hang the Korean definition on the row. A part with
 * nothing to say (no words.json entry, no native entry) gets neither field.
 */
function nativePartsOf(entry, nativeWords, wordTable) {
  if (!Array.isArray(entry.parts) || entry.parts.length === 0) return null;
  const parts = [];
  for (const part of entry.parts) {
    if (!part || typeof part !== "object") return null;
    if (typeof part.hangul !== "string" || part.hangul === "") return null;
    const hasHanja = part.hanja !== undefined;
    if (hasHanja && (typeof part.hanja !== "string" || part.hanja === "")) return null;
    const out = hasHanja ? { hanja: part.hanja, hangul: part.hangul } : { hangul: part.hangul };
    if (hasHanja) {
      const glosses = hanjaPartGlosses(wordTable, part);
      if (glosses !== null) out.glosses = glosses;
    } else {
      const [native] = usableNativeEntries(nativeWords, part.hangul);
      if (native !== undefined) {
        out.native = true;
        out.glosses = Array.isArray(native.glosses) ? native.glosses.slice() : [];
        out.pos = native.pos;
      }
    }
    parts.push(out);
  }
  return parts;
}

/**
 * One native.json entry shaped as a native match: kind, word, pos, glosses
 * (a copy), and `origin` when the entry declares one of the three classes.
 * The two fields a match may carry beyond these, `parts` and `form`, are
 * the caller's to add: buildNativeMatches adds both, a hybrid part's
 * sub-response (buildNativeEntryMatches) neither.
 */
function nativeEntryMatch(word, entry) {
  const match = {
    kind: "native",
    word,
    pos: entry.pos,
    glosses: Array.isArray(entry.glosses) ? entry.glosses.slice() : [],
  };
  const origin = nativeOriginOf(entry);
  if (origin !== null) match.origin = origin;
  return match;
}

/**
 * Hybrid card depth ADDENDUM: the entries of one native headword shaped as
 * native matches, every POS in table order, for the `lookup.nativeMatches`
 * a hybrid's native part carries (되다 in 가공되다). `parts` is deliberately
 * omitted, so a native part that is itself a hybrid never nests its own
 * parts, and `form` never applies (the part is a headword, not a surface).
 * Empty for a headword the table lacks.
 *
 * @param {string} word the part's hangul
 * @param {{native?:object}} data parsed data bundle
 * @returns {Array<{kind:"native", word:string, pos:string, glosses:string[], origin?:string}>}
 */
export function buildNativeEntryMatches(word, data) {
  if (typeof word !== "string" || word === "") return [];
  const nativeWords = (data && data.native && data.native.words) || {};
  return usableNativeEntries(nativeWords, word).map((entry) => nativeEntryMatch(word, entry));
}

/**
 * Build the `nativeMatches` array for a flagged lookup. One match per
 * (word, pos) pair, spans in text order, native.json entry order within a
 * word. Empty when the native table has nothing to say.
 *
 * Place names ADDENDUM: pos "name" is a POS like any other here; a place
 * entry matches, dedupes, and orders exactly as a noun does. Origin markers
 * ADDENDUM: `origin` rides on the match only when the entry declares one of
 * the three classes (NATIVE_ORIGINS); an unknown origin adds no field.
 *
 * @param {string} text raw query or selection
 * @param {{native?:object, words?:object, variants?:object}} data parsed data bundle
 * Deconjugation ADDENDUM: a match reached through a conjugated form carries
 * `form`, the claimed surface; a direct match never does.
 *
 * @returns {Array<{kind:"native", word:string, pos:string, glosses:string[], origin?:string, form?:string}>}
 */
export function buildNativeMatches(text, data) {
  const bundle = data || {};
  const nativeWords = (bundle.native && bundle.native.words) || {};
  const wordTable = (bundle.words && bundle.words.words) || {};
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const variantMap = (bundle.variants && bundle.variants.map) || {};
  const maxWordLen = maxWordLenOf(bundle.words);
  const maxHangulLen = maxHangulLenOf(bundle.words);
  const nativeMaxLen = nativeMaxLenOf(bundle.native);

  const out = [];
  /** @type {Map<string, object>} "word|pos" -> the emitted match */
  const seen = new Map();

  const entriesOf = (word) => usableNativeEntries(nativeWords, word);

  // Deconjugation ADDENDUM: `form` is the claimed surface a lemma was reached
  // through (먹었어 on the 먹다 match), absent on a direct match. Dedupe by
  // (word, pos) is unchanged, and a lemma reached directly keeps the direct
  // match without `form` whichever order the two arrive in.
  const joinEntries = (word, entries, form) => {
    for (const entry of entries) {
      const key = `${word}|${entry.pos}`;
      const existing = seen.get(key);
      if (existing !== undefined) {
        if (form === null && existing.form !== undefined) delete existing.form;
        continue;
      }
      const match = nativeEntryMatch(word, entry);
      // Hybrid parts ADDENDUM: the field rides only when the entry's parts
      // validate; absent parts (or junk) add no field.
      const parts = nativePartsOf(entry, nativeWords, wordTable);
      if (parts !== null) match.parts = parts;
      // The form is minted from the run's own syllables, so the check is
      // the wire rule stated once: a non-empty hangul string, or no field.
      if (form !== null && isHangulString(form)) match.form = form;
      seen.set(key, match);
      out.push(match);
    }
  };

  const joinNative = (word) => joinEntries(word, entriesOf(word), null);

  // The lemmas a conjugated form resolved to, verb and adj entries only,
  // ordered by lemma frequency (absent last) and then by the generator's
  // order, which Array.prototype.sort keeps for ties.
  const joinForm = (form, lemmas) => {
    const ranked = lemmas
      .map((lemma, index) => ({ lemma, index, f: lemmaFrequency(nativeWords, lemma) }))
      .sort((a, b) => (a.f === b.f ? a.index - b.index : a.f - b.f));
    for (const { lemma } of ranked) {
      joinEntries(lemma, conjugatingEntries(nativeWords, lemma), form);
    }
  };

  // The native-only pass over one uncovered stretch of a hangul run. A key
  // with no usable entry does not count as a match, so it cannot block the
  // greedy fallthrough that strips a trailing josa.
  const nativePass = (chars) => {
    if (chars.length === 0) return;
    const isWord = (key) => entriesOf(key).length > 0;
    for (const seg of greedySegment(asItems(chars), isWord, MIN_HANGUL_WORD_LEN, nativeMaxLen)) {
      if (seg.kind === "word") joinNative(seg.surface);
    }
  };

  for (const run of extractRuns(text)) {
    if (run.script === "han") {
      // Han runs: the Sino resolver owns the span; native joins on each
      // matched word's hangul reading(s).
      for (const segment of segmentRun(run.chars, wordTable, variantMap, maxWordLen)) {
        if (segment.kind !== "word") continue;
        const raw = wordTable[segment.canonical];
        for (const entry of Array.isArray(raw) ? raw : [raw]) {
          if (entry && typeof entry.hangul === "string" && entry.hangul !== "") {
            joinNative(entry.hangul);
          }
        }
      }
    } else {
      // Whole-word precedence: a native headword for the entire run claims
      // it before the Sino resolver sees a prefix to split off. What it
      // leaves (a josa at most) goes through the ordinary flow below.
      // Deconjugation ADDENDUM: failing a headword, a conjugated form claims
      // the run for its lemmas (먹었어 for 먹다), the same claim buildMatches
      // made, so the two passes still agree syllable for syllable.
      let claimed = nativeWholeLength(run.chars, bundle);
      if (claimed > 0) {
        joinNative(run.chars.slice(0, claimed).join(""));
      } else {
        const claim = deconjugatedClaim(run.chars, bundle);
        if (claim.length > 0) {
          claimed = claim.length;
          joinForm(run.chars.slice(0, claimed).join(""), claim.lemmas);
        }
      }
      let rest = claimed > 0 ? run.chars.slice(claimed) : run.chars;
      // Second-pass resolver ADDENDUM: the same decision buildMatches made.
      if (claimed === 0) {
        const second = secondPass(run.chars, bundle);
        if (second !== null && second.keep) {
          rest = second.keep;
        } else if (second !== null) {
          joinEntries(second.word, second.pos === null
            ? entriesOf(second.word)
            : entriesWithPos(nativeWords, second.word, second.pos), undefined);
          rest = [];
        } else if (unknownLoanword(run.chars, bundle)) {
          // Unknown loanwords ADDENDUM: the same decision buildMatches made.
          rest = [];
        }
        // Start-word ADDENDUM: the same decision buildMatches made.
        const start = startWordLength(rest, bundle);
        if (start > 0) {
          joinNative(rest.slice(0, startWordHead(rest, bundle)).join(""));
          rest = rest.slice(start);
        }
      }
      // Hangul runs: rule 3b spans are authoritative where they exist; the
      // stretches between them get the native-only pass.
      let cursor = 0;
      for (const span of segmentHangulRun(rest, byHangul, maxHangulLen)) {
        nativePass(rest.slice(cursor, span.start));
        joinNative(span.surface);
        cursor = span.start + span.length;
      }
      nativePass(rest.slice(cursor));
    }
  }

  return out;
}

/* ---------------------------------------------------------------------------
 * Romanized search ADDENDUM — the two interpreters.
 *
 * A Latin query has two plausible readings: hangul typed with the
 * keyboard in the wrong mode (`toddlf` → 생일) and romanized Korean
 * (`gukmin` → 국민). Both are tried, both may survive, and the merge orders
 * them by frequency. This supersedes the QWERTY addendum's `converted` field:
 * the response now carries `interpretations`.
 *
 * THE INPUT-CHANNEL RULE: none of this runs unless the caller asks for it.
 * Interpretation belongs to free-typed input (the search shell, the omnibox,
 * `?q=` deep links, the pending query); every internal navigation looks up
 * literally, and a literal lookup of Latin text finds nothing, as it always
 * did. Interpretation must never depend on string shape alone.
 * ------------------------------------------------------------------------- */

/**
 * The interpreted-query gate (REVISED: the original letters-only gate made
 * separator stripping unreachable). After trimming, a query is interpretable
 * when it starts with a Latin letter and holds nothing but letters, hyphens,
 * apostrophes and internal spaces — the punctuation romanizations use to mark
 * syllable boundaries (`guk-min`, `han'gul`, `guk min`). The leading-letter
 * requirement is what keeps a query of separators alone (`- -`) out.
 */
export const INTERPRETABLE_QUERY = /^[A-Za-z][A-Za-z' -]*$/;

/** True when a trimmed query should be handed to the two interpreters. */
export function isInterpretableQuery(text) {
  return typeof text === "string" && INTERPRETABLE_QUERY.test(text);
}

/** Identity of a match for dedupe purposes, per kind. */
function matchKey(match) {
  if (match.kind === "word") return `w|${match.canonical}|${match.hangul}|${match.surface}`;
  if (match.kind === "reading") return `r|${match.eum}`;
  return `c|${match.canonical}`;
}

/**
 * Interpretation 1: the Dubeolsik reading of the typed letters. It receives
 * the RAW text, separators included: they are not Dubeolsik keys, so they
 * simply break composition, and the dictionary filter absorbs the result.
 *
 * Native words ADDENDUM: a flagged call consults both tables, and native hits
 * alone keep the interpretation alive: `haneul` must reach 하늘 even though
 * the Sino tables have nothing there. `nativeMatches` rides on the
 * interpretation only when non-empty, so the unflagged shape is untouched.
 */
function dubeolsikInterpretation(raw, data, native) {
  const to = qwertyToHangul(raw);
  if (to === "" || to === raw) return null;
  const matches = buildMatches(to, data, native);
  const nativeMatches = native ? buildNativeMatches(to, data) : [];
  if (matches.length === 0 && nativeMatches.length === 0) return null;
  const interp = { kind: "dubeolsik", from: raw, to, matches };
  if (nativeMatches.length > 0) interp.nativeMatches = nativeMatches;
  return interp;
}

/**
 * Resolve-side budget (SPEC v2 bounds, follow-up): how many deromanize
 * candidates the interpreter RESOLVES against the dictionary, taken in the
 * generator's own cheapest-first order. The generator's caps bound what a
 * degenerate query can produce (thousands of candidates for 20 vowels);
 * this one bounds what a lookup pays for them. Truncation sheds only the
 * contrived tail: every pinned real-data anchor resolves within the first
 * few dozen candidates.
 */
export const RESOLVE_CAP = 256;

/** Coverage classes for the candidate collapse (SPEC v2 policy). */
const CLASS_WHOLE = 0;    // the whole candidate is one dictionary unit
const CLASS_COVERED = 1;  // covered end to end by word/native entries
const CLASS_PARTIAL = 2;  // dictionary explains only part of the candidate

/**
 * How much of one hangul candidate the dictionary explains, mirroring the
 * lookup itself: rule 3b spans first, then (flagged only) the native pass
 * over the stretches the Sino resolver left, same floor and cap.
 *
 * `covered` is the total explained syllable count. `anchored` is the length
 * of the contiguous explained run from the FIRST syllable: 발견했어 anchors
 * 2 through 발견, while the splinter 밝연해써 anchors 0 because its 연해
 * only starts at syllable two.
 */
function coverageOf(hangul, data, native) {
  const bundle = data || {};
  const byHangul = (bundle.words && bundle.words.byHangul) || {};
  const chars = [...hangul];
  // Disjoint covered intervals: rule 3b spans, plus native segs inside the
  // gaps between them on a flagged request.
  const intervals = [];
  let fillStretch = null;

  if (native) {
    const nativeWords = (bundle.native && bundle.native.words) || {};
    const nativeMaxLen = nativeMaxLenOf(bundle.native);
    const isNativeWord = (key) => usableNativeEntries(nativeWords, key).length > 0;
    fillStretch = (base, slice) => {
      for (const seg of greedySegment(asItems(slice), isNativeWord, MIN_HANGUL_WORD_LEN, nativeMaxLen)) {
        if (seg.kind === "word") intervals.push([base + seg.start, seg.length]);
      }
    };
  }
  const stretch = (base, end) => {
    if (fillStretch !== null && end > base) fillStretch(base, chars.slice(base, end));
  };

  // Whole-word precedence: the same claim the lookup makes, so a candidate
  // the native table holds whole measures as the lookup answers it. The
  // deconjugated claim (Deconjugation ADDENDUM) counts the same way: covered
  // and anchored, so 무시했어 measures as 무시하다's whole answer.
  let claimed = native ? nativeWholeLength(chars, bundle) : 0;
  if (native && claimed === 0) claimed = deconjugatedLength(chars, bundle);
  // Second-pass resolver ADDENDUM: a particle or contraction answer explains
  // the whole candidate, as the lookup answers it.
  if (native && claimed === 0 && secondPass(chars, bundle) !== null) claimed = chars.length;
  // Unknown loanwords ADDENDUM: a transliteration the lookup answers with
  // nothing covers nothing.
  if (native && claimed === 0 && unknownLoanword(chars, bundle)) return { covered: 0, anchored: 0 };
  // Start-word ADDENDUM: a native start word keeps its syllables.
  if (native && claimed === 0) claimed = startWordLength(chars, bundle);
  if (claimed > 0) intervals.push([0, claimed]);
  const spans = segmentHangulRun(chars.slice(claimed), byHangul, maxHangulLenOf(bundle.words));

  let cursor = claimed;
  for (const span of spans) {
    const start = claimed + span.start;
    stretch(cursor, start);
    intervals.push([start, span.length]);
    cursor = start + span.length;
  }
  stretch(cursor, chars.length);
  intervals.sort((a, b) => a[0] - b[0]);

  let covered = 0;
  let anchored = 0;
  let contiguous = true;
  for (const [start, length] of intervals) {
    covered += length;
    if (contiguous && start === anchored) anchored += length;
    else contiguous = false;
  }
  return { covered, anchored };
}

/**
 * Interpretation 2: the romanization reading (SPEC "Romanized search v2").
 * deromanize() generates ranked hangul candidate strings, tier 0 (the typed
 * form is one of the candidate's own exact romanizations) before tier 1 (the
 * habit-loosened rest), and EVERY candidate runs the NORMAL lookup, exactly
 * as if the user had typed that hangul: a word candidate takes the word path,
 * a single syllable takes the reading path, and the dictionary is the only
 * gate (the parity rule).
 *
 * Surviving candidates collapse under the SPEC v2 coverage policy: each is
 * classed by how much of it the dictionary explains, and ONLY the best class
 * present contributes matches (whole-entry beats fully-covered beats
 * partial). Within the partial class only the candidates with the maximal
 * covered-syllable count merge, so a fragment can never add matches a better
 * candidate lacks (mushihada must not surface 아다 beside 하다). Inside the
 * winning pool, candidates order by tier, then by best frequency among
 * whole-word readings (gungmin leads with 국민, not the rare surface reading
 * 궁민), then word-bearing before native-only, then (partial class only) by
 * anchored coverage and, among equally anchored parses, by the best
 * frequency among what each parse found; the sort is stable, so remaining
 * ties keep deromanize's order (fewest deviations first). `to` is
 * the pool's best candidate, EXCEPT for a partial-class win, where `to` is
 * the typed text itself: srcText derives from `to`, and no single hangul
 * spelling is canonical for a partial parse (the multi-match-root rule
 * generalized), so mushihaesseo roots as typed while class A/B root as the
 * hangul.
 */
function rrInterpretation(raw, data, native) {
  const wordTable = (data && data.words && data.words.words) || {};
  const byHangul = (data && data.words && data.words.byHangul) || {};

  // Pass 1: resolve candidates, in deromanize's cheapest-first order, up to
  // RESOLVE_CAP of them; only survivors matter. The cap bounds RESOLUTION,
  // not generation: degenerate vowel soup generates thousands of candidates,
  // and running the dictionary over all of them is the whole cost of a
  // garbage keystroke. Real queries resolve their words well inside the cap
  // (every pinned anchor sits in the first few dozen candidates), so the cap
  // only ever truncates the contrived tail.
  const candidates = deromanize(raw);
  const limit = Math.min(candidates.length, RESOLVE_CAP);
  const survivors = [];
  for (let i = 0; i < limit; i += 1) {
    const { hangul, tier } = candidates[i];
    const matches = buildMatches(hangul, data, native);
    // Native words ADDENDUM: flagged calls consult the native table for every
    // candidate too, and a native-only candidate still counts as explained.
    const nativeMatches = native ? buildNativeMatches(hangul, data) : [];
    if (matches.length === 0 && nativeMatches.length === 0) continue;
    survivors.push({ hangul, tier, matches, nativeMatches });
  }
  if (survivors.length === 0) return null;

  // Pass 2: classify by coverage. Whole is read off the resolved matches
  // (a word match spanning the entire candidate, a reading list, which only
  // ever fires for a whole single syllable, or a native entry for the whole
  // string, reached directly or as the form the whole string is: 무시했어
  // is whole through 무시하다's `form`); the rest measure their covered
  // syllables.
  for (const s of survivors) {
    const len = [...s.hangul].length;
    const whole =
      s.matches.some(
        (m) => (m.kind === "word" && m.surface === s.hangul) || m.kind === "reading"
      ) || s.nativeMatches.some((m) => m.word === s.hangul || m.form === s.hangul);
    if (whole) {
      s.cls = CLASS_WHOLE;
      s.covered = len;
      s.anchored = len;
    } else {
      const { covered, anchored } = coverageOf(s.hangul, data, native);
      s.covered = covered;
      s.anchored = anchored;
      s.cls = covered === len ? CLASS_COVERED : CLASS_PARTIAL;
    }
  }
  const bestClass = Math.min(...survivors.map((s) => s.cls));
  let pool = survivors.filter((s) => s.cls === bestClass);
  if (bestClass === CLASS_PARTIAL) {
    const maxCovered = Math.max(...pool.map((s) => s.covered));
    pool = pool.filter((s) => s.covered === maxCovered);
  }

  // Pass 3: rank the pool. The frequency comparison applies between
  // WHOLE-WORD readings of the query only (the v1 index ranked exactly
  // those); a partial candidate's best f describes a fragment, not the
  // query, so it keeps generation order.
  for (const s of pool) {
    s.f = hasOwn(byHangul, s.hangul) ? bestFrequency(s, wordTable) : Infinity;
    // Last tie key: a candidate with word matches outranks one the flagged
    // native pass alone kept alive.
    s.wordless = s.matches.some((m) => m.kind === "word") ? 0 : 1;
    // Partial-pool ordering key: the best f among what the parse actually
    // found, the same comparator the interpretation preference rules use.
    s.cf = bestFrequency(s, wordTable);
  }
  // Two Infinity ranks compare equal (Infinity minus Infinity is NaN, which
  // would poison the comparator). In a partial-class pool, every maximal
  // parse of an ambiguous romanization renders (inclusivity is
  // user-directed: the romanized typist, unlike the hangul typist, chose no
  // segmentation), and a parse is judged before the words it found:
  // ANCHORED coverage orders first, because a parse that cannot explain the
  // query's first syllable is a worse reading of the input (balgyeonhaesseo
  // leads with 발견했어's 發見, anchored 2, and the ㄺ-cluster splinter
  // 밝연해써 trails with its 沿海, anchored 0); among equally anchored
  // parses the common word is the likelier intent, so the best f among what
  // each parse found breaks the tie (gungminieoteo leads with 國民 over the
  // rare 窮民, both anchored 2). Unranked and native-only contributions
  // compare as worst, per the unranked convention; remaining ties keep the
  // deterministic generation order.
  pool.sort(
    (a, b) =>
      (a.tier - b.tier) ||
      (a.f === b.f ? 0 : a.f - b.f) ||
      (a.wordless - b.wordless) ||
      (bestClass === CLASS_PARTIAL ? b.anchored - a.anchored : 0) ||
      (bestClass === CLASS_PARTIAL && a.cf !== b.cf ? a.cf - b.cf : 0)
  );

  // Pass 4: merge the pool, deduped, in rank order.
  const matches = [];
  const nativeMatches = [];
  const seen = new Set();
  const seenNative = new Set();
  for (const survivor of pool) {
    for (const match of survivor.matches) {
      const key = matchKey(match);
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(match);
    }
    for (const match of survivor.nativeMatches) {
      const key = `${match.word}|${match.pos}`;
      if (seenNative.has(key)) continue;
      seenNative.add(key);
      nativeMatches.push(match);
    }
  }
  // `to` names the mapping the UI shows and roots the view: the pool's best
  // candidate, or the typed text itself for a partial-class win.
  const to = bestClass === CLASS_PARTIAL ? raw : pool[0].hangul;
  const interp = { kind: "rr", from: raw, to, matches };
  if (nativeMatches.length > 0) interp.nativeMatches = nativeMatches;
  return interp;
}

/** True when an interpretation found real words (not just a reading list). */
function hasWordMatches(interp) {
  return interp.matches.some((m) => m.kind === "word");
}

/**
 * The best (lowest) frequency bucket among an interpretation's word matches.
 * `f` lives on the words.json entry, not on the match, so it is read back
 * here; unranked entries sort last.
 */
function bestFrequency(interp, wordTable) {
  let best = Infinity;
  for (const match of interp.matches) {
    if (match.kind !== "word" || !hasOwn(wordTable, match.canonical)) continue;
    const entries = wordTable[match.canonical];
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      if (entry && Number.isInteger(entry.f) && entry.f < best) best = entry.f;
    }
  }
  return best;
}

/**
 * The prominence of a reading-only interpretation: the best compound count
 * among its candidates. Read as the parallel of the `f` rule above — the best
 * value the side has to offer — because the reading list's own order is
 * ranked by a saturating proxy (the truncated `compounds` array) and so says
 * little about which reading a typist meant.
 */
function bestCompoundCount(interp, charTable) {
  let best = -1;
  for (const match of interp.matches) {
    if (match.kind !== "reading" || !Array.isArray(match.candidates)) continue;
    for (const candidate of match.candidates) {
      const entry = hasOwn(charTable, candidate.char) ? charTable[candidate.char] : null;
      const count = entry && Array.isArray(entry.cw) ? entry.cw.length : 0;
      if (count > best) best = count;
    }
  }
  return best;
}

/**
 * Two surviving interpretations, ordered preferred-first. A word
 * interpretation beats a syllable-only one; word vs word compares the best
 * `f`; reading vs reading compares the best compound count; a remaining tie
 * goes to Dubeolsik, which is the older, more deliberate gesture.
 */
function orderPair(dubeolsik, rr, data) {
  const wordTable = (data && data.words && data.words.words) || {};
  const charTable = (data && data.hanja && data.hanja.chars) || {};
  const dw = hasWordMatches(dubeolsik);
  const rw = hasWordMatches(rr);
  if (dw !== rw) return dw ? [dubeolsik, rr] : [rr, dubeolsik];
  if (dw) {
    const df = bestFrequency(dubeolsik, wordTable);
    const rf = bestFrequency(rr, wordTable);
    if (df !== rf) return df < rf ? [dubeolsik, rr] : [rr, dubeolsik];
  } else {
    const dc = bestCompoundCount(dubeolsik, charTable);
    const rc = bestCompoundCount(rr, charTable);
    if (dc !== rc) return dc > rc ? [dubeolsik, rr] : [rr, dubeolsik];
  }
  return [dubeolsik, rr];
}

/**
 * Run both interpreters over a query, dropping the ones that found nothing.
 *
 * @param {string} text raw query (trimming/NFC handled here)
 * @param {object} data parsed data bundle
 * @param {{native?:boolean}} [options] `native: true` (native words ADDENDUM)
 *        makes each interpretation consult the native table too
 * @returns {Array<{kind:string, from:string, to:string, matches:object[]}>}
 *          zero, one or two interpretations, preferred first
 */
export function buildInterpretations(text, data, options) {
  const native =
    options !== null && typeof options === "object" && options.native === true;
  const raw = normalize(text).trim();
  if (!isInterpretableQuery(raw)) return [];
  const dubeolsik = dubeolsikInterpretation(raw, data, native);
  const rr = rrInterpretation(raw, data, native);
  if (dubeolsik === null) return rr === null ? [] : [rr];
  if (rr === null) return [dubeolsik];
  return orderPair(dubeolsik, rr, data);
}

/**
 * Flatten interpretations into the response's `matches` plus the
 * `interpretations` descriptor, where `start` is the index in `matches` at
 * which each group begins.
 */
function flattenInterpretations(interps) {
  const matches = [];
  const descriptors = [];
  for (const interp of interps) {
    descriptors.push({
      kind: interp.kind,
      from: interp.from,
      to: interp.to,
      start: matches.length,
    });
    matches.push(...interp.matches);
  }
  return { matches, interpretations: descriptors };
}

/**
 * Native words ADDENDUM: the response-level `nativeMatches` for an interpreted
 * lookup: the interpretations' native hits in preferred order, deduped by
 * (word, pos). The per-interpretation grouping is not preserved: the shape is
 * one flat array, parallel to `matches`.
 */
function collectNativeMatches(interps) {
  const out = [];
  const seen = new Set();
  for (const interp of interps) {
    if (!Array.isArray(interp.nativeMatches)) continue;
    for (const match of interp.nativeMatches) {
      const key = `${match.word}|${match.pos}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(match);
    }
  }
  return out;
}

/**
 * Full lookup, returning the SPEC "Message protocol" response envelope.
 * Never throws.
 *
 * @param {string} text raw query or selection
 * @param {object} data parsed data bundle
 * @param {{interpret?:boolean, native?:boolean}} [options] `interpret: true`
 *        opts the call into the two interpreters above. Absent (every internal
 *        navigation) means a literal lookup, so Latin text matches nothing.
 *        `native: true` (native words ADDENDUM) adds `nativeMatches` to the
 *        response when the native table has hits; an unflagged call never
 *        reads `data.native` and its response shape is byte-identical to
 *        before the addendum.
 */
export function lookup(text, data, options) {
  try {
    const opts = options !== null && typeof options === "object" ? options : {};
    const interpret = opts.interpret === true;
    const native = opts.native === true;
    if (interpret) {
      const interps = buildInterpretations(text, data, { native });
      if (interps.length > 0) {
        const result = { ok: true, ...flattenInterpretations(interps) };
        if (native) {
          const nativeMatches = collectNativeMatches(interps);
          if (nativeMatches.length > 0) result.nativeMatches = nativeMatches;
        }
        return result;
      }
    }
    const result = { ok: true, matches: buildMatches(text, data, native) };
    if (native) {
      const nativeMatches = buildNativeMatches(text, data);
      if (nativeMatches.length > 0) result.nativeMatches = nativeMatches;
    }
    return result;
  } catch (err) {
    return { ok: false, error: toErrorMessage(err) };
  }
}

/** Normalize any thrown value into a message string. */
export function toErrorMessage(err) {
  if (err && typeof err.message === "string" && err.message) return err.message;
  return String(err);
}

/* ---------------------------------------------------------------------------
 * Search popup ADDENDUM (1.1) — omnibox suggestions.
 *
 * Pure: background.js supplies the parsed data and hands the result straight to
 * chrome.omnibox's suggest(). Nothing here touches chrome.*.
 * ------------------------------------------------------------------------- */

/** Omnibox shows a handful of rows; SPEC caps us at 5. */
export const MAX_OMNIBOX_SUGGESTIONS = 5;

/** Separator between the pieces of a suggestion's dimmed tail. */
const DIM_SEPARATOR = " · ";

const XML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape dynamic text for the omnibox description's XML mini-format. The only
 * unescaped angle brackets in a description are the <match>/<dim> tags this
 * module emits itself; every gloss, hun, eum and spelling goes through here.
 * `content` is NEVER escaped — it round-trips into onInputEntered as typed.
 */
function escapeXml(text) {
  return typeof text === "string" ? text.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]) : "";
}

/** ` <dim>a · b</dim>` for the non-empty pieces, or "" when there are none. */
function dimTail(pieces) {
  const kept = pieces.filter((p) => typeof p === "string" && p !== "");
  return kept.length === 0 ? "" : ` <dim>${escapeXml(kept.join(DIM_SEPARATOR))}</dim>`;
}

/** `<match>頭</match> plain <dim>tail</dim>` with everything dynamic escaped. */
function describe(head, plain, dimPieces) {
  const mid = typeof plain === "string" && plain !== "" ? ` ${escapeXml(plain)}` : "";
  return `<match>${escapeXml(head)}</match>${mid}${dimTail(dimPieces)}`;
}

/**
 * lvl ADDENDUM: short school-level labels for the dimmed omnibox tail. Only
 * the curriculum levels say anything useful in one word here; `a` and `r`
 * contribute nothing (the popup's level chip carries the full taxonomy).
 */
const OMNIBOX_LEVEL_LABEL = { m: "중학", h: "고교" };

/** One row for a hanja character (char match or reading-browse candidate). */
function charSuggestion(char, hun, eum, gloss, lvl) {
  const reading = [hun, eum].filter((s) => typeof s === "string" && s !== "").join(" ");
  return {
    content: char,
    description: describe(char, reading, [gloss, OMNIBOX_LEVEL_LABEL[lvl] || ""]),
  };
}

/**
 * Up to 5 omnibox suggestions for a typed query, reusing buildMatches so the
 * omnibox and the popup always agree on what the input means.
 *
 * Order: word matches (unflagged first, then lessCommon, rare last), then the reading-browse
 * candidates of a single hangul syllable, then character matches. Each row's
 * `content` is the candidate's own canonical searchable string — the canonical
 * hanja spelling for a word, the canonical character for a char/reading row —
 * so re-entering it through onInputEntered lands on the same result.
 *
 * Never throws: junk data yields [].
 *
 * @param {string} text raw omnibox input
 * @param {{hanja?:object, words?:object, variants?:object, native?:object}} data parsed data files
 * @param {{interpret?:boolean, native?:boolean, labels?:{rare?:string, native?:string, loan?:string, hybrid?:string}}} [options]
 *        same input-channel rule as lookup(); the omnibox IS a typed channel,
 *        so background.js passes `interpret`. `native: true` (native words
 *        ADDENDUM) draws the rows from the All-scope result set, native
 *        entries included. `labels` (Korean language mode ADDENDUM) are the
 *        markers the dimmed tails carry, in the stored language;
 *        background.js reads them from the message table. Absent, English.
 *        Origin markers ADDENDUM: a native row's tail carries the label of
 *        its `origin` (native, loan, hybrid); a row without an origin
 *        carries no marker.
 * @returns {Array<{content:string, description:string}>}
 */
export function buildOmniboxSuggestions(text, data, options) {
  try {
    // Same generators and ordering as lookup(): `hj toddlf` suggests 생일's
    // entries, `hj gukmin` suggests 국민's. Each row's `content` stays the
    // candidate's canonical searchable string, so the suggestion the user
    // picks re-enters as hanja, not as what they typed.
    const opts = options !== null && typeof options === "object" ? options : {};
    const interpret = opts.interpret === true;
    const native = opts.native === true;
    const given = opts.labels !== null && typeof opts.labels === "object" ? opts.labels : {};
    const labels = {
      rare: typeof given.rare === "string" ? given.rare : "rare",
      native: typeof given.native === "string" ? given.native : "native",
      loan: typeof given.loan === "string" ? given.loan : "loan",
      hybrid: typeof given.hybrid === "string" ? given.hybrid : "hybrid",
    };
    const interps = interpret ? buildInterpretations(text, data, { native }) : [];
    const groups =
      interps.length > 0
        ? interps.map((i) => ({
            matches: i.matches,
            nativeMatches: Array.isArray(i.nativeMatches) ? i.nativeMatches : [],
          }))
        : [
            {
              matches: buildMatches(text, data, native),
              nativeMatches: native ? buildNativeMatches(text, data) : [],
            },
          ];

    // Ordering applies WITHIN a group, so the preferred interpretation's rows
    // stay ahead of the other's.
    const rows = [];
    for (const { matches, nativeMatches } of groups) {
      const words = matches.filter((m) => m.kind === "word");
      rows.push(
        // Flagged spellings rank last across the whole query, not just
        // within one hangul span (buildMatches only orders within a span).
        // Native rows sit after the unflagged hanja, per the lead rule's
        // priority order: unflagged hanja, native, lessCommon hanja, rare
        // hanja.
        ...words.filter((m) => m.rare !== true && m.lessCommon !== true),
        ...nativeMatches,
        ...words.filter((m) => m.lessCommon === true && m.rare !== true),
        ...words.filter((m) => m.rare === true),
        ...matches.filter((m) => m.kind === "reading"),
        ...matches.filter((m) => m.kind === "char")
      );
    }

    const suggestions = [];
    const seen = new Set();
    const push = (suggestion) => {
      if (suggestion === null || seen.has(suggestion.content)) return;
      seen.add(suggestion.content);
      suggestions.push(suggestion);
    };

    for (const match of rows) {
      if (suggestions.length >= MAX_OMNIBOX_SUGGESTIONS) break;
      if (match.kind === "word") {
        const gloss = Array.isArray(match.glosses) ? match.glosses[0] : "";
        push({
          content: match.canonical,
          description: describe(match.canonical, match.hangul, [
            gloss,
            match.rare === true ? labels.rare : "",
          ]),
        });
      } else if (match.kind === "native") {
        // Native words ADDENDUM: the origin marker sits in the dim tail,
        // where hanja rows carry the school level. Content is the hangul
        // word itself, so activating the row deep-links to it literally.
        // Origin markers ADDENDUM: the marker is the match's own origin
        // class; no origin, no marker.
        const gloss = Array.isArray(match.glosses) ? match.glosses[0] : "";
        const origin = nativeOriginOf(match);
        push({
          content: match.word,
          description: describe(match.word, "", [gloss, origin !== null ? labels[origin] : ""]),
        });
      } else if (match.kind === "char") {
        const pair = Array.isArray(match.eumhun) ? match.eumhun[0] : null;
        const gloss = Array.isArray(match.glosses) ? match.glosses[0] : "";
        push(
          charSuggestion(
            match.canonical,
            pair && typeof pair.hun === "string" ? pair.hun : "",
            pair && typeof pair.eum === "string" ? pair.eum : "",
            gloss,
            match.lvl
          )
        );
      } else if (match.kind === "reading" && Array.isArray(match.candidates)) {
        // The syllable itself is already the default suggestion ("search for
        // %s" opens the browse), so the rows here are the individual hanja.
        for (const c of match.candidates) {
          if (suggestions.length >= MAX_OMNIBOX_SUGGESTIONS) break;
          if (!c || typeof c.char !== "string" || c.char === "") continue;
          push(charSuggestion(c.char, c.hun, c.eum, c.gloss, c.lvl));
        }
      }
    }

    return suggestions.slice(0, MAX_OMNIBOX_SUGGESTIONS);
  } catch {
    return [];
  }
}
