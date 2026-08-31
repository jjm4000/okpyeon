/**
 * Okpyeon: romanized Korean back to hangul candidates (deromanization).
 *
 * The inverse of extension/rr.js, per the SPEC "Romanized search v2" addendum:
 * a pure-Latin query becomes ranked hangul candidate STRINGS, and each
 * candidate then behaves exactly like typed hangul (the parity rule lives in
 * lookup.js). The generator is GENEROUS BY DESIGN and the dictionary is the
 * gate. Garbage candidates match nothing, exactly like the Dubeolsik
 * channel, so every branch here errs toward emitting.
 *
 * Three layers of branching, mirroring what rr.js can emit:
 *
 *   LETTERS   segmentation ambiguity: vowel digraphs read whole or split
 *             (oe as ㅚ or ㅗ+ㅔ), ng as a coda or ㄴ+ㄱ, doubled consonants
 *             as tense onsets or coda/onset pairs, translit codas (johda,
 *             gabs) beside transcription codas (jota, gap).
 *   PREIMAGES the inverses of rr.js's sound changes, one alternative list
 *             per syllable boundary: nasalization back to its stop source
 *             (gungmin -> 국민), ll/nn back to the ㄴ+ㄹ boundary (silla ->
 *             신라), ji/chi back to 디/티 before ㅣ (gachi -> 같이), the ㅎ
 *             mergers back through both sides (joko -> 좋고, japyeo -> 잡혀),
 *             and liaison back to a moved final (gapsi -> 값이, joa -> 좋아).
 *   HABITS    the SPEC-pinned spelling-habit variants (kukmin, oo for u, sh
 *             before a vowel), the v1 query-side expansion moved in here so
 *             the loosened spellings feed the same branching.
 *
 * Forward RR (rr.js) is imported for RANKING ONLY: a candidate whose forms()
 * contain the normalized query exactly is tier 0, everything else tier 1.
 * Forward verification never gates a candidate; a gate would drop the
 * deliberate habit forgiveness.
 *
 * Bounds (SPEC v2, pinned in test/lookup.test.mjs): parse lists are capped at
 * BRANCH_CAP per position, the candidate list at candidateBudget() (a per-
 * syllable formula over CANDIDATE_CAP_PER_SYLLABLE), and the input at
 * MAX_LATIN letters. Preimage combinations are enumerated cheapest first
 * (surface reading, then one rule undone, then two, ...) so truncation sheds
 * the most contrived readings last. A 20-letter worst case stays well under
 * 50ms in node; see the pinned timing test.
 *
 * The jamo tables below duplicate rr.js internals (rr.js does not export
 * them). The round-trip completeness test, which finds every dictionary word
 * by deromanizing each of its own forms(), is what keeps the two in step.
 *
 * Pure: NO chrome.* usage, imports into plain Node like dubeolsik.js does.
 */

import { forms } from "./rr.js";

// ------------------------------------------------------------------ bounds

/** Parse lists kept per string position (letter-segmentation branching). */
export const BRANCH_CAP = 256;
/**
 * Hangul candidates generated per SYLLABLE of the shortest parse, across all
 * habit variants: the preimage space grows per syllable, so a flat budget
 * either starves an 8-syllable compound or wastes work on a 2-syllable word.
 * candidateBudget() below is the pinned formula.
 */
export const CANDIDATE_CAP_PER_SYLLABLE = 640;

/** Total candidate budget for a query whose shortest parse has `minLen`
 *  syllables. One CANDIDATE_CAP_PER_SYLLABLE covers up to 3 syllables (the
 *  overwhelmingly common query), each further syllable adds one more, and
 *  the factor caps at 8: dictionary headwords top out near 8 syllables, so
 *  past that only degenerate vowel runs would grow, and those degrade by
 *  truncation instead. */
export function candidateBudget(minLen) {
  return CANDIDATE_CAP_PER_SYLLABLE * Math.min(Math.max(1, minLen - 2), 8);
}
/** Letters of normalized input consumed; the rest is truncated, never hung. */
export const MAX_LATIN = 48;
/** Habit-variant expansion is deliberately bounded; the v1 cap, unchanged. */
export const MAX_RR_VARIANTS = 8;

// ------------------------------------------------------------------ jamo

const SBASE = 0xac00;
const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ",
  "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ",
  "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

const CHO_INDEX = new Map([...CHO].map((j, i) => [j, i]));
const JUNG_INDEX = new Map([...JUNG].map((j, i) => [j, i]));
const JONG_INDEX = new Map(JONG.map((j, i) => [j, i]));

/** [cho, jung, jong] triples -> a hangul string. Triples are valid here by
 *  construction (the tables below only hold legal jamo). */
function composeSyls(syls) {
  let out = "";
  for (const [c, v, t] of syls) {
    out += String.fromCodePoint(
      SBASE + CHO_INDEX.get(c) * 588 + JUNG_INDEX.get(v) * 28 + JONG_INDEX.get(t)
    );
  }
  return out;
}

// Coda clusters as [kept, moved], and coda neutralization: the same tables
// rr.js applies forward; here they are read backward.
const SPLIT = {
  "ㄳ": ["ㄱ", "ㅅ"], "ㄵ": ["ㄴ", "ㅈ"], "ㄶ": ["ㄴ", "ㅎ"],
  "ㄺ": ["ㄹ", "ㄱ"], "ㄻ": ["ㄹ", "ㅁ"], "ㄼ": ["ㄹ", "ㅂ"],
  "ㄽ": ["ㄹ", "ㅅ"], "ㄾ": ["ㄹ", "ㅌ"], "ㄿ": ["ㄹ", "ㅍ"],
  "ㅀ": ["ㄹ", "ㅎ"], "ㅄ": ["ㅂ", "ㅅ"],
};
const REP = {
  "ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄳ": "ㄱ", "ㄺ": "ㄱ",
  "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ", "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ",
  "ㄵ": "ㄴ", "ㄶ": "ㄴ",
  "ㄻ": "ㅁ",
  "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㅀ": "ㄹ",
  "ㅍ": "ㅂ", "ㄿ": "ㅂ", "ㅄ": "ㅂ",
};

/** Neutralized coda -> every coda it could have been (identity excluded). */
const REP_PRE = {};
for (const [src, rep] of Object.entries(REP)) {
  (REP_PRE[rep] = REP_PRE[rep] || []).push(src);
}

const H_BEFORE = { "ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅂ": "ㅍ", "ㅈ": "ㅊ" };
/** Aspirate onset -> the lax onset a coda ㅎ hardened (H_AFTER inverse). */
const H_LAX = { "ㅋ": "ㄱ", "ㅌ": "ㄷ", "ㅊ": "ㅈ", "ㅆ": "ㅅ" };
/** Nasal coda -> the plain stop nasalization made it from. */
const NASAL_SRC = { "ㅇ": "ㄱ", "ㄴ": "ㄷ", "ㅁ": "ㅂ" };
const Y_VOWELS = new Set("ㅑㅒㅕㅖㅛㅠ");

/** rr.js's hMerge: what a coda + onset ㅎ merge into, through neutralization. */
function hMerge(j) {
  return H_BEFORE[j] || H_BEFORE[REP[j] || j] || null;
}

/**
 * (surface coda, surface aspirate onset) -> source codas whose merger with an
 * onset ㅎ produced that surface. Built by running every coda through the
 * forward rule, so the pair inventory (읽히 일키, 앉히 안치, 잡혀 자펴, 옷
 * 한벌 오탄벌) can never drift from rr.js's.
 */
const H_ONSET_INV = new Map();
for (const j of JONG) {
  if (j === "" || j === "ㅇ") continue;
  let surface = null;
  if (j in SPLIT && hMerge(SPLIT[j][1])) {
    surface = SPLIT[j][0] + hMerge(SPLIT[j][1]);
  } else if (hMerge(j)) {
    surface = "" + hMerge(j);
  }
  if (surface === null) continue;
  if (!H_ONSET_INV.has(surface)) H_ONSET_INV.set(surface, []);
  H_ONSET_INV.get(surface).push(j);
}

// ------------------------------------------------------------------ letters

// Letter readings, the union of rr.js's transcription and Article 8 tables
// read backward. Kept NARROW on purpose: a coda letter maps to the single
// coda its table row names, and every fuzzier source (부엌 for bueok, 좋 for
// jot) is reached through the preimage slots below instead, where it costs a
// deviation instead of multiplying every parse.
const ONSETS = {
  g: ["ㄱ"], kk: ["ㄲ"], n: ["ㄴ"], d: ["ㄷ"], tt: ["ㄸ"],
  r: ["ㄹ"], l: ["ㄹ"], m: ["ㅁ"], b: ["ㅂ"], pp: ["ㅃ"],
  s: ["ㅅ"], ss: ["ㅆ"], j: ["ㅈ"], jj: ["ㅉ"], ch: ["ㅊ"],
  k: ["ㅋ"], t: ["ㅌ"], p: ["ㅍ"], h: ["ㅎ"],
};
const VOWELS = {
  a: "ㅏ", ae: "ㅐ", ya: "ㅑ", yae: "ㅒ", eo: "ㅓ", e: "ㅔ",
  yeo: "ㅕ", ye: "ㅖ", o: "ㅗ", wa: "ㅘ", wae: "ㅙ", oe: "ㅚ",
  yo: "ㅛ", u: "ㅜ", wo: "ㅝ", we: "ㅞ", wi: "ㅟ", yu: "ㅠ",
  eu: "ㅡ", ui: "ㅢ", i: "ㅣ",
};
const CODAS = {
  k: ["ㄱ"], g: ["ㄱ"], kk: ["ㄲ"], gs: ["ㄳ"], n: ["ㄴ"], nj: ["ㄵ"],
  nh: ["ㄶ"], t: ["ㄷ"], d: ["ㄷ"], l: ["ㄹ"], lg: ["ㄺ"], lm: ["ㄻ"],
  lb: ["ㄼ"], ls: ["ㄽ"], lt: ["ㄾ"], lp: ["ㄿ"], lh: ["ㅀ"], m: ["ㅁ"],
  p: ["ㅂ"], b: ["ㅂ"], bs: ["ㅄ"], s: ["ㅅ"], ss: ["ㅆ"], j: ["ㅈ"],
  ch: ["ㅊ"], h: ["ㅎ"], ng: ["ㅇ"],
};

const byLengthDesc = (keys) => keys.slice().sort((a, b) => b.length - a.length);
const ONSET_KEYS = byLengthDesc(Object.keys(ONSETS));
const VOWEL_KEYS = byLengthDesc(Object.keys(VOWELS));
const CODA_KEYS = byLengthDesc(Object.keys(CODAS));

// ------------------------------------------------------------------ habits

/** Habit rule (b): a leading tense/aspirate spelling for a lax initial. */
const DEVOICE_LEADING = { k: "g", t: "d", p: "b" };

/**
 * Romanization normalization: case, and the punctuation romanizations use to
 * mark syllable boundaries (guk-min, han'gul), are all noise against jamo
 * arithmetic. Moved from lookup.js, byte-identical behavior.
 */
export function normalizeRomanization(text) {
  return typeof text === "string"
    ? text.toLowerCase().replace(/[-'’\s]/g, "")
    : "";
}

/**
 * The bounded habit-variant set: the normalized form, plus the three v1
 * spelling rules applied in combination, so kooksu reaches guksu. Capped at
 * MAX_RR_VARIANTS (three binary rules cannot exceed it, but the cap is
 * enforced anyway so no future rule can make this unbounded). Moved from
 * lookup.js, byte-identical behavior.
 *
 * @param {string} text raw (or already normalized) query
 * @returns {string[]} variants, normalized form first, deduped
 */
export function romanizationVariants(text) {
  const base = normalizeRomanization(text);
  if (base === "") return [];
  const out = [base];
  const rules = [
    // (b) a leading k/t/p is often the lax initial RR spells g/d/b.
    (s) => (s[0] in DEVOICE_LEADING ? DEVOICE_LEADING[s[0]] + s.slice(1) : null),
    // (c) McCune-style `oo` for RR's `u`.
    (s) => (s.includes("oo") ? s.replace(/oo/g, "u") : null),
    // (d) `sh` before a vowel is RR's plain `s`.
    (s) => (/sh[aeiou]/.test(s) ? s.replace(/sh(?=[aeiou])/g, "s") : null),
  ];
  for (const rule of rules) {
    for (const seed of out.slice()) {
      if (out.length >= MAX_RR_VARIANTS) break;
      const next = rule(seed);
      if (typeof next === "string" && next !== "" && !out.includes(next)) out.push(next);
    }
  }
  return out;
}

// ------------------------------------------------------------------ parsing

/**
 * Letter segmentation: every reading of `latin` as a sequence of surface
 * syllables, as [cho, jung, jong] triples. Branches on onset/coda boundary
 * placement, vowel digraphs whole vs split, ng as coda vs ㄴ+ㄱ, doubled
 * consonants as tense vs pair. Memoized per position; each position's suffix
 * list is capped at BRANCH_CAP. The no-coda branch is tried first so the
 * plainer reading of an ambiguous consonant (무시... over 뭇이...) leads.
 *
 * @returns {Array<Array<[string,string,string]>>} parses (possibly empty)
 */
function parseSurface(latin) {
  const memo = new Map();

  const at = (pos) => {
    const hit = memo.get(pos);
    if (hit !== undefined) return hit;
    const out = [];
    memo.set(pos, out);
    if (pos === latin.length) {
      out.push([]);
      return out;
    }

    // Collect every first-syllable choice with its (memoized) suffix parses,
    // then merge them ROUND-ROBIN under the cap: each choice lands its first
    // suffix before any choice lands its second, so one prolific branch can
    // never crowd a rarer segmentation out of the list entirely.
    const choices = [];
    const consider = (cho, jung, jong, next) => {
      const rests = at(next);
      if (rests.length > 0) choices.push({ syl: [cho, jung, jong], rests });
    };
    const syllable = (cho, jung, codaStart) => {
      // No coda first, then every coda spelling that matches, longest first.
      if (codaStart === latin.length) {
        choices.push({ syl: [cho, jung, ""], rests: [[]] });
      } else {
        consider(cho, jung, "", codaStart);
      }
      for (const codaKey of CODA_KEYS) {
        if (!latin.startsWith(codaKey, codaStart)) continue;
        for (const jong of CODAS[codaKey]) {
          consider(cho, jung, jong, codaStart + codaKey.length);
        }
      }
    };
    const vowels = (cho, vstart) => {
      for (const vowelKey of VOWEL_KEYS) {
        if (!latin.startsWith(vowelKey, vstart)) continue;
        syllable(cho, VOWELS[vowelKey], vstart + vowelKey.length);
      }
    };
    for (const onsetKey of ONSET_KEYS) {
      if (!latin.startsWith(onsetKey, pos)) continue;
      for (const cho of ONSETS[onsetKey]) vowels(cho, pos + onsetKey.length);
    }
    // The empty onset (ㅇ): a syllable that begins with its vowel.
    vowels("ㅇ", pos);

    for (let r = 0; out.length < BRANCH_CAP; r += 1) {
      let any = false;
      for (const { syl, rests } of choices) {
        if (r >= rests.length) continue;
        any = true;
        out.push([syl, ...rests[r]]);
        if (out.length >= BRANCH_CAP) break;
      }
      if (!any) break;
    }
    return out;
  };

  // An empty parse at position 0 would mean empty input, which the caller
  // already rejected; a missing one means unparseable letters.
  return at(0).filter((p) => p.length > 0);
}

// ------------------------------------------------------------------ preimages

/**
 * Every source (coda, onset) pair rr.js's sound changes could have turned
 * into the surface pair (c, o) before the vowel v, each with a COST: 0 for
 * the surface itself, 1 for a single plain rule read backward, 2 when the
 * source also had to fall through coda neutralization (있는 <- 인는 goes
 * ㅆ -> ㄷ -> ㄴ, two hops). Costs order the expansion: the candidate cap
 * spends its budget on the likely readings before the contrived ones. Each
 * forward rule in rr.js's apply()/link() has its inverse here; study them
 * side by side.
 *
 * @returns {Array<[string, string, number]>} [coda, onset, cost], deduped
 *          (first, i.e. cheapest, occurrence wins), surface pair first
 */
function boundarySources(c, o, v) {
  const out = [];
  const seen = new Set();
  const add = (cc, oo, w) => {
    const key = cc + oo;
    if (seen.has(key)) return;
    seen.add(key);
    out.push([cc, oo, w]);
  };
  add(c, o, 0);

  // Ordered nasalization sources: the plain stop, then its neutralized kin.
  const nasalSources = (x) => [NASAL_SRC[x], ...(REP_PRE[NASAL_SRC[x]] || [])];
  const spread = (list, oo, base) => {
    list.forEach((cc, i) => add(cc, oo, i === 0 ? base : base + 1));
  };

  if (o === "ㄴ" || o === "ㅁ") {
    // Nasalization: 궁민 <- 국민, 뱅마 <- 백마, 심니 <- 십리.
    if (c in NASAL_SRC) spread(nasalSources(c), o, 1);
  }
  if (o === "ㄴ") {
    // A nasalized ㄹ onset: 종노 <- 종로, 왕심니 <- 왕십리, 신문노 <- 신문로.
    if (c === "ㅇ" || c === "ㅁ" || c === "ㄴ") {
      add(c, "ㄹ", 1);
      if (c in NASAL_SRC) spread(nasalSources(c), "ㄹ", 2);
    }
    // ㄴ-insertion (possibly nasalizing the coda too): 항녀울 <- 학여울.
    if (Y_VOWELS.has(v)) {
      add(c, "ㅇ", 1);
      if (c in NASAL_SRC) spread(nasalSources(c), "ㅇ", 1);
      for (const cc of REP_PRE[c] || []) add(cc, "ㅇ", 2);
    }
  }
  if (c === "ㄹ" && o === "ㄹ") {
    add("ㄴ", "ㄹ", 1);                        // 실라 <- 신라
    add("ㄹ", "ㄴ", 1);                        // 별래 <- 별내
    if (Y_VOWELS.has(v)) add("ㄹ", "ㅇ", 1);   // 알략 <- 알약
  }

  // ㅎ in the coda hardening the next onset: 조코 <- 좋고, 만치 <- 많지.
  const lax = H_LAX[o];
  if (lax !== undefined) {
    if (c === "") add("ㅎ", lax, 1);
    if (c === "ㄴ") add("ㄶ", lax, 1);
    if (c === "ㄹ") add("ㅀ", lax, 1);
  }
  // ㅎ in the onset hardening the coda: 자펴 <- 잡혀, 안치 <- 앉히, and the
  // everyday 하다 mergers (깨끄타다 <- 깨끗하다). All cost 1: neutralization
  // rides inside rr.js's single hMerge step, so this is one rule backward.
  for (const cc of H_ONSET_INV.get(c + o) || []) add(cc, "ㅎ", 1);
  // 구개음화 through 히: 구치다 <- 굳히다.
  if (c === "" && o === "ㅊ" && v === "ㅣ") add("ㄷ", "ㅎ", 1);

  if (o === "ㅇ") {
    // A ㅎ coda drops before a vowel: 조아 <- 좋아.
    if (c === "") add("ㅎ", "ㅇ", 1);
  } else if (c === "") {
    // Liaison moved a lone coda onto the vowel: 오시 <- 옷이, 부어케 <- 부엌에.
    if (JONG_INDEX.has(o)) add(o, "ㅇ", 1);
    // Palatalized liaison: 해도지 <- 해돋이, 가치 <- 같이.
    if (v === "ㅣ" && o === "ㅈ") add("ㄷ", "ㅇ", 1);
    if (v === "ㅣ" && o === "ㅊ") add("ㅌ", "ㅇ", 1);
    // ㄶ/ㅀ shed their ㅎ into a vowel: 마나 <- 많아, 시러 <- 싫어.
    if (o === "ㄴ") add("ㄶ", "ㅇ", 1);
    if (o === "ㄹ") add("ㅀ", "ㅇ", 1);
  } else {
    // Liaison split a cluster: 갑시 <- 값이, 일거 <- 읽어, 훌치 <- 훑이.
    for (const [cluster, [keep, move]] of Object.entries(SPLIT)) {
      if (keep !== c) continue;
      if (move === o) add(cluster, "ㅇ", 1);
      if (move === "ㅌ" && o === "ㅊ" && v === "ㅣ") add(cluster, "ㅇ", 1);
    }
  }

  // Coda neutralization alone (부억 <- 부엌), after the rules above so a
  // rule-derived reading of the same pair keeps its cheaper cost.
  for (const cc of REP_PRE[c] || []) add(cc, o, 1);
  return out;
}

/**
 * Emit every preimage of one surface parse whose deviations from the surface
 * cost exactly `cost` (see boundarySources). Slots are the syllable
 * boundaries plus the final coda, whose neutralization inverse (지읏 <- jieut)
 * costs 1 per rr.js's last-syllable REP step. `emit` returns false to stop
 * (the caller's candidate cap).
 */
function expandParse(parse, cost, emit) {
  const last = parse.length - 1;
  const slots = [];
  for (let i = 0; i + 1 < parse.length; i += 1) {
    slots.push(boundarySources(parse[i][2], parse[i + 1][0], parse[i + 1][1]));
  }
  // The final coda as one more slot: [coda, null, cost] rows, null marking
  // "no onset to touch".
  slots.push([
    [parse[last][2], null, 0],
    ...(REP_PRE[parse[last][2]] || []).map((cc) => [cc, null, 1]),
  ]);

  // suffixMax[i]: the most cost slots i.. can still absorb, for pruning.
  const suffixMax = new Array(slots.length + 1).fill(0);
  for (let i = slots.length - 1; i >= 0; i -= 1) {
    let max = 0;
    for (const [, , w] of slots[i]) if (w > max) max = w;
    suffixMax[i] = suffixMax[i + 1] + max;
  }
  if (cost > suffixMax[0]) return true;

  const syls = parse.map((s) => s.slice());
  const walk = (i, left) => {
    if (i === slots.length) return left !== 0 || emit(composeSyls(syls));
    for (const [cc, oo, w] of slots[i]) {
      if (w > left || left - w > suffixMax[i + 1]) continue;
      syls[i][2] = cc;
      if (oo !== null) syls[i + 1][0] = oo;
      if (!walk(i + 1, left - w)) return false;
    }
    // Restore the surface reading for the caller above this frame.
    syls[i][2] = slots[i][0][0];
    if (i < last) syls[i + 1][0] = parse[i + 1][0];
    return true;
  };
  return walk(0, cost);
}

// ------------------------------------------------------------------ public

/**
 * Ranked hangul candidates for a romanized query.
 *
 * Order: tier 0 (candidates whose own rr.js forms() contain the normalized
 * query exactly) before tier 1 (everything the generous branching reached,
 * habit variants included); within a tier, fewer sound-change deviations
 * first, habit variants in expansion order. Deduped; a candidate reachable
 * both ways keeps tier 0. The list is capped at candidateBudget(minLen).
 *
 * @param {string} latin raw query (normalization handled here)
 * @returns {Array<{hangul: string, tier: 0|1}>}
 */
export function deromanize(latin) {
  const normalized = normalizeRomanization(latin).slice(0, MAX_LATIN);
  if (normalized === "" || !/^[a-z]+$/.test(normalized)) return [];

  const variants = romanizationVariants(normalized);
  const parsed = [];
  let maxSlots = 0;
  for (const variant of variants) {
    for (const parse of parseSurface(variant)) {
      parsed.push(parse);
      if (parse.length > maxSlots) maxSlots = parse.length;
    }
  }
  // Fewest syllables first: sound changes never merge syllables, so the true
  // reading of an honest form is always among the shortest parses, and the
  // candidate cap should shed vowel-splitting parses (하네울) before it sheds
  // the compact ones (하늘). The sort is stable, so within a length the habit
  // variants keep their expansion order.
  parsed.sort((a, b) => a.length - b.length);

  const minLen = parsed.length > 0 ? parsed[0].length : 0;
  const seen = new Set();
  const ordered = [];
  let budget = candidateBudget(minLen);
  const emit = (hangul) => {
    if (!seen.has(hangul)) {
      seen.add(hangul);
      ordered.push(hangul);
      budget -= 1;
    }
    return budget > 0;
  };

  // Cost levels run OUTSIDE the parse loop: every surface reading is emitted
  // before any single-rule preimage, and those before the compound readings,
  // so the cap sheds the most contrived combinations first. A parse pays its
  // extra syllables over the shortest parse as up-front cost, so the compact
  // readings (하늘) spend the budget before the vowel-splitting ones (하네울)
  // have finished their surface forms. Per-slot costs top out at 2, so 2x the
  // slot count plus the length spread covers every combination.
  outer: for (let level = 0; level <= 2 * maxSlots + (maxSlots - minLen); level += 1) {
    for (const parse of parsed) {
      const cost = level - (parse.length - minLen);
      if (cost < 0) break; // parses are sorted by length; the rest cost more
      if (!expandParse(parse, cost, emit)) break outer;
    }
  }

  const tier0 = [];
  const tier1 = [];
  for (const hangul of ordered) {
    (forms(hangul).includes(normalized) ? tier0 : tier1).push(hangul);
  }
  return [
    ...tier0.map((hangul) => ({ hangul, tier: 0 })),
    ...tier1.map((hangul) => ({ hangul, tier: 1 })),
  ];
}
