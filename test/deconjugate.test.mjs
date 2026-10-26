/**
 * Tests for the deconjugation generator in extension/deconjugate.js.
 * Plain Node, no dependencies, no chrome globals.
 *
 *   node test/deconjugate.test.mjs
 *
 * The unit anchors need no data. The two pinned data tests (recall over the
 * Wiktionary conjugation tables, precision over the words.json hangul keys)
 * read extension/data/native.json, extension/data/words.json and
 * pipeline/cache/kaikki-Korean.jsonl, and skip with a notice when the cache
 * file is absent. Numbers pinned per SPEC "Deconjugation": recall floor
 * 99.5% (the Python reference, pipeline/spike_deconjugation.py, measured
 * 99.90%), precision ceiling 4% (measured 3.52%).
 */

import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { deconjugate, DECONJUGATE_CAP } from "../extension/deconjugate.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "extension", "data");
const cacheFile = join(here, "..", "pipeline", "cache", "kaikki-Korean.jsonl");

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

const includes = (form, lemma) =>
  assert.ok(deconjugate(form).includes(lemma), `${form} must propose ${lemma}: ${deconjugate(form).join(" ")}`);
const includes2 = (form, lemma) => {
  const out = deconjugate(form, { minSyllables: 1 });
  assert.ok(out.includes(lemma), `${form} (one-syllable opt-in) must propose ${lemma}: ${out.join(" ")}`);
};
const excludes = (form, lemma) =>
  assert.ok(!deconjugate(form).includes(lemma), `${form} must not propose ${lemma}`);

// ---------------------------------------------------------------------------
// Unit anchors (no data)
// ---------------------------------------------------------------------------

console.log("deconjugate.js");

test("먹었어: 먹다 first (bare stem plus stripped endings beats every restoration)", () => {
  assert.equal(deconjugate("먹었어")[0], "먹다");
  // Order: restoration cost, then the deeper strip, then generation order.
  // 먹었다 leaves the tense infix in the stem; 먹었으다 is an 으-drop reading
  // of the unstripped form; 먹었어다 explains nothing and sorts last.
  assert.deepEqual(deconjugate("먹었어"), ["먹다", "먹었다", "먹었으다", "먹었어다"]);
  // A plain strip (사 + 는) ranks before a restoration (살 + 는 with ㄹ-drop).
  const out = deconjugate("사는");
  assert.ok(out.indexOf("사다") < out.indexOf("살다"), out.join(" "));
});

test("regular endings: 좋은, 공부했어, 갔어요, 했어, 해요, 가서, 읽으셔서", () => {
  includes("좋은", "좋다");
  includes("공부했어", "공부하다");
  includes("갔어요", "가다");
  includes("했어", "하다");
  includes("해요", "하다");
  includes("가서", "가다");
  includes("읽으셔서", "읽다");
});

test("ㄹ stems: 사는 proposes 살다 and 사다; 삶은 and 압니다 restore 살다 and 알다", () => {
  includes("사는", "살다");
  includes("사는", "사다");
  // 삶 alone is one syllable and stays under the length floor; 삶은 is
  // 살 + ㅁ + 은 and restores through the cluster coda rule.
  includes("삶은", "살다");
  assert.deepEqual(deconjugate("삶"), []);
  includes("압니다", "알다");
});

test("the surface plus 다 sorts last; a bare vowel stem still reaches its lemma", () => {
  const out = deconjugate("먹었어");
  assert.equal(out[out.length - 1], "먹었어다");
  includes("나가", "나가다");
  includes("태어나", "태어나다");
});

test("irregulars: 더워 덥다, 몰라 모르다, 들어 듣다, 나아 낫다, 빨간 빨갛다, 부었어 붓다, 푸르러야 푸르다", () => {
  includes("더워", "덥다");
  includes("몰라", "모르다");
  includes("들어", "듣다");
  includes("나아", "낫다");
  includes("빨간", "빨갛다");
  includes("부었어", "붓다");
  includes("푸르러야", "푸르다");
});

test("precision conditions: 전화 is not 접다, 미안 is not 밀다", () => {
  excludes("전화", "접다");
  excludes("미안", "밀다");
});

test("length floor and script: 가, 먹, abc return []", () => {
  assert.deepEqual(deconjugate("가"), []);
  assert.deepEqual(deconjugate("먹"), []);
  assert.deepEqual(deconjugate("abc"), []);
  assert.deepEqual(deconjugate("먹었a"), []);
  assert.deepEqual(deconjugate(""), []);
});

test("one-syllable opt-in: 할 and 될 deconjugate only when the caller asks", () => {
  // Bound-noun ADDENDUM (2026-10-25): the modifier form before 거 (할거야).
  assert.deepEqual(deconjugate("할"), []);
  includes2("할", "하다");
  includes2("될", "되다");
  includes2("하는", "하다");
  assert.deepEqual(deconjugate("abc", { minSyllables: 1 }), []);
  assert.deepEqual(deconjugate("", { minSyllables: 1 }), []);
});

test("the ㄴ가 question ending and the colloquial 다구: 아닌가요, 그런가, 있다구요", () => {
  includes("아닌가요", "아니다");
  includes("그런가", "그렇다");
  includes("하는가", "하다");
  includes("있다구요", "있다");
});

test("the surface itself is never returned", () => {
  for (const form of ["먹다", "하다", "살다", "가다", "먹었다", "공부하다"]) {
    assert.ok(!deconjugate(form).includes(form), `${form} returned itself`);
  }
});

test("every candidate ends in 다 and is unique", () => {
  for (const form of ["먹었어", "사는", "하셨었겠습니다", "공부했어요", "더워"]) {
    const out = deconjugate(form);
    assert.ok(out.every((c) => c.endsWith("다")), `${form}: ${out.join(" ")}`);
    assert.equal(new Set(out).size, out.length, `${form} has duplicates`);
  }
});

test("cap respected on a long stacked input", () => {
  assert.equal(DECONJUGATE_CAP, 64);
  const long = "가".repeat(12) + "셨었겠습니다요";
  assert.ok(deconjugate(long).length <= DECONJUGATE_CAP);
  // Any input, whatever the endings, stays within the cap.
  for (const form of ["하셨었겠어요", "봐라", "웠어", "알았어요", "갔었었어요"]) {
    assert.ok(deconjugate(form).length <= DECONJUGATE_CAP, form);
  }
});

test("deterministic: the same input gives the same array", () => {
  for (const form of ["먹었어", "사는", "갔어요", "더워", "몰라", "하셨었겠어요"]) {
    assert.deepEqual(deconjugate(form), deconjugate(form));
  }
});

// ---------------------------------------------------------------------------
// Pinned data tests. Read-only; skipped, not failed, if the cache is absent.
// ---------------------------------------------------------------------------

const HANGUL_ONLY = /^[가-힣]+$/;

async function loadLemmaSet() {
  const native = JSON.parse(await readFile(join(dataDir, "native.json"), "utf8"));
  const lemmas = new Set();
  for (const [word, entries] of Object.entries(native.words)) {
    if (entries.some((e) => e.pos === "verb" || e.pos === "adj")) lemmas.add(word);
  }
  return lemmas;
}

async function cachePresent() {
  try {
    await stat(cacheFile);
    return true;
  } catch {
    return false;
  }
}

/** Distinct (form, lemma) pairs from the conjugation tables of gated lemmas. */
async function loadPairs(lemmas) {
  const pairs = [];
  const seen = new Set();
  const rl = createInterface({ input: createReadStream(cacheFile, { encoding: "utf8" }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.includes('"forms"')) continue;
    let o;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    const w = o.word || "";
    if ((o.pos !== "verb" && o.pos !== "adj") || !lemmas.has(w)) continue;
    for (const fm of o.forms || []) {
      const s = fm.form || "";
      if (s.length < 2 || s === w || !HANGUL_ONLY.test(s)) continue;
      const key = `${s}\t${w}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([s, w]);
    }
  }
  return pairs;
}

await testAsync("recall over the Wiktionary conjugation tables is at least 99.5% (pinned)", async () => {
  if (!(await cachePresent())) {
    console.log("      SKIPPED: pipeline/cache/kaikki-Korean.jsonl absent; recall NOT verified");
    return;
  }
  const started = Date.now();
  const lemmas = await loadLemmaSet();
  const pairs = await loadPairs(lemmas);
  assert.ok(pairs.length > 300000, `only ${pairs.length} pairs; the extract or native.json look wrong`);
  let hit = 0;
  const ambiguity = new Map();
  const misses = [];
  for (const [form, lemma] of pairs) {
    const survivors = deconjugate(form).filter((c) => lemmas.has(c));
    if (survivors.includes(lemma)) {
      hit += 1;
      ambiguity.set(survivors.length, (ambiguity.get(survivors.length) || 0) + 1);
    } else if (misses.length < 20) {
      misses.push(`${form} (${lemma})`);
    }
  }
  const recall = hit / pairs.length;
  const dist = [...ambiguity.entries()].sort((a, b) => a[0] - b[0])
    .map(([n, c]) => `${n}: ${c} (${(100 * c / hit).toFixed(1)}%)`).join(", ");
  console.log(`      recall ${(100 * recall).toFixed(2)}% (${hit} of ${pairs.length} pairs, ${Date.now() - started}ms)`);
  console.log(`      survivors per hit: ${dist}`);
  console.log(`      sample misses: ${misses.join(", ")}`);
  assert.ok(recall >= 0.995, `recall ${(100 * recall).toFixed(2)}% is under the 99.5% floor`);
});

await testAsync("precision: at most 4% of words.json hangul keys deconjugate to a lemma (pinned)", async () => {
  if (!(await cachePresent())) {
    console.log("      SKIPPED: pipeline/cache/kaikki-Korean.jsonl absent; precision NOT verified");
    return;
  }
  const lemmas = await loadLemmaSet();
  const words = JSON.parse(await readFile(join(dataDir, "words.json"), "utf8"));
  const keys = Object.keys(words.byHangul).filter((k) => k.length >= 2);
  assert.ok(keys.length > 10000, `only ${keys.length} hangul keys`);
  let deconjugated = 0;
  const sample = [];
  for (const key of keys) {
    const survivors = deconjugate(key).filter((c) => lemmas.has(c));
    if (survivors.length) {
      deconjugated += 1;
      if (sample.length < 12) sample.push(`${key} (${survivors.join(" ")})`);
    }
  }
  const share = deconjugated / keys.length;
  console.log(`      ${deconjugated} of ${keys.length} keys deconjugate: ${(100 * share).toFixed(2)}%`);
  console.log(`      sample: ${sample.join(", ")}`);
  assert.ok(share <= 0.04, `${(100 * share).toFixed(2)}% is over the 4% ceiling`);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
