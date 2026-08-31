/**
 * Hanja Hover — Revised Romanization (국어의 로마자 표기법), forward direction.
 *
 * Port of pipeline/rr.py per the SPEC "Romanized search v2" addendum: one
 * implementation of the phonology, in the language that runs it. The module
 * must emit the SAME forms family as rr.py's forms() for any hangul string;
 * test/lookup.test.mjs proves that against the python original.
 *
 * Forms per hangul string:
 *
 *   NAIVE    letter-for-letter, positional, no cross-syllable interaction.
 *            국민 -> gukmin.  This is what a learner types.
 *   OFFICIAL the standard's sound changes applied at jamo level ACROSS
 *            syllable boundaries first, then romanized.  국민 -> gungmin.
 *   TRANSLIT Article 8: one fixed letter per jamo, no sound changes.
 *
 * Tensification (된소리) is deliberately NOT marked, per the standard:
 * 국가 stays gukga, 값이 stays gapsi.
 *
 * Exported surface: isSyllable, decompose, compose, translit, naive,
 * official, candidates, forms. No chrome.* usage, no data files; everything
 * is Unicode arithmetic over the 11,172 precomposed syllables.
 */

// ------------------------------------------------------------------ jamo

const SBASE = 0xac00;
const SLAST = 0xd7a3;

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ",
  "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ",
  "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

// Consonant clusters in the coda, as [kept, moved] — the second element is
// what resyllabifies onto a following vowel (읽어 -> 일거, 값이 -> 갑시).
const SPLIT = {
  "ㄳ": ["ㄱ", "ㅅ"], "ㄵ": ["ㄴ", "ㅈ"], "ㄶ": ["ㄴ", "ㅎ"],
  "ㄺ": ["ㄹ", "ㄱ"], "ㄻ": ["ㄹ", "ㅁ"], "ㄼ": ["ㄹ", "ㅂ"],
  "ㄽ": ["ㄹ", "ㅅ"], "ㄾ": ["ㄹ", "ㅌ"], "ㄿ": ["ㄹ", "ㅍ"],
  "ㅀ": ["ㄹ", "ㅎ"], "ㅄ": ["ㅂ", "ㅅ"],
};

// 평파열음화 + 자음군 단순화: what a coda is actually pronounced as when it is
// NOT carried over to a following vowel. Seven-consonant inventory.
const REP = {
  "ㄲ": "ㄱ", "ㅋ": "ㄱ", "ㄳ": "ㄱ", "ㄺ": "ㄱ",
  "ㅅ": "ㄷ", "ㅆ": "ㄷ", "ㅈ": "ㄷ", "ㅊ": "ㄷ", "ㅌ": "ㄷ", "ㅎ": "ㄷ",
  "ㄵ": "ㄴ", "ㄶ": "ㄴ",
  "ㄻ": "ㅁ",
  "ㄼ": "ㄹ", "ㄽ": "ㄹ", "ㄾ": "ㄹ", "ㅀ": "ㄹ",
  "ㅍ": "ㅂ", "ㄿ": "ㅂ", "ㅄ": "ㅂ",
};

// ------------------------------------------------------------------ letters

const ONSET_ROM = {
  "ㄱ": "g", "ㄲ": "kk", "ㄴ": "n", "ㄷ": "d", "ㄸ": "tt", "ㄹ": "r",
  "ㅁ": "m", "ㅂ": "b", "ㅃ": "pp", "ㅅ": "s", "ㅆ": "ss", "ㅇ": "",
  "ㅈ": "j", "ㅉ": "jj", "ㅊ": "ch", "ㅋ": "k", "ㅌ": "t", "ㅍ": "p",
  "ㅎ": "h",
};

// Coda values, including the clusters (they romanize as their representative
// sound — this is what makes the NAIVE form usable without any rule engine).
const CODA_ROM = {
  "": "", "ㄱ": "k", "ㄲ": "k", "ㄳ": "k", "ㄴ": "n", "ㄵ": "n", "ㄶ": "n",
  "ㄷ": "t", "ㄹ": "l", "ㄺ": "k", "ㄻ": "m", "ㄼ": "l", "ㄽ": "l",
  "ㄾ": "l", "ㄿ": "p", "ㅀ": "l", "ㅁ": "m", "ㅂ": "p", "ㅄ": "p",
  "ㅅ": "t", "ㅆ": "t", "ㅇ": "ng", "ㅈ": "t", "ㅊ": "t", "ㅋ": "k",
  "ㅌ": "t", "ㅍ": "p", "ㅎ": "t",
};

// Article 8 (전자법): one fixed letter per jamo, whatever its position, no
// sound changes at all. ㄱ=g, ㄷ=d, ㅂ=b, ㄹ=l, ㅅ=s everywhere; clusters are
// spelled out letter by letter (값 gabs, 밖 bakk, 없 eobs); ㅎ is written even
// where transcription drops it (좋다 johda). The standard also writes a hyphen
// for the silent ㅇ in a non-initial syllable (물엿 mul-yeos); the index omits
// it, since the runtime strips hyphens from typed queries anyway.
const TRANSLIT_ONSET = {
  "ㄱ": "g", "ㄲ": "kk", "ㄴ": "n", "ㄷ": "d", "ㄸ": "tt", "ㄹ": "l",
  "ㅁ": "m", "ㅂ": "b", "ㅃ": "pp", "ㅅ": "s", "ㅆ": "ss", "ㅇ": "",
  "ㅈ": "j", "ㅉ": "jj", "ㅊ": "ch", "ㅋ": "k", "ㅌ": "t", "ㅍ": "p",
  "ㅎ": "h",
};
const TRANSLIT_CODA = {
  "": "", "ㅇ": "ng",
  "ㄱ": "g", "ㄲ": "kk", "ㄴ": "n", "ㄷ": "d", "ㄸ": "tt", "ㄹ": "l",
  "ㅁ": "m", "ㅂ": "b", "ㅃ": "pp", "ㅅ": "s", "ㅆ": "ss",
  "ㅈ": "j", "ㅉ": "jj", "ㅊ": "ch", "ㅋ": "k", "ㅌ": "t", "ㅍ": "p",
  "ㅎ": "h",
  "ㄳ": "gs", "ㄵ": "nj", "ㄶ": "nh", "ㄺ": "lg", "ㄻ": "lm", "ㄼ": "lb",
  "ㄽ": "ls", "ㄾ": "lt", "ㄿ": "lp", "ㅀ": "lh", "ㅄ": "bs",
};

const VOWEL_ROM = {
  "ㅏ": "a", "ㅐ": "ae", "ㅑ": "ya", "ㅒ": "yae", "ㅓ": "eo", "ㅔ": "e",
  "ㅕ": "yeo", "ㅖ": "ye", "ㅗ": "o", "ㅘ": "wa", "ㅙ": "wae", "ㅚ": "oe",
  "ㅛ": "yo", "ㅜ": "u", "ㅝ": "wo", "ㅞ": "we", "ㅟ": "wi", "ㅠ": "yu",
  "ㅡ": "eu", "ㅢ": "ui", "ㅣ": "i",
};

// ㅎ + ㄱ/ㄷ/ㅈ/ㅅ  ->  ㅋ/ㅌ/ㅊ/ㅆ  (좋고 조코, 놓다 노타, 낳지 나치, 좋소 조쏘)
const H_AFTER = { "ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅈ": "ㅊ", "ㅅ": "ㅆ" };
// ㄱ/ㄷ/ㅂ/ㅈ + ㅎ  ->  ㅋ/ㅌ/ㅍ/ㅊ  (잡혀 자펴, 축하 추카, 앉히 안치)
const H_BEFORE = { "ㄱ": "ㅋ", "ㄷ": "ㅌ", "ㅂ": "ㅍ", "ㅈ": "ㅊ" };
// obstruent coda -> nasal, before ㄴ/ㅁ (백마 뱅마, 국민 궁민)
const NASALIZE = { "ㄱ": "ㅇ", "ㄷ": "ㄴ", "ㅂ": "ㅁ" };
// ㄴ-insertion fires only before a GLIDE vowel; see insertN below.
const Y_VOWELS = new Set("ㅑㅒㅕㅖㅛㅠ");

/** True for a precomposed hangul syllable. */
export function isSyllable(ch) {
  const cp = ch.codePointAt(0);
  return cp >= SBASE && cp <= SLAST;
}

/** '국민' -> [['ㄱ','ㅜ','ㄱ'], ['ㅁ','ㅣ','ㄴ']]; null if not all syllables. */
export function decompose(s) {
  const out = [];
  for (const ch of s) {
    if (!isSyllable(ch)) return null;
    const i = ch.codePointAt(0) - SBASE;
    out.push([CHO[Math.floor(i / 588)], JUNG[Math.floor((i % 588) / 28)], JONG[i % 28]]);
  }
  return out;
}

/** Inverse of decompose — kept for tests and debug parity with rr.py. */
export function compose(syls) {
  return syls
    .map(([c, v, t]) =>
      String.fromCodePoint(
        SBASE + CHO.indexOf(c) * 588 + JUNG.indexOf(v) * 28 + JONG.indexOf(t)
      ))
    .join("");
}

// ------------------------------------------------------------------ romanize

/** Jamo triples -> latin. `liaison` writes ㄹㄹ as 'll' (official only). */
function romanize(syls, liaison) {
  const out = [];
  let prevCoda = "";
  for (const [cho, jung, jong] of syls) {
    let onset = ONSET_ROM[cho];
    if (liaison && cho === "ㄹ" && prevCoda === "ㄹ") {
      onset = "l"; // 신라 silla, 별내 byeollae — never 'lr'
    }
    out.push(onset + VOWEL_ROM[jung] + CODA_ROM[jong]);
    prevCoda = jong;
  }
  return out.join("");
}

// ------------------------------------------------------------------ rules

/**
 * ㄴ 첨가 (표준 발음법 29): a closed syllable followed by ㅇ + glide gains
 * ㄴ on the second syllable — 학여울 항녀울, 알약 알략, 서울역 서울력.
 *
 * The standard's own trigger list is 이/야/여/요/유, but bare 이 is excluded
 * here on purpose: an 이 after ㄷ/ㅌ is overwhelmingly the derivational
 * suffix, which palatalizes instead (해돋이 해도지, 같이 가치) — both of
 * which are binding anchors. Whether insertion applies at all is a morpheme
 * -boundary question no jamo-level rule can settle (학여울 항녀울 but 금요일
 * 그묘일), so `forms()` indexes the no-insertion reading as well rather than
 * betting on one. Mutates `syls`; returns whether anything changed.
 */
function insertN(syls) {
  let changed = false;
  for (let i = 1; i < syls.length; i++) {
    if (syls[i][0] === "ㅇ" && Y_VOWELS.has(syls[i][1]) && syls[i - 1][2]) {
      syls[i][0] = "ㄴ";
      changed = true;
    }
  }
  return changed;
}

/**
 * Boundary where the next syllable starts with a vowel: 연음 + the ㅎ and
 * palatalization rules that only apply there. Mutates both triples.
 */
function link(cur, nxt) {
  const coda = cur[2];
  if (coda === "ㅎ") {                    // 좋아 조아 — ㅎ just drops
    cur[2] = "";
  } else if (coda === "ㄶ" || coda === "ㅀ") {  // 많아 마나, 싫어 시러
    cur[2] = "";
    nxt[0] = SPLIT[coda][0];
  } else if (coda === "ㅇ") {             // 강아지 — ㅇ never moves
    // nothing
  } else if (coda in SPLIT) {             // 값이 갑시, 읽어 일거
    const [keep, moveRaw] = SPLIT[coda];
    let move = moveRaw;
    if (move === "ㅌ" && nxt[1] === "ㅣ") move = "ㅊ";  // 훑이 훌치
    cur[2] = keep;
    nxt[0] = move;
  } else if ((coda === "ㄷ" || coda === "ㅌ") && nxt[1] === "ㅣ") {
    // 구개음화: 해돋이 해도지, 같이 가치
    nxt[0] = coda === "ㄷ" ? "ㅈ" : "ㅊ";
    cur[2] = "";
  } else {                                // 옷이 오시, 부엌에 부어케
    nxt[0] = coda;
    cur[2] = "";
  }
}

/** ㅎ-onset merger through the coda's representative sound; null if none. */
function hMerge(j) {
  return H_BEFORE[j] || H_BEFORE[REP[j] || j] || null;
}

/**
 * Run the sound changes left to right. `nl` picks the reading for a
 * ㄴ+ㄹ boundary: 'auto' | 'll' | 'nn' (see forms()).
 */
function apply(syls, doInsertN, nl) {
  const s = syls.map((x) => x.slice());
  if (doInsertN) insertN(s);

  for (let i = 0; i < s.length - 1; i++) {
    const cur = s[i];
    const nxt = s[i + 1];
    let coda = cur[2];
    let onset = nxt[0];
    if (!coda) continue;

    if (onset === "ㅇ") {
      link(cur, nxt);
      continue;
    }

    // 구개음화 before 히: 굳히다 구치다
    if (coda === "ㄷ" && onset === "ㅎ" && nxt[1] === "ㅣ") {
      cur[2] = "";
      nxt[0] = "ㅊ";
      continue;
    }

    // ㅎ + 예사소리 -> 거센소리 (coda carries the ㅎ)
    if ((coda === "ㅎ" || coda === "ㄶ" || coda === "ㅀ") && onset in H_AFTER) {
      cur[2] = coda === "ㅎ" ? "" : SPLIT[coda][0];
      nxt[0] = H_AFTER[onset];
      coda = cur[2];
      onset = nxt[0];
      if (!coda) continue;
    } else if (onset === "ㅎ") {
      // 예사소리 + ㅎ -> 거센소리 (the ㅎ is the onset). ㅈ merges as
      // ㅈ+ㅎ -> ㅊ (맞히다 마치다), so it is looked up before neutralization
      // would turn it into ㄷ; ㅅ/ㅊ/ㅋ etc. go through their representative
      // sound (옷 한벌 -> 오탄벌).
      if (coda in SPLIT && hMerge(SPLIT[coda][1])) {
        const [keep, move] = SPLIT[coda];    // 읽히 일키, 앉히 안치, 밟히 발피
        cur[2] = keep;
        nxt[0] = hMerge(move);
        continue;
      }
      if (hMerge(coda)) {                    // 잡혀 자펴, 축하 추카, 맏형 마텽
        cur[2] = "";
        nxt[0] = hMerge(coda);
        continue;
      }
    }

    // everything below sees the neutralized coda
    coda = REP[coda] || coda;
    cur[2] = coda;

    if (onset === "ㄹ") {
      if (coda === "ㄱ" || coda === "ㄷ" || coda === "ㅂ" || coda === "ㅁ" || coda === "ㅇ") {
        // 왕십리 왕심니, 백로 뱅노, 종로 종노, 담력 담녁
        nxt[0] = onset = "ㄴ";
      } else if (coda === "ㄴ") {
        // 유음화 vs 비음화. Both are in the standard's example set —
        // 신라 실라 but 신문로 신문노 — and the split is lexical, not
        // phonological. 'auto' uses the mainstream heuristic for
        // Sino-Korean: a ㄹ-initial syllable hanging off a base of two
        // or more syllables assimilates the OTHER way (의견란 의견난,
        // 생산량 생산냥, 공권력 공권녁, 신문로 신문노), while a
        // two-syllable word takes 유음화 (신라, 난로, 권력). forms()
        // indexes both readings regardless.
        if (nl === "ll" || (nl === "auto" && i < 1)) {
          cur[2] = coda = "ㄹ";
        } else {
          nxt[0] = onset = "ㄴ";
        }
      }
      // coda ㄹ + onset ㄹ: already ll
    }

    if (onset === "ㄴ" || onset === "ㅁ") {
      if (coda in NASALIZE) {                // 백마 뱅마, 국민 궁민, 십리 심니
        cur[2] = NASALIZE[coda];
      } else if (coda === "ㄹ" && onset === "ㄴ") {  // 별내 별래, 알약 알략
        nxt[0] = "ㄹ";
      }
    }
  }

  const last = s[s.length - 1];
  last[2] = REP[last[2]] || last[2];
  return s;
}

// ------------------------------------------------------------------ public

/** Article 8: one fixed letter per jamo, no positional logic, no rules. */
export function translit(text) {
  const syls = decompose(text);
  if (syls === null) return null;
  return syls
    .map(([c, v, t]) => TRANSLIT_ONSET[c] + VOWEL_ROM[v] + TRANSLIT_CODA[t])
    .join("");
}

/** RR letter rules per syllable, positional, no cross-syllable changes. */
export function naive(text) {
  const syls = decompose(text);
  if (syls === null) return null;
  return romanize(syls, false);
}

/**
 * Sound changes first, then romanize. `insertNOpt` defaults to applying
 * ㄴ-insertion wherever it can fire.
 */
export function official(text, insertNOpt = null, nl = "auto") {
  const syls = decompose(text);
  if (syls === null) return null;
  const doInsert = insertNOpt === null ? true : insertNOpt;
  return romanize(apply(syls, doInsert, nl), true);
}

/**
 * Every romanization generated for `text`, primary first, WITH the
 * duplicates — `forms()` is this list deduped. Kept separate so callers
 * can see the collapse rate, matching rr.py.
 */
export function candidates(text) {
  const syls = decompose(text);
  if (syls === null) return [];
  const out = [
    romanize(syls, false),
    syls
      .map(([c, v, t]) => TRANSLIT_ONSET[c] + VOWEL_ROM[v] + TRANSLIT_CODA[t])
      .join(""),
  ];
  const probe = syls.map((x) => x.slice());
  const canInsert = insertN(probe);
  let hasNl = false;
  for (let i = 0; i < syls.length - 1; i++) {
    if (syls[i][2] === "ㄴ" && syls[i + 1][0] === "ㄹ") hasNl = true;
  }
  const inserts = canInsert ? [true, false] : [false];
  const nls = hasNl ? ["auto", "ll", "nn"] : ["auto"];
  for (const ins of inserts) {
    for (const nl of nls) {
      out.push(romanize(apply(syls, ins, nl), true));
    }
  }
  return out;
}

/**
 * Every romanization to index for `text`, primary first, deduped.
 *
 * naive, the Article 8 transliteration, then the official reading. Where
 * the standard is genuinely ambiguous for an unanalyzed common noun —
 * ㄴ-insertion, and the ㄴ+ㄹ boundary — BOTH readings are indexed rather
 * than guessed at: a spurious key costs a few bytes, a missing one costs a
 * search hit. The extra readings only appear for strings that hit one of
 * those two switches, so the usual word contributes one to three forms.
 */
export function forms(text) {
  const out = [];
  for (const v of candidates(text)) {
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
