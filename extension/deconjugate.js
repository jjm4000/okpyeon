/**
 * Okpyeon: deconjugation generator (SPEC "Deconjugation" addendum).
 *
 * Port of pipeline/spike_deconjugation.py, the measured Python rule set
 * (recall 99.90% over the Wiktionary conjugation tables; 3.52% of the
 * words.json hangul keys deconjugate). test/deconjugate.test.mjs pins the
 * port against the same data.
 *
 * deconjugate(surface) maps an inflected verb or adjective form to the
 * lemmas it could come from: 먹었어 to 먹다, 사는 to 살다 and 사다. It is
 * GENEROUS BY DESIGN and the dictionary is the gate (the romanized search
 * v2 principle): the caller keeps only candidates that native.json holds
 * as a verb or adjective headword. Nothing here consults data, so a
 * candidate is only ever a proposal.
 *
 * Two stages:
 *
 *   1. Ending stripping under the layer grammar [요] FINAL [TENSE]{0,2}
 *      [HON] stem. 셨어요 is 시 + 었 + 어요, so it strips as 요, then 어요,
 *      then 었, then 시. The bare form is also tried as a stem so a fused
 *      infinitive with no visible ending (지칭해) restores. Jamo-initial
 *      endings (ㄴ다 ㄹ까 ㅂ니다 ㅁ) match as the coda of the preceding
 *      syllable: 간다 is 가 + ㄴ다.
 *   2. Stem restoration on the syllable the stripping leaves: fused past
 *      (갔 is 가 + 았), fused vowels (봐 is 보 + 아), the irregular stems
 *      (더워 is 덥 + 어, 몰라 is 모르 + 아, 들어 is 듣 + 어), ㄹ-drop (사는 is
 *      살 + 는). Each restoration carries a cost, and each applies only
 *      where the phonology allows it, which is what keeps 전화 from
 *      becoming 접다 and 미안 from becoming 밀다.
 *
 * Output: candidate lemma strings ending in 다, deduplicated, never the
 * surface itself, ordered by restoration cost, then by how much of the
 * surface the reading explains as endings, then by generation order,
 * truncated to DECONJUGATE_CAP.
 * Empty for input under two syllables or containing anything that is not
 * a precomposed hangul syllable.
 *
 * Exported surface: deconjugate, DECONJUGATE_CAP. No chrome.* usage, no
 * data files, no imports.
 */

// ------------------------------------------------------------------ jamo

const SBASE = 0xac00;
const SLAST = 0xd7a3;

const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const JUNG = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ";
const JONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ",
  "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ",
  "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"];

function isSyllable(ch) {
  const cp = ch.codePointAt(0);
  return cp >= SBASE && cp <= SLAST;
}

/** '갔' -> ['ㄱ', 'ㅏ', 'ㅆ']. The caller guarantees a syllable. */
function dec(ch) {
  const o = ch.codePointAt(0) - SBASE;
  return [CHO[Math.floor(o / 588)], JUNG[Math.floor((o % 588) / 28)], JONG[o % 28]];
}

/** ['ㄱ', 'ㅏ', ''] -> '가'. */
function comp(l, v, t) {
  return String.fromCodePoint(SBASE + CHO.indexOf(l) * 588 + JUNG.indexOf(v) * 28 + JONG.indexOf(t));
}

// ------------------------------------------------------------------ endings

// The full inventory, as the SPEC lists it: sentence enders, tense and
// honorific infixes, connectives, adnominal and nominal endings, the
// imperatives, and the bare 요 서 야 도 that follow a fused vowel (해요 가서
// 해야). Dialect alternatives (허다, 카다 for 하다) are deliberately absent.
const ENDINGS_RAW = `
습니다 습니까 ㅂ니다 ㅂ니까 습디다 읍시다 ㅂ시다 세요 셔요 십시오 읍시오 ㅂ시오 으십시오 으세요 으셔요
어요 아요 여요 에요 예요 어 아 여 었 았 였 겠 어서 아서 여서 어야 아야 여야 어도 아도 여도
어라 아라 여라 으라 라 거라 너라 자 잖아 잖아요 지 지요 죠 지만 네 네요 군요 구나 는군요 는구나 는군
고 고요 고서 면 으면 면서 으면서 며 으며 니 으니 니까 으니까 려고 으려고 러 으러 게 든
든지 거나 다가 다 다고 는다 ㄴ다 는다고 ㄴ다고 는데 은데 ㄴ데 던데 는 은 ㄴ 을 ㄹ 던
을까 ㄹ까 을까요 ㄹ까요 을게 ㄹ게 을게요 ㄹ게요 을래 ㄹ래 을래요 ㄹ래요 을수록 ㄹ수록
는지 은지 ㄴ지 을지 ㄹ지 기 음 ㅁ 나 나요 냐 느냐 으냐 소 오 우 구려 십니다 십니까
시 으시 셨 으셨 세 으세 셔 으셔 려 으려 려면 으려면 더라 더군 더니 던지 대 다면
다면서 냐고 자고 라고 으라고 요 서 야 도
`.split(/\s+/).filter(Boolean);

// Longest first so 습니다 is tried before 다. Array.prototype.sort is stable,
// so endings of one length keep their listed order; that order only ever
// decides ties between candidates of equal cost.
const ENDINGS = [...new Set(ENDINGS_RAW)].sort((a, b) => b.length - a.length);

// Jamo that open a jamo-initial ending (ㄴ다, ㄹ까, ㅂ니다, ㅁ).
const JAMO = "ㄴㄹㅁㅂ";

// The layers. TENSE infixes may stack twice (했었 is 하 + 였 + 었); the
// honorific sits nearest the stem. The four bare honorific spellings are
// only ever infixes; 으셔 으세 셔 세 double as finals (하셔, 하세).
const TENSE = ["었", "았", "였", "겠"];
const HON = ["으셨", "으셔", "으시", "으세", "셨", "셔", "시", "세"];
const HON_ONLY = new Set(["으셨", "으시", "셨", "시"]);
const FINAL = ENDINGS.filter((e) => !TENSE.includes(e) && !HON_ONLY.has(e));

/** True when ending `e` starts with a syllable whose initial is ㅇ (으면, 어). */
function vowelInitial(e) {
  return Boolean(e) && isSyllable(e[0]) && dec(e[0])[0] === "ㅇ";
}

/**
 * The stem left when ending `e` is taken off form `f`, or null. A
 * jamo-initial ending matches its jamo as the coda of the last syllable
 * before its syllabic tail: 압니다 minus ㅂ니다 is 아 (the ㅂ came off 압).
 * A stem is never emptied.
 */
function stripOne(f, e) {
  if (JAMO.includes(e[0])) {
    const tail = e.slice(1);
    if (tail && !f.endsWith(tail)) return null;
    const base = tail ? f.slice(0, f.length - tail.length) : f;
    if (base.length < 1 || !isSyllable(base[base.length - 1])) return null;
    const [l, v, t] = dec(base[base.length - 1]);
    if (t !== e[0]) return null;
    return base.slice(0, -1) + comp(l, v, "");
  }
  if (!f.endsWith(e) || f.length <= e.length) return null;
  return f.slice(0, -e.length);
}

// ------------------------------------------------------------------ stems

/**
 * Candidate stems for the material left before `ending` (null for the bare
 * form), as a Map of stem to restoration cost. The stem as it stands costs
 * 0; a fused past 1; a fused vowel or an irregular after a fused past 2.
 * Each rule reverses one piece of phonology and applies only where the
 * remaining syllable and the ending allow it.
 */
function restoreStems(stem, ending) {
  const out = new Map();
  const put = (s, cost) => {
    if (s && (!out.has(s) || out.get(s) > cost)) out.set(s, cost);
  };
  if (!stem) return out;
  put(stem, 0);
  const last = stem[stem.length - 1];
  if (!isSyllable(last)) return out;
  let [l, v, t] = dec(last);
  const head = stem.slice(0, -1);
  const add = (l2, v2, t2, cost) => put(head + comp(l2, v2, t2), cost);
  const headSyl = head && isSyllable(head[head.length - 1]) ? dec(head[head.length - 1]) : null;

  // Cluster coda: the nominal ㅁ fused into an ㄹ stem. 삶 is 살 + ㅁ, 앎 is
  // 알 + ㅁ.
  if (t === "ㄻ") {
    add(l, v, "ㄹ", 1);
    return out;
  }

  let fusedPast = false;
  if (t === "ㅆ" && l === "ㅇ" && (v === "ㅐ" || v === "ㅒ" || v === "ㅖ")) {
    // ㅎ-irregular past on an ㅇ-initial syllable: 하얬 is 하얗 + 았, 허옜 is
    // 허옇 + 었.
    if (v === "ㅐ") { add(l, "ㅏ", "ㅎ", 2); add(l, "ㅓ", "ㅎ", 2); }
    if (v === "ㅒ") add(l, "ㅑ", "ㅎ", 2);
    if (v === "ㅖ") add(l, "ㅕ", "ㅎ", 2);
    return out;
  }
  if (t === "ㅆ" && l === "ㅇ" && (v === "ㅝ" || v === "ㅘ" || v === "ㅕ")) {
    // Past on an ㅇ-initial fused vowel: 웠 is 우 + 었 (배웠 is 배우 + 었),
    // 왔 is 오 + 았, 였 is 이 + 었 (고였 is 고이 + 었). The same 웠 and 왔
    // are the ㅂ-irregular past when the syllable before is open: 더웠 is
    // 덥 + 었, 도왔 is 돕 + 았.
    if (v === "ㅝ") add(l, "ㅜ", "", 2);
    if (v === "ㅘ") add(l, "ㅗ", "", 2);
    if (v === "ㅕ") add(l, "ㅣ", "", 2);
    if ((v === "ㅝ" || v === "ㅘ") && headSyl && headSyl[2] === "") {
      put(head.slice(0, -1) + comp(headSyl[0], headSyl[1], "ㅂ"), 2);
    }
    return out;
  }
  if (t === "ㅆ" && l !== "ㅇ") {
    // Fused past: 갔 is 가 + 았, 했 is 하 + 였, 됐 is 되 + 었, 봤 is 보 + 았.
    // An 었 or 았 with its own ㅇ initial is stripped as an ending instead.
    fusedPast = true;
    t = "";
    add(l, v, "", 1);
  }
  if (t === "") {
    const base = fusedPast ? 2 : 1;
    // Fused infinitive vowels on an open syllable.
    if (v === "ㅘ") { add(l, "ㅗ", "", base); add(l, "ㅗ", "ㅎ", base); } // 봐 is 보 + 아; 놔 is 놓 + 아
    if (v === "ㅝ") add(l, "ㅜ", "", base);                            // 줘 is 주 + 어
    if (v === "ㅙ") add(l, "ㅚ", "", base);                            // 돼 is 되 + 어
    if (v === "ㅐ" && l === "ㅎ") add(l, "ㅏ", "", base);               // 해 is 하 + 여
    if (v === "ㅕ") add(l, "ㅣ", "", base);                            // 켜 is 키 + 어; 져 is 지 + 어
    if (v === "ㅔ" && l === "ㅅ") add(l, "ㅣ", "", base);               // 잡수세(요) is 잡수시 + 어요
    if (v === "ㅓ") add(l, "ㅡ", "", base);                            // 써 is 쓰 + 어 (으-drop)
    if (v === "ㅏ") add(l, "ㅡ", "", base);                            // 바빠 is 바쁘 + 아 (으-drop)
    // ㅎ-irregular before a vowel: 그래 is 그렇 + 어, 빨개 is 빨갛 + 아, 벌게
    // is 벌겋 + 어, 하얘 is 하얗 + 아, 허예 is 허옇 + 어.
    if (v === "ㅐ") { add(l, "ㅏ", "ㅎ", base); add(l, "ㅓ", "ㅎ", base); }
    if (v === "ㅔ") add(l, "ㅓ", "ㅎ", base);
    if (v === "ㅒ") add(l, "ㅑ", "ㅎ", base);
    if (v === "ㅖ") add(l, "ㅕ", "ㅎ", base);
    // ㅎ-irregular before ㄴ, ㄹ, ㅁ or an 으-initial ending, where the ㅎ
    // (and the 으) drop: 빨간 is 빨갛 + ㄴ, 그러니 is 그렇 + 으니, 이런 is
    // 이렇 + ㄴ.
    if ((v === "ㅏ" || v === "ㅓ" || v === "ㅑ" || v === "ㅕ") && ending &&
        ("ㄴㄹㅁ".includes(ending[0]) || "니면며오냐세셔셨시십".includes(ending[0]))) {
      add(l, v, "ㅎ", base);
    }
    // 르-irregular: 몰라 is 모르 + 아, 불러 is 부르 + 어. The ㄹ doubled onto
    // the syllable before, so that syllable must carry an ㄹ coda.
    if (headSyl && l === "ㄹ" && (v === "ㅏ" || v === "ㅓ") && headSyl[2] === "ㄹ") {
      put(head.slice(0, -1) + comp(headSyl[0], headSyl[1], "") + "르", base);
    }
    // ㅂ-irregular: 더워 is 덥 + 어, 도와 is 돕 + 아, 무거우(ㄴ) is 무겁 + 은.
    // The fused syllable is ㅇ-initial and the stem syllable open.
    if (l === "ㅇ" && (v === "ㅝ" || v === "ㅘ" || v === "ㅜ") && headSyl && headSyl[2] === "") {
      put(head.slice(0, -1) + comp(headSyl[0], headSyl[1], "ㅂ"), base);
    }
    // ㅅ-irregular: 나아 is 낫 + 아, 지어 is 짓 + 어, 지으(면) is 짓 + 으면. An
    // ㅇ-initial vowel syllable after an open stem syllable.
    if (l === "ㅇ" && (v === "ㅏ" || v === "ㅓ" || v === "ㅡ") && headSyl && headSyl[2] === "") {
      put(head.slice(0, -1) + comp(headSyl[0], headSyl[1], "ㅅ"), base);
    }
    // An 으-initial ending stripped from an open stem: either the stem
    // dropped an ㅅ (지으면 is 짓 + 으면) or the 으 belongs to the stem and the
    // ending was vowel-initial (모았 is 모으 + 았, 부었 is 붓 + 었).
    if (ending && vowelInitial(ending) && !fusedPast) {
      add(l, v, "ㅅ", 1);
      put(stem + "으", 1);
    }
    // 러-irregular: 푸르러 is 푸르 + 러, 이르러 is 이르 + 러.
    if (last === "러" && head.endsWith("르")) put(head, base);
    // ㄹ-drop: 사는 is 살 + 는, 압니다 is 알 + ㅂ니다, 아세요 is 알 + 세요, 간
    // is 갈 + ㄴ. Only before ㄴ, ㅂ, ㅅ or 오, as a syllable or a jamo.
    if (ending && ("ㄴㅂ".includes(ending[0]) || "니는네냐느ㅂ세셔셨시십소오우".includes(ending[0]))) {
      add(l, v, "ㄹ", 1);
    }
  }
  if (t === "ㄹ" && ending && vowelInitial(ending)) {
    // ㄷ-irregular: 들어 is 듣 + 어, 걸으면 is 걷 + 으면.
    add(l, v, "ㄷ", 1);
  }
  return out;
}

// ------------------------------------------------------------------ generator

/**
 * Every lemma the layer grammar and the restoration rules can reach from
 * `form`, as a Map of lemma to {rest, passes} in generation order: the
 * restoration cost and the number of endings stripped on the cheapest
 * route (lowest restoration cost, then most endings stripped). Each stem is
 * remembered with the ending adjacent to it and the fewest passes that
 * reached it.
 */
function candidates(form) {
  const stems = new Map();
  const note = (stem, e, passes) => {
    if (stem && (!stems.has(stem) || stems.get(stem).passes > passes)) {
      stems.set(stem, { e, passes });
    }
  };
  note(form, null, 0);
  const starts = [[form, 0]];
  if (form.endsWith("요") && form.length >= 3) starts.push([form.slice(0, -1), 1]);
  for (const [f0, p0] of starts) {
    for (const e of FINAL) {
      const s1 = stripOne(f0, e);
      if (s1 === null) continue;
      note(s1, e, p0 + 1);
      let layer = [[s1, p0 + 1]];
      for (let round = 0; round < 2; round += 1) {
        const nxt = [];
        for (const [f1, p1] of layer) {
          for (const tense of TENSE) {
            const s2 = stripOne(f1, tense);
            if (s2 !== null) {
              note(s2, tense, p1 + 1);
              nxt.push([s2, p1 + 1]);
            }
          }
        }
        if (nxt.length === 0) break;
        layer = layer.concat(nxt);
      }
      for (const [f2, p2] of layer) {
        for (const h of HON) {
          const s3 = stripOne(f2, h);
          if (s3 !== null) note(s3, h, p2 + 1);
        }
      }
    }
  }
  const out = new Map();
  for (const [st, { e, passes }] of stems) {
    for (const [r, rest] of restoreStems(st, e)) {
      const lemma = r + "다";
      if (lemma === form) continue;
      const have = out.get(lemma);
      if (!have || rest < have.rest || (rest === have.rest && passes > have.passes)) {
        out.set(lemma, { rest, passes });
      }
    }
  }
  return out;
}

/** Pinned output bound: the worst input degrades by truncation. */
export const DECONJUGATE_CAP = 64;

/**
 * Candidate lemmas for an inflected surface form, at most DECONJUGATE_CAP
 * of them. [] unless the surface is two or more hangul syllables and
 * nothing else.
 *
 * Order (SPEC): by restoration cost, so a bare stem plus endings comes
 * before a fused past and that before an irregular; at equal cost, the
 * reading that explains more of the surface as endings comes first (먹다
 * before 먹었다 for 먹었어, since 먹었 still holds the tense infix); then
 * generation order, so the sort is stable and pinned. One candidate sorts
 * last whatever its cost: the surface plus 다 as it stands (먹었어다). It
 * explains no ending, yet it must stay a candidate, because a vowel-final
 * stem is its own infinitive (나가 is 나가 + 아, and 나가다 is the lemma).
 */
export function deconjugate(surface) {
  if (typeof surface !== "string" || surface.length < 2) return [];
  for (const ch of surface) {
    if (!isSyllable(ch)) return [];
  }
  const asIs = surface + "다";
  const found = [...candidates(surface)];
  found.sort((a, b) => {
    if (a[0] === asIs) return 1;
    if (b[0] === asIs) return -1;
    return (a[1].rest - b[1].rest) || (b[1].passes - a[1].passes);
  });
  return found.slice(0, DECONJUGATE_CAP).map(([lemma]) => lemma);
}
