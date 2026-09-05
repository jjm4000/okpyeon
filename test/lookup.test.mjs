/**
 * Unit tests for the pure lookup logic in extension/lookup.js.
 * Plain Node, no dependencies, no chrome globals.
 *
 *   "C:\Program Files\nodejs\node.exe" test/lookup.test.mjs
 *
 * Fixture data is defined inline below on purpose: extension/data/ holds Agent
 * A's real generated corpus and must not be depended on (or written to) here.
 * The optional smoke test at the bottom only *reads* the real files if present.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  buildFullCompounds,
  buildMatches,
  buildNativeMatches,
  nativeOriginOf,
  NATIVE_ORIGINS,
  buildOmniboxSuggestions,
  buildUsedIn,
  buildInterpretations,
  buildReadingIndex,
  buildWordParts,
  isInterpretableQuery,
  lookup,
  nativeMaxLenOf,
  MAX_NATIVE_WORD_LEN,
  RESOLVE_CAP,
  extractRuns,
  segmentRun,
  maxWordLenOf,
  maxHangulLenOf,
  MAX_OMNIBOX_SUGGESTIONS,
} from "../extension/lookup.js";

import { qwertyToHangul, isLatinQuery } from "../extension/dubeolsik.js";

import {
  deromanize,
  normalizeRomanization,
  romanizationVariants,
  candidateBudget,
  BRANCH_CAP,
  CANDIDATE_CAP_PER_SYLLABLE,
  MAX_LATIN,
  MAX_RR_VARIANTS,
} from "../extension/deromanize.js";

import {
  buildAnkiTsv,
  buildCsv,
  checkKeys,
  createFolder,
  deleteFolder,
  joinItems,
  moveItems,
  normalizeSavedState,
  normalizeSettings,
  removeItems,
  renameFolder,
  resolveExportSelection,
  toggleItem,
  CHAR_FIELDS,
  CSV_COLUMNS,
  DEFAULT_SETTINGS,
} from "../extension/saved.js";

// ---------------------------------------------------------------------------
// Inline fixtures (schema-exact per SPEC "Data files")
// ---------------------------------------------------------------------------

const variants = {
  version: 1,
  map: { 国: "國", 学: "學" },
};

const hanja = {
  version: 1,
  chars: {
    國: {
      eumhun: [{ hun: "나라", eum: "국" }],
      readings: ["국"],
      glosses: ["country; state; nation"],
      compounds: [
        { hangul: "국민", hanja: "國民", gloss: "the people of a nation" },
        { hangul: "국가", hanja: "國家", gloss: "state; country" },
      ],
      // cw addendum: complete ranked index — superset of `compounds`, may
      // reference spellings the words fixture lacks (skipped on join).
      cw: ["國民", "國家", "大韓民國", "不在words"],
      // lvl addendum: character level taxonomy. 國 is middle school.
      lvl: "m",
    },
    民: {
      eumhun: [{ hun: "백성", eum: "민" }],
      readings: ["민"],
      glosses: ["people; populace; subject"],
      compounds: [{ hangul: "국민", hanja: "國民", gloss: "the people of a nation" }],
    },
    學: {
      eumhun: [{ hun: "배울", eum: "학" }],
      readings: ["학"],
      glosses: ["to learn; to study", "school; learning"],
      compounds: [{ hangul: "학생", hanja: "學生", gloss: "student" }],
      // ranked index for the used-in tests: 學生 is contained by 學生會 and
      // 民主主義國家 is not; 不明 isn't a words key and must be skipped.
      cw: ["學生", "學生會", "不明學生"],
      lvl: "m",
    },
    生: {
      eumhun: [{ hun: "날", eum: "생" }],
      readings: ["생"],
      glosses: ["to be born; to live", "raw; fresh"],
      compounds: [{ hangul: "학생", hanja: "學生", gloss: "student" }],
    },
    事: {
      eumhun: [{ hun: "일", eum: "사" }],
      readings: ["사"],
      glosses: ["affair; matter; thing"],
      compounds: [{ hangul: "사고", hanja: "事故", gloss: "accident" }],
    },
    故: {
      eumhun: [{ hun: "연고", eum: "고" }],
      readings: ["고"],
      glosses: ["reason; cause", "old; former"],
      compounds: [{ hangul: "사고", hanja: "事故", gloss: "accident" }],
    },
    思: {
      eumhun: [{ hun: "생각", eum: "사" }],
      readings: ["사"],
      glosses: ["to think; to consider"],
      compounds: [{ hangul: "사고", hanja: "思考", gloss: "thought; thinking" }],
    },
    考: {
      eumhun: [{ hun: "생각할", eum: "고" }],
      readings: ["고"],
      glosses: ["to examine; to ponder"],
      compounds: [{ hangul: "사고", hanja: "思考", gloss: "thought; thinking" }],
    },
    // Homophones of 국 with descending compound counts, for rule 3c ranking.
    局: {
      eumhun: [{ hun: "판", eum: "국" }],
      readings: ["국"],
      glosses: ["bureau; office; situation"],
      compounds: [{ hangul: "약국", hanja: "藥局", gloss: "pharmacy" }],
      // lvl addendum: outside the curriculum but attested -> advanced.
      lvl: "a",
    },
    菊: {
      // No eumhun at all: the eum comes from `readings`, so hun must be "".
      eumhun: [],
      readings: ["국"],
      glosses: [],
      compounds: [],
      // lvl addendum: the reading-only dictionary tail -> rare.
      lvl: "r",
    },
    詐: {
      eumhun: [{ hun: "속일", eum: "사" }],
      readings: ["사"],
      glosses: ["to deceive; fraud"],
      compounds: [{ hangul: "사기", hanja: "詐欺", gloss: "fraud; swindle" }],
    },
    欺: {
      eumhun: [{ hun: "속일", eum: "기" }],
      readings: ["기"],
      glosses: ["to cheat; to deceive"],
      compounds: [{ hangul: "사기", hanja: "詐欺", gloss: "fraud; swindle" }],
    },
    // Components of 資本主義, for the word-parts addendum.
    資: {
      eumhun: [{ hun: "재물", eum: "자" }],
      readings: ["자"],
      glosses: ["property; resources"],
      compounds: [{ hangul: "자본", hanja: "資本", gloss: "capital" }],
    },
    本: {
      eumhun: [{ hun: "근본", eum: "본" }],
      readings: ["본"],
      glosses: ["root; origin; basis"],
      compounds: [{ hangul: "자본", hanja: "資本", gloss: "capital" }],
    },
    主: {
      eumhun: [{ hun: "주인", eum: "주" }],
      readings: ["주"],
      glosses: ["master; owner; main"],
      compounds: [{ hangul: "주의", hanja: "主義", gloss: "-ism; doctrine" }],
    },
    義: {
      eumhun: [{ hun: "옳을", eum: "의" }],
      readings: ["의"],
      glosses: ["righteousness; justice"],
      compounds: [{ hangul: "주의", hanja: "主義", gloss: "-ism; doctrine" }],
    },
    // --- rare-flag fixtures: 사랑 (rare 舍廊 vs non-rare 沙羅) ---
    舍: {
      eumhun: [{ hun: "집", eum: "사" }],
      readings: ["사"],
      glosses: ["house; lodging"],
      compounds: [],
    },
    廊: {
      eumhun: [{ hun: "행랑", eum: "랑" }],
      readings: ["랑"],
      glosses: ["corridor; veranda"],
      compounds: [],
    },
    沙: {
      eumhun: [{ hun: "모래", eum: "사" }],
      readings: ["사"],
      glosses: ["sand"],
      compounds: [{ hangul: "사기", hanja: "沙器", gloss: "porcelain" }],
    },
    羅: {
      eumhun: [{ hun: "벌일", eum: "라" }],
      readings: ["라"],
      glosses: ["net; to spread out"],
      compounds: [],
    },
    // --- romanized search v2 fixtures: chars whose eums collide with the
    // Dubeolsik reading of the same Latin query, so the merge and preference
    // rules can be driven through the real generator (no rr map exists).
    // "cheon" reads 천 romanized and types 초대ㅜ on the keyboard; "go" reads
    // 고 and types 해; "do" reads 도 and types 애; "an" reads 안 and types 무.
    天: {
      eumhun: [{ hun: "하늘", eum: "천" }],
      readings: ["천"],
      glosses: ["sky; heaven"],
      compounds: [],
    },
    海: {
      eumhun: [{ hun: "바다", eum: "해" }],
      readings: ["해"],
      glosses: ["sea; ocean"],
      compounds: [],
      // One-entry cw index: 해's best compound count must beat 고's zero.
      cw: ["海女"],
    },
    道: {
      eumhun: [{ hun: "길", eum: "도" }],
      readings: ["도"],
      glosses: ["road; way"],
      compounds: [],
      // Two entries: 도's best compound count must beat 애's zero.
      cw: ["道路", "道德"],
    },
    愛: {
      eumhun: [{ hun: "사랑", eum: "애" }],
      readings: ["애"],
      glosses: ["to love"],
      compounds: [],
    },
    安: {
      eumhun: [{ hun: "편안할", eum: "안" }],
      readings: ["안"],
      glosses: ["peaceful; safe"],
      compounds: [],
    },
    無: {
      eumhun: [{ hun: "없을", eum: "무" }],
      readings: ["무"],
      glosses: ["not have; without"],
      compounds: [],
    },
    // --- all-rare fixtures: 우리 (牛李 and 隅籬, both rare) ---
    牛: {
      eumhun: [{ hun: "소", eum: "우" }],
      readings: ["우"],
      glosses: ["cow; ox"],
      compounds: [],
    },
    李: {
      eumhun: [{ hun: "오얏", eum: "리" }],
      readings: ["리"],
      glosses: ["plum; a surname"],
      compounds: [],
    },
    隅: {
      eumhun: [{ hun: "모퉁이", eum: "우" }],
      readings: ["우"],
      glosses: ["corner; nook"],
      compounds: [],
    },
    籬: {
      eumhun: [{ hun: "울타리", eum: "리" }],
      readings: ["리"],
      glosses: ["hedge; fence"],
      compounds: [],
    },
  },
};

const words = {
  version: 1,
  words: {
    // Romanized search ADDENDUM: `f` is the frequency bucket (0 = most
    // frequent, absent = unranked). Only the two words the preference tests
    // compare carry one, so the unranked path is exercised too.
    國民: [{ hangul: "국민", glosses: ["the people; citizens of a nation"], f: 1 }],
    學生: [{ hangul: "학생", glosses: ["student; pupil"], f: 5 }],
    事故: [{ hangul: "사고", glosses: ["accident; mishap"] }],
    思考: [{ hangul: "사고", glosses: ["thought; thinking"] }],
    // 5 homograph spellings of 사기 — exercises the now-uncapped rule 3b.
    詐欺: [{ hangul: "사기", glosses: ["fraud; swindle"] }],
    士氣: [{ hangul: "사기", glosses: ["morale"] }],
    沙器: [{ hangul: "사기", glosses: ["porcelain; chinaware"] }],
    史記: [{ hangul: "사기", glosses: ["historical record"] }],
    射騎: [{ hangul: "사기", glosses: ["mounted archery"] }],
    // --- hanja-page (hp) flag fixtures: one hp sense + one plain sense, so
    // the any-wins collapse rule is actually exercised ---
    安全: [
      { hangul: "안전", glosses: ["safety; security"], hp: true },
      { hangul: "안전", glosses: ["archaic sense"] },
    ],
    // --- word-parts addendum fixtures ---
    資本主義: [
      { hangul: "자본주의", glosses: ["capitalism", "the capitalist system", "third gloss"] },
    ],
    資本: [{ hangul: "자본", glosses: ["capital", "funds", "dropped third gloss"] }],
    主義: [{ hangul: "주의", glosses: ["-ism; doctrine"] }],
    // Gloss-less stub: greedy longest-match would grab this and split
    // 資本主義 as 資本主 + 義. The DP must prefer 資本 + 主義.
    資本主: [{ hangul: "자본주", glosses: [] }],
    // The only sub-word available here is gloss-less — it must still be used,
    // because a gloss-less split beats no split (priority 2).
    原子力: [{ hangul: "원자력", glosses: ["nuclear power"] }],
    原子: [{ hangul: "원자", glosses: [] }],
    // Tie on gloss-covered (6) and covered (6): fewest segments wins, so
    // 民主主義 + 國家 (2 segments) beats 民主 + 主義 + 國家 (3).
    民主主義國家: [{ hangul: "민주주의국가", glosses: ["a democratic state"] }],
    民主主義: [{ hangul: "민주주의", glosses: ["democracy"] }],
    民主: [{ hangul: "민주", glosses: ["democracy; democratic"] }],
    國家: [{ hangul: "국가", glosses: ["state; nation"] }],
    // 3-char word covered by one 2-char sub-word plus a leftover char.
    學生會: [{ hangul: "학생회", glosses: ["student council"] }],
    // 3-char word with no multi-char sub-word at all.
    圖書館: [{ hangul: "도서관", glosses: ["library"] }],
    // Two 3-char homograph spellings, each with a different sub-word.
    詐欺戰: [{ hangul: "사기전", glosses: ["a campaign of fraud"] }],
    士氣戰: [{ hangul: "사기전", glosses: ["a battle of morale"] }],
    // --- rare-flag addendum fixtures ---
    // 사랑 is a native Korean word; 舍廊 is an obscure hanja homograph, so it
    // is flagged rare while 沙羅 is not. byHangul lists the RARE one first, so
    // correct output requires reordering.
    舍廊: [{ hangul: "사랑", glosses: ["a detached guest quarters"], rare: true }],
    沙羅: [{ hangul: "사랑", glosses: ["sal tree"] }],
    // 우리 is likewise native — both hanja spellings are rare.
    牛李: [{ hangul: "우리", glosses: ["the Niu-Li factional strife"], rare: true }],
    隅籬: [{ hangul: "우리", glosses: ["a corner fence"], rare: true }],
    // --- rare and lessCommon addendum: 가장 in all three states. byHangul
    // lists them rare, lessCommon, unflagged, so correct output requires
    // reordering to unflagged, lessCommon, rare. 가장 is also a native word
    // (the adverb), so the omnibox order can be pinned with all four kinds.
    假葬: [{ hangul: "가장", glosses: ["a temporary burial"], rare: true }],
    假裝: [{ hangul: "가장", glosses: ["disguise; pretense"], lessCommon: true }],
    家長: [{ hangul: "가장", glosses: ["the head of a family"] }],
    // --- length-metadata addendum: a 7-char headword, longer than the old
    // hardcoded segmentation cap of 6, in both scripts ---
    中華人民共和國: [{ hangul: "중화인민공화국", glosses: ["the People's Republic of China"] }],
    // --- omnibox addendum: a gloss loaded with XML metacharacters, so the
    // description escaping is actually exercised. No chars entry on purpose —
    // adding 特/殊 to `hanja` would perturb the reading-index ordering tests.
    特殊: [{ hangul: "특수", glosses: ['R&D <special> "quoted" \'odd\''] }],
    // --- romanized search v2: word pairs whose Latin queries collide across
    // the two interpreters (see the 天/海/道/愛/安/無 chars above).
    // "godo": 고도 romanized (f 1) vs 해애 on the keyboard (f 5); rr wins.
    古都: [{ hangul: "고도", glosses: ["an ancient capital"], f: 1 }],
    海愛: [{ hangul: "해애", glosses: ["love of the sea"], f: 5 }],
    // "sogo": 소고 romanized (unranked) vs 내해 typed (f 1); ranked wins.
    小鼓: [{ hangul: "소고", glosses: ["a small hand drum"] }],
    內海: [{ hangul: "내해", glosses: ["an inland sea"], f: 1 }],
    // "cheon": 초대 typed (a word) vs 천 romanized (a reading list only).
    招待: [{ hangul: "초대", glosses: ["invitation"] }],
  },
  byHangul: {
    국민: ["國民"],
    학생: ["學生"],
    사고: ["事故", "思考"],
    사기: ["詐欺", "士氣", "沙器", "史記", "射騎"],
    자본주의: ["資本主義"],
    학생회: ["學生會"],
    도서관: ["圖書館"],
    사기전: ["詐欺戰", "士氣戰"],
    사랑: ["舍廊", "沙羅"],
    우리: ["牛李", "隅籬"],
    가장: ["假葬", "假裝", "家長"],
    안전: ["安全"],
    중화인민공화국: ["中華人民共和國"],
    특수: ["特殊"],
    고도: ["古都"],
    해애: ["海愛"],
    소고: ["小鼓"],
    내해: ["內海"],
    초대: ["招待"],
  },
  // Length metadata addendum: the real caps for rules 3 / 3b.
  maxWordLen: 7,
  maxHangulLen: 7,
};

// Romanized search v2: there is no rr map any more. The romanization
// interpreter generates its candidates (extension/deromanize.js), so the
// bundle holds only the three real data files.
const data = { hanja, words, variants };

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message.split("\n").join("\n      ")}`);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL  ${name}`);
    console.log(`      ${err.message.split("\n").join("\n      ")}`);
  }
}

const wordsOf = (matches) => matches.filter((m) => m.kind === "word");
const charsOf = (matches) => matches.filter((m) => m.kind === "char");
const canonicals = (matches) => matches.map((m) => m.canonical);

console.log("lookup.js");

// --- rule 3: Han-run segmentation ----------------------------------------

test('lookup("國民") → word 국민 + char cards for 國 and 民', () => {
  const { ok, matches } = lookup("國民", data);
  assert.equal(ok, true);

  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.deepEqual(w[0], {
    kind: "word",
    surface: "國民",
    canonical: "國民",
    hangul: "국민",
    glosses: ["the people; citizens of a nation"],
    chars: ["國", "民"],
  });

  const c = charsOf(matches);
  assert.deepEqual(canonicals(c), ["國", "民"]);
  assert.deepEqual(c[0].eumhun, [{ hun: "나라", eum: "국" }]);
  assert.deepEqual(c[0].readings, ["국"]);
  assert.ok(c[0].compounds.length > 0);

  // Words come before chars.
  assert.equal(matches[0].kind, "word");
});

test("greedy longest-match prefers the 2-char word over single chars", () => {
  const segs = segmentRun([..."國民"], data.words.words, data.variants.map);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].kind, "word");
  assert.equal(segs[0].length, 2);
});

test("segmentation never spans a non-Han boundary", () => {
  const { matches } = lookup("國x民", data);
  assert.equal(wordsOf(matches).length, 0);
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民"]);
});

test("single-char selection returns just the char match", () => {
  const { matches } = lookup("學", data);
  assert.equal(wordsOf(matches).length, 0);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "char");
  assert.equal(matches[0].canonical, "學");
});

// --- rule 3: the <= 4 threshold counts HAN CHARS ONLY --------------------

test('lookup("國民이라는") → word 國民 + char cards for 國 and 民', () => {
  // 2 Han + 3 hangul. Hangul must NOT count toward the <= 4 Han-char
  // threshold, so the per-character eumhun cards still appear.
  const { ok, matches } = lookup("國民이라는", data);
  assert.equal(ok, true);
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民"]);
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民"]);
});

test("hangul beyond the threshold never suppresses Han char cards", () => {
  // 2 Han + 12 hangul = 14 relevant chars, but still only 2 Han chars.
  const { matches } = lookup("國民은 나라의 사람들을 뜻하는 말", data);
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民"]);
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民"]);
});

test("exactly 4 Han chars still shows word-covered char cards", () => {
  const { matches } = lookup("國民學生", data);
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民", "學生"]);
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民", "學", "生"]);
});

test("5+ Han chars fully covered by words omits the covered-char cards", () => {
  // 6 Han chars, every one inside a word match (國民 / 學生 / 事故).
  const { matches } = lookup("國民學生事故", data);
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民", "學生", "事故"]);
  assert.deepEqual(canonicals(charsOf(matches)), []);
});

test("5 Han chars: unmatched chars still get cards, covered ones do not", () => {
  const { matches } = lookup("學生國民事", data);
  assert.deepEqual(canonicals(wordsOf(matches)), ["學生", "國民"]);
  assert.deepEqual(canonicals(charsOf(matches)), ["事"]);
});

// --- rule 2: variants -----------------------------------------------------

test('lookup("国") resolves to the 國 entry via variants.map', () => {
  const { ok, matches } = lookup("国", data);
  assert.equal(ok, true);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, "char");
  assert.equal(matches[0].surface, "国"); // original glyph preserved
  assert.equal(matches[0].canonical, "國");
  assert.deepEqual(matches[0].eumhun, [{ hun: "나라", eum: "국" }]);
});

test("variant chars segment into words too (学生 → 學生)", () => {
  const { matches } = lookup("学生", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.equal(w[0].surface, "学生");
  assert.equal(w[0].canonical, "學生");
  assert.equal(w[0].hangul, "학생");
  assert.deepEqual(w[0].chars, ["學", "生"]);
  assert.deepEqual(canonicals(charsOf(matches)), ["學", "生"]);
});

// --- rule 3b: hangul reverse lookup --------------------------------------

test('lookup("국민") → word 國民 + char cards for 國 and 民', () => {
  const { ok, matches } = lookup("국민", data);
  assert.equal(ok, true);

  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.deepEqual(w[0], {
    kind: "word",
    surface: "국민",
    canonical: "國民",
    hangul: "국민",
    glosses: ["the people; citizens of a nation"],
    chars: ["國", "民"],
  });
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民"]);
});

test("hangul-sourced matches always emit component chars, even when long", () => {
  const { matches } = lookup("국민 학생 사고", data);
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民", "學生", "事故", "思考"]);
  // 사고 has two spellings: only the first (事故) contributes char cards.
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民", "學", "生", "事", "故"]);
});

test("one hangul span with multiple spellings → one word match each", () => {
  const { matches } = lookup("사고", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 2);
  assert.deepEqual(canonicals(w), ["事故", "思考"]);
  assert.ok(w.every((m) => m.surface === "사고" && m.hangul === "사고"));
  assert.deepEqual(canonicals(charsOf(matches)), ["事", "故"]);
});

test("multi-spelling hangul word emits ALL spellings, no cap", () => {
  const { matches } = lookup("사기", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 5, "no cap of 4 on hanja spellings");
  assert.deepEqual(canonicals(w), ["詐欺", "士氣", "沙器", "史記", "射騎"]);
  assert.ok(w.every((m) => m.surface === "사기" && m.hangul === "사기"));
  assert.deepEqual(w[1].glosses, ["morale"]);
  // Component char cards still only for the first spelling (詐欺).
  assert.deepEqual(canonicals(charsOf(matches)), ["詐", "欺"]);
});

// --- rare flag addendum ---------------------------------------------------

test("absent rare flag emits no key at all", () => {
  for (const text of ["國民", "국민", "資本主義"]) {
    for (const m of wordsOf(lookup(text, data).matches)) {
      assert.equal("rare" in m, false, `${text} → ${m.canonical} should have no rare key`);
    }
  }
});

test("Han-sourced lookup of 舍廊 carries rare: true", () => {
  // The UI ignores the flag for Han-sourced matches, but the protocol still
  // reports it — the decision belongs to the renderer, not the worker.
  const { matches } = lookup("舍廊", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.equal(w[0].canonical, "舍廊");
  assert.equal(w[0].rare, true);
  // 2 Han chars, so the component cards appear as usual.
  assert.deepEqual(canonicals(charsOf(matches)), ["舍", "廊"]);
});

test("hangul 사랑: non-rare orders first and owns the char cards", () => {
  assert.deepEqual(words.byHangul["사랑"], ["舍廊", "沙羅"], "rare is listed first");
  const { matches } = lookup("사랑", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 2);

  // Reordered: non-rare 沙羅 first, rare 舍廊 second.
  assert.deepEqual(canonicals(w), ["沙羅", "舍廊"]);
  assert.equal("rare" in w[0], false);
  assert.equal(w[1].rare, true);

  // Char cards come from the first NON-RARE spelling, not byHangul[0].
  assert.deepEqual(canonicals(charsOf(matches)), ["沙", "羅"]);
});

test("all-rare hangul span still matches, flagged, cards from the first", () => {
  const { ok, matches } = lookup("우리", data);
  assert.equal(ok, true);
  const w = wordsOf(matches);
  assert.equal(w.length, 2);
  // No non-rare spelling exists, so byHangul order is preserved as-is.
  assert.deepEqual(canonicals(w), ["牛李", "隅籬"]);
  assert.ok(w.every((m) => m.rare === true));
  // Fallback: char cards from the first spelling.
  assert.deepEqual(canonicals(charsOf(matches)), ["牛", "李"]);
});

test("byHangul relative order is preserved within each rare group", () => {
  // All five 사기 spellings are non-rare, so the order is untouched.
  assert.deepEqual(canonicals(wordsOf(lookup("사기", data).matches)), [
    "詐欺",
    "士氣",
    "沙器",
    "史記",
    "射騎",
  ]);
});

test("a spelling is rare only when every contributing sense-set is rare", () => {
  const mixed = {
    ...data,
    words: {
      ...words,
      words: {
        ...words.words,
        舍廊: [
          { hangul: "사랑", glosses: ["obscure sense"], rare: true },
          { hangul: "사랑", glosses: ["an attested sense"] },
        ],
      },
    },
  };
  const w = wordsOf(lookup("사랑", mixed).matches);
  const saranng = w.find((m) => m.canonical === "舍廊");
  assert.equal("rare" in saranng, false, "one attested sense clears the flag");
  assert.deepEqual(saranng.glosses, ["obscure sense", "an attested sense"]);
});

// --- rare and lessCommon addendum ------------------------------------------

test("lessCommon: absent flag emits no key; a flagged sense-set carries it", () => {
  for (const text of ["國民", "국민", "사랑", "우리"]) {
    for (const m of wordsOf(lookup(text, data).matches)) {
      assert.equal("lessCommon" in m, false, `${text} → ${m.canonical} should have no lessCommon key`);
    }
  }
  // Han-sourced: the flag rides the match, exactly like rare.
  const han = wordsOf(lookup("假裝", data).matches);
  assert.equal(han.length, 1);
  assert.equal(han[0].lessCommon, true);
  assert.equal("rare" in han[0], false);
});

test("hangul 가장 orders unflagged, then lessCommon, then rare; the unflagged leads", () => {
  assert.deepEqual(words.byHangul["가장"], ["假葬", "假裝", "家長"], "byHangul lists rare first");
  const w = wordsOf(lookup("가장", data).matches);
  assert.deepEqual(canonicals(w), ["家長", "假裝", "假葬"]);
  assert.equal("rare" in w[0], false);
  assert.equal("lessCommon" in w[0], false);
  assert.equal(w[1].lessCommon, true);
  assert.equal("rare" in w[1], false);
  assert.equal(w[2].rare, true);
  assert.equal("lessCommon" in w[2], false);
});

test("lessCommon leads a group with no unflagged spelling; rare still sorts last", () => {
  const noPlain = {
    ...data,
    words: {
      ...words,
      words: { ...words.words, 家長: undefined },
    },
  };
  const w = wordsOf(lookup("가장", noPlain).matches);
  assert.deepEqual(canonicals(w), ["假裝", "假葬"]);
  assert.equal(w[0].lessCommon, true);
  assert.equal(w[1].rare, true);
});

test("a spelling is lessCommon only when every contributing sense-set is", () => {
  const mixed = {
    ...data,
    words: {
      ...words,
      words: {
        ...words.words,
        假裝: [
          { hangul: "가장", glosses: ["a homograph sense"], lessCommon: true },
          { hangul: "가장", glosses: ["a plain sense"] },
        ],
      },
    },
  };
  const w = wordsOf(lookup("가장", mixed).matches);
  const gajang = w.find((m) => m.canonical === "假裝");
  assert.equal("lessCommon" in gajang, false, "one unflagged sense clears the flag");
  // Cleared on the hangul path, so it sorts with the unflagged spellings.
  assert.deepEqual(canonicals(w), ["假裝", "家長", "假葬"]);
  // The Han path agrees: a deduped headword drops the flag the same way.
  const han = wordsOf(lookup("假裝", mixed).matches);
  assert.equal(han.length, 1);
  assert.equal("lessCommon" in han[0], false);
});

test("lvl: propagated onto char matches, one value per char", () => {
  const guk = charsOf(lookup("國", data).matches)[0];
  assert.equal(guk.lvl, "m");
  const hak = charsOf(lookup("學", data).matches)[0];
  assert.equal(hak.lvl, "m");
  const guk2 = charsOf(lookup("局", data).matches)[0];
  assert.equal(guk2.lvl, "a");
  const guk3 = charsOf(lookup("菊", data).matches)[0];
  assert.equal(guk3.lvl, "r");
  // the legacy fields are gone for good
  assert.equal("edu" in guk, false);
  assert.equal("eduT" in guk, false);
  // a fixture char without lvl (placeholder data) simply carries none
  const min = charsOf(lookup("民", data).matches)[0];
  assert.equal("lvl" in min, false);
});

test("lvl: survives the kind:\"reading\" candidate rebuild", () => {
  // The reading path rebuilds candidates through an explicit field list —
  // the site that silently dropped the level field once before.
  const reading = lookup("국", data).matches[0];
  assert.equal(reading.kind, "reading");
  assert.equal(reading.candidates.find((c) => c.char === "國").lvl, "m");
  assert.equal(reading.candidates.find((c) => c.char === "局").lvl, "a");
  assert.equal(reading.candidates.find((c) => c.char === "菊").lvl, "r");
  const hak = lookup("학", data).matches[0].candidates.find((c) => c.char === "學");
  assert.equal(hak.lvl, "m");
});

test("lvl: junk values are not propagated", () => {
  const junk = {
    ...data,
    hanja: {
      version: 1,
      chars: { 國: { ...hanja.chars.國, lvl: "x" } },
    },
  };
  const m = charsOf(lookup("國", junk).matches)[0];
  assert.equal("lvl" in m, false);
});

// --- length metadata: segmentation caps come from the data ---------------

test("7-char hanja selection returns the whole word, not fragments", () => {
  const w = wordsOf(lookup("中華人民共和國", data).matches);
  assert.equal(w.length, 1);
  assert.equal(w[0].canonical, "中華人民共和國");
  assert.equal(w[0].hangul, "중화인민공화국");
});

test("7-syllable hangul reverse lookup resolves the whole word", () => {
  const w = wordsOf(lookup("중화인민공화국", data).matches);
  assert.equal(w.length, 1);
  assert.equal(w[0].surface, "중화인민공화국");
  assert.equal(w[0].canonical, "中華人民共和國");
});

test("without the meta fields, segmentation falls back to 6 (old behavior)", () => {
  assert.equal(maxWordLenOf(undefined), 6);
  assert.equal(maxWordLenOf({}), 6);
  assert.equal(maxHangulLenOf({}), 6);
  assert.equal(maxWordLenOf({ maxWordLen: 11 }), 11);
  // junk values fall back rather than breaking segmentation
  assert.equal(maxWordLenOf({ maxWordLen: 0 }), 6);
  assert.equal(maxHangulLenOf({ maxHangulLen: "11" }), 6);

  const noMeta = {
    hanja,
    words: { version: 1, words: words.words, byHangul: words.byHangul },
    variants,
  };
  const w = wordsOf(lookup("中華人民共和國", noMeta).matches);
  assert.ok(
    !w.some((m) => m.canonical === "中華人民共和國"),
    "a 7-char span is out of reach when the cap falls back to 6"
  );
  assert.equal(wordsOf(lookup("중화인민공화국", noMeta).matches).length, 0);
  // and the 6-char word is still reachable on the fallback path
  assert.equal(wordsOf(lookup("民主主義國家", noMeta).matches)[0].canonical, "民主主義國家");
});

test("word parts respect the data-driven cap", () => {
  // 7-char sub-span 中華人民共和國 inside an 8-char word is only visible when
  // buildWordParts is allowed to look past 6.
  const parts = buildWordParts("大中華人民共和國", words.words, 7);
  assert.deepEqual(
    parts.map((p) => (p.type === "word" ? p.hanja : p.char)),
    ["大", "中華人民共和國"]
  );
  assert.equal(
    (buildWordParts("大中華人民共和國", words.words) || []).some(
      (p) => p.hanja === "中華人民共和國"
    ),
    false,
    "default cap of 6 cannot see the 7-char sub-word"
  );
});

test("cwCount: present on chars with a cw index, absent otherwise", () => {
  const guk = charsOf(lookup("國", data).matches)[0];
  assert.equal(guk.cwCount, 4, "counts the whole index, not just joinable rows");
  const min = charsOf(lookup("民", data).matches)[0];
  assert.equal("cwCount" in min, false);
});

test("buildFullCompounds joins cw against words in order, skipping unknowns", () => {
  const rows = buildFullCompounds("國", data);
  assert.deepEqual(rows, [
    { hanja: "國民", hangul: "국민", gloss: "the people; citizens of a nation" },
    { hanja: "國家", hangul: "국가", gloss: "state; nation" },
  ]);
});

test("buildFullCompounds normalizes variants and handles unknown chars", () => {
  assert.deepEqual(buildFullCompounds("国", data), buildFullCompounds("國", data));
  assert.deepEqual(buildFullCompounds("𠀀", data), []);
  assert.deepEqual(buildFullCompounds("", data), []);
});

test("buildFullCompounds: rare only when every sense of a spelling is rare", () => {
  const patched = {
    ...data,
    hanja: {
      ...hanja,
      chars: { ...hanja.chars, 國: { ...hanja.chars.國, cw: ["舍廊", "沙羅"] } },
    },
  };
  const rows = buildFullCompounds("國", patched);
  assert.equal(rows[0].rare, true, "舍廊 is rare in the fixture");
  assert.equal("rare" in rows[1], false, "沙羅 is not");
});

test("buildFullCompounds and buildUsedIn: lessCommon rides the join row under the every-sense rule", () => {
  const patched = {
    ...data,
    hanja: {
      ...hanja,
      chars: { ...hanja.chars, 國: { ...hanja.chars.國, cw: ["假裝", "假葬", "家長"] } },
    },
  };
  const rows = buildFullCompounds("國", patched);
  assert.equal(rows[0].lessCommon, true, "假裝 is lessCommon in the fixture");
  assert.equal("rare" in rows[0], false);
  assert.equal(rows[1].rare, true);
  assert.equal("lessCommon" in rows[1], false);
  assert.equal("lessCommon" in rows[2], false);
  assert.equal("rare" in rows[2], false);
  // A mixed spelling (one lessCommon sense, one plain) carries neither.
  const mixed = {
    ...patched,
    words: {
      ...words,
      words: {
        ...words.words,
        假裝: [
          { hangul: "가장", glosses: ["a homograph sense"], lessCommon: true },
          { hangul: "가장", glosses: ["a plain sense"] },
        ],
      },
    },
  };
  assert.equal("lessCommon" in buildFullCompounds("國", mixed)[0], false);
  // Used-in rows go through the same join (假 has no chars entry, so the
  // word-table scan supplies the larger words).
  const usedIn = {
    ...data,
    words: {
      ...words,
      words: {
        ...words.words,
        假裝舞: [{ hangul: "가장무", glosses: ["a masked dance"], lessCommon: true }],
        假裝舞會: [{ hangul: "가장무회", glosses: ["a masquerade ball"] }],
      },
    },
  };
  const used = buildUsedIn("假裝", usedIn);
  assert.deepEqual(used.map((r) => r.hanja), ["假裝舞", "假裝舞會"]);
  assert.equal(used[0].lessCommon, true);
  assert.equal("lessCommon" in used[1], false);
});

test("usedInCount: present when larger words exist, absent otherwise", () => {
  const student = wordsOf(lookup("學生", data).matches)[0];
  assert.equal(student.usedInCount, 1, "學生會 contains 學生; 不明學生 not a word");
  const hangulSourced = wordsOf(lookup("학생", data).matches)[0];
  assert.equal(hangulSourced.usedInCount, 1, "hangul path carries it too");
  const nation = wordsOf(lookup("民主主義國家", data).matches)[0];
  assert.equal("usedInCount" in nation, false, "nothing contains the longest word");
});

test("buildUsedIn: ranked rows, self excluded, unknowns skipped", () => {
  assert.deepEqual(buildUsedIn("學生", data), [
    { hanja: "學生會", hangul: "학생회", gloss: "student council" },
  ]);
  assert.deepEqual(buildUsedIn("nope", data), []);
  assert.deepEqual(buildUsedIn("", data), []);
});

test("buildUsedIn falls back to a wordTable scan when the char lacks cw", () => {
  // 民 has no cw in the fixture; 民主 is contained by 民主主義 and 民主主義國家.
  const rows = buildUsedIn("民主", data);
  const spellings = rows.map((r) => r.hanja).sort();
  assert.deepEqual(spellings, ["民主主義", "民主主義國家"]);
});

test("hp flag: propagates on both paths, any-wins, absent otherwise", () => {
  // Han-sourced: 安全's first sense is hp, second is not — any-wins.
  const han = wordsOf(lookup("安全", data).matches);
  assert.equal(han[0].hp, true, "Han-sourced hp");
  // Hangul-sourced reverse lookup carries it too.
  const hang = wordsOf(lookup("안전", data).matches);
  assert.equal(hang[0].hp, true, "hangul-sourced hp");
  // Words harvested from hangul-headword pages emit no key at all.
  const plain = wordsOf(lookup("國民", data).matches);
  assert.equal("hp" in plain[0], false, "no hp key on hangul-page words");
});

test("Han-sourced: a non-rare sense clears the flag on a deduped headword", () => {
  // Two homograph senses share canonical+hangul, so they collapse to one card;
  // the non-rare one must win, as it does on the hangul path.
  const mixed = {
    ...data,
    words: {
      ...words,
      words: {
        ...words.words,
        舍廊: [
          { hangul: "사랑", glosses: ["obscure sense"], rare: true },
          { hangul: "사랑", glosses: ["an attested sense"] },
        ],
      },
    },
  };
  const w = wordsOf(lookup("舍廊", mixed).matches);
  assert.equal(w.length, 1, "same canonical+hangul collapses to one card");
  assert.equal("rare" in w[0], false);
});

// --- word parts addendum --------------------------------------------------

test("資本主義 → parts [資本, 主義] despite the greedier 資本主 stub", () => {
  assert.ok(words.words["資本主"], "the gloss-less stub must be in the fixture");
  const { ok, matches } = lookup("資本主義", data);
  assert.equal(ok, true);
  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.equal(w[0].canonical, "資本主義");
  assert.deepEqual(w[0].parts, [
    { type: "word", hanja: "資本", hangul: "자본", glosses: ["capital", "funds"] },
    { type: "word", hanja: "主義", hangul: "주의", glosses: ["-ism; doctrine"] },
  ]);
});

test("a gloss-less sub-word is still used when it is the only one", () => {
  // Priority 2: covering 2 of 3 chars beats covering none, glosses or not.
  const parts = buildWordParts("原子力", words.words);
  assert.deepEqual(parts, [
    { type: "word", hanja: "原子", hangul: "원자", glosses: [] },
    { type: "char", char: "力" },
  ]);
});

test("ties on coverage are broken by fewest segments", () => {
  // 民主主義+國家 and 民主+主義+國家 both cover 6/6 chars with glossed
  // sub-words; the 2-segment split must win.
  const parts = buildWordParts("民主主義國家", words.words);
  assert.equal(parts.length, 2);
  assert.deepEqual(
    parts.map((p) => p.hanja),
    ["民主主義", "國家"]
  );
});

test("sub-word glosses are capped at 2 and taken from the first sense", () => {
  const { matches } = lookup("資本主義", data);
  assert.equal(wordsOf(matches)[0].parts[0].glosses.length, 2);
  // The word's own glosses are NOT capped — only its parts' are.
  assert.equal(wordsOf(matches)[0].glosses.length, 3);
});

test("hangul lookup 자본주의 yields the same parts", () => {
  const { matches } = lookup("자본주의", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.equal(w[0].surface, "자본주의");
  assert.equal(w[0].canonical, "資本主義");
  assert.deepEqual(w[0].parts, lookup("資本主義", data).matches[0].parts);
});

test("3-char word with one 2-char sub-word → parts [word, char]", () => {
  const { matches } = lookup("學生會", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.deepEqual(w[0].parts, [
    { type: "word", hanja: "學生", hangul: "학생", glosses: ["student; pupil"] },
    { type: "char", char: "會" },
  ]);
});

test("a word is never its own part (full-span exclusion)", () => {
  // 學生會 is itself a key in `words`; the length-3 candidate at offset 0 must
  // be rejected so segmentation falls through to 學生 + 會.
  const parts = buildWordParts("學生會", words.words);
  assert.equal(parts[0].hanja, "學生");
  assert.notEqual(parts[0].hanja, "學生會");
  // The exclusion is by span, not by key: 圖書館 has no usable sub-word.
  assert.equal(buildWordParts("圖書館", words.words), null);
});

test("word with no multi-char sub-word omits the parts key entirely", () => {
  const { matches } = lookup("圖書館", data);
  const w = wordsOf(matches);
  assert.equal(w.length, 1);
  assert.equal("parts" in w[0], false);
});

test("2-char words never get a parts key", () => {
  for (const text of ["國民", "국민", "学生"]) {
    for (const m of wordsOf(lookup(text, data).matches)) {
      assert.equal("parts" in m, false, `${text} → ${m.canonical} should have no parts`);
    }
  }
  assert.equal(buildWordParts("國民", words.words), null);
});

test("each homograph spelling gets its own parts", () => {
  const w = wordsOf(lookup("사기전", data).matches);
  assert.equal(w.length, 2);
  assert.deepEqual(canonicals(w), ["詐欺戰", "士氣戰"]);
  assert.deepEqual(w[0].parts, [
    { type: "word", hanja: "詐欺", hangul: "사기", glosses: ["fraud; swindle"] },
    { type: "char", char: "戰" },
  ]);
  assert.deepEqual(w[1].parts, [
    { type: "word", hanja: "士氣", hangul: "사기", glosses: ["morale"] },
    { type: "char", char: "戰" },
  ]);
});

test("parts cover the word in order, with no gaps", () => {
  for (const text of ["資本主義", "學生會", "사기전", "民主主義國家", "原子力"]) {
    for (const m of wordsOf(lookup(text, data).matches)) {
      if (!m.parts) continue;
      const covered = m.parts
        .map((p) => (p.type === "word" ? p.hanja : p.char))
        .join("");
      assert.equal(covered, m.canonical, `${m.canonical} parts must cover the word`);
    }
  }
});

// --- rule 3c: single hangul syllable → homophone browse ------------------

test('lookup("국") returns a reading match including 國 with hun 나라', () => {
  const { ok, matches } = lookup("국", data);
  assert.equal(ok, true);
  assert.equal(matches.length, 1);

  const m = matches[0];
  assert.equal(m.kind, "reading");
  assert.equal(m.surface, "국");
  assert.equal(m.eum, "국");

  const guk = m.candidates.find((c) => c.char === "國");
  assert.ok(guk, "candidates should include 國");
  assert.deepEqual(guk, {
    char: "國",
    hun: "나라",
    eum: "국",
    gloss: "country; state; nation",
    lvl: "m",
  });
});

test("reading candidates are ranked by compound count, descending", () => {
  const { matches } = lookup("국", data);
  // 國 has 2 compounds, 局 has 1, 菊 has 0.
  assert.deepEqual(
    matches[0].candidates.map((c) => c.char),
    ["國", "局", "菊"]
  );
});

test("reading candidates are uncapped and expose hun \"\" when readings-only", () => {
  const { matches } = lookup("국", data);
  const guk = matches[0].candidates.find((c) => c.char === "菊");
  assert.deepEqual(guk, { char: "菊", hun: "", eum: "국", gloss: "", lvl: "r" });
  assert.equal(matches[0].candidates.length, 3, "every homophone is listed");
});

test("a syllable with no matching hanja returns empty matches", () => {
  assert.deepEqual(lookup("늘", data), { ok: true, matches: [] });
});

test("rule 3c only fires when the WHOLE selection is one syllable", () => {
  // Punctuation/latin around a lone syllable still counts as one syllable.
  assert.equal(lookup("  국!  ", data).matches[0].kind, "reading");
  // Two syllables, or a syllable plus a Han char, do not.
  assert.deepEqual(lookup("하늘", data), { ok: true, matches: [] });
  assert.equal(lookup("국民", data).matches[0].kind, "char");
});

test("buildReadingIndex is a pure function over hanja.json", () => {
  const index = buildReadingIndex(hanja);
  assert.deepEqual(index["국"].map((c) => c.char), ["國", "局", "菊"]);
  // 事/思/詐/沙 all have 1 compound (stable, so hanja.json key order); 舍 has 0.
  assert.deepEqual(index["사"].map((c) => c.char), ["事", "思", "詐", "沙", "舍"]);
  assert.equal(index["없"], undefined);
  // A precomputed index is used in preference to rebuilding.
  const stub = { "국": [{ char: "X", hun: "h", eum: "국", gloss: "g" }] };
  const viaCache = lookup("국", { ...data, readingIndex: stub });
  assert.deepEqual(viaCache.matches[0].candidates, stub["국"]);
});

test("getReadingIndex is only invoked on the rule 3c path", () => {
  let calls = 0;
  const bundle = {
    ...data,
    getReadingIndex: () => {
      calls += 1;
      return buildReadingIndex(hanja);
    },
  };
  lookup("國民", bundle);
  lookup("국민", bundle);
  assert.equal(calls, 0, "index must not be built for word/char lookups");
  lookup("국", bundle);
  assert.equal(calls, 1);
});

test("empty hanja data yields no reading match", () => {
  assert.deepEqual(lookup("국", { ...data, hanja: { chars: {} } }), {
    ok: true,
    matches: [],
  });
});

test("hangul with no sino-Korean match returns empty matches", () => {
  assert.deepEqual(lookup("하늘이 파랗다", data), { ok: true, matches: [] });
});

test("particle-suffixed hangul word still matches the full word", () => {
  // 자본주의는 = 자본주의 + topic marker; the particle must fall away and the
  // largest available word must still match, parts intact.
  const { ok, matches } = lookup("자본주의는", data);
  assert.equal(ok, true);
  const [word] = wordsOf(matches);
  assert.equal(word.canonical, "資本主義");
  assert.deepEqual(word.parts.map((p) => p.hanja), ["資本", "主義"]);
  // Same with a two-syllable tail.
  const two = lookup("국민은요", data);
  assert.deepEqual(canonicals(wordsOf(two.matches)), ["國民"]);
});

test("mixed Han + hangul selection works end to end", () => {
  const { ok, matches } = lookup("國民과 학생", data);
  assert.equal(ok, true);
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民", "學生"]);
  // Only 2 Han chars, so 國/民 keep their cards; 學生 is hangul-sourced and
  // always contributes its components.
  assert.deepEqual(canonicals(charsOf(matches)), ["國", "民", "學", "生"]);
});

// --- rules 1 & 4: caps, non-CJK, unknown chars ---------------------------

test('lookup("abc") returns empty matches', () => {
  // Latin finds nothing literally, and interpreting it finds nothing either
  // (뮻 is in no dictionary, and "abc" is in no rr index), so no
  // `interpretations` field appears on either call.
  assert.deepEqual(lookup("abc", data), { ok: true, matches: [] });
  assert.deepEqual(lookup("abc", data, { interpret: true }), { ok: true, matches: [] });
});

test("empty / non-string input is safe", () => {
  assert.deepEqual(lookup("", data), { ok: true, matches: [] });
  assert.deepEqual(lookup(null, data), { ok: true, matches: [] });
  assert.deepEqual(lookup(undefined, data), { ok: true, matches: [] });
});

test("unknown Han chars are silently skipped", () => {
  assert.deepEqual(lookup("龘", data), { ok: true, matches: [] });
});

test("input longer than 20 Han chars is capped without error", () => {
  const long = "國民".repeat(30); // 60 Han chars
  const runs = extractRuns(long);
  assert.equal(
    runs.reduce((n, r) => n + r.chars.length, 0),
    20,
    "cap should be 20 relevant chars"
  );

  const { ok, matches } = lookup(long, data);
  assert.equal(ok, true);
  // 10 x 國民 word spans collapse to one deduped word card; 20 Han chars > 4 so
  // no char cards for chars that only appeared inside words.
  assert.deepEqual(canonicals(wordsOf(matches)), ["國民"]);
  assert.deepEqual(canonicals(charsOf(matches)), []);
});

test("the 20-char input cap counts Han and Hangul together (rule 1)", () => {
  const mixed = "國民".repeat(6) + "국민".repeat(6); // 12 Han + 12 hangul
  const runs = extractRuns(mixed);
  assert.equal(
    runs.reduce((n, r) => n + r.chars.length, 0),
    20
  );
  assert.equal(lookup(mixed, data).ok, true);
});

// --- rule 4 / error envelope ---------------------------------------------

test("missing or malformed data yields empty matches, not a throw", () => {
  assert.deepEqual(lookup("國民", {}), { ok: true, matches: [] });
  assert.deepEqual(lookup("國民", null), { ok: true, matches: [] });
  assert.deepEqual(lookup("國民", { hanja: {}, words: {}, variants: {} }), {
    ok: true,
    matches: [],
  });
});

test("exceptions are reported as { ok:false, error }", () => {
  const exploding = {
    get hanja() {
      throw new Error("boom");
    },
  };
  const res = lookup("國民", exploding);
  assert.equal(res.ok, false);
  assert.equal(res.error, "boom");
});

test("prototype keys are not treated as data", () => {
  assert.ok(buildMatches("國民", data).length > 0);
  const empty = { hanja: { chars: {} }, words: { words: {} }, variants: { map: {} } };
  assert.deepEqual(buildMatches("國民", empty), []);
  assert.deepEqual(buildMatches("constructor", empty), []);
});

// --- search popup addendum: omnibox suggestions --------------------------

const contentsOf = (rows) => rows.map((r) => r.content);
/** Strip the two markup tags we emit; whatever is left must be escaped text. */
const stripTags = (d) => d.replace(/<\/?(?:match|dim)>/g, "");

test("hanja word query puts the word first, with an escaped description", () => {
  const rows = buildOmniboxSuggestions("國民", data);
  assert.equal(rows[0].content, "國民");
  assert.equal(
    rows[0].description,
    "<match>國民</match> 국민 <dim>the people; citizens of a nation</dim>"
  );
  // Word first, then the component char rows.
  assert.deepEqual(contentsOf(rows), ["國民", "國", "民"]);
  assert.equal(
    rows[1].description,
    "<match>國</match> 나라 국 <dim>country; state; nation · 중학</dim>"
  );
});

test("content is the canonical searchable string, never escaped", () => {
  // A variant spelling resolves to the canonical one, so re-entering the
  // suggestion finds the same record.
  assert.deepEqual(contentsOf(buildOmniboxSuggestions("国民", data)), ["國民", "國", "民"]);
  // Raw hanja, no entities anywhere in any content.
  for (const query of ["國民", "특수", "사기", "국"]) {
    for (const row of buildOmniboxSuggestions(query, data)) {
      assert.ok(!/[&<>]/.test(row.content), `${query}: content must be plain text`);
    }
  }
  assert.equal(buildOmniboxSuggestions("특수", data)[0].content, "特殊");
});

test("descriptions XML-escape every dynamic fragment", () => {
  const [row] = buildOmniboxSuggestions("特殊", data);
  assert.equal(
    row.description,
    "<match>特殊</match> 특수 " +
      "<dim>R&amp;D &lt;special&gt; &quot;quoted&quot; &apos;odd&apos;</dim>"
  );
  // Only <match>/<dim> may be real markup.
  assert.ok(!/[<>]/.test(stripTags(row.description)));
  assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(row.description));
});

test("hangul homograph query yields every spelling, capped at 5", () => {
  const rows = buildOmniboxSuggestions("사기", data);
  assert.equal(MAX_OMNIBOX_SUGGESTIONS, 5);
  assert.equal(rows.length, 5, "7 candidates exist (5 words + 2 chars); cap applies");
  assert.deepEqual(contentsOf(rows), ["詐欺", "士氣", "沙器", "史記", "射騎"]);
  assert.equal(rows[1].description, "<match>士氣</match> 사기 <dim>morale</dim>");
});

test("rare-flagged words rank last across the whole query", () => {
  // 우리 → 牛李/隅籬 (both rare) comes first in buildMatches order; the
  // non-rare 國民 from the later span must still lead.
  const rows = buildOmniboxSuggestions("우리 국민", data);
  assert.deepEqual(contentsOf(rows), ["國民", "牛李", "隅籬", "牛", "李"]);
  assert.equal(
    rows[1].description,
    "<match>牛李</match> 우리 <dim>the Niu-Li factional strife · rare</dim>"
  );
  // Within one span the non-rare spelling still leads.
  assert.deepEqual(contentsOf(buildOmniboxSuggestions("사랑", data)).slice(0, 2), [
    "沙羅",
    "舍廊",
  ]);
});

test("a single syllable yields its reading-browse candidates", () => {
  const rows = buildOmniboxSuggestions("국", data);
  assert.deepEqual(contentsOf(rows), ["國", "局", "菊"]);
  assert.equal(
    rows[0].description,
    "<match>國</match> 나라 국 <dim>country; state; nation · 중학</dim>"
  );
  assert.equal(rows[1].description, "<match>局</match> 판 국 <dim>bureau; office; situation</dim>");
  // 菊 has no hun and no gloss: no empty dim block, no stray separator.
  assert.equal(rows[2].description, "<match>菊</match> 국");
});

test("omnibox input is trimmed and NFC-normalized", () => {
  assert.deepEqual(
    buildOmniboxSuggestions("  國民  ", data),
    buildOmniboxSuggestions("國民", data)
  );
  // Decomposed hangul jamo normalize to the composed syllable (and only then
  // does rule 3c see a single syllable at all).
  const decomposed = "국";
  assert.notEqual(decomposed, "국");
  assert.deepEqual(
    buildOmniboxSuggestions(decomposed, data),
    buildOmniboxSuggestions("국", data)
  );
  assert.equal(buildOmniboxSuggestions(decomposed, data).length, 3);
  // The same, written inline rather than through a variable.
  assert.deepEqual(
    buildOmniboxSuggestions("국", data),
    buildOmniboxSuggestions("국", data)
  );
});

test("empty, whitespace and no-match omnibox input yields no rows", () => {
  for (const query of ["", "   ", "\t\n", "abc", "龘", "하늘이 파랗다", null, undefined, 42]) {
    assert.deepEqual(buildOmniboxSuggestions(query, data), [], `query ${String(query)}`);
  }
});

test("junk data is tolerated: no throw, just no suggestions", () => {
  assert.deepEqual(buildOmniboxSuggestions("國民", null), []);
  assert.deepEqual(buildOmniboxSuggestions("國民", {}), []);
  assert.deepEqual(buildOmniboxSuggestions("國民", { words: { words: null } }), []);
  const exploding = {
    get hanja() {
      throw new Error("boom");
    },
  };
  assert.deepEqual(buildOmniboxSuggestions("國民", exploding), []);
});

// ---------------------------------------------------------------------------
// saved.js — saved words + settings (ADDENDUM). Pure, no chrome, no storage.
// ---------------------------------------------------------------------------

console.log("\nsaved.js");

/** A saved state holding one word and one char, both in f0. */
function seedState() {
  let state = normalizeSavedState(null);
  state = toggleItem(state, "word", "國民", "f0", 1000).state;
  state = toggleItem(state, "char", "國", "f0", 2000).state;
  return state;
}

// --- normalize / migration -----------------------------------------------

test("normalizeSavedState turns nothing at all into a valid v1 state", () => {
  for (const junk of [undefined, null, 42, "nope", [], {}]) {
    const state = normalizeSavedState(junk);
    assert.equal(state.v, 1);
    assert.deepEqual(state.folders, [{ id: "f0", name: "Saved" }]);
    assert.deepEqual(state.items, []);
    assert.equal(state.nextFolder, 1);
    assert.equal(state.nextItem, 0);
  }
});

test("normalizeSavedState scrubs junk folders and items, keeping the good ones", () => {
  const state = normalizeSavedState({
    v: 1,
    folders: [
      { id: "f0", name: "" }, // f0 with no name falls back to "Saved"
      { id: "f2", name: "  Verbs  " }, // trimmed
      { id: "f3", name: "   " }, // nameless non-default folder: dropped
      { id: "f2", name: "dupe id" }, // duplicate id: dropped
      null,
      "nope",
    ],
    items: [
      { id: "i1", kind: "word", key: "國民", folderId: "f2", addedAt: 5 },
      { id: "i1", kind: "char", key: "國", folderId: "f9", addedAt: 6 }, // dup id + dead folder
      { kind: "word", key: "學生" }, // no id, no addedAt
      { id: "i7", kind: "word", key: "國民" }, // duplicate identity: dropped
      { id: "i8", kind: "verb", key: "x" }, // bad kind
      { id: "i9", kind: "word", key: "" }, // bad key
      null,
    ],
  });

  assert.deepEqual(state.folders, [
    { id: "f0", name: "Saved" },
    { id: "f2", name: "Verbs" },
  ]);
  assert.deepEqual(
    state.items.map((i) => [i.id, i.kind, i.key, i.folderId, i.addedAt]),
    [
      ["i1", "word", "國民", "f2", 5],
      ["i2", "char", "國", "f0", 6], // fresh id, item rehomed to f0
      ["i3", "word", "學生", "f0", 0],
    ]
  );
  // Counters clear every id in use, so nothing can ever collide.
  assert.equal(state.nextFolder, 3);
  assert.equal(state.nextItem, 4);
});

test("normalizeSavedState never mutates its input", () => {
  const raw = { folders: [], items: [{ id: "i0", kind: "word", key: "國民" }] };
  const snapshot = JSON.stringify(raw);
  normalizeSavedState(raw);
  assert.equal(JSON.stringify(raw), snapshot);
});

// --- toggle identity round-trip ------------------------------------------

test("toggleItem saves, then the same identity toggles back off", () => {
  const empty = normalizeSavedState(null);

  const saved = toggleItem(empty, "char", "國", "f0", 1234);
  assert.equal(saved.saved, true);
  assert.deepEqual(saved.item, {
    id: "i0",
    kind: "char",
    key: "國",
    folderId: "f0",
    addedAt: 1234,
  });
  assert.equal(saved.state.items.length, 1);
  assert.equal(empty.items.length, 0, "input state must not be mutated");

  const off = toggleItem(saved.state, "char", "國", "f0", 5678);
  assert.equal(off.saved, false);
  assert.equal(off.item, undefined);
  assert.deepEqual(off.state.items, []);
  // Ids stay monotonic: re-saving does not reuse i0.
  assert.equal(toggleItem(off.state, "char", "國", "f0", 9).item.id, "i1");
});

test("toggleItem keeps word and char identities apart, and refuses junk", () => {
  let state = normalizeSavedState(null);
  state = toggleItem(state, "word", "國", "f0", 1).state;
  const both = toggleItem(state, "char", "國", "f0", 2);
  assert.equal(both.saved, true);
  assert.equal(both.state.items.length, 2);

  const bad = toggleItem(both.state, "verb", "國", "f0", 3);
  assert.equal(bad.saved, false);
  assert.equal(bad.state.items.length, 2);
  assert.equal(toggleItem(both.state, "char", "", "f0", 3).saved, false);
});

test("toggleItem drops a new item in the default folder, falling back to f0", () => {
  const withFolder = createFolder(normalizeSavedState(null), "Verbs");
  assert.equal(withFolder.folder.id, "f1");
  assert.equal(toggleItem(withFolder.state, "word", "國民", "f1", 1).item.folderId, "f1");
  // A default folder that no longer exists must not strand the item.
  assert.equal(toggleItem(withFolder.state, "word", "國民", "f9", 1).item.folderId, "f0");
});

// --- checkKeys ------------------------------------------------------------

test("checkKeys answers every requested identity with a boolean", () => {
  const state = seedState();
  assert.deepEqual(
    checkKeys(state, [
      { kind: "char", key: "國" },
      { kind: "word", key: "國民" },
      { kind: "char", key: "民" },
      { kind: "word", key: "國" }, // same key, other kind: not saved
      null,
      { kind: "char" },
    ]),
    { "c:國": true, "w:國民": true, "c:民": false, "w:國": false }
  );
  assert.deepEqual(checkKeys(state, undefined), {});
});

// --- folder CRUD ----------------------------------------------------------

test("createFolder mints monotonic ids and refuses an empty name", () => {
  const first = createFolder(normalizeSavedState(null), "Verbs");
  assert.equal(first.error, null);
  assert.deepEqual(first.folder, { id: "f1", name: "Verbs" });

  const second = createFolder(first.state, "  Idioms  ");
  assert.deepEqual(second.folder, { id: "f2", name: "Idioms" });
  assert.deepEqual(second.state.folders, [
    { id: "f0", name: "Saved" },
    { id: "f1", name: "Verbs" },
    { id: "f2", name: "Idioms" },
  ]);

  const bad = createFolder(second.state, "   ");
  assert.equal(bad.folder, null);
  assert.equal(bad.error, "folder name required");
  assert.equal(bad.state.folders.length, 3);
});

test("renameFolder renames f0 too, but never to empty", () => {
  const state = createFolder(normalizeSavedState(null), "Verbs").state;

  const renamed = renameFolder(state, "f0", " Bookmarks ");
  assert.deepEqual(renamed.folder, { id: "f0", name: "Bookmarks" });
  assert.equal(renamed.error, null);
  assert.equal(state.folders[0].name, "Saved", "input state must not be mutated");

  assert.equal(renameFolder(state, "f0", "  ").error, "folder name required");
  assert.equal(renameFolder(state, "f9", "Nope").error, "no such folder");
  assert.equal(renameFolder(state, "f9", "Nope").folder, null);
});

test("deleteFolder refuses f0 and moves a deleted folder's items to f0", () => {
  let state = createFolder(seedState(), "Verbs").state; // f1
  state = moveItems(state, ["i0"], "f1").state;

  const refused = deleteFolder(state, "f0");
  assert.equal(refused.error, "the default folder cannot be deleted");
  assert.equal(refused.state.folders.length, 2);
  assert.equal(deleteFolder(state, "f9").error, "no such folder");

  const gone = deleteFolder(state, "f1");
  assert.equal(gone.error, null);
  assert.equal(gone.moved, 1);
  assert.deepEqual(gone.state.folders, [{ id: "f0", name: "Saved" }]);
  assert.ok(gone.state.items.every((i) => i.folderId === "f0"));
  assert.equal(gone.state.items.length, 2, "items survive their folder");
  // Deleting a folder never recycles its id.
  assert.equal(createFolder(gone.state, "Later").folder.id, "f2");
});

test("deleting the default folder resets the setting to f0", () => {
  const made = createFolder(normalizeSavedState(null), "Verbs");
  const settings = normalizeSettings({ defaultFolderId: "f1" }, made.state);
  assert.equal(settings.defaultFolderId, "f1", "a live folder stands");

  const gone = deleteFolder(made.state, "f1");
  assert.equal(normalizeSettings(settings, gone.state).defaultFolderId, "f0");
  // Without a state to check against, the stored value is taken at face value.
  assert.equal(normalizeSettings(settings).defaultFolderId, "f1");
});

// --- move / remove --------------------------------------------------------

test("moveItems re-homes only the named items, and only into a real folder", () => {
  const state = createFolder(seedState(), "Verbs").state; // f1

  const moved = moveItems(state, ["i0", "i9"], "f1");
  assert.equal(moved.error, null);
  assert.equal(moved.moved, 1);
  assert.deepEqual(
    moved.state.items.map((i) => [i.id, i.folderId]),
    [
      ["i0", "f1"],
      ["i1", "f0"],
    ]
  );
  // A move into the folder the item is already in changes nothing.
  assert.equal(moveItems(moved.state, ["i0"], "f1").moved, 0);

  const nowhere = moveItems(state, ["i0"], "f9");
  assert.equal(nowhere.error, "no such folder");
  assert.equal(nowhere.moved, 0);
  assert.deepEqual(nowhere.state.items[0].folderId, "f0");
});

test("removeItems drops the named ids and reports the count", () => {
  const state = seedState();
  const removed = removeItems(state, ["i1", "i9"]);
  assert.equal(removed.removed, 1);
  assert.deepEqual(removed.state.items.map((i) => i.id), ["i0"]);
  assert.equal(removeItems(state, []).removed, 0);
  assert.equal(removeItems(state, undefined).removed, 0);
  assert.equal(state.items.length, 2, "input state must not be mutated");
});

// --- export selection -----------------------------------------------------

test("resolveExportSelection takes ids, then folders, then all", () => {
  let state = createFolder(seedState(), "Verbs").state; // f1
  state = moveItems(state, ["i1"], "f1").state;
  const ids = (items) => items.map((i) => i.id);

  assert.deepEqual(ids(resolveExportSelection(state, { ids: ["i1"] })), ["i1"]);
  assert.deepEqual(ids(resolveExportSelection(state, { folderIds: ["f1"] })), ["i1"]);
  assert.deepEqual(ids(resolveExportSelection(state, { folderIds: ["f0", "f1"] })), [
    "i0",
    "i1",
  ]);
  assert.deepEqual(ids(resolveExportSelection(state, { all: true })), ["i0", "i1"]);
  // Explicit ids win over everything else.
  assert.deepEqual(
    ids(resolveExportSelection(state, { ids: ["i0"], folderIds: ["f1"], all: true })),
    ["i0"]
  );
  // Nothing asked for is nothing exported; the caller decides what a bare
  // "export" means.
  assert.deepEqual(resolveExportSelection(state, {}), []);
  assert.deepEqual(resolveExportSelection(state, undefined), []);
});

// --- join against live data ----------------------------------------------

test("joinItems joins words, chars, and marks entries the data no longer has", () => {
  const items = [
    { id: "i0", kind: "word", key: "國民", folderId: "f0", addedAt: 1 },
    { id: "i1", kind: "char", key: "國", folderId: "f0", addedAt: 2 },
    { id: "i2", kind: "word", key: "沒有", folderId: "f0", addedAt: 3 },
    { id: "i3", kind: "char", key: "沒", folderId: "f0", addedAt: 4 },
  ];
  const [word, char, deadWord, deadChar] = joinItems(items, data);

  assert.equal(word.hangul, "국민");
  assert.deepEqual(word.glosses, ["the people; citizens of a nation"]);
  assert.equal(word.rare, undefined);
  assert.equal(word.missing, undefined);
  assert.equal(word.id, "i0", "item fields ride along for the saved view");
  assert.equal(word.folderId, "f0");

  assert.deepEqual(char.eumhun, [{ hun: "나라", eum: "국" }]);
  assert.deepEqual(char.readings, ["국"]);
  assert.deepEqual(char.glosses, ["country; state; nation"]);
  assert.equal(char.lvl, "m");

  assert.equal(deadWord.missing, true);
  assert.equal(deadWord.key, "沒有");
  assert.equal(deadChar.missing, true);
});

test("joinItems merges homograph glosses, flags all-rare, and follows variants", () => {
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "우리", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "word", key: "牛李", folderId: "f0", addedAt: 2 },
      { id: "i2", kind: "word", key: "安全", folderId: "f0", addedAt: 3 },
      { id: "i3", kind: "char", key: "国", folderId: "f0", addedAt: 4 },
    ],
    data
  );
  assert.equal(rows[0].missing, true, "a hangul spelling is not a words key");
  assert.equal(rows[1].rare, true);
  assert.equal(rows[1].lessCommon, undefined);
  // 安全 has two senses; both glosses show, the hangul comes from the first.
  assert.deepEqual(rows[2].glosses, ["safety; security", "archaic sense"]);
  assert.equal(rows[2].hangul, "안전");
  assert.equal(rows[2].rare, undefined);
  assert.equal(rows[2].lessCommon, undefined);
  // A variant glyph still resolves rather than reading as missing.
  assert.equal(rows[3].missing, undefined);
  assert.deepEqual(rows[3].readings, ["국"]);
});

test("joinItems: a saved lessCommon spelling carries the flag, every-sense rule", () => {
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "假裝", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "word", key: "假葬", folderId: "f0", addedAt: 2 },
      { id: "i2", kind: "word", key: "家長", folderId: "f0", addedAt: 3 },
    ],
    data
  );
  assert.equal(rows[0].lessCommon, true);
  assert.equal(rows[0].rare, undefined);
  assert.equal(rows[1].rare, true);
  assert.equal(rows[1].lessCommon, undefined);
  assert.equal(rows[2].rare, undefined);
  assert.equal(rows[2].lessCommon, undefined);
  const mixed = {
    ...data,
    words: {
      ...words,
      words: {
        ...words.words,
        假裝: [
          { hangul: "가장", glosses: ["a homograph sense"], lessCommon: true },
          { hangul: "가장", glosses: ["a plain sense"] },
        ],
      },
    },
  };
  assert.equal(joinItems([{ id: "i0", kind: "word", key: "假裝", folderId: "f0", addedAt: 1 }], mixed)[0].lessCommon, undefined);
});

// --- settings -------------------------------------------------------------

test("normalizeSettings fills the SPEC defaults and drops unknown tokens", () => {
  for (const junk of [undefined, null, 7, {}, { anki: "nope" }]) {
    assert.deepEqual(normalizeSettings(junk), {
      v: 1,
      defaultFolderId: "f0",
      language: "en",
      nativeWords: false,
      jaReadings: false,
      zhReadings: false,
      anki: {
        wordFront: "hanja",
        wordBack: ["hangul", "defs"],
        charFront: "char",
        charBack: ["eumhun", "defs"],
      },
    });
  }

  const scrubbed = normalizeSettings({
    v: 99,
    defaultFolderId: "",
    anki: {
      wordFront: "lvl", // a char token: not valid on a word front
      wordBack: ["defs", "defs", "lvl", 7, "hanja"],
      charFront: "eumhun",
      charBack: "not an array",
    },
  });
  assert.equal(scrubbed.v, 1);
  assert.equal(scrubbed.defaultFolderId, "f0");
  assert.equal(scrubbed.anki.wordFront, "hanja");
  assert.deepEqual(scrubbed.anki.wordBack, ["defs", "hanja"]);
  assert.equal(scrubbed.anki.charFront, "eumhun");
  assert.deepEqual(scrubbed.anki.charBack, ["eumhun", "defs"]);
  // An emptied checkset is a real user choice and survives normalization.
  assert.deepEqual(normalizeSettings({ anki: { charBack: [] } }).anki.charBack, []);
});

test("a settings patch merges over the current record, one level into anki", () => {
  const current = normalizeSettings(null);
  // The shape background.js's settingsSet merge produces.
  const merged = normalizeSettings(
    {
      ...current,
      defaultFolderId: "f1",
      anki: { ...current.anki, wordFront: "hangul" },
    },
    { folders: [{ id: "f1", name: "Verbs" }] }
  );
  assert.equal(merged.defaultFolderId, "f1");
  assert.equal(merged.anki.wordFront, "hangul");
  assert.deepEqual(merged.anki.wordBack, ["hangul", "defs"], "siblings survive");
  assert.equal(merged.anki.charFront, "char");
  assert.equal(DEFAULT_SETTINGS.anki.wordFront, "hanja", "defaults stay defaults");
});

// --- Anki TSV -------------------------------------------------------------

const tsvLines = (tsv) => tsv.replace(/\n$/, "").split("\n");

test("buildAnkiTsv writes the directives, then Front TAB Back TAB Tag per item", () => {
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "國民", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "char", key: "學", folderId: "f0", addedAt: 2 },
    ],
    data
  );
  const lines = tsvLines(buildAnkiTsv(rows, null, [{ id: "f0", name: "Saved" }]));

  assert.deepEqual(lines.slice(0, 3), [
    "#separator:tab",
    "#html:false",
    "#tags column:3",
  ]);
  // Word defaults: front hanja, back hangul + numbered defs, tag = folder.
  assert.equal(lines[3], "國民\t국민 · 1. the people; citizens of a nation\tSaved");
  // Char defaults: front char, back eumhun + numbered defs over ALL glosses.
  assert.equal(lines[4], "學\t배울 학 · 1. to learn; to study; 2. school; learning\tSaved");
  assert.equal(lines.length, 5);
  assert.ok(buildAnkiTsv(rows, null, []).endsWith("\n"));
});

test("the anki tag is the folder name, with whitespace runs as underscores", () => {
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "國民", folderId: "f1", addedAt: 1 },
      { id: "i1", kind: "word", key: "學生", folderId: "f2", addedAt: 2 },
      { id: "i2", kind: "word", key: "國家", folderId: "f9", addedAt: 3 },
    ],
    data
  );
  const tags = tsvLines(
    buildAnkiTsv(rows, null, [
      { id: "f1", name: "HSK words  2" },
      { id: "f2", name: "  spaced\tout  " },
    ])
  )
    .slice(3)
    .map((line) => line.split("\t")[2]);

  // Anki splits tags on whitespace, so a multi-word folder must be one token.
  assert.deepEqual(tags, ["HSK_words_2", "spaced_out", "f9"]);
  // Front and back are untouched by the tag column.
  const line = tsvLines(buildAnkiTsv(rows, null, [{ id: "f1", name: "HSK words  2" }]))[3];
  assert.equal(line, "國民\t국민 · 1. the people; citizens of a nation\tHSK_words_2");
  // No folder list at all: the id stands in, like the CSV's folder column.
  assert.equal(tsvLines(buildAnkiTsv(rows, null))[3].split("\t")[2], "f1");
});

test("buildAnkiTsv renders the fields the settings ask for", () => {
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "國民", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "char", key: "國", folderId: "f0", addedAt: 2 },
    ],
    data
  );
  const folders = [{ id: "f0", name: "Saved" }];
  const lines = tsvLines(
    buildAnkiTsv(
      rows,
      {
        anki: {
          wordFront: "hangul",
          wordBack: ["hanja", "defs"],
          charFront: "eumhun",
          charBack: ["char", "readings", "lvl"],
        },
      },
      folders
    )
  );
  assert.equal(lines[3], "국민\t國民 · 1. the people; citizens of a nation\tSaved");
  assert.equal(lines[4], "나라 국\t國 · 국 · m\tSaved");

  // A back set that renders nothing at all leaves an empty back field.
  const bare = tsvLines(buildAnkiTsv(rows, { anki: { wordBack: [] } }, folders));
  assert.equal(bare[3], "國民\t\tSaved");
});

test("buildAnkiTsv quotes tabs, quotes and newlines CSV-style, and skips missing rows", () => {
  const odd = {
    variants: { map: {} },
    hanja: { chars: {} },
    words: {
      words: {
        特殊: [{ hangul: "특수", glosses: ['R&D <special> "quoted" \'odd\''] }],
        分野: [{ hangul: "분야", glosses: ["field\ttabbed", "line\nbroken"] }],
      },
    },
  };
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "特殊", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "word", key: "分野", folderId: "f0", addedAt: 2 },
      { id: "i2", kind: "word", key: "沒有", folderId: "f0", addedAt: 3 },
    ],
    odd
  );
  const tsv = buildAnkiTsv(rows, null, [{ id: "f0", name: 'a "tag"\there' }]);

  assert.ok(
    tsv.includes('特殊\t"특수 · 1. R&D <special> ""quoted"" \'odd\'"'),
    "an embedded double quote is doubled and the field is wrapped"
  );
  assert.ok(
    tsv.includes('分野\t"분야 · 1. field\ttabbed; 2. line\nbroken"'),
    "tab and newline force quoting too"
  );
  // The tag column obeys the same quoting rules; its whitespace (the space and
  // the tab) has already collapsed into underscores, so only the quotes are
  // left to escape.
  assert.ok(tsv.includes('\t"a_""tag""_here"'), "the tag is quoted like any field");
  // The missing row is skipped; the caller counts it (background.js reports it
  // as `skipped`). Asserted whole, since a quoted field may itself hold a
  // newline and line counting would lie.
  assert.equal(
    tsv,
    [
      "#separator:tab",
      "#html:false",
      "#tags column:3",
      '特殊\t"특수 · 1. R&D <special> ""quoted"" \'odd\'"\t"a_""tag""_here"',
      '分野\t"분야 · 1. field\ttabbed; 2. line\nbroken"\t"a_""tag""_here"',
    ].join("\n") + "\n"
  );
  assert.equal(rows.filter((r) => r.missing === true).length, 1);
  const directives = "#separator:tab\n#html:false\n#tags column:3\n";
  assert.deepEqual(buildAnkiTsv([], null, []), directives);
  assert.deepEqual(buildAnkiTsv(undefined, null, undefined), directives);
});

// --- CSV export ----------------------------------------------------------

test("buildCsv writes the header and every column, whatever the anki settings", () => {
  const folders = [
    { id: "f0", name: "Saved" },
    { id: "f1", name: "Verbs" },
  ];
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "國民", folderId: "f1", addedAt: Date.UTC(2026, 7, 17) },
      { id: "i1", kind: "char", key: "學", folderId: "f0", addedAt: Date.UTC(2025, 0, 2) },
    ],
    data
  );
  const lines = buildCsv(rows, folders).replace(/\n$/, "").split("\n");

  assert.deepEqual(CSV_COLUMNS, [
    "kind",
    "key",
    "hangul",
    "eumhun",
    "readings",
    "definitions",
    "level",
    "japanese",
    "chinese",
    "folder",
    "added",
  ]);
  assert.equal(
    lines[0],
    "kind,key,hangul,eumhun,readings,definitions,level,japanese,chinese,folder,added"
  );
  // A word has no eumhun/readings/level (nor sino readings); the columns stay
  // in place, empty.
  assert.equal(
    lines[1],
    "word,國民,국민,,,1. the people; citizens of a nation,,,,Verbs,2026-08-17"
  );
  // A char has no hangul; the folder name is resolved, not the id. No sino
  // data was joined here, so the japanese/chinese columns stay empty too.
  assert.equal(
    lines[2],
    "char,學,,배울 학,학,1. to learn; to study; 2. school; learning,m,,,Saved,2025-01-02"
  );
  assert.equal(lines.length, 3);
});

test("buildCsv quotes commas, quotes and newlines RFC-4180 style", () => {
  const odd = {
    variants: { map: {} },
    hanja: { chars: {} },
    words: {
      words: {
        特殊: [{ hangul: "특수", glosses: ['R&D <special> "quoted" \'odd\''] }],
        分野: [{ hangul: "분야", glosses: ["field, comma'd", "line\nbroken"] }],
        沒有: [{ hangul: "몰유", glosses: ["gone"] }],
      },
    },
  };
  const csv = buildCsv(
    joinItems(
      [
        { id: "i0", kind: "word", key: "特殊", folderId: "f0", addedAt: 0 },
        { id: "i1", kind: "word", key: "分野", folderId: "f2", addedAt: 0 },
        { id: "i2", kind: "word", key: "沒有", folderId: "f0", addedAt: 0 },
      ],
      odd
    ),
    [{ id: "f0", name: 'The "big" list, part 2' }]
  );

  const lines = csv.replace(/\n$/, "").split("\n");
  assert.equal(
    lines[1],
    'word,特殊,특수,,,"1. R&D <special> ""quoted"" \'odd\'",,,,"The ""big"" list, part 2",'
  );
  // An embedded newline lives inside the quoted field, so this row spans two
  // physical lines; the unresolved folder falls back to its id.
  assert.equal(lines[2], 'word,分野,분야,,,"1. field, comma\'d; 2. line');
  assert.equal(lines[3], 'broken",,,,f2,');
  assert.equal(lines[4], "word,沒有,몰유,,,1. gone,,,,\"The \"\"big\"\" list, part 2\",");
  // addedAt 0 (an item normalized from junk) leaves the date column empty.
  assert.ok(lines[1].endsWith(","));
});

test("buildCsv skips missing rows and survives junk input", () => {
  const rows = joinItems(
    [
      { id: "i0", kind: "word", key: "國民", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "word", key: "沒有", folderId: "f0", addedAt: 2 },
      { id: "i2", kind: "char", key: "沒", folderId: "f0", addedAt: 3 },
    ],
    data
  );
  const csv = buildCsv(rows, [{ id: "f0", name: "Saved" }]);
  assert.equal(csv.replace(/\n$/, "").split("\n").length, 2, "header + the one live row");
  assert.ok(!csv.includes("沒"));
  assert.equal(rows.filter((r) => r.missing === true).length, 2);

  const header = `${CSV_COLUMNS.join(",")}\n`;
  assert.equal(buildCsv([], []), header);
  assert.equal(buildCsv(undefined, undefined), header);
  // No folder list at all: the id stands in for the name.
  assert.ok(buildCsv(rows, undefined).includes(",f0,"));
});

// --- background.js: still importable without chrome globals --------------

await testAsync("background.js imports cleanly in Node (guards hold)", async () => {
  assert.equal(typeof globalThis.chrome, "undefined", "no chrome shim in the test env");
  const bg = await import("../extension/background.js");
  const exported = [
    "handleLookup",
    "handleCompounds",
    "handleUsedIn",
    "handleOpenTab",
    "handleGetPendingQuery",
    "setPendingQuery",
    "handleSavedGet",
    "handleSavedToggle",
    "handleSavedCheck",
    "handleSavedRemove",
    "handleSavedMove",
    "handleFolderCreate",
    "handleFolderRename",
    "handleFolderDelete",
    "handleSettingsGet",
    "handleSettingsSet",
    "handleSavedExport",
  ];
  for (const fn of exported) {
    assert.equal(typeof bg[fn], "function", `background.js should export ${fn}`);
  }
});

// --- decomposition: the worker's guard and its join ----------------------

await testAsync("decomp: a missing or wrong-version file leaves an empty table", async () => {
  const { guardDecomp } = await import("../extension/background.js");
  assert.deepEqual(guardDecomp(null), { v: 1, parts: {}, phon: {} });
  assert.deepEqual(guardDecomp("nonsense"), { v: 1, parts: {}, phon: {} });
  assert.deepEqual(guardDecomp({ v: 2, parts: { "依": [["衣"]] } }), { v: 1, parts: {}, phon: {} });
  assert.deepEqual(guardDecomp({ v: 1 }), { v: 1, parts: {}, phon: {} });
});

await testAsync("decomp: the guard passes `phon` through and degrades it with the file", async () => {
  const { guardDecomp } = await import("../extension/background.js");
  // The guardNative trap: a guard that rebuilds the record drops the sibling
  // map, so the pass-through is asserted on the guard's own output.
  assert.deepEqual(
    guardDecomp({ v: 1, parts: { "請": [["言"], ["靑"]] }, phon: { "請": 1 } }),
    { v: 1, parts: { "請": [["言"], ["靑"]] }, phon: { "請": 1 } }
  );
  // Junk in the slot degrades to an empty map, never to a crash.
  assert.deepEqual(guardDecomp({ v: 1, parts: {}, phon: "nonsense" }).phon, {});
  assert.deepEqual(guardDecomp({ v: 1, parts: {}, phon: null }).phon, {});
  // An old bundle degrades WHOLE: no parts, and no pins into them either.
  assert.deepEqual(
    guardDecomp({ v: 2, parts: { "請": [["言"], ["靑"]] }, phon: { "請": 1 } }),
    { v: 1, parts: {}, phon: {} }
  );
});

await testAsync("decomp: rows are joined onto char matches, targets resolved", async () => {
  const { attachDecomp, guardDecomp } = await import("../extension/background.js");
  const decomp = guardDecomp({
    v: 1,
    parts: {
      "依": [["亻", "人"], ["衣"]],
      "疑": [["匕"], ["龴", null], ["㇒", null, "downward stroke"]],
      "國": [["囗"], ["或"]],          // 或 has readings but no eumhun
      "乁": [["丿", "丿"]],            // target with no dictionary entry
    },
  });
  // The real hanja.json shape: chars under a `chars` key, version beside it.
  // A bare table here once hid a join bug that degraded every part to an
  // inert glyph in the shipped extension.
  const hanja = {
    version: 1,
    chars: {
      "人": { eumhun: [{ hun: "사람", eum: "인" }], glosses: ["person; human"] },
      "衣": { eumhun: [{ hun: "옷", eum: "의" }], glosses: ["clothing"] },
      "匕": { eumhun: [], glosses: [] },
      "囗": { eumhun: [{ hun: "에울", eum: "위" }], glosses: ["enclosure"] },
      // The fallback case: no eumhun pair at all, but a reading is recorded.
      "或": { eumhun: [], readings: ["혹"], glosses: ["some; perhaps"] },
    },
  };
  const matches = [
    { kind: "char", canonical: "依" },
    { kind: "char", canonical: "疑" },
    { kind: "char", canonical: "國" },
    { kind: "char", canonical: "乁" },
    { kind: "char", canonical: "一" },                       // no entry
    { kind: "word", canonical: "依存", parts: [{ type: "word" }] },
  ];
  const out = attachDecomp({ ok: true, matches }, { decomp, hanja });
  const [uy, ui, guk, ye, il, word] = out.matches;

  // Alias: the display glyph stays 亻, the reading comes from 人.
  assert.deepEqual(uy.parts, [
    { g: "亻", t: "人", hun: "사람", eum: "인", gloss: "person; human" },
    { g: "衣", t: "衣", hun: "옷", eum: "의", gloss: "clothing" },
  ]);
  // Reading-less rows carry no target, and a name only when the data has one.
  assert.deepEqual(ui.parts, [
    { g: "匕", t: "匕", hun: "", eum: "", gloss: "" },
    { g: "龴" },
    { g: "㇒", name: "downward stroke" },
  ]);
  // An empty eumhun list falls back to readings[0], so the row is never a
  // bare gloss.
  assert.deepEqual(guk.parts, [
    { g: "囗", t: "囗", hun: "에울", eum: "위", gloss: "enclosure" },
    { g: "或", t: "或", hun: "", eum: "혹", gloss: "some; perhaps" },
  ]);
  // A target outside the dictionary degrades to an inert row.
  assert.deepEqual(ye.parts, [{ g: "丿" }]);
  assert.equal("parts" in il, false);
  // Word `parts` (component words) are a different field on a different kind.
  assert.deepEqual(word.parts, [{ type: "word" }]);
});

await testAsync("decomp: the phon pin flags the joined row, driven through the guard", async () => {
  const { attachDecomp, guardDecomp } = await import("../extension/background.js");
  // The attach path runs on guardDecomp's OUTPUT, never on a hand-built
  // table: the drive-through-the-guard pattern, so a guard that dropped
  // `phon` would fail HERE and not only in the shipped worker.
  const decomp = guardDecomp({
    v: 1,
    parts: {
      "請": [["言"], ["靑"]],
      "晴": [["日"], ["靑"]],          // no phon entry at all
      "凊": [[42], ["靑"]],            // malformed row 0 drops in the filter
      "圊": [["囗"], ["靑", "諪"]],     // pinned row's target has no entry
      "喆": [["吉"], ["吉"]],          // the pinned glyph appears twice
    },
    phon: { "請": 1, "凊": 1, "圊": 1, "喆": 1 },
  });
  const hanja = {
    version: 1,
    chars: {
      "言": { eumhun: [{ hun: "말씀", eum: "언" }], glosses: ["speech"] },
      "靑": { eumhun: [{ hun: "푸를", eum: "청" }], glosses: ["blue"] },
      "日": { eumhun: [{ hun: "날", eum: "일" }], glosses: ["sun; day"] },
      "囗": { eumhun: [{ hun: "에울", eum: "위" }], glosses: ["enclosure"] },
      "吉": { eumhun: [{ hun: "길할", eum: "길" }], glosses: ["lucky"] },
    },
  };
  const matches = [
    { kind: "char", canonical: "請" },
    { kind: "char", canonical: "晴" },
    { kind: "char", canonical: "凊" },
    { kind: "char", canonical: "圊" },
    { kind: "char", canonical: "喆" },
  ];
  const out = attachDecomp({ ok: true, matches }, { decomp, hanja });
  const [pinned, unpinned, filtered, inert, doubled] = out.matches;

  // The joined row at the pinned index carries the flag; its sibling not.
  assert.deepEqual(pinned.parts, [
    { g: "言", t: "言", hun: "말씀", eum: "언", gloss: "speech" },
    { g: "靑", t: "靑", hun: "푸를", eum: "청", gloss: "blue", phon: true },
  ]);
  // No phon entry: the match is byte-identical to the unflagged join.
  assert.deepEqual(unpinned.parts, [
    { g: "日", t: "日", hun: "날", eum: "일", gloss: "sun; day" },
    { g: "靑", t: "靑", hun: "푸를", eum: "청", gloss: "blue" },
  ]);
  // The pin indexes the EMITTED rows: row 0 dropped in the filter, and the
  // flag still lands on 靑, which is the map-before-filter ordering.
  assert.deepEqual(filtered.parts, [
    { g: "靑", t: "靑", hun: "푸를", eum: "청", gloss: "blue", phon: true },
  ]);
  // A pinned row that degraded to an inert {g} is NOT flagged.
  assert.deepEqual(inert.parts, [
    { g: "囗", t: "囗", hun: "에울", eum: "위", gloss: "enclosure" },
    { g: "靑" },
  ]);
  // A repeated glyph marks ONE row: the one the pin addresses.
  assert.deepEqual(doubled.parts, [
    { g: "吉", t: "吉", hun: "길할", eum: "길", gloss: "lucky" },
    { g: "吉", t: "吉", hun: "길할", eum: "길", gloss: "lucky", phon: true },
  ]);
});

// --- recomposition: the derived found-in index ---------------------------

// One inline decomp table, shaped to carry every rule the index has to obey.
const RECOMP_PARTS = {
  "依": [["亻", "人"], ["衣"]],            // alias: the row credits 人, not 亻
  "袋": [["代"], ["衣"]],
  "雙": [["隹"], ["隹"], ["又"]],          // the same part twice
  "雜": [["隹"], ["木"]],
  "衣": [["亠", null], ["衣"]],            // a row targeting its own character
};

const RECOMP_HANJA = {
  version: 1,
  chars: {
    "依": { eumhun: [{ hun: "의지할", eum: "의" }], glosses: ["to rely on"],
      lvl: "h", cw: ["依存"] },
    // No eumhun pair, but a reading: the join falls back to readings[0].
    "袋": { eumhun: [], readings: ["대"], glosses: ["bag; sack"], lvl: "a",
      cw: ["布袋", "魚袋", "紙袋"] },
    "雙": { eumhun: [{ hun: "두", eum: "쌍" }], glosses: ["a pair"], lvl: "h" },
    "雜": { eumhun: [{ hun: "섞일", eum: "잡" }], glosses: ["mixed"], lvl: "h" },
    "人": { eumhun: [{ hun: "사람", eum: "인" }], glosses: ["person"], lvl: "m" },
    "衣": { eumhun: [{ hun: "옷", eum: "의" }], glosses: ["clothing"], lvl: "m" },
  },
};

await testAsync("recomposition: the index is derived from the decomp table alone", async () => {
  const { buildFoundInIndex } = await import("../extension/background.js");
  const index = buildFoundInIndex(RECOMP_PARTS);

  // Alias crediting: the TARGET is indexed, the display glyph never is.
  assert.deepEqual(index["人"], ["依"]);
  assert.equal("亻" in index, false, "a display glyph is not a list of its own");
  // Reading-less rows name no character, so they credit nothing.
  assert.equal("亠" in index, false);
  // A part used twice by one character is credited once.
  assert.deepEqual(index["隹"], ["雙", "雜"]);
  // Self-exclusion: 衣's own row for 衣 does not put 衣 in its own list.
  assert.deepEqual(index["衣"], ["依", "袋"]);
  // An empty or malformed table is simply an empty index.
  assert.deepEqual(Object.keys(buildFoundInIndex(null)), []);
  assert.deepEqual(Object.keys(buildFoundInIndex({ "依": "nonsense" })), []);
});

await testAsync("recomposition: lists are joined and ranked by cw, ties by codepoint", async () => {
  const { buildFoundInIndex, buildFoundIn } = await import("../extension/background.js");
  const index = buildFoundInIndex(RECOMP_PARTS);

  // 袋 has three compounds to 依's one, so it leads despite the later codepoint.
  assert.deepEqual(buildFoundIn("衣", index, RECOMP_HANJA), [
    { char: "袋", hun: "", eum: "대", gloss: "bag; sack", lvl: "a" },
    { char: "依", hun: "의지할", eum: "의", gloss: "to rely on", lvl: "h" },
  ]);
  // Neither has a cw index, so the codepoint decides: 雙 U+96D9 before 雜 U+96DC.
  assert.deepEqual(
    buildFoundIn("隹", index, RECOMP_HANJA).map((r) => r.char),
    ["雙", "雜"]
  );
  // A character nothing is built from, and one outside the dictionary.
  assert.deepEqual(buildFoundIn("依", index, RECOMP_HANJA), []);
  // A container with no dictionary entry is dropped, never rendered as a row
  // that would navigate nowhere.
  assert.deepEqual(buildFoundIn("木", index, { version: 1, chars: {} }), []);
  assert.deepEqual(buildFoundIn("", index, RECOMP_HANJA), []);
});

await testAsync("recomposition: the index FOLLOWS the table it was built from", async () => {
  const { buildFoundInIndex } = await import("../extension/background.js");
  const before = buildFoundInIndex(RECOMP_PARTS);

  // The binding property: nothing is stored, so editing the decomposition is
  // the whole change. A mutated copy yields the mutated lists, and the index
  // built from the original is untouched by it.
  const mutated = JSON.parse(JSON.stringify(RECOMP_PARTS));
  delete mutated["雜"];                       // 隹 loses a container
  mutated["依"] = [["亻", "儿"], ["衣"]];      // the alias now credits 儿
  mutated["祖"] = [["礻", "示"], ["且"]];      // a new character appears
  const after = buildFoundInIndex(mutated);

  assert.deepEqual(after["隹"], ["雙"]);
  assert.equal("人" in after, false);
  assert.deepEqual(after["儿"], ["依"]);
  assert.deepEqual(after["示"], ["祖"]);
  assert.deepEqual(before["隹"], ["雙", "雜"]);
  assert.deepEqual(before["人"], ["依"]);
  assert.equal("儿" in before, false);
});

await testAsync("recomposition: char matches carry foundInCount, omitted when 0", async () => {
  const { buildFoundInIndex, attachFoundIn } = await import("../extension/background.js");
  const index = buildFoundInIndex(RECOMP_PARTS);
  let builds = 0;
  const getIndex = () => {
    builds++;
    return index;
  };

  const out = attachFoundIn(
    {
      ok: true,
      matches: [
        { kind: "char", canonical: "衣" },
        { kind: "char", canonical: "隹" },
        { kind: "char", canonical: "雜" },          // a part of nothing
        { kind: "word", canonical: "依存", usedInCount: 2 },
      ],
    },
    getIndex
  );
  const [ui, chu, jap, word] = out.matches;
  assert.equal(ui.foundInCount, 2);
  assert.equal(chu.foundInCount, 2);
  assert.equal("foundInCount" in jap, false);
  assert.equal("foundInCount" in word, false);
  assert.equal(builds, 1, "the index is resolved once per response");

  // A response with no char match never asks for the index at all.
  attachFoundIn({ ok: true, matches: [{ kind: "word", canonical: "依存" }] }, getIndex);
  assert.equal(builds, 1);
  // Error envelopes pass straight through.
  const err = { ok: false, error: "boom" };
  assert.equal(attachFoundIn(err, getIndex), err);
});

// --- saved words: every handler answers when there is no chrome.storage ---

await testAsync("without chrome.storage every saved handler answers 'unavailable'", async () => {
  const bg = await import("../extension/background.js");
  const unavailable = { ok: false, error: "storage unavailable" };

  assert.deepEqual(await bg.handleSavedGet(), unavailable);
  assert.deepEqual(await bg.handleSavedToggle("char", "國"), unavailable);
  assert.deepEqual(await bg.handleSavedCheck([{ kind: "char", key: "國" }]), unavailable);
  assert.deepEqual(await bg.handleSavedRemove(["i0"]), unavailable);
  assert.deepEqual(await bg.handleSavedMove(["i0"], "f1"), unavailable);
  assert.deepEqual(await bg.handleFolderCreate("Verbs"), unavailable);
  assert.deepEqual(await bg.handleFolderRename("f1", "Verbs"), unavailable);
  assert.deepEqual(await bg.handleFolderDelete("f1"), unavailable);
  assert.deepEqual(await bg.handleSettingsGet(), unavailable);
  assert.deepEqual(await bg.handleSettingsSet({ defaultFolderId: "f1" }), unavailable);
  assert.deepEqual(await bg.handleSavedExport({ all: true }), unavailable);
  // Both export formats stop at the same guard.
  assert.deepEqual(await bg.handleSavedExport({ all: true }, "csv"), unavailable);
  assert.deepEqual(await bg.handleSavedExport({ all: true }, "anki"), unavailable);
});

await testAsync("the router carries every SPEC message type", async () => {
  const { MESSAGE_HANDLERS } = await import("../extension/background.js");
  const types = [
    "lookup",
    "compounds",
    "usedIn",
    "foundIn",
    "openTab",
    "getPendingQuery",
    "savedGet",
    "savedToggle",
    "savedCheck",
    "savedRemove",
    "savedMove",
    "folderCreate",
    "folderRename",
    "folderDelete",
    "settingsGet",
    "settingsSet",
    "savedExport",
    "messagesGet",
  ];
  assert.deepEqual(Object.keys(MESSAGE_HANDLERS).sort(), types.slice().sort());
  // Routed saved messages reach the storage guard, not a crash.
  for (const type of types.filter((t) => t.startsWith("saved") || t.startsWith("folder") ||
    t.startsWith("settings"))) {
    assert.deepEqual(await MESSAGE_HANDLERS[type]({ type }), {
      ok: false,
      error: "storage unavailable",
    });
  }
  // The export format rides on the message; an absent one means "anki".
  assert.deepEqual(
    await MESSAGE_HANDLERS.savedExport({ type: "savedExport", all: true, format: "csv" }),
    { ok: false, error: "storage unavailable" }
  );
});

// --- sidebar addendum: the omnibox -> panel pending query is read-once -----

await testAsync("pending query is handed over once, then cleared", async () => {
  const { setPendingQuery, handleGetPendingQuery } = await import("../extension/background.js");

  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: null });

  setPendingQuery("國民");
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: "國民" });
  // Read-once: a second panel open must not re-run the old search.
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: null });

  // The omnibox fallback path clears it the same way.
  setPendingQuery("國");
  setPendingQuery(null);
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: null });
});

/* ---------------------------------------------------------------------------
 * QWERTY-to-hangul (한영타 변환) — extension/dubeolsik.js
 * ------------------------------------------------------------------------- */

test("the key map covers the layout, unshifted and shifted", () => {
  // One syllable per key, so a wrong cell shows up as a wrong glyph rather
  // than as a plausible-looking neighbour.
  assert.equal(qwertyToHangul("rk"), "가");
  assert.equal(qwertyToHangul("sk"), "나");
  assert.equal(qwertyToHangul("ek"), "다");
  assert.equal(qwertyToHangul("fk"), "라");
  assert.equal(qwertyToHangul("ak"), "마");
  assert.equal(qwertyToHangul("qk"), "바");
  assert.equal(qwertyToHangul("tk"), "사");
  assert.equal(qwertyToHangul("dk"), "아");
  assert.equal(qwertyToHangul("wk"), "자");
  assert.equal(qwertyToHangul("ck"), "차");
  assert.equal(qwertyToHangul("zk"), "카");
  assert.equal(qwertyToHangul("xk"), "타");
  assert.equal(qwertyToHangul("vk"), "파");
  assert.equal(qwertyToHangul("gk"), "하");
  // Every vowel key, against the same initial.
  assert.equal(
    qwertyToHangul("rk ro ri rO rj rp ru rP rh ry rn rb rm rl"),
    "가 개 갸 걔 거 게 겨 계 고 교 구 규 그 기"
  );
  // The seven shifted keys are their own jamo, not their lowercase twins.
  assert.equal(qwertyToHangul("Qk Wk Ek Rk Tk"), "빠 짜 따 까 싸");
  assert.equal(qwertyToHangul("rO rP"), "걔 계");
});

test("any other uppercase letter is just its lowercase key", () => {
  // 하늘 uses none of the seven shifted keys, so caps lock changes nothing.
  assert.equal(qwertyToHangul("gksmf"), "하늘");
  assert.equal(qwertyToHangul("GKSMF"), "하늘");
  assert.equal(qwertyToHangul("GkSmF"), "하늘");
  // Where a letter IS a shifted key, the two cases genuinely differ: the R of
  // 한국 is ㄱ, but a capital R is ㄲ.
  assert.equal(qwertyToHangul("gksrnr"), "한국");
  assert.equal(qwertyToHangul("GKSRNR"), "한꾺");
  assert.equal(qwertyToHangul("gkrtod"), "학생");
  assert.equal(qwertyToHangul("GKRTOD"), "핚썡");
});

test("compound vowels fuse", () => {
  assert.equal(qwertyToHangul("rhk"), "과");   // ㅗ + ㅏ = ㅘ
  assert.equal(qwertyToHangul("rho"), "괘");   // ㅗ + ㅐ = ㅙ
  assert.equal(qwertyToHangul("rhl"), "괴");   // ㅗ + ㅣ = ㅚ
  assert.equal(qwertyToHangul("rnj"), "궈");   // ㅜ + ㅓ = ㅝ
  assert.equal(qwertyToHangul("rnp"), "궤");   // ㅜ + ㅔ = ㅞ
  assert.equal(qwertyToHangul("rnl"), "귀");   // ㅜ + ㅣ = ㅟ
  assert.equal(qwertyToHangul("rml"), "긔");   // ㅡ + ㅣ = ㅢ
  // A pair the layout does NOT fuse simply starts a new syllable.
  assert.equal(qwertyToHangul("rkl"), "가ㅣ");
});

test("compound finals fuse", () => {
  assert.equal(qwertyToHangul("rkrt"), "갃");
  assert.equal(qwertyToHangul("rksw"), "갅");
  assert.equal(qwertyToHangul("rksg"), "갆");
  assert.equal(qwertyToHangul("rkfr"), "갉");
  assert.equal(qwertyToHangul("rkfa"), "갊");
  assert.equal(qwertyToHangul("rkfq"), "갋");
  assert.equal(qwertyToHangul("rkft"), "갌");
  assert.equal(qwertyToHangul("rkfx"), "갍");
  assert.equal(qwertyToHangul("rkfv"), "갎");
  assert.equal(qwertyToHangul("rkfg"), "갏");
  assert.equal(qwertyToHangul("rkqt"), "값");
});

test("ㄲ and ㅆ are legal finals; ㄸ ㅃ ㅉ never are", () => {
  assert.equal(qwertyToHangul("dlT"), "있");
  assert.equal(qwertyToHangul("qkR"), "밖");
  // A double that cannot close a syllable opens the next one instead.
  assert.equal(qwertyToHangul("rkE"), "가ㄸ");
  assert.equal(qwertyToHangul("rkEk"), "가따");
});

test("a final hands itself to the next syllable when a vowel follows", () => {
  // The headline case: 생일, not 샹딜.
  assert.equal(qwertyToHangul("toddlf"), "생일");
  assert.equal(qwertyToHangul("tkfka"), "사람");
  assert.equal(qwertyToHangul("dkssudgktpdy"), "안녕하세요");
  // A DOUBLED final moves whole, since it is one jamo.
  assert.equal(qwertyToHangul("dlTj"), "이써");
  // A COMPOUND final splits: ㄺ leaves ㄹ behind and sends ㄱ on.
  assert.equal(qwertyToHangul("ekfr"), "닭");
  assert.equal(qwertyToHangul("ekfrl"), "달기");
  assert.equal(qwertyToHangul("Qkfrka"), "빨감");
  // No vowel follows, so nothing is handed off and the syllable just ends.
  assert.equal(qwertyToHangul("dlTdj"), "있어");
});

test("jamo that never complete a syllable emit as themselves", () => {
  assert.equal(qwertyToHangul("r"), "ㄱ");
  assert.equal(qwertyToHangul("k"), "ㅏ");
  assert.equal(qwertyToHangul("rt"), "ㄱㅅ");
  assert.equal(qwertyToHangul("rr"), "ㄱㄱ");
  assert.equal(qwertyToHangul("kk"), "ㅏㅏ");
  // A bare pair still fuses where the layout fuses it.
  assert.equal(qwertyToHangul("ml"), "ㅢ");
  assert.equal(qwertyToHangul("hk"), "ㅘ");
  // A trailing consonant after a finished syllable is a tail, not a loss.
  assert.equal(qwertyToHangul("rkr"), "각");
  assert.equal(qwertyToHangul("rkrr"), "각ㄱ");
});

test("characters the layout has no key for pass straight through", () => {
  assert.equal(qwertyToHangul("rk rk"), "가 가");
  assert.equal(qwertyToHangul("rk1"), "가1");
  assert.equal(qwertyToHangul(""), "");
  assert.equal(qwertyToHangul(null), "");
  assert.equal(qwertyToHangul(undefined), "");
  assert.equal(qwertyToHangul(42), "");
});

test("only pure-Latin queries are read as mistyped hangul", () => {
  assert.equal(isLatinQuery("toddlf"), true);
  assert.equal(isLatinQuery("GKRTOD"), true);
  assert.equal(isLatinQuery("생일"), false);
  assert.equal(isLatinQuery("國民"), false);
  assert.equal(isLatinQuery("hj toddlf"), false);   // a space disqualifies it
  assert.equal(isLatinQuery("toddlf1"), false);
  assert.equal(isLatinQuery("國民abc"), false);
  assert.equal(isLatinQuery(""), false);
  assert.equal(isLatinQuery(null), false);
});

// --- romanized search v2: the generator and the two interpreters -----------

const interpreted = (text) => lookup(text, data, { interpret: true });
const kinds = (response) => (response.interpretations || []).map((i) => i.kind);
const hangulsOf = (candidates) => candidates.map((c) => c.hangul);

test("the input-channel rule: interpretation only happens when asked", () => {
  // A literal lookup of Latin text finds nothing, exactly as it did before the
  // QWERTY feature. This is what every internal navigation gets.
  assert.deepEqual(lookup("tkrl", data), { ok: true, matches: [] });
  assert.deepEqual(lookup("gukmin", data), { ok: true, matches: [] });
  assert.equal("interpretations" in lookup("tkrl", data), false);
  // Absent, null and non-object options are all literal.
  assert.deepEqual(lookup("tkrl", data, null).matches, []);
  assert.deepEqual(lookup("tkrl", data, {}).matches, []);
  assert.deepEqual(lookup("tkrl", data, { interpret: false }).matches, []);
  // And the flag changes the answer, so the tests above prove something.
  assert.ok(interpreted("tkrl").matches.length > 0);
  // The separator-bearing spellings are literal-empty too.
  for (const written of ["guk-min", "guk min", "han'gul"]) {
    assert.deepEqual(lookup(written, data), { ok: true, matches: [] }, written);
  }
  // Non-Latin input is never interpreted, flag or no flag.
  assert.equal("interpretations" in interpreted("國民"), false);
  assert.equal("interpretations" in interpreted("국민"), false);
  assert.equal("interpretations" in interpreted("國民abc"), false);
  assert.deepEqual(interpreted("國民").matches, lookup("國民", data).matches);
});

test("the interpreted-query gate: letters plus syllable separators", () => {
  assert.equal(isInterpretableQuery("gukmin"), true);
  assert.equal(isInterpretableQuery("guk-min"), true);
  assert.equal(isInterpretableQuery("guk min"), true);
  assert.equal(isInterpretableQuery("han'gul"), true);
  assert.equal(isInterpretableQuery("Seoul-Dae Hak-Kyo"), true);
  assert.equal(isInterpretableQuery("a"), true);
  // At least one letter, and it has to lead: separators alone are not a query.
  assert.equal(isInterpretableQuery("- -"), false);
  assert.equal(isInterpretableQuery("-"), false);
  assert.equal(isInterpretableQuery("'"), false);
  assert.equal(isInterpretableQuery(" "), false);
  assert.equal(isInterpretableQuery("-guk"), false);
  assert.equal(isInterpretableQuery(""), false);
  // Anything else still disqualifies the query.
  assert.equal(isInterpretableQuery("guk1"), false);
  assert.equal(isInterpretableQuery("國民"), false);
  assert.equal(isInterpretableQuery("國民abc"), false);
  assert.equal(isInterpretableQuery("guk.min"), false);
  assert.equal(isInterpretableQuery(null), false);
  // A separators-only query is not interpreted even with the flag set, and
  // the Dubeolsik generator never throws on separator-bearing input.
  for (const junk of ["- -", "-", "  '  ", "---"]) {
    assert.deepEqual(lookup(junk, data, { interpret: true }), { ok: true, matches: [] }, junk);
  }
  assert.deepEqual(buildInterpretations("- -", data), []);
  assert.deepEqual(buildInterpretations("zz-zz z'z", data), []);
});

test("romanization normalization strips case, hyphens, apostrophes, spaces", () => {
  assert.equal(normalizeRomanization("Guk-Min"), "gukmin");
  assert.equal(normalizeRomanization("han'gul"), "hangul");
  assert.equal(normalizeRomanization("han’gul"), "hangul");
  assert.equal(normalizeRomanization("  GUK MIN "), "gukmin");
  assert.equal(normalizeRomanization(""), "");
  assert.equal(normalizeRomanization(null), "");
});

test("variant expansion is bounded and applies each rule", () => {
  // (a) the normalized form is always first and always present.
  assert.deepEqual(romanizationVariants("gukmin"), ["gukmin"]);
  // (b) a leading k/t/p devoices, one variant each.
  assert.deepEqual(romanizationVariants("kukmin"), ["kukmin", "gukmin"]);
  assert.deepEqual(romanizationVariants("taehan"), ["taehan", "daehan"]);
  assert.deepEqual(romanizationVariants("pusan"), ["pusan", "busan"]);
  // A non-leading k is untouched.
  assert.deepEqual(romanizationVariants("hanguk"), ["hanguk"]);
  // (c) oo → u, every occurrence at once.
  assert.deepEqual(romanizationVariants("moo"), ["moo", "mu"]);
  assert.deepEqual(romanizationVariants("mooboo"), ["mooboo", "mubu"]);
  // (d) sh before a vowel → s; sh elsewhere is left alone.
  assert.deepEqual(romanizationVariants("shin"), ["shin", "sin"]);
  assert.deepEqual(romanizationVariants("shhh"), ["shhh"]);
  // Rules combine, and the combination stays inside the cap.
  assert.deepEqual(romanizationVariants("kooshi"), [
    "kooshi",
    "gooshi",
    "kushi",
    "gushi",
    "koosi",
    "goosi",
    "kusi",
    "gusi",
  ]);
  assert.equal(romanizationVariants("kooshi").length, MAX_RR_VARIANTS);
  // Pathological input does not blow up: three binary rules, cap honored.
  const long = "koo".repeat(50) + "shi".repeat(50);
  assert.ok(romanizationVariants(long).length <= MAX_RR_VARIANTS);
  assert.equal(romanizationVariants("").length, 0);
  assert.equal(romanizationVariants(null).length, 0);
});

test("deromanize: letter segmentation branches on every ambiguity", () => {
  const all = (q) => hangulsOf(deromanize(q));
  // Vowel digraphs read whole and split.
  for (const h of ["하늘", "한을", "하네울"]) {
    assert.ok(all("haneul").includes(h), `haneul should offer ${h}`);
  }
  // ng as one coda versus ㄴ + ㄱ across the boundary.
  for (const h of ["강이", "간기"]) {
    assert.ok(all("gangi").includes(h), `gangi should offer ${h}`);
  }
  // Doubled consonants as a tense onset versus a coda/onset pair.
  for (const h of ["하꾜", "학쿄"]) {
    assert.ok(all("hakkyo").includes(h), `hakkyo should offer ${h}`);
  }
  // Article 8 codas parse beside the transcription codas.
  assert.ok(all("gabs").includes("값"), "gabs should offer 값");
  assert.ok(all("johda").includes("좋다"), "johda should offer 좋다");
  // Unparseable letters yield no candidates at all: Dubeolsik strings stay
  // the other interpreter's business.
  for (const q of ["toddlf", "gksmf", "tkrl", "zzz", "", "guk1min"]) {
    assert.deepEqual(deromanize(q), [], JSON.stringify(q));
  }
  assert.deepEqual(deromanize(null), []);
  // Separators and case normalize away before parsing.
  assert.deepEqual(deromanize("Guk-Min"), deromanize("gukmin"));
});

test("deromanize: sound-change preimages invert each forward rule", () => {
  const anchors = [
    ["gungmin", "국민"],      // nasalization
    ["jongno", "종로"],       // ㄹ onset nasalized after ㅇ
    ["wangsimni", "왕십리"],  // ㅂ + ㄹ, both sides changed
    ["silla", "신라"],        // ㄴ+ㄹ read as ll
    ["sinmunno", "신문로"],   // ㄴ+ㄹ read as nn
    ["hallasan", "한라산"],
    ["byeollae", "별내"],     // ㄹ+ㄴ as ll
    ["hangnyeoul", "학여울"], // ㄴ-insertion plus nasalization
    ["allyak", "알약"],       // ㄴ-insertion plus 유음화
    ["gachi", "같이"],        // palatalized liaison
    ["haedoji", "해돋이"],
    ["joko", "좋고"],         // ㅎ coda hardening the onset
    ["nota", "놓다"],
    ["japyeo", "잡혀"],       // ㅎ onset hardening the coda
    ["chuka", "축하"],
    ["anchida", "앉히다"],    // cluster + ㅎ onset
    ["joa", "좋아"],          // ㅎ dropped before a vowel
    ["mana", "많아"],         // ㄶ shedding its ㅎ
    ["gapsi", "값이"],        // cluster liaison
    ["ilgeo", "읽어"],
    ["osi", "옷이"],          // lone-coda liaison
    ["bueok", "부엌"],        // word-final neutralization
    ["jota", "좋다"],         // non-final neutralization (naive coda t)
  ];
  for (const [q, w] of anchors) {
    assert.ok(hangulsOf(deromanize(q)).includes(w), `${q} should reach ${w}`);
  }
});

test("deromanize: tier 0 is an exact forward form, tier 1 the loosened rest", () => {
  // The honest spelling leads, tier 0, before any of its generous siblings.
  assert.deepEqual(deromanize("gukmin")[0], { hangul: "국민", tier: 0 });
  assert.deepEqual(deromanize("haneul")[0], { hangul: "하늘", tier: 0 });
  // A habit-loosened spelling still reaches the word, but at tier 1, while
  // the honest forms of the same word stay tier 0.
  assert.equal(deromanize("kukmin").find((c) => c.hangul === "국민").tier, 1);
  assert.equal(deromanize("gungmin").find((c) => c.hangul === "국민").tier, 0);
  assert.equal(deromanize("gugmin").find((c) => c.hangul === "국민").tier, 0);
  // Tiers are contiguous: every tier 0 candidate precedes every tier 1.
  for (const q of ["gukmin", "kukmin", "haneul", "mushihaesseo"]) {
    const tiers = deromanize(q).map((c) => c.tier);
    assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b), q);
  }
  // The habit variants feed the same branching: oo → u and sh → s chain.
  assert.ok(hangulsOf(deromanize("mooshi")).includes("무시"));
  // The v2 QA case, generator-level: the inflected form is a candidate.
  assert.ok(hangulsOf(deromanize("mushihaesseo")).includes("무시했어"));
  assert.ok(hangulsOf(deromanize("musihada")).includes("무시하다"));
});

test("deromanize: the pinned caps, and a 20-letter worst case under 50ms", () => {
  // The SPEC v2 bounds. Changing any of these is a SPEC change.
  assert.equal(BRANCH_CAP, 256);
  assert.equal(CANDIDATE_CAP_PER_SYLLABLE, 640);
  assert.equal(MAX_LATIN, 48);
  // The budget formula: one unit through 3 syllables, one more per syllable
  // beyond, growth capped at 8 units.
  assert.equal(candidateBudget(1), CANDIDATE_CAP_PER_SYLLABLE);
  assert.equal(candidateBudget(3), CANDIDATE_CAP_PER_SYLLABLE);
  assert.equal(candidateBudget(4), 2 * CANDIDATE_CAP_PER_SYLLABLE);
  assert.equal(candidateBudget(8), 6 * CANDIDATE_CAP_PER_SYLLABLE);
  assert.equal(candidateBudget(20), 8 * CANDIDATE_CAP_PER_SYLLABLE);
  // Worst garbage: 20 letters of pure vowel soup degrades by truncation.
  // One unmeasured warmup run first: the bound is on the generator, not on
  // v8's first-call JIT cost.
  deromanize("a".repeat(20));
  const started = performance.now();
  const soup = deromanize("a".repeat(20));
  const elapsed = performance.now() - started;
  assert.ok(soup.length > 0 && soup.length <= candidateBudget(20));
  assert.ok(elapsed < 50, `20-char worst case took ${elapsed.toFixed(1)}ms`);
  // Input beyond MAX_LATIN letters is truncated, never hung.
  const t2 = performance.now();
  const over = deromanize("a".repeat(500));
  assert.ok(performance.now() - t2 < 250, "over-long input must truncate");
  assert.deepEqual(over, deromanize("a".repeat(MAX_LATIN)));
  // Candidates are deduped.
  const cands = hangulsOf(deromanize("haneul"));
  assert.equal(cands.length, new Set(cands).size);
});

test("the generator drives the romanization interpreter", () => {
  // All three RR forms of 국민 land on 국민, no map anywhere.
  for (const form of ["gukmin", "gungmin", "gugmin"]) {
    const r = interpreted(form);
    assert.deepEqual(kinds(r), ["rr"], form);
    assert.deepEqual(r.interpretations[0], {
      kind: "rr",
      from: form,
      to: "국민",
      start: 0,
    });
    // The candidate ran the NORMAL lookup, so it is the ordinary word answer:
    // the parity rule, byte for byte.
    assert.deepEqual(r.matches, lookup("국민", data).matches);
  }
  // Case and the syllable-boundary punctuation normalize away.
  assert.deepEqual(interpreted("GukMin").matches, interpreted("gukmin").matches);
  for (const written of ["guk-min", "guk min", "Guk-Min", "guk'min", "GUK MIN"]) {
    assert.deepEqual(
      interpreted(written).matches,
      interpreted("gukmin").matches,
      `${written} should read like gukmin`
    );
    assert.deepEqual(kinds(interpreted(written)), ["rr"], written);
    assert.equal(interpreted(written).interpretations[0].from, written.trim());
  }
  // Trailing separators are trimmed away before the gate sees them.
  assert.deepEqual(interpreted("  gukmin  ").matches, interpreted("gukmin").matches);
  // A habit variant reaches the word: kukmin → 국민.
  const k = interpreted("kukmin");
  assert.deepEqual(kinds(k), ["rr"]);
  assert.equal(k.interpretations[0].to, "국민");
  assert.deepEqual(k.matches, lookup("국민", data).matches);
  // A single-syllable candidate takes the reading path, not the word path.
  const syllable = interpreted("guk");
  assert.deepEqual(kinds(syllable), ["rr"]);
  assert.equal(syllable.matches[0].kind, "reading");
  assert.equal(syllable.matches[0].eum, "국");
  assert.deepEqual(syllable.matches, lookup("국", data).matches);
  // PARITY: an inflected romanization resolves its dictionary prefix exactly
  // the way the typed hangul does (the QA case that motivated v2).
  const inflected = interpreted("gukminieoteo");
  assert.deepEqual(kinds(inflected), ["rr"]);
  assert.deepEqual(
    inflected.matches.filter((m) => m.kind === "word").map((m) => m.canonical),
    ["國民"]
  );
  // Candidates the dictionary rejects leave no trace: garbage romanizations
  // with no dictionary hit drop the whole interpretation.
  assert.deepEqual(interpreted("pyulk"), { ok: true, matches: [] });
});

test("the resolve-side budget is pinned and only truncates the tail", () => {
  // The interpreter resolves at most RESOLVE_CAP candidates, taken in the
  // generator's cheapest-first order. Changing the value is a SPEC change.
  assert.equal(RESOLVE_CAP, 256);
  // A query whose generator output exceeds the cap still resolves its real
  // words: gukminieoteo generates well over RESOLVE_CAP candidates, and the
  // collapse test below proves 國民 comes through regardless.
  assert.ok(deromanize("gukminieoteo").length > RESOLVE_CAP);
  assert.ok(
    interpreted("gukminieoteo").matches.some(
      (m) => m.kind === "word" && m.canonical === "國民"
    )
  );
});

test("candidate collapse: coverage classes gate matches and name the root", () => {
  // Class A, the whole candidate is one dictionary entry: `to` (and so the
  // srcText the renderer roots in) is the candidate hangul.
  assert.equal(interpreted("gukmin").interpretations[0].to, "국민");
  assert.equal(interpreted("guk").interpretations[0].to, "국");
  // Class B, covered end to end by more than one entry: still roots as the
  // candidate hangul, and resolves exactly like the typed hangul (parity).
  const b = interpreted("gukminsarang");
  assert.deepEqual(kinds(b), ["rr"]);
  assert.equal(b.interpretations[0].to, "국민사랑");
  assert.deepEqual(b.matches, lookup("국민사랑", data).matches);
  // The class-B win shuts partial candidates out: 국민살앙 (the liaison
  // preimage, 국민 covered, 살앙 opaque) survives the dictionary but adds
  // nothing, so the merge is byte for byte the typed-hangul answer above.
  // Class C, a partial parse: `to` is the TYPED text itself, per the
  // multi-match-root rule, because no single hangul spelling is canonical;
  // the matches still come from the best partial candidates.
  const c = interpreted("gukminieoteo");
  assert.equal(c.interpretations[0].to, "gukminieoteo");
  assert.deepEqual(
    c.matches.filter((m) => m.kind === "word").map((m) => m.canonical),
    ["國民"]
  );
});

test("merge matrix: dubeolsik-only, rr-only, both, neither", () => {
  // dubeolsik only: 사기전 is in the fixture; "tkrlwjs" has no vowel letter,
  // so the romanization generator cannot even parse it.
  assert.deepEqual(deromanize("tkrlwjs"), []);
  const d = interpreted("tkrlwjs");
  assert.deepEqual(kinds(d), ["dubeolsik"]);
  assert.deepEqual(d.interpretations[0], {
    kind: "dubeolsik",
    from: "tkrlwjs",
    to: "사기전",
    start: 0,
  });
  assert.deepEqual(d.matches, lookup("사기전", data).matches);

  // rr only: "gungmin" is jamo soup on the Dubeolsik side.
  assert.deepEqual(kinds(interpreted("gungmin")), ["rr"]);

  // both: "cheon" types 초대ㅜ (word 招待) and reads 천 (a reading list).
  const both = interpreted("cheon");
  assert.equal(both.interpretations.length, 2);
  assert.equal(both.interpretations[0].start, 0);
  assert.equal(
    both.matches.length,
    both.interpretations[1].start +
      (both.interpretations[1].kind === "rr"
        ? lookup("천", data).matches.length
        : lookup("초대", data).matches.length)
  );

  // neither
  assert.deepEqual(interpreted("zzz"), { ok: true, matches: [] });
  assert.deepEqual(interpreted("abcdefg"), { ok: true, matches: [] });
});

test("preference: lowest f wins between two word interpretations", () => {
  // godo → 해애 (f 5) on the keyboard, 고도 (f 1) romanized.
  const rrFirst = interpreted("godo");
  assert.deepEqual(kinds(rrFirst), ["rr", "dubeolsik"]);
  assert.deepEqual(rrFirst.interpretations, [
    { kind: "rr", from: "godo", to: "고도", start: 0 },
    {
      kind: "dubeolsik",
      from: "godo",
      to: "해애",
      start: lookup("고도", data).matches.length,
    },
  ]);
  assert.deepEqual(rrFirst.matches, [
    ...lookup("고도", data).matches,
    ...lookup("해애", data).matches,
  ]);

  // The mirror image, and the ranked-beats-unranked rule in one: sogo →
  // 내해 (f 1) on the keyboard, 소고 (no f at all) romanized.
  const dubeolsikFirst = interpreted("sogo");
  assert.deepEqual(kinds(dubeolsikFirst), ["dubeolsik", "rr"]);
  assert.deepEqual(dubeolsikFirst.matches, [
    ...lookup("내해", data).matches,
    ...lookup("소고", data).matches,
  ]);
});

test("preference: a word interpretation beats a syllable-only one", () => {
  // cheon → 초대 (via 초대ㅜ), a word, on the keyboard; 천, a reading list,
  // romanized. The word side leads whichever interpreter found it.
  const r = interpreted("cheon");
  assert.deepEqual(kinds(r), ["dubeolsik", "rr"]);
  assert.equal(r.matches[0].kind, "word");
  assert.equal(r.matches[0].canonical, "招待");
  assert.equal(r.matches[r.interpretations[1].start].kind, "reading");
  assert.equal(r.matches[r.interpretations[1].start].eum, "천");
});

test("preference: reading vs reading compares compound counts", () => {
  // go → 해 (海, cw 1) on the keyboard; 고 (故/考, no cw) romanized.
  const d = interpreted("go");
  assert.deepEqual(kinds(d), ["dubeolsik", "rr"]);
  assert.deepEqual(d.matches, [...lookup("해", data).matches, ...lookup("고", data).matches]);
  // do → 애 (愛, no cw) on the keyboard; 도 (道, cw 2) romanized.
  const r = interpreted("do");
  assert.deepEqual(kinds(r), ["rr", "dubeolsik"]);
  assert.deepEqual(r.matches, [...lookup("도", data).matches, ...lookup("애", data).matches]);
});

test("preference: a remaining tie goes to Dubeolsik", () => {
  // an → 무 on the keyboard, 안 romanized. Both are reading lists and neither
  // side's candidates carry a cw index, so nothing separates them.
  const r = interpreted("an");
  assert.deepEqual(kinds(r), ["dubeolsik", "rr"]);
  assert.deepEqual(r.matches, [...lookup("무", data).matches, ...lookup("안", data).matches]);
});

test("buildInterpretations returns the groups the response is built from", () => {
  assert.deepEqual(buildInterpretations("國民", data), []);
  assert.deepEqual(buildInterpretations("", data), []);
  const two = buildInterpretations("godo", data);
  assert.deepEqual(two.map((i) => [i.kind, i.to]), [["rr", "고도"], ["dubeolsik", "해애"]]);
  // Trimming and NFC happen here, so surrounding whitespace is invisible.
  assert.deepEqual(
    buildInterpretations("  godo  ", data).map((i) => i.from),
    ["godo", "godo"]
  );
  assert.deepEqual(interpreted("  godo  ").matches, interpreted("godo").matches);
});

test("omnibox suggestions run the same generators, deduped and capped", () => {
  const omni = (text) => buildOmniboxSuggestions(text, data, { interpret: true });
  // Single interpretation: byte for byte the hangul query's rows.
  assert.deepEqual(omni("tkrlwjs"), buildOmniboxSuggestions("사기전", data));
  assert.deepEqual(omni("gukmin"), buildOmniboxSuggestions("국민", data));
  // `content` stays the canonical searchable string, never what was typed.
  const rows = omni("gukmin");
  assert.ok(rows.length > 0);
  assert.equal(rows[0].content, "國民");
  assert.ok(rows.every((r) => !/[A-Za-z]/.test(r.content)));
  // Dual: the preferred group's rows come first, dedupe by content holds,
  // and the cap still holds.
  const dual = omni("godo");
  assert.equal(dual[0].content, "古都");
  assert.ok(dual.some((r) => r.content === "海愛"));
  assert.ok(dual.length <= MAX_OMNIBOX_SUGGESTIONS);
  const contents = dual.map((r) => r.content);
  assert.deepEqual(contents, [...new Set(contents)]);
  // The omnibox shares the widened gate.
  assert.deepEqual(omni("guk-min"), buildOmniboxSuggestions("국민", data));
  assert.deepEqual(omni("guk min"), buildOmniboxSuggestions("국민", data));
  // The channel rule applies here too.
  assert.deepEqual(buildOmniboxSuggestions("gukmin", data), []);
  assert.deepEqual(buildOmniboxSuggestions("guk-min", data), []);
  assert.deepEqual(omni("zzz"), []);
  assert.deepEqual(omni("- -"), []);
});

// ---------------------------------------------------------------------------
// Native words ADDENDUM: the second table, the request flag, the omnibox.
// ---------------------------------------------------------------------------

/** Schema-exact native.json fixture (SPEC "native.json"). */
const native = {
  version: 1,
  maxLen: 3,
  words: {
    // Origin markers ADDENDUM: 하늘 and 사랑 declare origin "native"; the
    // entries below without one are unknown (no field on the match).
    하늘: [{ pos: "noun", glosses: ["sky", "heaven"], origin: "native" }],
    사랑: [{ pos: "noun", glosses: ["love"], origin: "native" }],
    우리: [{ pos: "pron", glosses: ["we; us"] }],
    가장: [{ pos: "adv", glosses: ["most"] }],
    먹다: [{ pos: "verb", glosses: ["to eat"] }],
    // Distinct POS = distinct entries (POS homonyms merged at build time).
    가득: [
      { pos: "adv", glosses: ["fully"] },
      { pos: "det", glosses: ["full; filled"] },
    ],
    // 3-syllable key: the longest the declared maxLen allows.
    하늘색: [{ pos: "noun", glosses: ["sky blue"] }],
    // Place names ADDENDUM: pos "name" entries, one per origin class; a
    // hybrid noun (밥 + 床); a junk origin that must read as unknown.
    서울: [{ pos: "name", glosses: ["Seoul"], origin: "native" }],
    런던: [{ pos: "name", glosses: ["London"], origin: "loan" }],
    밥상: [{ pos: "noun", glosses: ["dining table"], origin: "hybrid" }],
    담배: [{ pos: "noun", glosses: ["tobacco"], origin: "unknown" }],
  },
  // Romanized search v2: no `rr` map. The generator reaches native headwords
  // by construction; wave 3 removes the map from the emit too.
};

const nativeData = { ...data, native };

test("unflagged responses are byte-identical with a native table present", () => {
  for (const q of ["사랑", "하늘이", "우리", "國民", "먹다", "국"]) {
    assert.equal(
      JSON.stringify(lookup(q, nativeData)),
      JSON.stringify(lookup(q, data)),
      `query ${q}`
    );
    assert.equal("nativeMatches" in lookup(q, nativeData), false, `query ${q}`);
  }
  // The interpret channel too: a native-only romanization finds nothing.
  assert.deepEqual(lookup("haneul", nativeData, { interpret: true }), {
    ok: true,
    matches: [],
  });
  assert.deepEqual(buildOmniboxSuggestions("haneul", nativeData, { interpret: true }), []);
  assert.deepEqual(
    buildOmniboxSuggestions("사랑", nativeData),
    buildOmniboxSuggestions("사랑", data)
  );
});

test("flagged: native joins on the Sino-resolved span, rare flags intact", () => {
  const res = lookup("사랑", nativeData, { native: true });
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "사랑", pos: "noun", glosses: ["love"], origin: "native" },
  ]);
  // The Sino side is exactly today's: lead-rule inputs (rare flags, order)
  // ride the response untouched. The renderer decides the lead.
  const w = wordsOf(res.matches);
  assert.deepEqual(canonicals(w), ["沙羅", "舍廊"]);
  assert.equal("rare" in w[0], false);
  assert.equal(w[1].rare, true);
  assert.deepEqual(res.matches, lookup("사랑", data).matches);
});

test("flagged: a Han-run selection joins native on the word's hangul", () => {
  // Selecting 舍廊 must carry the 사랑 native entry, so the hanja-led card
  // can render its Same sound row.
  const res = lookup("舍廊", nativeData, { native: true });
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "사랑", pos: "noun", glosses: ["love"], origin: "native" },
  ]);
});

test("flagged: native-only spans run their own pass, josa fallthrough included", () => {
  // The Sino resolver finds nothing in 하늘이; the native pass matches 하늘
  // and leaves the josa unmatched, exactly as rule 3b does on 국민이.
  const res = lookup("하늘이", nativeData, { native: true });
  assert.deepEqual(res.matches, []);
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "하늘", pos: "noun", glosses: ["sky", "heaven"], origin: "native" },
  ]);
  // Longest match first: 하늘색이 finds 하늘색, not 하늘.
  assert.deepEqual(
    lookup("하늘색이", nativeData, { native: true }).nativeMatches.map((m) => m.word),
    ["하늘색"]
  );
});

test("flagged: the native pass fills the stretches the Sino resolver left", () => {
  const res = lookup("하늘국민", nativeData, { native: true });
  assert.deepEqual(canonicals(wordsOf(res.matches)), ["國民"]);
  assert.deepEqual(res.nativeMatches.map((m) => m.word), ["하늘"]);
});

test("flagged: distinct POS entries stay distinct matches; empty is omitted", () => {
  assert.deepEqual(lookup("가득", nativeData, { native: true }).nativeMatches, [
    { kind: "native", word: "가득", pos: "adv", glosses: ["fully"] },
    { kind: "native", word: "가득", pos: "det", glosses: ["full; filled"] },
  ]);
  // Nothing native to say: the field is omitted, not empty.
  const res = lookup("국민", nativeData, { native: true });
  assert.equal("nativeMatches" in res, false);
  assert.deepEqual(res.matches, lookup("국민", data).matches);
  // No deconjugation (documented gap): only the exact dictionary form hits.
  assert.deepEqual(
    lookup("먹다", nativeData, { native: true }).nativeMatches.map((m) => m.word),
    ["먹다"]
  );
  assert.equal("nativeMatches" in lookup("먹었다", nativeData, { native: true }), false);
});

// ---------------------------------------------------------------------------
// Whole-word precedence and hybrid parts ADDENDUM (2026-09-05).
// ---------------------------------------------------------------------------

/**
 * The hybrid fixtures beside the base tables: 加工 as a hanja word (the
 * prefix rule 3b would split off), 가공되다 and 공부하다 as hybrids carrying
 * parts, 되다 as the native tail. A separate bundle, so the base fixtures
 * keep the counts every other test pins.
 */
const hybridWords = {
  ...words,
  words: { ...words.words, 加工: [{ hangul: "가공", glosses: ["processing"] }] },
  byHangul: { ...words.byHangul, 가공: ["加工"] },
};
const hybridNative = {
  version: 1,
  maxLen: 4,
  words: {
    ...native.words,
    가공되다: [
      {
        pos: "verb",
        glosses: ["to be processed"],
        origin: "hybrid",
        parts: [{ hanja: "加工", hangul: "가공" }, { hangul: "되다" }],
      },
    ],
    // Segments the tables lack: 工夫 is no fixture word, 하다 no fixture
    // entry, so the hangul part resolves to nothing (no `native` flag).
    공부하다: [
      {
        pos: "verb",
        glosses: ["to study"],
        origin: "hybrid",
        parts: [{ hanja: "工夫", hangul: "공부" }, { hangul: "하다" }],
      },
    ],
    되다: [{ pos: "verb", glosses: ["to become"], origin: "native" }],
  },
};
const hybridData = { hanja, words: hybridWords, variants, native: hybridNative };
const hybridLead = {
  kind: "native",
  word: "가공되다",
  pos: "verb",
  glosses: ["to be processed"],
  origin: "hybrid",
  parts: [{ hanja: "加工", hangul: "가공" }, { hangul: "되다", native: true }],
};

test("whole-word precedence: the hybrid claims the run, no split survivors", () => {
  // Flagged: the native table holds the entire candidate, so the Sino
  // resolver never splits off 加工 and the native pass never sees 되다 alone.
  assert.deepEqual(lookup("가공되다", hybridData, { native: true }), {
    ok: true,
    matches: [],
    nativeMatches: [hybridLead],
  });
  // The trailing-josa fallthrough every pass shares: 가공되다가 claims 가공되다.
  assert.deepEqual(lookup("가공되다가", hybridData, { native: true }), {
    ok: true,
    matches: [],
    nativeMatches: [hybridLead],
  });
  // Unflagged: the split, byte-identical to a bundle with no native table.
  const bare = { hanja, words: hybridWords, variants };
  assert.equal(
    JSON.stringify(lookup("가공되다", hybridData)),
    JSON.stringify(lookup("가공되다", bare))
  );
  assert.deepEqual(
    wordsOf(lookup("가공되다", hybridData).matches).map((m) => m.canonical),
    ["加工"]
  );
  assert.equal("nativeMatches" in lookup("가공되다", hybridData), false);
  // The claim is for the (josa-stripped) whole only: with a real word behind
  // it, the run splits as today, 加工 and 國民 with the native 되다 between.
  const longer = lookup("가공되다국민", hybridData, { native: true });
  assert.deepEqual(wordsOf(longer.matches).map((m) => m.canonical), ["加工", "國民"]);
  assert.deepEqual(longer.nativeMatches.map((m) => m.word), ["되다"]);
  // The omnibox draws from the same result: one hybrid row, no 加工 row.
  assert.deepEqual(
    buildOmniboxSuggestions("가공되다", hybridData, { native: true }).map((r) => r.content),
    ["가공되다"]
  );
  assert.deepEqual(
    buildOmniboxSuggestions("가공되다", hybridData).map((r) => r.content),
    ["加工"]
  );
});

test("whole-word precedence: the interpreted path leads with the hybrid too", () => {
  const rr = lookup("gagongdoeda", hybridData, { interpret: true, native: true });
  assert.deepEqual(rr.interpretations, [
    { kind: "rr", from: "gagongdoeda", to: "가공되다", start: 0 },
  ]);
  assert.deepEqual(rr.matches, []);
  assert.deepEqual(rr.nativeMatches, [hybridLead]);
  // Unflagged, the same query still reaches the split.
  const off = lookup("gagongdoeda", hybridData, { interpret: true });
  assert.deepEqual(wordsOf(off.matches).map((m) => m.canonical), ["加工"]);
  assert.equal("nativeMatches" in off, false);
});

test("whole-word precedence: pure hanja words and non-splitting natives are byte-identical", () => {
  // 국민: no native entry, so the flagged response IS the unflagged one.
  assert.equal(
    JSON.stringify(lookup("국민", hybridData, { native: true })),
    JSON.stringify(lookup("국민", data))
  );
  assert.equal(
    JSON.stringify(lookup("국민이", hybridData, { native: true })),
    JSON.stringify(lookup("국민이", data))
  );
  // 하늘: native-only, the entry the greedy pass always found, no parts key.
  for (const q of ["하늘", "하늘이"]) {
    assert.equal(
      JSON.stringify(lookup(q, hybridData, { native: true })),
      JSON.stringify({
        ok: true,
        matches: [],
        nativeMatches: [
          { kind: "native", word: "하늘", pos: "noun", glosses: ["sky", "heaven"], origin: "native" },
        ],
      })
    );
  }
  // 하늘국민: the claim needs the whole run; the stretches still split as
  // before, and the pre-addendum fixture answers identically.
  assert.equal(
    JSON.stringify(lookup("하늘국민", hybridData, { native: true })),
    JSON.stringify(lookup("하늘국민", nativeData, { native: true }))
  );
});

test("whole-word precedence: a string that is both hanja word and native headword keeps the lead rule", () => {
  // 사랑 (two rare spellings + native) and 가장 (家長 unflagged + native):
  // the native entry joins on the Sino span exactly as before, and the
  // renderer's lead rule decides. Pinned against the pre-addendum fixture.
  for (const q of ["사랑", "가장", "우리", "가장이"]) {
    assert.equal(
      JSON.stringify(lookup(q, hybridData, { native: true })),
      JSON.stringify(lookup(q, nativeData, { native: true })),
      `query ${q}`
    );
  }
  const love = lookup("사랑", hybridData, { native: true });
  // Flag order as ever: the lessCommon 沙羅 ahead of the rare 舍廊.
  assert.deepEqual(wordsOf(love.matches).map((m) => m.canonical), ["沙羅", "舍廊"]);
  assert.deepEqual(love.nativeMatches.map((m) => m.word), ["사랑"]);
  // A hanja word anchored at the same syllable and reaching further keeps
  // its authority: 국민 beats a native 국 + nothing, and a native headword
  // one syllable shorter than the Sino span never claims the run.
  const shorter = {
    ...hybridData,
    native: { version: 1, maxLen: 4, words: { 국민이: [{ pos: "noun", glosses: ["x"] }] } },
  };
  assert.deepEqual(lookup("국민이라", shorter, { native: true }).nativeMatches.map((m) => m.word), ["국민이"]);
  const longerSino = {
    ...hybridData,
    native: { version: 1, maxLen: 4, words: { 자본주: [{ pos: "noun", glosses: ["x"] }] } },
  };
  const jabon = lookup("자본주의", longerSino, { native: true });
  assert.deepEqual(wordsOf(jabon.matches).map((m) => m.canonical), ["資本主義"]);
  assert.equal("nativeMatches" in jabon, false);
});

test("hybrid parts: the match carries validated parts, hangul parts resolved against the table", () => {
  const study = lookup("공부하다", hybridData, { native: true });
  assert.deepEqual(study.matches, []);
  assert.deepEqual(study.nativeMatches, [
    {
      kind: "native",
      word: "공부하다",
      pos: "verb",
      glosses: ["to study"],
      origin: "hybrid",
      // 하다 is no fixture entry: no `native` flag, the chip renders inert.
      parts: [{ hanja: "工夫", hangul: "공부" }, { hangul: "하다" }],
    },
  ]);
  // Junk parts add no field at all; the card degrades to the marker alone.
  const junk = (parts) => ({
    ...hybridData,
    native: {
      version: 1,
      maxLen: 4,
      words: { 밥상: [{ pos: "noun", glosses: ["dining table"], origin: "hybrid", parts }] },
    },
  });
  for (const parts of [undefined, null, "x", [], [{}], [{ hangul: "" }], [{ hanja: "", hangul: "밥" }],
    [{ hanja: "床", hangul: 3 }], [{ hangul: "밥" }, null]]) {
    const res = lookup("밥상", junk(parts), { native: true });
    assert.equal("parts" in res.nativeMatches[0], false, JSON.stringify(parts));
  }
  // The match's parts are copies: mutating them never reaches the table.
  const res = lookup("가공되다", hybridData, { native: true });
  res.nativeMatches[0].parts[0].hanja = "X";
  assert.equal(hybridNative.words.가공되다[0].parts[0].hanja, "加工");
});

await testAsync("hybrid parts: guardNative and attachKo spread parts through", async () => {
  const { guardNative, attachKo } = await import("../extension/background.js");
  const guarded = guardNative({ version: 1, maxLen: 4, words: hybridNative.words });
  const res = lookup("가공되다", { ...hybridData, native: guarded }, { native: true });
  assert.deepEqual(res.nativeMatches, [hybridLead]);
  // The ko attach hangs its entry on the same match and leaves parts alone.
  const ko = { version: 1, words: {}, natives: { "가공되다|verb": { d: ["가공이 되다."], s: 1 } }, chars: {} };
  const attached = attachKo(res, ko);
  assert.deepEqual(attached.nativeMatches[0].parts, hybridLead.parts);
  assert.deepEqual(attached.nativeMatches[0].ko, ko.natives["가공되다|verb"]);
});

test("the native pass is bounded by native.json's declared maxLen", () => {
  const capped = { ...nativeData, native: { version: 1, maxLen: 2, words: native.words } };
  // 하늘색 exists in the table, but a maxLen of 2 keeps the pass from trying
  // it; the greedy match stops at 하늘.
  assert.deepEqual(
    lookup("하늘색", capped, { native: true }).nativeMatches.map((m) => m.word),
    ["하늘"]
  );
  assert.equal(nativeMaxLenOf(native), 3);
  assert.equal(nativeMaxLenOf({}), MAX_NATIVE_WORD_LEN);
  assert.equal(nativeMaxLenOf(null), MAX_NATIVE_WORD_LEN);
  assert.equal(nativeMaxLenOf({ maxLen: "5" }), MAX_NATIVE_WORD_LEN);
});

test("hedge retirement preconditions ride the response", () => {
  // 우리: every hanja spelling rare AND a native entry. The renderer retires
  // the banner from exactly these two facts.
  const res = lookup("우리", nativeData, { native: true });
  const w = wordsOf(res.matches);
  assert.ok(w.length > 0);
  assert.ok(w.every((m) => m.rare === true));
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "우리", pos: "pron", glosses: ["we; us"] },
  ]);
  // All-rare hangul with NO native entry: no nativeMatches, the banner (and
  // today's behavior entirely) stands.
  const noEntry = {
    ...nativeData,
    native: { version: 1, maxLen: 3, words: { 하늘: native.words.하늘 } },
  };
  const kept = lookup("우리", noEntry, { native: true });
  assert.ok(wordsOf(kept.matches).every((m) => m.rare === true));
  assert.equal("nativeMatches" in kept, false);
});

test("flagged interpretations consult both tables; native-only survives", () => {
  // Romanized: the generator offers 하늘 for `haneul` by construction; the
  // QA gap that killed the map design is unrepresentable now. Flagged, the
  // candidate 하늘 has no Sino entry and the interpretation lives on the
  // native hit alone, with empty `matches`.
  const rrRes = lookup("haneul", nativeData, { interpret: true, native: true });
  assert.deepEqual(rrRes.interpretations, [
    { kind: "rr", from: "haneul", to: "하늘", start: 0 },
  ]);
  assert.deepEqual(rrRes.matches, []);
  assert.deepEqual(rrRes.nativeMatches, [
    { kind: "native", word: "하늘", pos: "noun", glosses: ["sky", "heaven"], origin: "native" },
  ]);
  // Dubeolsik: gksmf is 하늘 typed in the wrong mode.
  const typed = lookup("gksmf", nativeData, { interpret: true, native: true });
  assert.deepEqual(typed.interpretations, [
    { kind: "dubeolsik", from: "gksmf", to: "하늘", start: 0 },
  ]);
  assert.deepEqual(typed.nativeMatches, rrRes.nativeMatches);
  // Unflagged, both queries still find nothing at all.
  assert.deepEqual(lookup("gksmf", nativeData, { interpret: true }), {
    ok: true,
    matches: [],
  });
});

test("flagged: one rr interpretation carries Sino and native hits together", () => {
  // sarang: the candidate 사랑 hits the Sino tables (舍廊/沙羅) AND the
  // native table. One interpretation, both kinds of matches, `to` named by
  // the first candidate that explained something.
  const res = lookup("sarang", nativeData, { interpret: true, native: true });
  assert.deepEqual(res.interpretations, [
    { kind: "rr", from: "sarang", to: "사랑", start: 0 },
  ]);
  assert.deepEqual(res.matches, lookup("사랑", data).matches);
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "사랑", pos: "noun", glosses: ["love"], origin: "native" },
  ]);
});

test("flagged: a native entry completes a class-B parse and roots as hangul", () => {
  // 사랑먹다: the Sino resolver covers 사랑, the native pass covers 먹다, so
  // the candidate is covered end to end (class B) and `to` is the hangul.
  // The liaison splinter 살앙먹다 (class C: only 먹다 covered) survives the
  // dictionary but is shut out of the merge by the class rule.
  const res = lookup("sarangmeokda", nativeData, { interpret: true, native: true });
  assert.deepEqual(kinds(res), ["rr"]);
  assert.equal(res.interpretations[0].to, "사랑먹다");
  assert.deepEqual(res.matches, lookup("사랑먹다", data).matches);
  assert.deepEqual(
    (res.nativeMatches || []).map((m) => m.word),
    ["사랑", "먹다"]
  );
});

test("flagged: variant expansion reaches native headwords", () => {
  // kadeuk devoices to gadeuk, which only the native table explains, so the
  // kukmin-style spelling habits work on native headwords too.
  const res = lookup("kadeuk", nativeData, { interpret: true, native: true });
  assert.deepEqual(res.interpretations, [
    { kind: "rr", from: "kadeuk", to: "가득", start: 0 },
  ]);
  assert.deepEqual(res.matches, []);
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "가득", pos: "adv", glosses: ["fully"] },
    { kind: "native", word: "가득", pos: "det", glosses: ["full; filled"] },
  ]);
});

test("the native rr map is dead: no lookup reads it, flagged or not", () => {
  // A leftover map (native.json still carries one until wave 3 re-emits) sits
  // behind a throwing getter: any lookup that so much as reads it fails the
  // test. Unflagged responses stay byte-identical to a bundle with no native
  // table at all; flagged ones answer from the generator alone.
  const trapped = {
    ...data,
    native: {
      version: 1,
      maxLen: 3,
      words: native.words,
      get rr() {
        throw new Error("the retired native rr map was read");
      },
    },
  };
  assert.deepEqual(lookup("haneul", trapped, { interpret: true }), {
    ok: true,
    matches: [],
  });
  for (const q of ["gukmin", "kadeuk", "gksmf", "guk"]) {
    assert.equal(
      JSON.stringify(lookup(q, trapped, { interpret: true })),
      JSON.stringify(lookup(q, data, { interpret: true })),
      `query ${q}`
    );
  }
  // Flagged lookups no longer need the map either: 하늘 still resolves.
  const flagged = lookup("haneul", trapped, { interpret: true, native: true });
  assert.deepEqual((flagged.nativeMatches || []).map((m) => m.word), ["하늘"]);
  assert.deepEqual(buildOmniboxSuggestions("haneul", trapped, { interpret: true }), []);
});

test("buildNativeMatches tolerates junk and keeps the 2-syllable floor", () => {
  assert.deepEqual(buildNativeMatches("하늘", data), []);
  assert.deepEqual(buildNativeMatches("하늘", null), []);
  assert.deepEqual(buildNativeMatches("", nativeData), []);
  assert.deepEqual(buildNativeMatches(42, nativeData), []);
  // A key with no usable entry neither matches nor blocks the fallthrough.
  const junk = {
    ...data,
    native: {
      version: 1,
      maxLen: 3,
      words: { 하늘이: "nonsense", 하늘: [{ pos: "noun", glosses: ["sky"] }, "junk"] },
    },
  };
  assert.deepEqual(buildNativeMatches("하늘이", junk), [
    { kind: "native", word: "하늘", pos: "noun", glosses: ["sky"] },
  ]);
  // One syllable is the reading-browse channel (rule 3c); the native pass
  // keeps rule 3b's 2-syllable floor, so a 1-syllable key is never matched.
  const single = {
    ...data,
    native: { version: 1, maxLen: 3, words: { 물: [{ pos: "noun", glosses: ["water"] }] } },
  };
  assert.deepEqual(buildNativeMatches("물", single), []);
});

test("flagged omnibox: native rows sit between non-rare and rare hanja", () => {
  const rows = buildOmniboxSuggestions("사랑", nativeData, { native: true });
  // Merge order per the lead rule: non-rare hanja, native, rare hanja, then
  // the component char rows. The native marker sits in the dim tail, where
  // hanja rows carry the school level; content is the hangul word itself.
  assert.deepEqual(contentsOf(rows), ["沙羅", "사랑", "舍廊", "沙", "羅"]);
  assert.equal(rows[1].description, "<match>사랑</match> <dim>love · native</dim>");
  // A native-only query yields its native row through the interpret channel.
  const typed = buildOmniboxSuggestions("haneul", nativeData, {
    interpret: true,
    native: true,
  });
  assert.deepEqual(contentsOf(typed), ["하늘"]);
  assert.equal(typed[0].description, "<match>하늘</match> <dim>sky · native</dim>");
});

test("omnibox: unflagged hanja, native, lessCommon hanja, rare hanja, in that order", () => {
  // 가장 carries all four kinds at once. The lessCommon row gets no marker
  // in its dim tail; the rare row keeps its own.
  const rows = buildOmniboxSuggestions("가장", nativeData, { native: true });
  assert.deepEqual(contentsOf(rows).slice(0, 4), ["家長", "가장", "假裝", "假葬"]);
  assert.equal(rows[2].description, "<match>假裝</match> 가장 <dim>disguise; pretense</dim>");
  assert.equal(rows[3].description, "<match>假葬</match> 가장 <dim>a temporary burial · rare</dim>");
  // Toggle off: the native row drops out and the hanja keep their order.
  assert.deepEqual(contentsOf(buildOmniboxSuggestions("가장", data)).slice(0, 3), [
    "家長",
    "假裝",
    "假葬",
  ]);
  // Across spans: the lessCommon spelling of an earlier span still yields to
  // a later span's unflagged one, and still beats every rare one.
  assert.deepEqual(contentsOf(buildOmniboxSuggestions("가장 우리 국민", data)).slice(0, 5), [
    "家長",
    "國民",
    "假裝",
    "假葬",
    "牛李",
  ]);
});

test("place names: pos name matches, dedupes, and orders like a noun", () => {
  const seoul = buildNativeMatches("서울", nativeData);
  assert.deepEqual(seoul, [
    { kind: "native", word: "서울", pos: "name", glosses: ["Seoul"], origin: "native" },
  ]);
  // Spans in text order, one match per (word, pos), josa fallthrough intact.
  assert.deepEqual(
    lookup("런던과 서울은", nativeData, { native: true }).nativeMatches.map((m) => [m.word, m.pos, m.origin]),
    [["런던", "name", "loan"], ["서울", "name", "native"]]
  );
  // The omnibox lead rule places a name row where a noun row goes: after
  // the unflagged hanja, before the flagged ones.
  const rows = buildOmniboxSuggestions("서울 사랑", nativeData, { native: true });
  assert.deepEqual(contentsOf(rows).slice(0, 4), ["沙羅", "서울", "사랑", "舍廊"]);
  // Unflagged, a place name is invisible, exactly like any native entry.
  assert.deepEqual(lookup("서울", nativeData), { ok: true, matches: [] });
});

test("origin markers: origin rides the match only as one of the three classes", () => {
  assert.deepEqual([...NATIVE_ORIGINS], ["native", "loan", "hybrid"]);
  assert.equal(nativeOriginOf({ origin: "loan" }), "loan");
  for (const junk of [undefined, null, "", "unknown", "NATIVE", 7, ["native"], {}]) {
    assert.equal(nativeOriginOf({ origin: junk }), null, JSON.stringify(junk));
  }
  assert.equal(nativeOriginOf(null), null);
  const byWord = (text) =>
    Object.fromEntries(
      lookup(text, nativeData, { native: true }).nativeMatches.map((m) => [m.word, m])
    );
  const literal = byWord("하늘 런던 밥상 담배 우리");
  assert.equal(literal.하늘.origin, "native");
  assert.equal(literal.런던.origin, "loan");
  assert.equal(literal.밥상.origin, "hybrid");
  assert.equal("origin" in literal.담배, false, "a junk origin is unknown: no field");
  assert.equal("origin" in literal.우리, false, "an absent origin is unknown: no field");
  // The interpreted joins (dubeolsik and rr, deduped per candidate and then
  // across interpretations) rebuild nothing: the same field survives.
  for (const typed of ["fjsejs", "reondeon"]) {
    const res = lookup(typed, nativeData, { interpret: true, native: true });
    assert.equal(res.nativeMatches.find((m) => m.word === "런던").origin, "loan", typed);
  }
  const both = lookup("qkqtkd", nativeData, { interpret: true, native: true });
  assert.equal(both.nativeMatches.find((m) => m.word === "밥상").origin, "hybrid");
});

test("origin markers: omnibox tails carry the origin's label, none when unknown", () => {
  const rows = buildOmniboxSuggestions("하늘 런던 밥상 담배 우리", nativeData, { native: true });
  const tail = (word) => rows.find((r) => r.content === word).description;
  assert.equal(tail("하늘"), "<match>하늘</match> <dim>sky · native</dim>");
  assert.equal(tail("런던"), "<match>런던</match> <dim>London · loan</dim>");
  assert.equal(tail("밥상"), "<match>밥상</match> <dim>dining table · hybrid</dim>");
  assert.equal(tail("담배"), "<match>담배</match> <dim>tobacco</dim>");
  assert.equal(tail("우리"), "<match>우리</match> <dim>we; us</dim>");
  // Korean labels, one per class; a label not given falls back to English.
  const ko = buildOmniboxSuggestions("하늘 런던 밥상", nativeData, {
    native: true,
    labels: { native: "고유어", loan: "외래어", hybrid: "혼종어" },
  });
  assert.deepEqual(
    ko.map((r) => r.description.replace(/^.*· /, "").replace("</dim>", "")),
    ["고유어", "외래어", "혼종어"]
  );
  const partial = buildOmniboxSuggestions("런던 밥상", nativeData, {
    native: true,
    labels: { loan: "외래어" },
  });
  assert.match(partial[0].description, /· 외래어<\/dim>$/);
  assert.match(partial[1].description, /· hybrid<\/dim>$/);
});

await testAsync("origin markers: guardNative spreads origin and pos name through", async () => {
  const { guardNative } = await import("../extension/background.js");
  const guarded = guardNative({ version: 1, maxLen: 3, words: native.words });
  assert.equal(guarded.words, native.words, "the table is the file's own object");
  assert.equal(guarded.words.서울[0].pos, "name");
  assert.equal(guarded.words.런던[0].origin, "loan");
  const res = lookup("런던", { ...data, native: guarded }, { native: true });
  assert.deepEqual(res.nativeMatches, [
    { kind: "native", word: "런던", pos: "name", glosses: ["London"], origin: "loan" },
  ]);
});

await testAsync("native: guardNative shapes junk into an empty table", async () => {
  const { guardNative } = await import("../extension/background.js");
  assert.deepEqual(guardNative(null), { version: 1, words: {} });
  assert.deepEqual(guardNative("nonsense"), { version: 1, words: {} });
  assert.deepEqual(guardNative({ words: null }), { version: 1, words: {} });
  // maxLen passes through as an integer only; lookup.js falls back otherwise.
  assert.deepEqual(guardNative({ maxLen: "5", words: {} }),
    { version: 1, words: {} });
  assert.deepEqual(guardNative({ version: 1, maxLen: 5, words: { 하늘: [] } }), {
    version: 1,
    words: { 하늘: [] },
    maxLen: 5,
  });
});

await testAsync("native: guardNative drops the retired rr map (the worker's shape)", async () => {
  // Romanized search v2: the emitted file still carries `rr` until wave 3
  // re-emits, but the worker's shape no longer does, and the generator makes
  // haneul resolve through the EXACT guarded bundle the worker builds, which
  // is where the v1 map once died silently.
  const { guardNative } = await import("../extension/background.js");
  const guarded = guardNative({
    version: 1,
    maxLen: 2,
    words: { 하늘: [{ pos: "noun", glosses: ["sky"] }] },
    rr: { haneul: ["하늘"] },
  });
  assert.equal("rr" in guarded, false);
  const bundle = { ...data, native: guarded };
  const viaWorkerShape = lookup("haneul", bundle, { interpret: true, native: true });
  assert.equal(viaWorkerShape.ok, true);
  assert.deepEqual(
    (viaWorkerShape.nativeMatches || []).map((m) => m.word),
    ["하늘"],
    "the guarded bundle must still resolve haneul"
  );
});

await testAsync("native: the pending query carries scope only when flagged", async () => {
  const { setPendingQuery, handleGetPendingQuery } = await import("../extension/background.js");

  setPendingQuery("하늘", "all");
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: "하늘", scope: "all" });
  // Read-once clears the scope with the query.
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: null });

  // The pre-addendum call shape: no scope key in the answer at all.
  setPendingQuery("國民");
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: "國民" });

  // A scope never rides without a query.
  setPendingQuery(null, "all");
  assert.deepEqual(await handleGetPendingQuery(), { ok: true, query: null });
});

// ---------------------------------------------------------------------------
// Sibling Sino readings ADDENDUM: guardSino, the attach, the flag gate.
// ---------------------------------------------------------------------------

/**
 * Schema-exact sino.json fixture (SPEC "sino.json"): [reading, eum] pairs,
 * capped at two, display order baked at build time. 學 carries both
 * languages, 民 is ja-only (a language with no readings omits its key, never
 * an empty array), 生's unaligned ショウ trails the aligned reading with an
 * empty eum tag, and 思 (a real Mandarin polyphone, SPEC's own tied-char
 * list) is zh-only with two pinyin, for the spaced-dot join.
 */
const sino = {
  version: 1,
  chars: {
    學: { ja: [["ガク", "학"]], zh: [["xué", "학"]] },
    民: { ja: [["ミン", "민"]] },
    生: { ja: [["セイ", "생"], ["ショウ", ""]], zh: [["shēng", "생"]] },
    思: { zh: [["sī", "사"], ["sāi", ""]] },
  },
};

await testAsync("sino: guardSino shapes junk and SPREADS every field through", async () => {
  const { guardSino } = await import("../extension/background.js");
  assert.deepEqual(guardSino(null), { version: 1, chars: {} });
  assert.deepEqual(guardSino("nonsense"), { version: 1, chars: {} });
  assert.deepEqual(guardSino({ chars: null }), { version: 1, chars: {} });
  assert.deepEqual(guardSino({ chars: 7 }), { version: 1, chars: {} });
  // Pass-through: the guarded record IS the schema record, per-char entries
  // untouched (same objects, not lookalike rebuilds).
  const guarded = guardSino(sino);
  assert.deepEqual(guarded, sino);
  assert.equal(guarded.chars, sino.chars);
  assert.equal(guarded.chars.學, sino.chars.學);
  // The guardNative lesson, asserted directly: a field this guard was never
  // taught about still survives, because the raw record is spread, not
  // rebuilt field by field.
  assert.equal(guardSino({ version: 1, chars: {}, future: 7 }).future, 7);
});

await testAsync("sino: entries ride whole onto char matches, lookup driven through the guarded shape", async () => {
  const { guardSino, attachSino } = await import("../extension/background.js");
  // The EXACT shape the worker holds: a parsed file put through guardSino.
  // This is the path a rebuild-style guard would silently break (fields
  // dropped only where the real worker runs), so the fixture goes through
  // JSON like a fetched file does.
  const guarded = guardSino(JSON.parse(JSON.stringify(sino)));

  const res = attachSino(lookup("學生", data), guarded);
  assert.equal(res.ok, true);
  const hak = res.matches.find((m) => m.kind === "char" && m.canonical === "學");
  assert.deepEqual(hak.sino, { ja: [["ガク", "학"]], zh: [["xué", "학"]] });
  // The eum-less trailing pair survives the trip untouched, order intact.
  const saeng = res.matches.find((m) => m.kind === "char" && m.canonical === "生");
  assert.deepEqual(saeng.sino, {
    ja: [["セイ", "생"], ["ショウ", ""]],
    zh: [["shēng", "생"]],
  });
  // Word matches never carry the field.
  assert.ok(res.matches.filter((m) => m.kind === "word").every((m) => !("sino" in m)));

  // A ja-only char attaches exactly its one language; a char the table lacks
  // gets NO field at all, not an empty one.
  const gukmin = attachSino(lookup("國民", data), guarded);
  const min = gukmin.matches.find((m) => m.kind === "char" && m.canonical === "民");
  assert.deepEqual(min.sino, { ja: [["ミン", "민"]] });
  const guk = gukmin.matches.find((m) => m.kind === "char" && m.canonical === "國");
  assert.equal("sino" in guk, false);

  // A variant surface attaches on the canonical, like every other join.
  const viaVariant = attachSino(lookup("学", data), guarded);
  assert.deepEqual(viaVariant.matches[0].sino, sino.chars.學);

  // Junk tolerance: error results and non-results pass through untouched,
  // and an empty guarded table attaches nothing.
  const errRes = { ok: false, error: "nope" };
  assert.equal(attachSino(errRes, guarded), errRes);
  assert.equal(attachSino(null, guarded), null);
  const bare = attachSino(lookup("學生", data), guardSino(null));
  assert.ok(bare.matches.every((m) => !("sino" in m)));
});

test("sino: no lookup semantics, a sino table on the bundle is never read", () => {
  // The feature is attach-and-render: lookup itself must never so much as
  // touch a sino table, flagged native or not. The throwing getter fails the
  // test on any read, native-rr-trap style.
  const trapped = {
    ...data,
    get sino() {
      throw new Error("the sino table was read inside lookup");
    },
  };
  for (const q of ["學生", "國民", "학생", "국", "gukmin", "学"]) {
    assert.equal(
      JSON.stringify(lookup(q, trapped, { interpret: true })),
      JSON.stringify(lookup(q, data, { interpret: true })),
      `query ${q}`
    );
  }
  // Unflagged worker responses are byte-identical because the attach only
  // runs on the flagged path: no match of a plain lookup carries the field.
  assert.ok(lookup("學生", data).matches.every((m) => !("sino" in m)));
});

test("sino: the readings toggles default off, read strict true, independently", () => {
  assert.equal(DEFAULT_SETTINGS.jaReadings, false);
  assert.equal(DEFAULT_SETTINGS.zhReadings, false);
  // Hand-edited junk can never switch a readings surface on by accident.
  const scrubbed = normalizeSettings({ jaReadings: "yes", zhReadings: 1 });
  assert.equal(scrubbed.jaReadings, false);
  assert.equal(scrubbed.zhReadings, false);
  const jaOnly = normalizeSettings({ jaReadings: true });
  assert.equal(jaOnly.jaReadings, true);
  assert.equal(jaOnly.zhReadings, false, "the toggles are independent");
});

// --- sino: the Anki export fields (SPEC "Anki export" bullet) -------------

test("sino export: ja/zh are charBack tokens, always valid, default unchecked", () => {
  assert.deepEqual(CHAR_FIELDS, ["char", "eumhun", "readings", "defs", "lvl", "ja", "zh"]);
  assert.deepEqual(DEFAULT_SETTINGS.anki.charBack, ["eumhun", "defs"]);
  // The tokens survive normalization in the checkset's own order, whatever
  // the display toggles say.
  const checked = normalizeSettings({
    jaReadings: false,
    zhReadings: false,
    anki: { charBack: ["ja", "eumhun", "zh"] },
  });
  assert.deepEqual(checked.anki.charBack, ["ja", "eumhun", "zh"]);
  // A word back never accepts the char-only tokens.
  const word = normalizeSettings({ anki: { wordBack: ["ja", "hangul", "zh"] } });
  assert.deepEqual(word.anki.wordBack, ["hangul"]);
});

test("sino export: joinItems hangs the whole entry on char rows when data carries it", () => {
  const items = [
    { id: "i0", kind: "char", key: "學", folderId: "f0", addedAt: 1 },
    { id: "i1", kind: "char", key: "國", folderId: "f0", addedAt: 2 },
    { id: "i2", kind: "word", key: "國民", folderId: "f0", addedAt: 3 },
    { id: "i3", kind: "char", key: "学", folderId: "f0", addedAt: 4 },
  ];
  const rows = joinItems(items, { ...data, sino });
  assert.equal(rows[0].sino, sino.chars.學, "the entry rides whole, not a rebuild");
  assert.equal("sino" in rows[1], false, "a char the table lacks gets no field");
  assert.equal("sino" in rows[2], false, "word rows never carry the field");
  assert.equal(rows[3].sino, sino.chars.學, "a variant key joins on the canonical");
  // The ungated export path: without sino on the data, no row carries any.
  assert.ok(joinItems(items, data).every((row) => !("sino" in row)));
});

test("sino export: a checked field emits the readings text, display separators", () => {
  const folders = [{ id: "f0", name: "Saved" }];
  const rows = joinItems(
    [
      { id: "i0", kind: "char", key: "生", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "char", key: "思", folderId: "f0", addedAt: 2 },
    ],
    { ...data, sino }
  );
  // ja: on'yomi joined with the katakana middle dot, the eum-less trailing
  // pair included, baked order untouched. 思 has no ja readings, so the empty
  // field drops from its back, no placeholder.
  const ja = tsvLines(buildAnkiTsv(rows, { anki: { charBack: ["char", "ja"] } }, folders));
  assert.equal(ja[3], "生\t生 · セイ・ショウ\tSaved");
  assert.equal(ja[4], "思\t思\tSaved");
  // zh: pinyin joined with a spaced middle dot.
  const zh = tsvLines(buildAnkiTsv(rows, { anki: { charBack: ["char", "zh"] } }, folders));
  assert.equal(zh[3], "生\t生 · shēng\tSaved");
  assert.equal(zh[4], "思\t思 · sī · sāi\tSaved");
  // Both checked: two back fields, the field separator between them.
  const both = tsvLines(buildAnkiTsv(rows, { anki: { charBack: ["ja", "zh"] } }, folders));
  assert.equal(both[3], "生\tセイ・ショウ · shēng\tSaved");
  assert.equal(both[4], "思\tsī · sāi\tSaved");
  // Neither checked (the shipped default): byte-identical whether or not sino
  // data reached the rows at all.
  const bare = joinItems(
    [
      { id: "i0", kind: "char", key: "生", folderId: "f0", addedAt: 1 },
      { id: "i1", kind: "char", key: "思", folderId: "f0", addedAt: 2 },
    ],
    data
  );
  assert.equal(buildAnkiTsv(rows, null, folders), buildAnkiTsv(bare, null, folders));
  assert.ok(!buildAnkiTsv(rows, null, folders).includes("セイ"));
});

test("sino export: the CSV keeps its all-columns rule, filled only when joined", () => {
  const folders = [{ id: "f0", name: "Saved" }];
  const items = [
    { id: "i0", kind: "char", key: "生", folderId: "f0", addedAt: Date.UTC(2026, 7, 31) },
    { id: "i1", kind: "word", key: "國民", folderId: "f0", addedAt: Date.UTC(2026, 7, 31) },
  ];
  const joined = buildCsv(joinItems(items, { ...data, sino }), folders)
    .replace(/\n$/, "")
    .split("\n");
  assert.equal(
    joined[1],
    "char,生,,날 생,생,1. to be born; to live; 2. raw; fresh,,セイ・ショウ,shēng,Saved,2026-08-31"
  );
  assert.equal(
    joined[2],
    "word,國民,국민,,,1. the people; citizens of a nation,,,,Saved,2026-08-31"
  );
  // The ungated path: the columns stay in place, the values are empty.
  const ungated = buildCsv(joinItems(items, data), folders).replace(/\n$/, "").split("\n");
  assert.equal(
    ungated[1],
    "char,生,,날 생,생,1. to be born; to live; 2. raw; fresh,,,,Saved,2026-08-31"
  );
});

await testAsync("sino export: the fetch gate opens only on a charBack reading field", async () => {
  // The handler itself stops at the storage guard in Node (like every saved
  // handler above), so the gate it consults is exported and pinned here:
  // handleSavedExport touches getSino() exactly when this says true.
  const { exportWantsSino } = await import("../extension/background.js");
  assert.equal(exportWantsSino(normalizeSettings(null)), false, "the default never fetches");
  assert.equal(exportWantsSino({ anki: { charBack: ["eumhun", "defs"] } }), false);
  assert.equal(exportWantsSino({ anki: { charBack: ["ja"] } }), true);
  assert.equal(exportWantsSino({ anki: { charBack: ["zh"] } }), true);
  assert.equal(exportWantsSino({ anki: { charBack: ["eumhun", "ja", "zh"] } }), true);
  // The display toggles have no say, in either direction.
  assert.equal(
    exportWantsSino({ jaReadings: true, zhReadings: true, anki: { charBack: ["defs"] } }),
    false
  );
  // Junk settings read as "no fetch", never as an accidental one.
  assert.equal(exportWantsSino(null), false);
  assert.equal(exportWantsSino({ anki: { charBack: "ja" } }), false);
});

// ---------------------------------------------------------------------------
// Korean language mode ADDENDUM: guardKo, the attach, the flag gates, export.
// ---------------------------------------------------------------------------

console.log("\nKorean definitions (ko.json)");

/**
 * Schema-exact ko.json fixture (SPEC "Emitted file"): `d` the kept senses
 * (one or two), `s` the Urimalsaem target_code of the first. 學生 carries two
 * senses and the SPEC's own anchor code; 生 and 民 are deliberately absent
 * from `chars`, 主義 from `words`, and the 사랑 noun from `natives`, so every
 * "no entry, no field" branch is exercised beside the attached ones.
 */
const ko = {
  version: 1,
  words: {
    學生: { d: ["학예를 배우는 사람.", "학교에 다니면서 공부하는 사람."], s: 27143 },
    國民: { d: ["한 나라의 통치권 아래에 있는 사람."], s: 11111 },
    資本: { d: ["장사나 사업 따위의 기본이 되는 돈."], s: 22222 },
    學生會: { d: ["학생들의 자치 단체."], s: 33333 },
    國家: { d: ["일정한 영토와 주권을 가진 집단."], s: 44444 },
  },
  natives: {
    "하늘|noun": { d: ["지평선 위로 보이는 무한한 공간."], s: 55555 },
    "우리|pron": { d: ["말하는 이가 자기와 듣는 이를 함께 이르는 말."], s: 66666 },
    // Place names ADDENDUM: the natives lane maps a 지명 sense onto "hangul|name".
    "서울|name": { d: ["한반도의 중심부에 있는 도시. 대한민국의 수도이다."], s: 88888 },
  },
  chars: {
    學: { d: ["어떤 원리에 따라 조직된 지식의 체계.", "‘학문’의 뜻을 더하는 접미사."], s: 67890 },
    國: { d: ["일정한 영토와 주권을 가진 집단."], s: 77777 },
  },
};

await testAsync("ko: guardKo shapes junk and SPREADS every field through", async () => {
  const { guardKo } = await import("../extension/background.js");
  const empty = { version: 1, words: {}, natives: {}, chars: {} };
  assert.deepEqual(guardKo(null), empty);
  assert.deepEqual(guardKo("nonsense"), empty);
  assert.deepEqual(guardKo({ words: null, natives: 7, chars: "x" }), empty);
  // Each table is defended on its own: junk in one leaves the others intact.
  const partial = guardKo({ words: ko.words, natives: [], chars: null });
  assert.equal(partial.words, ko.words);
  assert.deepEqual(partial.natives, {}, "an array is not a table");
  assert.deepEqual(partial.chars, {});
  // Pass-through: the guarded record IS the schema record, entries untouched
  // (same objects, not lookalike rebuilds).
  const guarded = guardKo(ko);
  assert.deepEqual(guarded, ko);
  assert.equal(guarded.words, ko.words);
  assert.equal(guarded.words.學生, ko.words.學生);
  assert.equal(guarded.natives, ko.natives);
  assert.equal(guarded.chars.學, ko.chars.學);
  // The guardNative lesson: a field this guard was never taught about still
  // survives, because the raw record is spread, not rebuilt field by field.
  assert.equal(guardKo({ version: 1, words: {}, natives: {}, chars: {}, future: 7 }).future, 7);
});

await testAsync("ko: entries ride whole onto every match kind, lookup driven through the guarded shape", async () => {
  const { guardKo, attachKo, guardDecomp, attachDecomp } = await import("../extension/background.js");
  // The EXACT shape the worker holds: a parsed file put through guardKo.
  const guarded = guardKo(JSON.parse(JSON.stringify(ko)));

  // Word and char matches, by canonical key; a key the table lacks gets NO
  // field, not an empty one.
  const res = attachKo(lookup("學生", data), guarded);
  assert.equal(res.ok, true);
  const word = res.matches.find((m) => m.kind === "word");
  assert.deepEqual(word.ko, ko.words.學生);
  const hak = res.matches.find((m) => m.kind === "char" && m.canonical === "學");
  assert.deepEqual(hak.ko, ko.chars.學);
  const saeng = res.matches.find((m) => m.kind === "char" && m.canonical === "生");
  assert.equal("ko" in saeng, false);
  // The inline compound rows on a char match: 學's 學生 row, and 生's.
  assert.deepEqual(hak.compounds[0].ko, ko.words.學生);
  assert.deepEqual(saeng.compounds[0].ko, ko.words.學生, "生's 학생 row too");
  // Those rows are hanja.json's own objects: the loaded table stays clean,
  // and a later unflagged lookup of the same char carries nothing.
  assert.equal("ko" in hanja.chars.學.compounds[0], false, "the data table was written to");
  assert.ok(lookup("學", data).matches[0].compounds.every((row) => !("ko" in row)));

  // A variant surface attaches on the canonical, like every other join.
  const viaVariant = attachKo(lookup("学生", data), guarded);
  assert.deepEqual(viaVariant.matches[0].ko, ko.words.學生);

  // Component-word parts: 資本 attached, 主義 not.
  const parts = attachKo(lookup("資本主義", data), guarded).matches[0].parts;
  const jabon = parts.find((p) => p.type === "word" && p.hanja === "資本");
  assert.deepEqual(jabon.ko, ko.words.資本);
  const juui = parts.find((p) => p.type === "word" && p.hanja === "主義");
  assert.equal("ko" in juui, false);

  // Reading-list candidates, by char.
  const reading = attachKo(lookup("국", data), guarded).matches[0];
  assert.equal(reading.kind, "reading");
  assert.deepEqual(reading.candidates.find((c) => c.char === "國").ko, ko.chars.國);
  assert.equal("ko" in reading.candidates.find((c) => c.char === "局"), false);

  // Joined decomposition parts, by the row's TARGET.
  const decomped = attachDecomp(lookup("生", data), {
    hanja,
    decomp: guardDecomp({ v: 1, parts: { 生: [["學"], ["民"], ["丿", null, "slash"]] } }),
  });
  attachKo(decomped, guarded);
  const [partHak, partMin, inert] = decomped.matches[0].parts;
  assert.equal(partHak.t, "學");
  assert.deepEqual(partHak.ko, ko.chars.學);
  assert.equal("ko" in partMin, false, "a target the table lacks");
  assert.equal("ko" in inert, false, "an inert row names no target");

  // Native matches, by "hangul|pos"; the 사랑 noun has no entry.
  const natives = attachKo(lookup("하늘 사랑 우리", nativeData, { native: true }), guarded);
  const sky = natives.nativeMatches.find((m) => m.word === "하늘");
  assert.deepEqual(sky.ko, ko.natives["하늘|noun"]);
  assert.equal("ko" in natives.nativeMatches.find((m) => m.word === "사랑"), false);
  assert.deepEqual(natives.nativeMatches.find((m) => m.word === "우리").ko, ko.natives["우리|pron"]);
  // Place names ADDENDUM: a place entry keys by "hangul|name", origin intact.
  const places = attachKo(lookup("서울 런던", nativeData, { native: true }), guarded);
  const seoul = places.nativeMatches.find((m) => m.word === "서울");
  assert.equal(seoul.pos, "name");
  assert.equal(seoul.origin, "native");
  assert.deepEqual(seoul.ko, ko.natives["서울|name"]);
  assert.equal("ko" in places.nativeMatches.find((m) => m.word === "런던"), false);

  // Junk tolerance: error results and non-results pass through untouched,
  // and an empty guarded table attaches nothing anywhere.
  const errRes = { ok: false, error: "nope" };
  assert.equal(attachKo(errRes, guarded), errRes);
  assert.equal(attachKo(null, guarded), null);
  const bare = attachKo(lookup("學生", data), guardKo(null));
  assert.ok(bare.matches.every((m) => !("ko" in m)));
  assert.ok(bare.matches.every((m) => (m.compounds ?? []).every((row) => !("ko" in row))));
  // Unflagged worker responses are byte-identical: no plain lookup carries
  // the field, on any match or row.
  const plain = lookup("學生", data);
  assert.ok(plain.matches.every((m) => !("ko" in m)));
  assert.ok(!JSON.stringify(plain).includes('"ko"'));
});

await testAsync("ko: attachKoRows covers the compound, used-in and part-of row lists", async () => {
  const { guardKo, attachKoRows } = await import("../extension/background.js");
  const guarded = guardKo(ko);
  // The full compound index of 國: 國民 and 國家 attached.
  const compounds = attachKoRows(buildFullCompounds("國", data), guarded, "word");
  assert.deepEqual(compounds.find((r) => r.hanja === "國民").ko, ko.words.國民);
  assert.deepEqual(compounds.find((r) => r.hanja === "國家").ko, ko.words.國家);
  // The used-in list of 學生: 學生會 attached; a spelling the table lacks
  // (資本主義 and 資本主, through the cw-less fallback scan) gets no field.
  const usedIn = attachKoRows(buildUsedIn("學生", data), guarded, "word");
  assert.deepEqual(usedIn.find((r) => r.hanja === "學生會").ko, ko.words.學生會);
  const scanned = attachKoRows(buildUsedIn("資本", data), guarded, "word");
  assert.ok(scanned.length > 0 && scanned.every((r) => !("ko" in r)));
  // Part-of rows key by char.
  const foundIn = attachKoRows([{ char: "學", hun: "배울", eum: "학", gloss: "x" }, { char: "生" }],
    guarded, "char");
  assert.deepEqual(foundIn[0].ko, ko.chars.學);
  assert.equal("ko" in foundIn[1], false);
  // Junk: a non-array passes through, junk rows are skipped, an unguarded
  // raw table is guarded on the way in.
  assert.equal(attachKoRows(null, guarded, "word"), null);
  assert.deepEqual(attachKoRows([null, 7, { hanja: "學生" }], ko, "word")[2].ko, ko.words.學生);
  assert.ok(attachKoRows([{ hanja: "學生" }], null, "word").every((r) => !("ko" in r)));
});

test("ko: no lookup semantics, a ko table on the bundle is never read", () => {
  const trapped = {
    ...data,
    get ko() {
      throw new Error("the ko table was read inside lookup");
    },
  };
  for (const q of ["學生", "國民", "학생", "국", "gukmin", "学"]) {
    assert.equal(
      JSON.stringify(lookup(q, trapped, { interpret: true })),
      JSON.stringify(lookup(q, data, { interpret: true })),
      `query ${q}`
    );
  }
});

/**
 * The worker's packaged-file reads, stubbed: the three data files answer
 * from the fixtures, ko.json from the ko fixture, everything else 404s
 * (decomp.json degrades to an empty table). `log` collects every url so a
 * check can prove which files a request touched.
 */
const fetchData = (log) => async (url) => {
  log.push(url);
  const name = /\/data\/(\w+)\.json$/.exec(url)?.[1];
  const file = { hanja, words, variants, ko }[name] ?? null;
  return { ok: file !== null, status: file ? 200 : 404, json: async () => file };
};
const koFetches = (log) => log.filter((u) => /\/data\/ko\.json$/.test(u)).length;

await testAsync("ko: the worker fetches ko.json on the first flagged request only, never unflagged", async () => {
  const { handleLookup, handleCompounds, handleUsedIn, handleFoundIn, MESSAGE_HANDLERS } =
    await import("../extension/background.js");
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = fetchData(fetched);
  globalThis.chrome = { runtime: { getURL: (path) => `chrome-extension://okp/${path}` } };
  try {
    // Unflagged: the data files load, ko.json does not, and nothing carries
    // the field.
    let res = await handleLookup("學生", false, false, false, false);
    assert.equal(res.ok, true);
    assert.equal(koFetches(fetched), 0);
    assert.ok(!JSON.stringify(res).includes('"ko"'));
    res = await handleLookup("學生", false, false, false);
    assert.equal(koFetches(fetched), 0, "an absent flag is off");
    // Flagged: one fetch, then the cache serves every later flagged request.
    res = await handleLookup("學生", false, false, false, true);
    assert.equal(koFetches(fetched), 1);
    assert.deepEqual(res.matches.find((m) => m.kind === "word").ko, ko.words.學生);
    assert.deepEqual(res.matches.find((m) => m.canonical === "學").ko, ko.chars.學);
    res = await handleLookup("國民", false, true, false, true);
    assert.equal(koFetches(fetched), 1, "cached");
    assert.deepEqual(res.matches[0].ko, ko.words.國民);
    // The row messages carry the same flag, and attach onto their rows.
    const cpd = await handleCompounds("國", true);
    assert.deepEqual(cpd.compounds.find((r) => r.hanja === "國民").ko, ko.words.國民);
    assert.ok(!JSON.stringify(await handleCompounds("國")).includes('"ko"'));
    const used = await handleUsedIn("學生", true);
    assert.deepEqual(used.words.find((r) => r.hanja === "學生會").ko, ko.words.學生會);
    assert.ok(!JSON.stringify(await handleUsedIn("學生")).includes('"ko"'));
    assert.deepEqual(await handleFoundIn("學", true), { ok: true, chars: [] }, "no decomp table here");
    // The router reads m.ko strictly.
    res = await MESSAGE_HANDLERS.lookup({ type: "lookup", text: "學生", ko: true });
    assert.deepEqual(res.matches[0].ko, ko.words.學生);
    res = await MESSAGE_HANDLERS.lookup({ type: "lookup", text: "學生", ko: "yes" });
    assert.ok(!JSON.stringify(res).includes('"ko"'));
    assert.equal(koFetches(fetched), 1);
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.chrome;
  }
});

await testAsync("ko: isAllowedTabUrl admits Wiktionary articles and Urimalsaem senses, nothing else", async () => {
  const { isAllowedTabUrl, URIMALSAEM_URL_PREFIX, WIKI_URL_PREFIX } =
    await import("../extension/background.js");
  assert.equal(URIMALSAEM_URL_PREFIX, "https://opendict.korean.go.kr/dictionary/view?sense_no=");
  assert.equal(isAllowedTabUrl(`${WIKI_URL_PREFIX}%ED%95%99%EC%83%9D#Korean`), true);
  assert.equal(isAllowedTabUrl(`${URIMALSAEM_URL_PREFIX}27143`), true);
  assert.equal(isAllowedTabUrl("https://opendict.korean.go.kr/"), false);
  assert.equal(isAllowedTabUrl("https://evil.example/?u=https://opendict.korean.go.kr/dictionary/view?sense_no=1"), false);
  assert.equal(isAllowedTabUrl(null), false);
});

test("ko export: joinItems hangs the whole entry on word and char rows when data carries it", () => {
  const items = [
    { id: "i0", kind: "word", key: "學生", folderId: "f0", addedAt: 1 },
    { id: "i1", kind: "char", key: "學", folderId: "f0", addedAt: 2 },
    { id: "i2", kind: "char", key: "生", folderId: "f0", addedAt: 3 },
    { id: "i3", kind: "word", key: "事故", folderId: "f0", addedAt: 4 },
    { id: "i4", kind: "char", key: "学", folderId: "f0", addedAt: 5 },
  ];
  const rows = joinItems(items, { ...data, ko });
  assert.equal(rows[0].ko, ko.words.學生, "the entry rides whole, not a rebuild");
  assert.equal(rows[1].ko, ko.chars.學);
  assert.equal("ko" in rows[2], false, "a char the table lacks gets no field");
  assert.equal("ko" in rows[3], false, "a word the table lacks gets no field");
  assert.equal(rows[4].ko, ko.chars.學, "a variant key joins on the canonical");
  // The ungated path: without ko on the data, no row carries any.
  assert.ok(joinItems(items, data).every((row) => !("ko" in row)));
  assert.ok(joinItems(items, { ...data, ko: null }).every((row) => !("ko" in row)));
});

test("ko export: the definitions field is the Korean senses joined with ' / ', English when falling back", () => {
  const folders = [{ id: "f0", name: "Saved" }];
  const items = [
    { id: "i0", kind: "word", key: "學生", folderId: "f0", addedAt: Date.UTC(2026, 8, 1) },
    { id: "i1", kind: "char", key: "學", folderId: "f0", addedAt: Date.UTC(2026, 8, 1) },
    { id: "i2", kind: "char", key: "生", folderId: "f0", addedAt: Date.UTC(2026, 8, 1) },
  ];
  const withKo = joinItems(items, { ...data, ko });
  const anki = tsvLines(buildAnkiTsv(withKo, null, folders));
  assert.equal(anki[3], "學生\t학생 · 학예를 배우는 사람. / 학교에 다니면서 공부하는 사람.\tSaved");
  assert.equal(anki[4], "學\t배울 학 · 어떤 원리에 따라 조직된 지식의 체계. / ‘학문’의 뜻을 더하는 접미사.\tSaved");
  assert.equal(anki[5], "生\t날 생 · 1. to be born; to live; 2. raw; fresh\tSaved", "no entry: English");
  const csv = buildCsv(withKo, folders).replace(/\n$/, "").split("\n");
  assert.equal(csv[0], CSV_COLUMNS.join(","), "header identifiers unchanged");
  assert.equal(csv[1], "word,學生,학생,,,학예를 배우는 사람. / 학교에 다니면서 공부하는 사람.,,,,Saved,2026-09-01");
  assert.equal(csv[3], "char,生,,날 생,생,1. to be born; to live; 2. raw; fresh,,,,Saved,2026-09-01");
  // Without ko on the rows: byte-identical to before the feature.
  const without = joinItems(items, data);
  assert.equal(tsvLines(buildAnkiTsv(without, null, folders))[3], "學生\t학생 · 1. student; pupil\tSaved");
  assert.ok(!buildCsv(without, folders).includes("학예"));
  // A junk entry (no usable senses) falls back to English too.
  const junk = joinItems(items, { ...data, ko: { words: { 學生: { d: [], s: 1 } } } });
  assert.equal(tsvLines(buildAnkiTsv(junk, null, folders))[3], "學生\t학생 · 1. student; pupil\tSaved");
});

await testAsync("ko export: the fetch gate opens only under 한국어 with a definitions field in play", async () => {
  const { exportWantsKo } = await import("../extension/background.js");
  const defaults = normalizeSettings(null);
  assert.equal(exportWantsKo(defaults, "csv"), false, "English never fetches");
  assert.equal(exportWantsKo(defaults, "anki"), false);
  const korean = normalizeSettings({ language: "ko" });
  assert.equal(exportWantsKo(korean, "csv"), true, "the CSV always writes definitions");
  assert.equal(exportWantsKo(korean, "anki"), true, "the default backs carry defs");
  const noDefs = normalizeSettings({
    language: "ko",
    anki: { wordBack: ["hangul"], charBack: ["eumhun", "ja"] },
  });
  assert.equal(exportWantsKo(noDefs, "anki"), false);
  assert.equal(exportWantsKo(noDefs, "csv"), true);
  // A defs FRONT opens the gate too.
  assert.equal(exportWantsKo({ language: "ko", anki: { wordFront: "defs", wordBack: [], charBack: [] } }, "anki"), true);
  assert.equal(exportWantsKo({ language: "ko", anki: { charFront: "defs" } }, "anki"), true);
  // Junk settings read as "no fetch", never as an accidental one.
  assert.equal(exportWantsKo(null, "csv"), false);
  assert.equal(exportWantsKo({ language: "ko", anki: "junk" }, "anki"), false);
  assert.equal(exportWantsKo({ language: "xx" }, "csv"), false);
});

await testAsync("ko export: handleSavedExport loads ko.json through the gate and the fields follow the language", async () => {
  // A FRESH worker instance (the query string makes Node load the module
  // again), so its ko cache is empty and the gate's fetch is observable.
  const { handleSavedExport } = await import("../extension/background.js?ko-export-gate");
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = fetchData(fetched);
  const store = {
    okpSaved: {
      v: 1,
      folders: [{ id: "f0", name: "Saved" }],
      items: [
        { id: "i0", kind: "word", key: "學生", folderId: "f0", addedAt: Date.UTC(2026, 8, 1) },
        { id: "i1", kind: "char", key: "生", folderId: "f0", addedAt: Date.UTC(2026, 8, 1) },
      ],
      nextFolder: 1,
      nextItem: 2,
    },
  };
  const local = {
    get: async (key) => ({ [key]: store[key] }),
    set: async (obj) => { Object.assign(store, obj); },
  };
  globalThis.chrome = {
    runtime: { getURL: (path) => `chrome-extension://okp/${path}` },
    storage: { local },
  };
  const bodyOf = (res) => {
    assert.equal(res.ok, true, res.error);
    return res.tsv.replace(/\n$/, "").split("\n");
  };
  try {
    // English: the ungated path, ko.json never fetched, English definitions.
    store.okpSettings = normalizeSettings({ language: "en" });
    let lines = bodyOf(await handleSavedExport({ all: true }, "csv"));
    assert.equal(koFetches(fetched), 0);
    assert.equal(lines[1], "word,學生,학생,,,1. student; pupil,,,,Saved,2026-09-01");
    // 한국어 without a definitions field: still no fetch.
    store.okpSettings = normalizeSettings({
      language: "ko",
      anki: { wordBack: ["hangul"], charBack: ["eumhun"] },
    });
    lines = bodyOf(await handleSavedExport({ all: true }, "anki"));
    assert.equal(koFetches(fetched), 0);
    assert.equal(lines[3], "學生\t학생\tSaved");
    // 한국어 CSV: the gate opens, one fetch, Korean where the entry exists.
    lines = bodyOf(await handleSavedExport({ all: true }, "csv"));
    assert.equal(koFetches(fetched), 1);
    assert.equal(lines[0], CSV_COLUMNS.join(","));
    assert.equal(lines[1], "word,學生,학생,,,학예를 배우는 사람. / 학교에 다니면서 공부하는 사람.,,,,Saved,2026-09-01");
    assert.equal(lines[2], "char,生,,날 생,생,1. to be born; to live; 2. raw; fresh,,,,Saved,2026-09-01");
    // 한국어 Anki with defs: the cached table, Korean on the word's back.
    store.okpSettings = normalizeSettings({ language: "ko" });
    lines = bodyOf(await handleSavedExport({ all: true }, "anki"));
    assert.equal(koFetches(fetched), 1, "cached");
    assert.equal(lines[3], "學生\t학생 · 학예를 배우는 사람. / 학교에 다니면서 공부하는 사람.\tSaved");
    assert.equal(lines[4], "生\t날 생 · 1. to be born; to live; 2. raw; fresh\tSaved");
    // Back to English: English again, whatever the cache holds.
    store.okpSettings = normalizeSettings({ language: "en" });
    lines = bodyOf(await handleSavedExport({ all: true }, "anki"));
    assert.equal(lines[3], "學生\t학생 · 1. student; pupil\tSaved");
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.chrome;
  }
});

await testAsync("ko: handleSavedGet attaches the Korean entries onto its rows only when flagged", async () => {
  // A fresh worker instance, so the ko fetch itself is observable.
  const { handleSavedGet, MESSAGE_HANDLERS } =
    await import("../extension/background.js?ko-saved-get");
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = fetchData(fetched);
  const store = {
    okpSaved: {
      v: 1,
      folders: [{ id: "f0", name: "Saved" }],
      items: [
        { id: "i0", kind: "word", key: "學生", folderId: "f0", addedAt: 1 },
        { id: "i1", kind: "char", key: "學", folderId: "f0", addedAt: 2 },
        { id: "i2", kind: "char", key: "生", folderId: "f0", addedAt: 3 },
      ],
      nextFolder: 1,
      nextItem: 3,
    },
    okpSettings: normalizeSettings({ language: "ko" }),
  };
  globalThis.chrome = {
    runtime: { getURL: (path) => `chrome-extension://okp/${path}` },
    storage: {
      local: {
        get: async (key) => ({ [key]: store[key] }),
        set: async (obj) => { Object.assign(store, obj); },
      },
    },
  };
  try {
    // Unflagged: the stored language has no say; no fetch, no field.
    let res = await handleSavedGet();
    assert.equal(res.ok, true);
    assert.equal(koFetches(fetched), 0);
    assert.ok(res.items.every((row) => !("ko" in row)));
    res = await MESSAGE_HANDLERS.savedGet({ type: "savedGet" });
    assert.equal(koFetches(fetched), 0);
    // Flagged: one fetch, the entries ride whole, a key the table lacks gets none.
    res = await MESSAGE_HANDLERS.savedGet({ type: "savedGet", ko: true });
    assert.equal(koFetches(fetched), 1);
    assert.deepEqual(res.items[0].ko, ko.words.學生);
    assert.deepEqual(res.items[1].ko, ko.chars.學);
    assert.equal("ko" in res.items[2], false);
    res = await handleSavedGet(true);
    assert.equal(koFetches(fetched), 1, "cached");
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.chrome;
  }
});

// --- optional smoke test against Agent A's real corpus -------------------
// Read-only, and skipped (not failed) if the files are absent.

const dataDir = join(dirname(fileURLToPath(import.meta.url)), "..", "extension", "data");

await testAsync("smoke: real extension/data corpus resolves 國民 / 国 / 국민", async () => {
  let real;
  try {
    const [h, w, v] = await Promise.all([
      readFile(join(dataDir, "hanja.json"), "utf8"),
      readFile(join(dataDir, "words.json"), "utf8"),
      readFile(join(dataDir, "variants.json"), "utf8"),
    ]);
    real = {
      hanja: JSON.parse(h),
      words: JSON.parse(w),
      variants: JSON.parse(v),
    };
  } catch (err) {
    // Absent, or Agent A is mid-rebuild (truncated/partial JSON). Neither is a
    // failure of the lookup logic — the inline-fixture tests above cover that.
    console.log(`      (skipped — extension/data unreadable: ${err.code || err.name})`);
    return;
  }

  const kind = real.hanja.placeholder ? "fixture" : "real";
  const wordMatch = lookup("國民", real).matches.find((m) => m.kind === "word");
  assert.ok(wordMatch, `${kind} data: 國民 should produce a word match`);
  assert.equal(wordMatch.hangul, "국민");
  assert.deepEqual(wordMatch.chars, ["國", "民"]);

  const variantMatch = lookup("国", real).matches[0];
  assert.ok(variantMatch, `${kind} data: 国 should resolve via variants.map`);
  assert.equal(variantMatch.canonical, "國");

  // Han-char threshold correction, verified against whatever data is shipped.
  const withParticle = lookup("國民이라는", real);
  assert.deepEqual(
    canonicals(charsOf(withParticle.matches)).slice(0, 2),
    ["國", "民"],
    `${kind} data: 國民이라는 must still return the 國/民 char cards`
  );

  // QWERTY + romanized ADDENDA against the real corpus: the headline cases
  // only work if the interpreters and the dictionary agree, which no fixture
  // can prove.
  const say = (text) => lookup(text, real, { interpret: true });

  // toddlf → 생일: Dubeolsik alone, no romanization collision.
  const typed = say("toddlf");
  assert.deepEqual(
    typed.interpretations,
    [{ kind: "dubeolsik", from: "toddlf", to: "생일", start: 0 }],
    `${kind} data: toddlf should be read as 생일 and nothing else`
  );
  const birthday = typed.matches.find((m) => m.kind === "word");
  assert.ok(birthday, `${kind} data: toddlf should find a word match`);
  assert.equal(birthday.hangul, "생일");
  assert.deepEqual(lookup("생일", real).matches, typed.matches);
  const typedRows = buildOmniboxSuggestions("toddlf", real, { interpret: true });
  assert.ok(typedRows.length > 0, `${kind} data: toddlf should suggest something`);
  assert.deepEqual(
    typedRows,
    buildOmniboxSuggestions("생일", real),
    `${kind} data: the omnibox reads the input on the same rule`
  );
  assert.ok(
    typedRows.every((r) => !/[A-Za-z]/.test(r.content)),
    `${kind} data: suggestion content stays the canonical searchable string`
  );
  // The project's own name, typed the same way.
  assert.equal(say("dhrvus").interpretations[0].to, "옥편");
  assert.ok(
    say("dhrvus").matches.some((m) => m.canonical === "玉篇"),
    `${kind} data: dhrvus should find 玉篇`
  );

  // Romanized search v2: the generator replaces the rr maps, so every one of
  // these runs unconditionally against whatever corpus is shipped. All three
  // RR forms of 국민 land, and the leading-devoice habit reaches it too.
  for (const form of ["gukmin", "gungmin", "gugmin", "kukmin"]) {
    const r = say(form);
    assert.deepEqual(
      (r.interpretations || []).map((i) => i.kind),
      ["rr"],
      `${kind} data: ${form} should be read as romanization only`
    );
    assert.equal(r.interpretations[0].to, "국민", `${kind} data: ${form} → 국민`);
    const w = r.matches.find((m) => m.kind === "word");
    assert.ok(w, `${kind} data: ${form} should find a word match`);
    assert.equal(w.canonical, "國民", `${kind} data: ${form} → 國民`);
  }

  // The widened gate on real data: the hyphenated spelling of the same
  // query lands on 국민, while the literal channel still finds nothing.
  for (const written of ["guk-min", "guk min", "Guk-Min"]) {
    const r = say(written);
    assert.deepEqual(
      (r.interpretations || []).map((i) => i.kind),
      ["rr"],
      `${kind} data: ${written} should be read as romanization only`
    );
    assert.equal(r.interpretations[0].to, "국민", `${kind} data: ${written} → 국민`);
    assert.deepEqual(r.matches, say("gukmin").matches, `${kind} data: ${written} = gukmin`);
    assert.deepEqual(lookup(written, real), { ok: true, matches: [] }, written);
  }

  // su: both interpreters survive — 수 romanized, 녀 on the keyboard — and
  // 수 comes first. Both are reading lists, so the compound-count rule
  // decides it.
  const su = say("su");
  assert.deepEqual(
    su.interpretations.map((i) => [i.kind, i.to]),
    [["rr", "수"], ["dubeolsik", "녀"]],
    `${kind} data: su should read 수 first, then 녀`
  );
  assert.equal(su.matches[0].kind, "reading");
  assert.equal(su.matches[0].eum, "수");
  assert.equal(su.matches[su.interpretations[1].start].eum, "녀");
  assert.deepEqual(
    su.matches,
    [...lookup("수", real).matches, ...lookup("녀", real).matches],
    `${kind} data: su's groups are the ordinary 수 and 녀 lookups`
  );
  // The channel rule on real data: a navigateTo-style literal lookup of the
  // same string finds nothing at all.
  assert.deepEqual(lookup("su", real), { ok: true, matches: [] });
  assert.deepEqual(lookup("gukmin", real), { ok: true, matches: [] });

  // PARITY, the v2 QA case: an inflected romanization resolves its
  // dictionary prefix exactly the way the typed hangul does. Unflagged,
  // nothing covers the suffix, so these are class-C parses and `to` (the
  // srcText root) stays the typed text.
  const bucketOf = (spelling) => {
    const entries = real.words.words[spelling] || [];
    let best = Infinity;
    for (const e of entries) {
      if (e && Number.isInteger(e.f) && e.f < best) best = e.f;
    }
    return best;
  };
  for (const [q, expectHangul] of [["mushihada", "무시"], ["mushihaesseo", "무시"]]) {
    const r = say(q);
    assert.deepEqual(
      (r.interpretations || []).map((i) => i.kind),
      ["rr"],
      `${kind} data: ${q} should carry an rr interpretation`
    );
    assert.equal(r.interpretations[0].to, q, `${kind} data: ${q} roots as typed`);
    assert.ok(
      r.matches.some((m) => m.kind === "word" && m.hangul === expectHangul),
      `${kind} data: ${q} should resolve a ${expectHangul} word`
    );
    assert.equal(r.matches[0].kind, "word", `${kind} data: ${q} leads with a word`);
  }
  // Class-C ordering, first key: ANCHORED coverage. A parse that cannot
  // explain the query's first syllable is a worse reading of the input, so
  // 무시-anchored parses (anchored 2) lead over the splinters 뭇이하다 (以下)
  // and 뭇이해써 (理解), anchored 0, whatever their frequencies say.
  assert.equal(say("mushihada").matches[0].canonical, "無視");
  assert.equal(say("mushihaesseo").matches[0].canonical, "無視");
  // Second key, live where anchoring TIES: the best f among what each parse
  // found. gungminmyeo parses as 궁민며 (surface) and 국민며 (the nasal
  // preimage), both anchored 2 with an opaque tail, so frequency decides:
  // 國民 outranks the rare 窮民, which still renders after it. Asserted
  // THROUGH the f comparison so a data flip fails loudly.
  assert.ok(
    bucketOf("國民") < bucketOf("窮民"),
    `${kind} data: 國民 (f ${bucketOf("國民")}) must outrank 窮民 (f ${bucketOf("窮民")})`
  );
  const gungminmyeo = say("gungminmyeo");
  assert.equal(
    gungminmyeo.interpretations[0].to,
    "gungminmyeo",
    `${kind} data: gungminmyeo roots as typed (class C)`
  );
  const gungminmyeoWords = gungminmyeo.matches
    .filter((m) => m.kind === "word")
    .map((m) => m.canonical);
  assert.equal(gungminmyeoWords[0], "國民", `${kind} data: frequency breaks the anchor tie`);
  assert.ok(
    gungminmyeoWords.includes("窮民"),
    `${kind} data: the equally anchored 궁민 parse still renders`
  );
  assert.ok(
    say("musihaesseo").matches.some((m) => m.kind === "word" && m.hangul === "무시"),
    `${kind} data: musihaesseo resolves 무시 like typed 무시했어`
  );

  // Ambiguous romanization, inclusivity user-directed: balgyeonhaesseo
  // parses as 발견했어 AND as the ㄺ-cluster splinter 밝연해써 (연해 from
  // syllable two). BOTH render, and the root stays the typed text. ANCHORING
  // decides the order before frequency is even consulted: 발견 anchors 2,
  // the splinter anchors 0.
  const balgyeon = say("balgyeonhaesseo");
  assert.deepEqual(
    (balgyeon.interpretations || []).map((i) => [i.kind, i.to]),
    [["rr", "balgyeonhaesseo"]],
    `${kind} data: balgyeonhaesseo roots as typed (class C)`
  );
  assert.equal(balgyeon.matches[0].kind, "word");
  assert.equal(
    balgyeon.matches[0].canonical,
    "發見",
    `${kind} data: balgyeonhaesseo leads with 發見`
  );
  const balgyeonWords = balgyeon.matches
    .filter((m) => m.kind === "word")
    .map((m) => m.canonical);
  assert.ok(
    balgyeonWords.indexOf("沿海") > balgyeonWords.indexOf("發見"),
    `${kind} data: the 沿海 splinter renders too, after 發見`
  );
  assert.ok(
    lookup("무시했어", real).matches.some((m) => m.kind === "word" && m.hangul === "무시"),
    `${kind} data: typed 무시했어 resolves 무시 (the parity baseline)`
  );

  const cw = (ch) => ((real.hanja.chars[ch] || {}).cw || []).length;
  const bestCw = (eum) =>
    Math.max(...lookup(eum, real).matches[0].candidates.map((c) => cw(c.char)));
  const rrNote =
    `generator: 국민 f=${(real.words.words["國民"][0] || {}).f}; ` +
    `su → 수 (best cw ${bestCw("수")}) over 녀 (best cw ${bestCw("녀")})`;

  // Rule 3c against the real corpus.
  const reading = lookup("국", real).matches[0];
  assert.ok(reading && reading.kind === "reading", `${kind} data: 국 → reading match`);
  assert.ok(
    reading.candidates.some((c) => c.char === "國"),
    `${kind} data: 국 candidates should include 國`
  );
  const counts = reading.candidates.map(
    (c) => (real.hanja.chars[c.char].compounds || []).length
  );
  assert.deepEqual(
    counts,
    [...counts].sort((a, b) => b - a),
    `${kind} data: candidates must be ranked by compound count descending`
  );

  // Rare-flag addendum. Agent A may not have shipped the flag yet, so probe
  // for any occurrence before asserting anything about it.
  let rareNote = "no rare flag in corpus yet";
  const corpusHasRare = Object.values(real.words.words).some(
    (senses) => Array.isArray(senses) && senses.some((s) => s && s.rare === true)
  );
  if (corpusHasRare) {
    const flagged = Object.entries(real.words.words).filter(
      ([, senses]) => Array.isArray(senses) && senses.every((s) => s && s.rare === true)
    );
    rareNote = `${flagged.length} fully-rare spellings`;

    // Sanity anchors from SPEC: 국민/자본주의 not rare.
    for (const notRare of ["國民", "資本主義"]) {
      const m = lookup(notRare, real).matches.find((x) => x.kind === "word");
      if (m) assert.equal("rare" in m, false, `${kind} data: ${notRare} must not be rare`);
    }

    // Any hangul span mixing rare and non-rare spellings must order non-rare
    // first and take its char cards from a non-rare spelling.
    for (const [hangul, spellings] of Object.entries(real.words.byHangul)) {
      if (!Array.isArray(spellings) || spellings.length < 2) continue;
      const rareness = spellings.map((sp) => {
        const senses = real.words.words[sp];
        return Array.isArray(senses) && senses.every((s) => s && s.rare === true);
      });
      if (!rareness.includes(true) || !rareness.includes(false)) continue;

      const ms = lookup(hangul, real).matches.filter((m) => m.kind === "word");
      const flags = ms.map((m) => m.rare === true);
      assert.deepEqual(
        flags,
        [...flags].sort((a, b) => Number(a) - Number(b)),
        `${kind} data: ${hangul} — non-rare spellings must order first`
      );
      assert.equal(ms[0].rare, undefined, `${kind} data: ${hangul} leads with a non-rare`);
      rareNote += `; e.g. ${hangul} → ${ms.map((m) => m.canonical).join("/")}`;
      break;
    }
  }

  // lvl addendum: EVERY char carries exactly one valid level, the zones sit
  // in their expected bands, and the boundary anchors hold.
  let eduNote = "no lvl in corpus yet";
  const levelled = Object.entries(real.hanja.chars).filter(([, e]) => e && e.lvl);
  if (levelled.length > 0) {
    const zones = { m: 0, h: 0, a: 0, r: 0 };
    const bad = [];
    for (const [c, e] of Object.entries(real.hanja.chars)) {
      if (e && (e.lvl === "m" || e.lvl === "h" || e.lvl === "a" || e.lvl === "r")) {
        zones[e.lvl] += 1;
      } else {
        bad.push(c);
      }
      if (e && ("edu" in e || "eduT" in e)) bad.push(c);
    }
    assert.deepEqual(bad.slice(0, 5), [], `${kind} data: ${bad.length} chars without exactly one lvl`);
    assert.equal(
      zones.m + zones.h + zones.a + zones.r,
      Object.keys(real.hanja.chars).length
    );
    assert.ok(zones.m > 700 && zones.m <= 900, `${kind} data: m=${zones.m}`);
    assert.ok(zones.h > 700 && zones.h <= 900, `${kind} data: h=${zones.h}`);
    assert.ok(zones.a >= 1000 && zones.a <= 3500, `${kind} data: a=${zones.a}`);
    assert.ok(zones.r > zones.a, `${kind} data: r=${zones.r} should be the largest zone`);
    eduNote = `lvl ${zones.m}m/${zones.h}h/${zones.a}a/${zones.r}r`;

    // Boundary anchors: curriculum, attested, and dictionary-tail.
    for (const [ch, want] of [
      ["學", "m"], ["國", "m"], ["民", "m"],
      ["雰", "a"], ["癌", "a"], ["膵", "a"],
      ["㔏", "r"], ["朞", "r"],
    ]) {
      const e = real.hanja.chars[ch];
      if (e) assert.equal(e.lvl, want, `${kind} data: ${ch} should be lvl ${want}`);
    }

    // and it must reach the matches: char cards and reading rows alike
    const [sample, sampleEntry] = levelled[0];
    const card = charsOf(lookup(sample, real).matches)[0];
    assert.equal(card.lvl, sampleEntry.lvl, `${kind} data: ${sample} card carries lvl`);
    const row = lookup(sampleEntry.readings[0], real).matches[0];
    if (row && row.kind === "reading") {
      const c = row.candidates.find((x) => x.char === sample);
      if (c) assert.equal(c.lvl, sampleEntry.lvl, `${kind} data: reading row carries lvl`);
    }
  }

  // ROUND TRIP (regression net for the canonical-keys + length-metadata
  // fixes): every shipped key must be reachable by looking up the key itself.
  // Before the fix, 131 words keys resolved to nothing (中腦 → 中匘, no such
  // key), 130 more silently answered from a different record, and every key
  // longer than 6 chars came back as fragments.
  const wordKeys = Object.keys(real.words.words);
  const unreachable = [];
  const redirected = [];
  for (const key of wordKeys) {
    const ms = lookup(key, real).matches.filter((m) => m.kind === "word");
    if (ms.length === 0) unreachable.push(key);
    else if (!ms.some((m) => m.canonical === key)) redirected.push(`${key}->${ms[0].canonical}`);
  }
  assert.deepEqual(unreachable.slice(0, 5), [], `${kind} data: ${unreachable.length} unreachable words keys`);
  assert.deepEqual(redirected.slice(0, 5), [], `${kind} data: ${redirected.length} words keys redirect elsewhere`);

  const hangulKeys = Object.keys(real.words.byHangul);
  const deadHangul = [];
  for (const key of hangulKeys) {
    if (lookup(key, real).matches.some((m) => m.kind === "word")) continue;
    deadHangul.push(key);
  }
  assert.deepEqual(deadHangul.slice(0, 5), [], `${kind} data: ${deadHangul.length} byHangul keys resolve to nothing`);

  // The declared caps must be the real ones, and long keys must survive the
  // whole pipeline as single word matches.
  assert.equal(maxWordLenOf(real.words), Math.max(...wordKeys.map((k) => k.length)));
  assert.equal(maxHangulLenOf(real.words), Math.max(...hangulKeys.map((k) => k.length)));
  const longest = wordKeys.reduce((a, b) => (b.length > a.length ? b : a), "");
  const longMatch = lookup(longest, real).matches.find((m) => m.kind === "word");
  assert.equal(longMatch.canonical, longest, `${kind} data: longest key resolves whole`);
  const roundTripNote =
    `round-trip ${wordKeys.length} words + ${hangulKeys.length} byHangul keys, ` +
    `0 unreachable, 0 redirects, longest ${longest} (${longest.length})`;

  // Word-parts addendum against the real corpus (skipped if 資本主義 absent).
  let partsNote = "資本主義 absent";
  if (Object.prototype.hasOwnProperty.call(real.words.words, "資本主義")) {
    const w = lookup("資本主義", real).matches.find((m) => m.kind === "word");
    assert.ok(w, `${kind} data: 資本主義 should produce a word match`);
    assert.ok(Array.isArray(w.parts) && w.parts.length > 0, `${kind} data: expected parts`);
    assert.ok(
      w.parts.some((p) => p.type === "word"),
      `${kind} data: parts should contain at least one sub-word`
    );
    assert.equal(
      w.parts.map((p) => (p.type === "word" ? p.hanja : p.char)).join(""),
      "資本主義",
      `${kind} data: parts must cover the word`
    );
    assert.ok(
      w.parts.every((p) => p.type !== "word" || p.hanja !== "資本主義"),
      `${kind} data: a word must not be its own part`
    );
    assert.ok(
      w.parts.every((p) => p.type !== "word" || p.glosses.length <= 2),
      `${kind} data: sub-word glosses capped at 2`
    );
    partsNote =
      "資本主義 parts " + w.parts.map((p) => (p.type === "word" ? p.hanja : p.char)).join("+");
  }

  console.log(
    `      (${roundTripNote}; ${partsNote}; ${rareNote}; ${eduNote}; ${rrNote}; ` +
      `${kind} data: ${Object.keys(real.hanja.chars).length} chars, ` +
      `${Object.keys(real.words.words).length} words, ` +
      `${Object.keys(real.variants.map).length} variants, ` +
      `${reading.candidates.length} hanja read 국)`
  );
});

// --- native words against the real emitted native.json -------------------
// Read-only. Skipped LOUDLY while the pipeline half has not landed yet: the
// suite stays green now and goes fully live the moment native.json exists.

await testAsync("smoke: real native.json resolves 하늘 / 사랑 / 무리 / toggle-off", async () => {
  let real;
  try {
    const [h, w, v] = await Promise.all([
      readFile(join(dataDir, "hanja.json"), "utf8"),
      readFile(join(dataDir, "words.json"), "utf8"),
      readFile(join(dataDir, "variants.json"), "utf8"),
    ]);
    real = {
      hanja: JSON.parse(h),
      words: JSON.parse(w),
      variants: JSON.parse(v),
    };
  } catch (err) {
    console.log(`      (skipped: extension/data unreadable: ${err.code || err.name})`);
    return;
  }
  if (real.hanja.placeholder) {
    console.log("      (skipped: placeholder corpus, no native anchors to check)");
    return;
  }

  let realNative;
  try {
    realNative = JSON.parse(await readFile(join(dataDir, "native.json"), "utf8"));
  } catch (err) {
    console.log(
      "      (SKIPPED: extension/data/native.json is not there yet; " +
        "this smoke goes live when the pipeline emits it: " +
        `${err.code || err.name})`
    );
    return;
  }

  const all = { ...real, native: realNative };

  // 하늘: native card data where today nothing renders.
  const sky = lookup("하늘", all, { native: true });
  const skyEntry = (sky.nativeMatches || []).find((m) => m.word === "하늘");
  assert.ok(skyEntry, "하늘 should carry a native entry");
  assert.ok(
    skyEntry.glosses.some((g) => /sky/i.test(g)),
    "하늘 should carry a sky gloss"
  );

  // 사랑: every hanja spelling rare, native entry present with 舍廊 beside
  // it. These are the inputs from which the renderer makes the native lead.
  const love = lookup("사랑", all, { native: true });
  assert.ok(
    (love.nativeMatches || []).some((m) => m.word === "사랑"),
    "사랑 should carry a native entry"
  );
  const loveWords = wordsOf(love.matches);
  assert.ok(
    loveWords.some((m) => m.canonical === "舍廊"),
    "사랑 should still resolve 舍廊"
  );
  assert.ok(
    loveWords.every((m) => m.rare === true || m.lessCommon === true),
    "every hanja spelling of 사랑 should be flagged, rare or lessCommon (native leads)"
  );
  assert.ok(
    loveWords.every((m) => !(m.rare === true && m.lessCommon === true)),
    "no spelling of 사랑 carries both flags"
  );

  // 무리: 無理 is non-rare, so hanja still leads.
  const muri = lookup("무리", all, { native: true });
  const muriWords = wordsOf(muri.matches);
  const mu = muriWords.find((m) => m.canonical === "無理");
  assert.ok(mu, "무리 should resolve 無理");
  assert.equal("rare" in mu, false, "無理 must not be rare");
  assert.equal("rare" in muriWords[0], false, "무리 leads with a non-rare spelling");

  // 먹다 (verb): reachable from a typed exact-form query.
  const eat = lookup("먹다", all, { native: true });
  assert.ok(
    (eat.nativeMatches || []).some((m) => m.word === "먹다"),
    "먹다 should carry a native entry"
  );

  // Romanized reach (the QA gap v2 closed for good): flagged `haneul` finds
  // 하늘 through the generator, where the Dubeolsik mistype `gksmf` always
  // worked. No map is consulted anywhere.
  const sayAll = (t) => lookup(t, all, { interpret: true, native: true });
  const haneul = sayAll("haneul");
  assert.ok(
    (haneul.interpretations || []).some((i) => i.kind === "rr"),
    "haneul should carry a live rr interpretation"
  );
  assert.equal(
    haneul.interpretations[0].to,
    "하늘",
    "haneul roots as 하늘 (class A: a whole native headword)"
  );
  assert.ok(
    (haneul.nativeMatches || []).some((m) => m.word === "하늘"),
    "flagged haneul should reach the native 하늘"
  );
  const sarang = sayAll("sarang");
  assert.ok(
    (sarang.nativeMatches || []).some((m) => m.word === "사랑"),
    "flagged sarang should reach the native 사랑"
  );
  const gksmf = sayAll("gksmf");
  assert.ok(
    (gksmf.nativeMatches || []).some((m) => m.word === "하늘"),
    "gksmf (the keyboard path) must still reach 하늘"
  );
  // The QA case that motivated v2, flagged, under the collapse policy.
  // Whole-word precedence ADDENDUM: 무시하다 is itself a hybrid headword in
  // native.json, so mushihada is now class A (a whole native headword): `to`
  // and the srcText root are 무시하다, the entry leads with its parts
  // (無視 + 하다) and the split (a 無視 word card beside a 하다 native card)
  // is not rendered at all. The cross-candidate splinter junk (아다, from
  // 뭇이하다) stays shut out.
  const mushihada = sayAll("mushihada");
  assert.deepEqual(mushihada.interpretations, [
    { kind: "rr", from: "mushihada", to: "무시하다", start: 0 },
  ]);
  assert.deepEqual(mushihada.matches, [], "flagged mushihada renders no split");
  const mushihadaNative = (mushihada.nativeMatches || []).map((m) => m.word);
  assert.deepEqual(mushihadaNative, ["무시하다"], "the hybrid headword leads alone");
  assert.equal(mushihada.nativeMatches[0].origin, "hybrid");
  assert.deepEqual(mushihada.nativeMatches[0].parts, [
    { hanja: "無視", hangul: "무시" },
    { hangul: "하다", native: true },
  ]);
  assert.ok(!mushihadaNative.includes("아다"), "the splinter junk 아다 must not");
  // mushihaesseo stays class C (nothing covers 했어): it roots as the TYPED
  // text and carries no splinter native matches. The anchored-coverage key
  // leads it with 無視: the 무시-anchored parses (anchored 2) order before
  // the splinter 뭇이해써 (理解, anchored 0), whatever the frequencies say.
  const mushihaesseo = sayAll("mushihaesseo");
  assert.deepEqual(
    (mushihaesseo.interpretations || []).map((i) => [i.kind, i.to]),
    [["rr", "mushihaesseo"]],
    "flagged mushihaesseo roots as typed (class C)"
  );
  assert.equal(mushihaesseo.matches[0].kind, "word");
  assert.equal(mushihaesseo.matches[0].canonical, "無視", "flagged mushihaesseo leads with 無視");
  assert.ok(
    !(mushihaesseo.nativeMatches || []).some((m) => m.word === "아다"),
    "no splinter native matches on mushihaesseo"
  );
  // Ambiguous romanization, flagged: both maximal parses of balgyeonhaesseo
  // render (inclusivity is user-directed), anchoring deciding the order
  // before frequency is consulted: 발견했어's 發見 anchors 2, the ㄺ-cluster
  // splinter 밝연해써's 沿海 anchors 0. Root stays typed.
  const balgyeon = sayAll("balgyeonhaesseo");
  assert.deepEqual(
    (balgyeon.interpretations || []).map((i) => [i.kind, i.to]),
    [["rr", "balgyeonhaesseo"]],
    "flagged balgyeonhaesseo roots as typed (class C)"
  );
  assert.equal(balgyeon.matches[0].kind, "word");
  assert.equal(balgyeon.matches[0].canonical, "發見", "flagged balgyeonhaesseo leads with 發見");
  const balgyeonWords = balgyeon.matches
    .filter((m) => m.kind === "word")
    .map((m) => m.canonical);
  assert.ok(
    balgyeonWords.indexOf("沿海") > balgyeonWords.indexOf("發見"),
    "flagged: the 沿海 splinter renders too, after 發見"
  );
  // Unflagged, the romanization stays Sino-only: no native rides along.
  assert.equal("nativeMatches" in lookup("haneul", all, { interpret: true }), false);

  // Toggle off: byte-identical to a lookup that never saw the file.
  assert.equal(JSON.stringify(lookup("사랑", all)), JSON.stringify(lookup("사랑", real)));
  assert.equal("nativeMatches" in lookup("사랑", all), false);

  // Resolve-side budget: the degenerate 20-vowel garbage query's FULL
  // flagged lookup stays under 75ms warm. One unmeasured warmup run first;
  // the bound is on the capped pipeline, not on v8's first-call JIT cost.
  const soup = "a".repeat(20);
  lookup(soup, all, { interpret: true, native: true });
  const soupStart = performance.now();
  lookup(soup, all, { interpret: true, native: true });
  const soupMs = performance.now() - soupStart;
  assert.ok(soupMs < 75, `20-vowel garbage lookup took ${soupMs.toFixed(1)}ms`);

  // Flagged omnibox rows carry the marker of the entry's origin (origin
  // markers ADDENDUM), and no marker while the file declares none.
  const rows = buildOmniboxSuggestions("하늘", all, { interpret: true, native: true });
  const skyRow = rows.find((r) => r.content === "하늘");
  assert.ok(skyRow, "omnibox should offer 하늘 as a native row");
  const skyOrigin = nativeOriginOf(realNative.words["하늘"][0]);
  if (skyOrigin === null) {
    assert.doesNotMatch(skyRow.description, /native|loan|hybrid/);
  } else {
    assert.match(skyRow.description, new RegExp(`· ${skyOrigin}</dim>$`));
  }

  // The declared cap is the real longest key.
  const nativeKeys = Object.keys(realNative.words);
  assert.equal(realNative.maxLen, Math.max(...nativeKeys.map((k) => [...k].length)));

  console.log(
    `      (native ${nativeKeys.length} words, maxLen ${realNative.maxLen}; ` +
      `사랑 → ${loveWords.map((m) => m.canonical).join("/")} + native)`
  );
});

// --- decomposition against the real emitted decomp.json ------------------
// No harness covers the shipped file: both pages run on a hand-written fixture.
// Read-only, and skipped (not failed) if the file is absent.

await testAsync("smoke: real decomp.json decomposes 依 / 學 / 疑 and stays clickable", async () => {
  let decomp, chars;
  try {
    const [d, h] = await Promise.all([
      readFile(join(dataDir, "decomp.json"), "utf8"),
      readFile(join(dataDir, "hanja.json"), "utf8"),
    ]);
    decomp = JSON.parse(d);
    chars = JSON.parse(h).chars;
  } catch (err) {
    console.log(`      (skipped — decomp.json unreadable: ${err.code || err.name})`);
    return;
  }

  assert.equal(decomp.v, 1);
  const parts = decomp.parts;
  assert.ok(parts && typeof parts === "object", "decomp.json must carry a parts map");

  // A row is clickable iff its length is 1 or its slot 2 is a string. The
  // target is slot 2 when present, else the display glyph itself.
  const clickable = (row) => row.length === 1 || typeof row[1] === "string";
  const targetOf = (row) => (typeof row[1] === "string" ? row[1] : row[0]);
  const glyphs = (ch) => (parts[ch] || []).map((r) => r[0]).join("+");

  // SPEC binding anchors, including the two the above-BMP aliases exist for.
  assert.equal(glyphs("依"), "亻+衣", "依 = 亻 + 衣");
  assert.equal(parts["依"][0][1], "人", "亻 aliases to 人");
  assert.equal(glyphs("學"), "臼+爻+冖+子", "學 = 臼 + 爻 + 冖 + 子");
  assert.equal(glyphs("疑"), "匕+矢+龴+疋", "疑 = 匕 + 矢 + 龴 + 疋");
  // 龴 is a reading-less shape row, so it must not be clickable.
  assert.equal(clickable(parts["疑"][2]), false, "龴 is a reading-less row");

  // ABSENT by rule: 無 substitutes to ？, 乙 is atomic.
  for (const absent of ["無", "乙"]) {
    assert.equal(absent in parts, false, `${absent} must have no entry`);
  }

  // ABSENT by the substantiality rule: splits of single strokes only.
  for (const absent of ["心", "戈", "竹"]) {
    assert.equal(absent in parts, false, `${absent} must have no entry`);
  }
  // The supplement aliases are what keep 上 emitted under that rule.
  assert.deepEqual(parts["上"], [["⺊", "卜"], ["一"]], "上 = ⺊(→卜) + 一");

  // Whole-file invariants. A click can never land nowhere, and nothing the
  // card renders may be unrenderable.
  const badTarget = [];
  const aboveBmp = [];
  const tooShort = [];
  const opaque = [];
  const illegal = [];
  const ILLEGAL = /[\u2ff0-\u2fff\u303e{}？]/;
  for (const [ch, rows] of Object.entries(parts)) {
    if (rows.length < 2) tooShort.push(ch);
    let anyResolves = false;
    for (const row of rows) {
      const g = row[0];
      if ([...g].some((c) => c.codePointAt(0) > 0xffff)) aboveBmp.push(`${ch}:${g}`);
      if (ILLEGAL.test(g)) illegal.push(`${ch}:${g}`);
      if (!clickable(row)) continue;
      const t = targetOf(row);
      if (Object.prototype.hasOwnProperty.call(chars, t)) anyResolves = true;
      else badTarget.push(`${ch}:${g}->${t}`);
    }
    if (!anyResolves) opaque.push(ch);
  }
  assert.deepEqual(aboveBmp.slice(0, 5), [], `${aboveBmp.length} parts above the BMP`);
  assert.deepEqual(illegal.slice(0, 5), [], `${illegal.length} parts carry IDC or placeholder characters`);
  assert.deepEqual(tooShort.slice(0, 5), [], `${tooShort.length} entries with fewer than 2 parts`);
  assert.deepEqual(badTarget.slice(0, 5), [], `${badTarget.length} clickable parts miss hanja.json`);
  assert.deepEqual(opaque.slice(0, 5), [], `${opaque.length} entries resolve to no dictionary character`);

  // The emit is restricted to hanja.json characters: the runtime never asks
  // about anything else.
  const stray = Object.keys(parts).filter(
    (ch) => !Object.prototype.hasOwnProperty.call(chars, ch)
  );
  assert.deepEqual(stray.slice(0, 5), [], `${stray.length} decomposed chars are not in hanja.json`);

  const rowCount = Object.values(parts).reduce((n, r) => n + r.length, 0);
  const clicky = Object.values(parts).reduce((n, r) => n + r.filter(clickable).length, 0);
  console.log(
    `      (decomp ${Object.keys(parts).length} chars, ${rowCount} part rows, ` +
      `${clicky} clickable, ${rowCount - clicky} reading-less; ` +
      `every target in hanja.json; every glyph BMP)`
  );

  // Dead-end rule: 雔 has no card, so 雙 flattens to 隹 + 隹 + 又.
  assert.deepEqual(parts["雙"], [["隹"], ["隹"], ["又"]]);

  // End-to-end join over the REAL files, exactly as the worker holds them:
  // whole hanja.json, guarded decomp.json. This is the seam the unit fixture
  // cannot cover, and where the chars-wrapper bug lived.
  const { attachDecomp, guardDecomp } = await import("../extension/background.js");
  const hanjaFile = JSON.parse(await readFile(join(dataDir, "hanja.json"), "utf8"));
  const joined = attachDecomp(
    { ok: true, matches: [{ kind: "char", canonical: "依" }, { kind: "char", canonical: "國" }] },
    { decomp: guardDecomp(decomp), hanja: hanjaFile }
  );
  const uy = joined.matches[0].parts;
  assert.equal(uy.length, 2);
  assert.equal(uy[0].g, "亻");
  assert.equal(uy[0].t, "人");
  assert.equal(uy[0].eum, "인", "the 亻 row must carry 人's reading after the real-file join");
  assert.equal(uy[1].t, "衣");
  assert.equal(uy[1].eum, "의");

  // 或 has readings but no eumhun pair, so its row rides the readings fallback.
  // Without it the row would render as a bare gloss.
  const guk = joined.matches[1].parts;
  assert.deepEqual(guk.map((p) => p.g), ["囗", "或"], "國 = 囗 + 或");
  assert.equal(hanjaFile.chars["或"].eumhun.length, 0, "或 has no eumhun pair");
  assert.equal(guk[1].eum, "혹", "the 或 row must fall back to readings[0]");
  assert.equal(guk[1].hun, "");
});

// --- recomposition against the real emitted decomp.json ------------------

await testAsync("smoke: the real found-in index holds 人 ⊃ 依, 辶 ⊃ 道, 隹 ⊃ 雙", async () => {
  let decomp, hanjaFile;
  try {
    const [d, h] = await Promise.all([
      readFile(join(dataDir, "decomp.json"), "utf8"),
      readFile(join(dataDir, "hanja.json"), "utf8"),
    ]);
    decomp = JSON.parse(d);
    hanjaFile = JSON.parse(h);
  } catch (err) {
    console.log(`      (skipped — decomp.json unreadable: ${err.code || err.name})`);
    return;
  }

  const { buildFoundInIndex, buildFoundIn, guardDecomp } =
    await import("../extension/background.js");
  const index = buildFoundInIndex(guardDecomp(decomp).parts);

  // The alias credit, over the shipped file: 依's 亻 row credits 人.
  assert.ok(index["人"].includes("依"), "人 must be found in 依");
  // A component-only character: no compounds, no words, and now card content.
  assert.ok(index["辶"] && index["辶"].length > 0, "辶 must be found in something");
  assert.ok(index["辶"].includes("道"), "辶 must be found in 道");
  // 雙 carries 隹 twice and must appear exactly once.
  assert.equal(
    index["隹"].filter((c) => c === "雙").length,
    1,
    "雙 must appear once in 隹's list"
  );
  // Nothing is found in itself, anywhere in the shipped data.
  const selfCredited = Object.keys(index).filter((t) => index[t].includes(t));
  assert.deepEqual(selfCredited.slice(0, 5), [], `${selfCredited.length} self-credited targets`);

  // The join and the ranking, over the real tables.
  const rows = buildFoundIn("辶", index, hanjaFile);
  assert.equal(rows.length, index["辶"].length, "every container joins to an entry");
  const cw = (ch) => (hanjaFile.chars[ch].cw || []).length;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1].char, b = rows[i].char;
    assert.ok(
      cw(a) > cw(b) || (cw(a) === cw(b) && a.codePointAt(0) < b.codePointAt(0)),
      `${a} before ${b} breaks the ranking`
    );
  }
  assert.ok(rows.every((r) => typeof r.char === "string" && r.char.length > 0));

  const sizes = Object.keys(index).map((t) => index[t].length);
  const biggest = Object.keys(index).sort((a, b) => index[b].length - index[a].length)[0];
  console.log(
    `      (found-in ${Object.keys(index).length} targets, ` +
      `${sizes.reduce((n, s) => n + s, 0)} credits, ` +
      `biggest ${biggest} in ${index[biggest].length}; 辶 in ${index["辶"].length})`
  );
});

// --- sibling Sino readings against the real emitted sino.json -------------
// The pipeline emits sino.json in its own wave, possibly after this one: the
// smoke SKIPS LOUDLY until the file lands and then runs on its own.

await testAsync("smoke: real sino.json grounds the 學 and 樂 anchors through the worker's shape", async () => {
  let real, sinoFile;
  try {
    const [h, w, v, s] = await Promise.all([
      readFile(join(dataDir, "hanja.json"), "utf8"),
      readFile(join(dataDir, "words.json"), "utf8"),
      readFile(join(dataDir, "variants.json"), "utf8"),
      readFile(join(dataDir, "sino.json"), "utf8"),
    ]);
    real = { hanja: JSON.parse(h), words: JSON.parse(w), variants: JSON.parse(v) };
    sinoFile = JSON.parse(s);
  } catch (err) {
    console.log(
      `      (SKIPPED: sino smoke needs extension/data/sino.json ` +
        `(${err.code || err.name}); it goes live once the pipeline emits the file)`
    );
    return;
  }

  // The worker's exact arrangement: the parsed file through guardSino, the
  // attach on a real lookup result.
  const { guardSino, attachSino } = await import("../extension/background.js");
  const guarded = guardSino(sinoFile);

  // 學: single reading each side (SPEC anchor: ja [ガク], zh [xué]).
  const hak = attachSino(lookup("學", real), guarded)
    .matches.find((m) => m.kind === "char" && m.canonical === "學");
  assert.ok(hak && hak.sino, "學 must carry a sino entry");
  assert.deepEqual(hak.sino.ja.map((p) => p[0]), ["ガク"], "學 ja readings");
  assert.deepEqual(hak.sino.zh.map((p) => p[0]), ["xué"], "學 zh readings");

  // 樂, aligned in eum order per the SPEC anchor: 악↔ガク↔yuè, 락↔ラク↔lè.
  const ak = attachSino(lookup("樂", real), guarded)
    .matches.find((m) => m.kind === "char" && m.canonical === "樂");
  assert.ok(ak && ak.sino, "樂 must carry a sino entry");
  assert.deepEqual(ak.sino.ja, [["ガク", "악"], ["ラク", "락"]], "樂 ja pairs in eum order");
  assert.deepEqual(ak.sino.zh, [["yuè", "악"], ["lè", "락"]], "樂 zh pairs in eum order");

  const charCount = Object.keys(guarded.chars).length;
  console.log(`      (sino ${charCount} chars; 學 and 樂 anchors hold through guardSino)`);
});

// ---------------------------------------------------------------------------
// rr.js — forward romanization port (SPEC "Romanized search v2")
// ---------------------------------------------------------------------------

console.log("\nrr.js");

const { naive, official, translit, forms } = await import("../extension/rr.js");

// The SPEC v2 anchor pairs. `officialForm` is the binding official reading;
// `naiveForm` is what rr.py's naive() actually emits, which must differ from
// the official form exactly where the sound changes fire.
const RR_ANCHORS = [
  { hangul: "국민", officialForm: "gungmin", naiveForm: "gukmin" },
  { hangul: "종로", officialForm: "jongno", naiveForm: "jongro" },
  { hangul: "같이", officialForm: "gachi", naiveForm: "gati" },
  { hangul: "좋고", officialForm: "joko", naiveForm: "jotgo" },
  { hangul: "신라", officialForm: "silla", naiveForm: "sinra" },
  { hangul: "한라산", officialForm: "hallasan", naiveForm: "hanrasan" },
  { hangul: "학여울", officialForm: "hangnyeoul", naiveForm: "hakyeoul" },
  { hangul: "좋아", officialForm: "joa", naiveForm: "jota" },
];

test("rr anchors: official readings match the SPEC pairs", () => {
  for (const { hangul, officialForm } of RR_ANCHORS) {
    assert.equal(official(hangul), officialForm, hangul);
    assert.ok(forms(hangul).includes(officialForm), `${hangul} forms lack ${officialForm}`);
  }
});

test("rr anchors: the naive form differs where sound changes fire", () => {
  for (const { hangul, officialForm, naiveForm } of RR_ANCHORS) {
    assert.equal(naive(hangul), naiveForm, hangul);
    assert.notEqual(naiveForm, officialForm, hangul);
    // forms() leads with the naive form, per rr.py's ordering.
    assert.equal(forms(hangul)[0], naiveForm, hangul);
  }
});

test("rr ambiguity readings: ㄴ+ㄹ and ㄴ-insertion index both sides", () => {
  assert.deepEqual(forms("신라"), ["sinra", "sinla", "silla", "sinna"]);
  assert.deepEqual(forms("한라산"), ["hanrasan", "hanlasan", "hallasan", "hannasan"]);
  assert.deepEqual(forms("학여울"), ["hakyeoul", "hagyeoul", "hangnyeoul"]);
});

test("rr edge shapes: non-hangul behaves like rr.py", () => {
  assert.equal(naive("abc"), null);
  assert.equal(official("한a"), null);
  assert.equal(translit("漢字"), null);
  assert.deepEqual(forms("abc"), []);
  assert.deepEqual(forms("국민 학교"), []);
});

// --- cross-implementation sweep against pipeline/rr.py -------------------

await testAsync("sweep: JS forms() matches pipeline/rr.py over the shipped word lists", async () => {
  const { spawnSync } = await import("node:child_process");
  const { tmpdir } = await import("node:os");
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");

  const probe = spawnSync("python", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    console.log("      SKIPPED — python not on PATH; rr.py equivalence NOT verified");
    return;
  }

  let wordSet;
  try {
    const [w, n] = await Promise.all([
      readFile(join(dataDir, "words.json"), "utf8"),
      readFile(join(dataDir, "native.json"), "utf8"),
    ]);
    wordSet = new Set([
      ...Object.keys(JSON.parse(w).byHangul),
      ...Object.keys(JSON.parse(n).words),
    ]);
  } catch (err) {
    console.log(`      SKIPPED — data files unreadable (${err.code || err.name}); rr.py equivalence NOT verified`);
    return;
  }
  for (const { hangul } of RR_ANCHORS) wordSet.add(hangul);
  const wordList = [...wordSet];

  const pyScript = [
    "import sys, json, io",
    "sys.path.insert(0, sys.argv[1])",
    "import rr",
    "words = json.load(open(sys.argv[2], encoding='utf-8'))",
    "out = {w: rr.forms(w) for w in words}",
    "json.dump(out, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False)",
  ].join("\n");

  const workDir = await mkdtemp(join(tmpdir(), "rr-sweep-"));
  try {
    const inFile = join(workDir, "words.json");
    const outFile = join(workDir, "forms.json");
    await writeFile(inFile, JSON.stringify(wordList), "utf8");
    const pipelineDir = join(dirname(fileURLToPath(import.meta.url)), "..", "pipeline");
    const started = Date.now();
    const run = spawnSync("python", ["-c", pyScript, pipelineDir, inFile, outFile], {
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      timeout: 120000,
    });
    assert.equal(run.status, 0, `python failed: ${(run.stderr || "").slice(0, 500)}`);
    const pyForms = JSON.parse(await readFile(outFile, "utf8"));

    let mismatches = 0;
    let firstDiff = null;
    for (const w of wordList) {
      const js = forms(w);
      const py = pyForms[w];
      if (JSON.stringify(js) !== JSON.stringify(py)) {
        mismatches += 1;
        if (!firstDiff) firstDiff = `${w}: js ${JSON.stringify(js)} py ${JSON.stringify(py)}`;
      }
    }
    assert.equal(mismatches, 0, `${mismatches} mismatches, first: ${firstDiff}`);
    console.log(
      `      (${wordList.length} words, python ${Date.now() - started}ms, all forms identical)`
    );
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
});

// --- round-trip completeness: the SPEC v2 safety story --------------------
// Replaces map determinism: for EVERY words.json byHangul key and EVERY
// native.json headword, deromanizing each of the word's own forms() must
// find the word again. Runs over the FULL population (~59k forms, about 30
// seconds in node); skipped, not failed, when the data files are absent.

await testAsync("round trip: deromanize(f) contains w for every f in forms(w), FULL population", async () => {
  let wordSet;
  try {
    const [w, n] = await Promise.all([
      readFile(join(dataDir, "words.json"), "utf8"),
      readFile(join(dataDir, "native.json"), "utf8"),
    ]);
    wordSet = new Set([
      ...Object.keys(JSON.parse(w).byHangul),
      ...Object.keys(JSON.parse(n).words),
    ]);
  } catch (err) {
    console.log(`      SKIPPED: data files unreadable (${err.code || err.name}); round trip NOT verified`);
    return;
  }
  // The behavior anchors ride along even if the corpus ever drops one.
  for (const anchor of ["국민", "하늘", "사랑", "가득", "무시", "생일", "학여울"]) {
    wordSet.add(anchor);
  }
  for (const { hangul } of RR_ANCHORS) wordSet.add(hangul);

  const started = Date.now();
  let checked = 0;
  const failures = [];
  for (const word of wordSet) {
    for (const form of forms(word)) {
      checked += 1;
      if (!deromanize(form).some((c) => c.hangul === word)) {
        failures.push(`${word} via ${form}`);
      }
    }
  }
  assert.deepEqual(
    failures.slice(0, 10),
    [],
    `${failures.length} of ${checked} forms fail the round trip`
  );
  console.log(
    `      (${wordSet.size} words, ${checked} forms, ${Date.now() - started}ms, all round-trip)`
  );
});

// ---------------------------------------------------------------------------
// Korean language mode: the message-table loader, the tables, the setting
// ---------------------------------------------------------------------------

console.log("\ni18n.js");

const readJson = async (rel) => JSON.parse(await readFile(new URL(rel, import.meta.url), "utf8"));
const EN_FILE = await readJson("../extension/_locales/en/messages.json");
const KO_FILE = await readJson("../extension/_locales/ko/messages.json");
const flatten = (table) =>
  Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v.message]));

// The loader is a classic script; in Node its one effect is the global.
await import("../extension/i18n.js");
const I18N = globalThis.__okpyeonI18n;

test("i18n: t() substitutes placeholders, picks the English plural by COUNT, never throws", () => {
  I18N.reset();
  assert.equal(I18N.language(), "en");
  assert.equal(I18N.t("level.m"), "Middle school");
  assert.equal(I18N.t("row.partOf", { COUNT: 1 }), "Part of 1 character");
  assert.equal(I18N.t("row.partOf", { COUNT: 2 }), "Part of 2 characters");
  assert.equal(I18N.t("row.partOf", { COUNT: 0 }), "Part of 0 characters");
  assert.equal(I18N.t("button.showMore", { PAGE: 5, COUNT: 13 }), "Show 5 more (13)");
  assert.equal(I18N.t("search.none", { QUERY: "x" }), "No entry for “x”.");
  assert.equal(I18N.t("saved.deleteFolderN", { FOLDER: "Verbs", COUNT: 1, TARGET: "Saved" }),
    "Delete Verbs? 1 item moves to Saved.");
  // An unfilled slot stays visible rather than going blank.
  assert.equal(I18N.t("star.save"), "Save $WORD$");
  assert.equal(I18N.t("star.save", { WORD: undefined }), "Save $WORD$");
  // Missing key: the key itself. Junk keys: no throw.
  assert.equal(I18N.t("no.such.key"), "no.such.key");
  assert.equal(I18N.t(undefined), "undefined");
  assert.equal(I18N.t(null), "null");
  assert.equal(I18N.t("level.m", null), "Middle school");
  assert.deepEqual(I18N.segments("title.reading", { COUNT: 5, SYLLABLE: "국" }), [
    { name: "COUNT", value: "5" },
    { text: " hanja read " },
    { name: "SYLLABLE", value: "국" },
  ]);
});

test("i18n: init(table, lang) installs and activates; missing keys fall back to English, then the key", () => {
  I18N.reset();
  const fired = [];
  I18N.onChange((lang) => fired.push(lang));
  // Chrome's file shape, with a file-form key.
  I18N.init({ row_partOf: { message: "한자 $COUNT$자에 쓰임" } }, "ko");
  assert.equal(I18N.language(), "ko");
  assert.equal(I18N.t("row.partOf", { COUNT: 1 }), "한자 1자에 쓰임");
  assert.equal(I18N.t("row.partOf", { COUNT: 7 }), "한자 7자에 쓰임");
  assert.equal(I18N.t("level.m"), "Middle school", "English fills a hole in the active table");
  assert.equal(I18N.t("no.such.key"), "no.such.key");
  // A flat map with dotted keys lands on the same slots.
  I18N.init({ "level.m": "중학" }, "ko");
  assert.equal(I18N.t("level.m"), "중학");
  assert.deepEqual(fired, ["ko"], "one change event per activation, none for a re-install");
  I18N.reset();
  assert.equal(I18N.language(), "en");
  assert.equal(I18N.t("level.m"), "Middle school");
});

await testAsync("i18n: setLanguage() loads through the configured source; a stale answer never wins", async () => {
  I18N.reset();
  const loads = [];
  I18N.configure({
    load: (lang) => {
      loads.push(lang);
      return Promise.resolve(lang === "ko" ? KO_FILE : null);
    },
  });
  const fired = [];
  I18N.onChange((lang) => fired.push(lang));
  assert.equal(await I18N.setLanguage("ko"), true);
  assert.equal(I18N.language(), "ko");
  assert.equal(I18N.t("tab.search"), "검색");
  assert.equal(I18N.t("row.usedIn", { COUNT: 3 }), "더 긴 단어 3개에 쓰임");
  // Cached: switching back and forth loads nothing more.
  assert.equal(await I18N.setLanguage("en"), true);
  assert.equal(await I18N.setLanguage("ko"), true);
  assert.deepEqual(loads, ["ko"]);
  assert.deepEqual(fired, ["ko", "en", "ko"]);
  // Unknown language: English, no load.
  assert.equal(await I18N.setLanguage("fr"), true);
  assert.equal(I18N.language(), "en");
  assert.deepEqual(loads, ["ko"]);

  // No table available: English stands, and the promise says so.
  I18N.reset();
  I18N.configure({ load: () => Promise.resolve(null) });
  assert.equal(await I18N.setLanguage("ko"), false);
  assert.equal(I18N.language(), "en");
  I18N.configure({ load: () => Promise.reject(new Error("boom")) });
  assert.equal(await I18N.setLanguage("ko"), false);
  assert.equal(I18N.language(), "en");

  // Race: ko requested, en requested before ko's table arrives.
  I18N.reset();
  let release;
  I18N.configure({ load: () => new Promise((resolve) => { release = resolve; }) });
  const slow = I18N.setLanguage("ko");
  assert.equal(await I18N.setLanguage("en"), true);
  release(KO_FILE);
  assert.equal(await slow, true, "resolves to whether the WANTED language is active");
  assert.equal(I18N.language(), "en", "the stale ko answer is stored, not applied");
  assert.equal(await I18N.setLanguage("ko"), true, "and the stored table serves the next switch");
  I18N.reset();
});

test("i18n: render() composes one text node per run and one element per built slot", () => {
  I18N.reset();
  const doc = { createTextNode: (text) => ({ node: "text", text }) };
  globalThis.document = doc;
  try {
    const parent = () => {
      const kids = [];
      return { kids, appendChild: (n) => kids.push(n) };
    };
    const b = (value) => ({ node: "b", text: value });
    let p = parent();
    I18N.render(p, "row.usedIn", { COUNT: 6 }, { COUNT: b });
    assert.deepEqual(p.kids, [
      { node: "text", text: "Used in " },
      { node: "b", text: "6" },
      { node: "text", text: " larger words" },
    ]);
    p = parent();
    I18N.render(p, "title.reading", { COUNT: 5, SYLLABLE: "국" }, { SYLLABLE: b });
    assert.deepEqual(p.kids, [
      { node: "text", text: "5 hanja read " },
      { node: "b", text: "국" },
    ]);
    p = parent();
    I18N.render(p, "row.partOf", { COUNT: 1 });
    assert.deepEqual(p.kids, [{ node: "text", text: "Part of 1 character" }]);
    p = parent();
    I18N.render(p, "about.noVersion", { WORDMARK: "Okpyeon", GITHUB: "GitHub ↗" },
      { WORDMARK: b, GITHUB: (text) => ({ node: "a", text }) });
    assert.deepEqual(p.kids, [
      { node: "b", text: "Okpyeon" },
      { node: "text", text: ". Data from English Wiktionary and Urimalsaem, CC BY-SA. " },
      { node: "a", text: "GitHub ↗" },
    ]);
  } finally {
    delete globalThis.document;
  }
});

test("i18n: the built-in English table is _locales/en/messages.json, verbatim", () => {
  assert.deepEqual(I18N.builtin(), flatten(EN_FILE));
});

test("messages.json: Chrome-valid names, declared placeholders, and ko covers en", () => {
  const FIXED = new Set([
    "link_wiktionary", "tooltip_sino_both", "tooltip_sino_ja", "tooltip_sino_zh",
    "wordmark", "link_github", "input_placeholder", "saved_anki", "saved_csv",
    "language_en", "language_ko",
    // Deliberately bilingual: a user stuck in the wrong language must still
    // find the way out.
    "group_language",
  ]);
  for (const [name, table] of [["en", EN_FILE], ["ko", KO_FILE]]) {
    const lower = new Set();
    for (const [key, entry] of Object.entries(table)) {
      assert.match(key, /^[A-Za-z0-9_@]+$/, `${name}: ${key} is not a Chrome message name`);
      assert.ok(!lower.has(key.toLowerCase()), `${name}: ${key} collides case-insensitively`);
      lower.add(key.toLowerCase());
      assert.equal(typeof entry.message, "string", `${name}: ${key} has no message`);
      const used = [...entry.message.matchAll(/\$([A-Za-z][A-Za-z0-9_]*)\$/g)].map((m) => m[1]);
      for (const p of used) {
        assert.ok(entry.placeholders && entry.placeholders[p.toLowerCase()],
          `${name}: ${key} uses $${p}$ without declaring it`);
      }
      if (entry.placeholders) {
        for (const p of Object.keys(entry.placeholders)) {
          assert.ok(used.some((u) => u.toLowerCase() === p), `${name}: ${key} declares unused ${p}`);
        }
      }
      // Nothing an English speaker would read as machine text, either way.
      assert.doesNotMatch(entry.message, /—/, `${name}: ${key} carries an em dash`);
    }
  }
  const base = (key) => key.replace(/_(one|other)$/, "");
  for (const key of Object.keys(EN_FILE)) {
    assert.ok(KO_FILE[base(key)], `ko lacks ${base(key)}`);
  }
  for (const key of Object.keys(KO_FILE)) {
    assert.ok(EN_FILE[key] || (EN_FILE[`${key}_one`] && EN_FILE[`${key}_other`]), `en lacks ${key}`);
    assert.doesNotMatch(key, /_(one|other)$/, `ko has no plural forms: ${key}`);
    if (EN_FILE[key] && EN_FILE[key].message === KO_FILE[key].message) {
      assert.ok(FIXED.has(key), `${key} is untranslated: ${JSON.stringify(KO_FILE[key].message)}`);
    }
  }
  // The manifest's two, plus the ko description under the store's cap.
  assert.equal(EN_FILE.appName.message, "Okpyeon: Hanja Popup Dictionary");
  assert.equal(KO_FILE.appName.message, "옥편: 한자 팝업 사전");
  assert.ok(KO_FILE.appDesc.message.length <= 132);
});

await testAsync("every message key the surfaces read exists in the English table", async () => {
  const sources = [
    "../extension/content/content.js",
    "../extension/sidepanel/sidepanel.js",
    "../extension/sidepanel/search-shell.js",
    "../extension/sidepanel/saved-view.js",
    "../extension/sidepanel/settings-view.js",
  ];
  const keys = new Set([
    // Composed at run time from a zone or a condition, so not scannable.
    "level.m", "level.h", "level.a", "level.r",
    "level.m.title", "level.h.title", "level.a.title", "level.r.title",
    "about", "about.noVersion",
    // Read by the worker (background.js), which is not scanned.
    "folder.default", "omnibox.suggestion", "marker.rare", "marker.native",
    "marker.loan", "marker.hybrid",
  ]);
  // A key ends in a word character: `t("level." + zone)` is composed above.
  const KEY = "([A-Za-z][A-Za-z0-9.]*[A-Za-z0-9])";
  const patterns = [
    new RegExp(`\\bt\\(\\s*"${KEY}"`, "g"),
    new RegExp(`\\bt\\(\\s*[^,()]+\\?\\s*"${KEY}"\\s*:\\s*"${KEY}"`, "g"),
    new RegExp(`\\btRender\\([^,]+,\\s*"${KEY}"`, "g"),
    new RegExp(`\\b(?:labelKey|titleKey|groupKey|descriptionKey):\\s*"${KEY}"`, "g"),
  ];
  let scanned = 0;
  for (const rel of sources) {
    const src = await readFile(new URL(rel, import.meta.url), "utf8");
    for (const re of patterns) {
      for (const m of src.matchAll(re)) {
        for (const key of m.slice(1)) if (key) { keys.add(key); scanned += 1; }
      }
    }
  }
  assert.ok(scanned > 120, `only ${scanned} key uses scanned`);
  const en = flatten(EN_FILE);
  for (const key of keys) {
    const fk = I18N.fileKey(key);
    assert.ok(fk in en || (`${fk}_one` in en && `${fk}_other` in en), `no English message for ${key}`);
  }
  // The manifest reads its two through Chrome's own mechanism.
  const manifest = await readJson("../extension/manifest.json");
  assert.equal(manifest.name, "__MSG_appName__");
  assert.equal(manifest.description, "__MSG_appDesc__");
  assert.equal(manifest.default_locale, "en");
  assert.deepEqual(manifest.content_scripts[0].js, ["i18n.js", "content/content.js"]);
});

test("settings: language normalizes to en | ko, default en", () => {
  assert.equal(DEFAULT_SETTINGS.language, "en");
  assert.equal(normalizeSettings(null).language, "en");
  assert.equal(normalizeSettings({ language: "ko" }).language, "ko");
  assert.equal(normalizeSettings({ language: "en" }).language, "en");
  for (const junk of ["fr", "KO", "", 7, null, true, ["ko"]]) {
    assert.equal(normalizeSettings({ language: junk }).language, "en", JSON.stringify(junk));
  }
});

await testAsync("first run: the language derives from the browser UI language once, then never again", async () => {
  const { languageForUi, handleSettingsGet, handleSettingsSet } =
    await import("../extension/background.js");
  assert.equal(languageForUi("ko"), "ko");
  assert.equal(languageForUi("ko-KR"), "ko");
  assert.equal(languageForUi("KO"), "ko");
  assert.equal(languageForUi("en-US"), "en");
  assert.equal(languageForUi("kok"), "en", "Konkani is not Korean");
  assert.equal(languageForUi(""), "en");
  assert.equal(languageForUi(undefined), "en");

  const area = () => {
    const store = {};
    return {
      store,
      get: async (key) => ({ [key]: store[key] }),
      set: async (obj) => { Object.assign(store, obj); },
    };
  };
  const stub = (ui, local) => {
    globalThis.chrome = { i18n: { getUILanguage: () => ui }, storage: { local } };
  };
  try {
    // Korean browser, no record: derived and persisted on the first read.
    const koArea = area();
    stub("ko-KR", koArea);
    let res = await handleSettingsGet();
    assert.equal(res.ok, true);
    assert.equal(res.settings.language, "ko");
    assert.equal(koArea.store.okpSettings.language, "ko", "persisted, not just answered");
    // The browser language changing later changes nothing.
    stub("en-US", koArea);
    res = await handleSettingsGet();
    assert.equal(res.settings.language, "ko");
    // English browser, no record.
    const enArea = area();
    stub("en-US", enArea);
    res = await handleSettingsGet();
    assert.equal(res.settings.language, "en");
    assert.equal(enArea.store.okpSettings.language, "en");
    // An existing record without the field is an existing user: English,
    // whatever the browser says.
    const oldArea = area();
    oldArea.store.okpSettings = { v: 1, defaultFolderId: "f0" };
    stub("ko-KR", oldArea);
    res = await handleSettingsGet();
    assert.equal(res.settings.language, "en");
    // The setting writes like any other and survives normalization.
    res = await handleSettingsSet({ language: "ko" });
    assert.equal(res.settings.language, "ko");
    assert.equal(oldArea.store.okpSettings.language, "ko");
    res = await handleSettingsSet({ language: "xx" });
    assert.equal(res.settings.language, "en");
    // No chrome.i18n at all: the navigator, then English.
    const bareArea = area();
    globalThis.chrome = { storage: { local: bareArea } };
    res = await handleSettingsGet();
    assert.equal(res.settings.language, "en");
  } finally {
    delete globalThis.chrome;
  }
});

await testAsync("messagesGet: served from the packaged file, cached per locale, unavailable without a runtime", async () => {
  const { handleMessagesGet, MESSAGE_HANDLERS, MESSAGE_LANGUAGES } =
    await import("../extension/background.js");
  assert.deepEqual(MESSAGE_LANGUAGES, ["en", "ko"]);
  assert.deepEqual(await handleMessagesGet("ko"), { ok: false, error: "messages unavailable" });
  assert.deepEqual(await MESSAGE_HANDLERS.messagesGet({ type: "messagesGet", lang: "ko" }),
    { ok: false, error: "messages unavailable" });

  const fetched = [];
  const realFetch = globalThis.fetch;
  globalThis.chrome = { runtime: { getURL: (path) => `chrome-extension://okp/${path}` } };
  globalThis.fetch = async (url) => {
    fetched.push(url);
    const m = /_locales\/(\w+)\/messages\.json$/.exec(url);
    const table = m && m[1] === "ko" ? KO_FILE : m && m[1] === "en" ? EN_FILE : null;
    return { ok: table !== null, status: table ? 200 : 404, json: async () => table };
  };
  try {
    let res = await handleMessagesGet("ko");
    assert.equal(res.ok, true);
    assert.equal(res.lang, "ko");
    assert.equal(res.messages.tab_search.message, "검색");
    res = await handleMessagesGet("ko");
    assert.deepEqual(fetched, ["chrome-extension://okp/_locales/ko/messages.json"], "cached");
    res = await handleMessagesGet("fr");
    assert.equal(res.lang, "en", "an unknown language is served as English");
    assert.equal(res.messages.tab_search.message, "Search");
    res = await handleMessagesGet(undefined);
    assert.equal(res.lang, "en");
    assert.equal(fetched.length, 2);
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.chrome;
  }
});

test("omnibox rows carry the marker labels they are given; English without them", () => {
  const en = buildOmniboxSuggestions("우리 국민", data);
  const ko = buildOmniboxSuggestions("우리 국민", data, { labels: { rare: "희귀", native: "고유어" } });
  assert.match(en.find((r) => r.content === "牛李").description, /· rare<\/dim>$/);
  assert.match(ko.find((r) => r.content === "牛李").description, /· 희귀<\/dim>$/);
  assert.deepEqual(ko.map((r) => r.content), en.map((r) => r.content), "labels change no order");
  const nativeEn = buildOmniboxSuggestions("하늘", nativeData, { native: true });
  const nativeKo = buildOmniboxSuggestions("하늘", nativeData, {
    native: true,
    labels: { native: "고유어" },
  });
  assert.match(nativeEn.find((r) => r.content === "하늘").description, /native<\/dim>$/);
  assert.match(nativeKo.find((r) => r.content === "하늘").description, /고유어<\/dim>$/);
  // Junk labels read as absent.
  assert.deepEqual(buildOmniboxSuggestions("우리 국민", data, { labels: { rare: 7 } }), en);
  assert.deepEqual(buildOmniboxSuggestions("우리 국민", data, { labels: "no" }), en);
});

// A fetch stand-in for the worker's packaged-file reads: the two message
// tables answer, everything else is a 404.
const fetchTables = (log) => async (url) => {
  if (log) log.push(url);
  const m = /_locales\/(\w+)\/messages\.json$/.exec(url);
  const table = m && m[1] === "ko" ? KO_FILE : m && m[1] === "en" ? EN_FILE : null;
  return { ok: table !== null, status: table ? 200 : 404, json: async () => table };
};
const fakeArea = () => {
  const store = {};
  return {
    store,
    get: async (key) => ({ [key]: store[key] }),
    set: async (obj) => { Object.assign(store, obj); },
  };
};

await testAsync("first run: the default folder takes the language's name from the table, once", async () => {
  const { handleSavedToggle, handleSettingsSet, defaultFolderName } =
    await import("../extension/background.js");
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchTables();
  const stub = (ui, local, withRuntime = true) => {
    globalThis.chrome = { i18n: { getUILanguage: () => ui }, storage: { local } };
    if (withRuntime) {
      globalThis.chrome.runtime = { getURL: (path) => `chrome-extension://okp/${path}` };
    }
  };
  try {
    // Korean browser, nothing stored: both records are created, the folder
    // named from the ko table, and persisted.
    const koArea = fakeArea();
    stub("ko-KR", koArea);
    let res = await handleSavedToggle("char", "國");
    assert.equal(res.ok, true);
    assert.deepEqual(res.folders, [{ id: "f0", name: "저장됨" }]);
    assert.equal(koArea.store.okpSaved.folders[0].name, "저장됨");
    assert.equal(koArea.store.okpSettings.language, "ko");
    // Data from then on: switching the language renames nothing.
    await handleSettingsSet({ language: "en" });
    res = await handleSavedToggle("char", "民");
    assert.deepEqual(res.folders, [{ id: "f0", name: "저장됨" }]);
    // English browser: "Saved", as before.
    const enArea = fakeArea();
    stub("en-US", enArea);
    res = await handleSavedToggle("char", "國");
    assert.deepEqual(res.folders, [{ id: "f0", name: "Saved" }]);
    // An existing record under a Korean browser is never touched.
    const oldArea = fakeArea();
    oldArea.store.okpSaved = { v: 1, folders: [{ id: "f0", name: "Saved" }], items: [] };
    stub("ko-KR", oldArea);
    res = await handleSavedToggle("char", "國");
    assert.deepEqual(res.folders, [{ id: "f0", name: "Saved" }]);
    // No packaged table reachable: the English default stands.
    stub("ko-KR", fakeArea(), false);
    res = await handleSavedToggle("char", "國");
    assert.deepEqual(res.folders, [{ id: "f0", name: "Saved" }]);
    assert.equal(await defaultFolderName("ko"), "Saved");
    assert.equal(await defaultFolderName("en"), "Saved");
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.chrome;
  }
});

await testAsync("omnibox copy follows the stored language; the English fallbacks are the en table's", async () => {
  const { omniboxCopy, OMNIBOX_FALLBACK } = await import("../extension/background.js");
  assert.deepEqual({ ...OMNIBOX_FALLBACK }, {
    description: EN_FILE.omnibox_suggestion.message,
    rare: EN_FILE.marker_rare.message,
    native: EN_FILE.marker_native.message,
    loan: EN_FILE.marker_loan.message,
    hybrid: EN_FILE.marker_hybrid.message,
  });
  // No chrome at all: English.
  assert.deepEqual(await omniboxCopy(), { ...OMNIBOX_FALLBACK });
  const realFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = fetchTables(fetched);
  const stub = (settings) => {
    const local = fakeArea();
    if (settings !== undefined) local.store.okpSettings = settings;
    globalThis.chrome = {
      runtime: { getURL: (path) => `chrome-extension://okp/${path}` },
      storage: { local },
    };
  };
  try {
    stub({ v: 1, language: "ko" });
    assert.deepEqual(await omniboxCopy(), {
      description: KO_FILE.omnibox_suggestion.message,
      rare: "희귀",
      native: "고유어",
      loan: "외래어",
      hybrid: "혼종어",
    });
    assert.equal(KO_FILE.omnibox_suggestion.message, "옥편에서 <match>%s</match> 검색");
    stub({ v: 1, language: "en" });
    assert.deepEqual(await omniboxCopy(), { ...OMNIBOX_FALLBACK });
    stub({ v: 1, language: "xx" });
    assert.deepEqual(await omniboxCopy(), { ...OMNIBOX_FALLBACK });
    stub(undefined);
    assert.deepEqual(await omniboxCopy(), { ...OMNIBOX_FALLBACK });
    // The tables are the cached messagesGet ones: one fetch per language.
    assert.deepEqual(fetched.filter((u) => /_locales/.test(u)).length <= 2, true);
  } finally {
    globalThis.fetch = realFetch;
    delete globalThis.chrome;
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
