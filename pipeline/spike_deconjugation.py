# Deconjugation spike (second pass, 2026-09-05). Not part of the build.
# The rule set extension/deconjugate.js ports; measured against the
# Wiktionary conjugation tables and the words.json hangul keys:
#   recall 99.90% of 335,835 (form, lemma) pairs; 3.52% of 23,267 hangul
#   keys deconjugate to some lemma (mostly real forms: 하자, 사고, 보도).
# Run: PYTHONIOENCODING=utf-8 python pipeline/spike_deconjugation.py
# Deconjugation spike, second pass: the SPEC addendum's inventory and
# precision conditions, measured for recall (Wiktionary tables) and
# precision (dictionary words that wrongly deconjugate).
import io, json, re, collections, sys, random

L = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"
V = "ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"
T = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ",
     "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

def dec(s):
    o = ord(s) - 0xAC00
    return L[o // 588], V[(o % 588) // 28], T[o % 28]

def comp(l, v, t):
    return chr(0xAC00 + L.index(l) * 588 + V.index(v) * 28 + T.index(t))

def is_syl(c):
    return "가" <= c <= "힣"

ENDINGS = """
습니다 습니까 ㅂ니다 ㅂ니까 습디다 읍시다 ㅂ시다 세요 셔요 십시오 읍시오 ㅂ시오 으십시오 으세요 으셔요
어요 아요 여요 에요 예요 어 아 여 었 았 였 겠 어서 아서 여서 어야 아야 여야 어도 아도 여도
어라 아라 여라 으라 라 거라 너라 자 잖아 잖아요 지 지요 죠 지만 네 네요 군요 구나 는군요 는구나 는군
고 고요 고서 면 으면 면서 으면서 며 으며 니 으니 니까 으니까 려고 으려고 러 으러 게 든
든지 거나 다가 다 다고 는다 ㄴ다 는다고 ㄴ다고 는데 은데 ㄴ데 던데 는 은 ㄴ 을 ㄹ 던
을까 ㄹ까 을까요 ㄹ까요 을게 ㄹ게 을게요 ㄹ게요 을래 ㄹ래 을래요 ㄹ래요 을수록 ㄹ수록
는지 은지 ㄴ지 을지 ㄹ지 기 음 ㅁ 나 나요 냐 느냐 으냐 소 오 우 구려 십니다 십니까
시 으시 셨 으셨 세 으세 셔 으셔 려 으려 려면 으려면 더라 더군 더니 던지 대 다면
다면서 냐고 자고 라고 으라고 요 서 야 도
""".split()
ENDINGS = sorted(set(ENDINGS), key=len, reverse=True)
JAMO = "ㄴㄹㅁㅂ"

def vowel_initial(e):
    return e and is_syl(e[0]) and dec(e[0])[0] == "ㅇ"

def restore_stems(stem, ending):
    """(candidate stem, cost) pairs for the material left before `ending`."""
    out = {}
    def put(s, cost):
        if s and (s not in out or out[s] > cost):
            out[s] = cost
    if not stem:
        return out
    put(stem, 0)
    last = stem[-1]
    if not is_syl(last):
        return out
    l, v, t = dec(last)
    head = stem[:-1]
    def add(l2, v2, t2, cost):
        try:
            put(head + comp(l2, v2, t2), cost)
        except ValueError:
            pass
    # cluster codas: 삶 = 살 + ㅁ, 앎 = 알 + ㅁ
    if t == "ㄻ":
        add(l, v, "ㄹ", 1)
        return out
    fused_past = False
    if t == "ㅆ" and l == "ㅇ" and v in ("ㅐ", "ㅒ", "ㅖ"):
        # ㅎ-irregular past with an ㅇ initial: 하얬 <- 하얗, 허옜 <- 허옇
        if v == "ㅐ": add(l, "ㅏ", "ㅎ", 2); add(l, "ㅓ", "ㅎ", 2)
        if v == "ㅒ": add(l, "ㅑ", "ㅎ", 2)
        if v == "ㅖ": add(l, "ㅕ", "ㅎ", 2)
        return out
    if t == "ㅆ" and l == "ㅇ" and v in ("ㅝ", "ㅘ", "ㅕ"):
        # 웠 = 우+었 (배웠 <- 배우; 더웠 <- 덥), 왔 = 오+았 (왔 <- 오; 도왔 <- 돕),
        # 였 = 이+었 (고였 <- 고이)
        if v == "ㅝ": add(l, "ㅜ", "", 2)
        if v == "ㅘ": add(l, "ㅗ", "", 2)
        if v == "ㅕ": add(l, "ㅣ", "", 2)
        if v in ("ㅝ", "ㅘ") and head and is_syl(head[-1]):
            hl, hv, ht = dec(head[-1])
            if ht == "":
                put(head[:-1] + comp(hl, hv, "ㅂ"), 2)
        return out
    if t == "ㅆ" and l != "ㅇ":
        # fused past: 갔 = 가+았, 했 = 하+였, 됐 = 되+었, 봤 = 보+았 (었/았 with
        # an ㅇ initial are stripped as endings, not fused)
        fused_past = True
        t = ""
        add(l, v, "", 1)
    if t == "":
        base = 2 if fused_past else 1
        # fused infinitive vowels (open syllable)
        if v == "ㅘ": add(l, "ㅗ", "", base); add(l, "ㅗ", "ㅎ", base)   # 봐 <- 보, 놔 <- 놓
        if v == "ㅝ": add(l, "ㅜ", "", base)                       # 줘 <- 주
        if v == "ㅙ": add(l, "ㅚ", "", base)                       # 돼 <- 되
        if v == "ㅐ" and l == "ㅎ": add(l, "ㅏ", "", base)          # 해 <- 하
        if v == "ㅕ": add(l, "ㅣ", "", base)                       # 켜 <- 키, 져 <- 지, 여 <- 이
        if v == "ㅔ" and l == "ㅅ": add(l, "ㅣ", "", base)          # 잡수세(요) <- 잡수시
        if v == "ㅓ": add(l, "ㅡ", "", base)                       # 써 <- 쓰 (으-drop)
        if v == "ㅏ": add(l, "ㅡ", "", base)                       # 바빠 <- 바쁘
        if v in ("ㅏ", "ㅓ") and l == "ㅇ" and head:
            # 으-drop across syllables: 바빠 handled above; 예뻐 <- 예쁘 too.
            pass
        # ㅎ-irregular: 그래 <- 그렇, 빨개 <- 빨갛, 하얘 <- 하얗, 허예 <- 허옇;
        # and before ㄴ/ㄹ/ㅁ or an 으-initial ending the ㅎ (and 으) drop:
        # 빨간 <- 빨갛+ㄴ, 그러니 <- 그렇+으니, 이런 <- 이렇+ㄴ
        if v == "ㅐ": add(l, "ㅏ", "ㅎ", base); add(l, "ㅓ", "ㅎ", base)
        if v == "ㅔ": add(l, "ㅓ", "ㅎ", base)                       # 벌게 <- 벌겋
        if v == "ㅒ": add(l, "ㅑ", "ㅎ", base)
        if v == "ㅖ": add(l, "ㅕ", "ㅎ", base)
        if v in ("ㅏ", "ㅓ", "ㅑ", "ㅕ") and ending and (ending[0] in "ㄴㄹㅁ" or ending[0] in "니면며오냐세셔셨시십"):
            add(l, v, "ㅎ", base)
        # 르-irregular: 몰라 <- 모르, 불러 <- 부르
        if head and is_syl(head[-1]) and l == "ㄹ" and v in ("ㅏ", "ㅓ"):
            hl, hv, ht = dec(head[-1])
            if ht == "ㄹ":
                put(head[:-1] + comp(hl, hv, "") + "르", base)
        # ㅂ-irregular: 더워 <- 덥, 도와 <- 돕, 무거우(ㄴ) <- 무겁: the fused
        # syllable is ㅇ-initial and the stem syllable open
        if l == "ㅇ" and v in ("ㅝ", "ㅘ", "ㅜ") and head and is_syl(head[-1]):
            hl, hv, ht = dec(head[-1])
            if ht == "":
                put(head[:-1] + comp(hl, hv, "ㅂ"), base)
        # ㅅ-irregular: 나아 <- 낫, 지어 <- 짓, 지으면 <- 짓: an ㅇ-initial
        # vowel syllable after an open stem syllable
        if l == "ㅇ" and v in ("ㅏ", "ㅓ", "ㅡ") and head and is_syl(head[-1]):
            hl, hv, ht = dec(head[-1])
            if ht == "":
                put(head[:-1] + comp(hl, hv, "ㅅ"), base)
        # an 으-initial ending stripped from an open stem: the stem may be a
        # dropped ㅅ (지으면 <- 짓) or the 으 belongs to the ending (먹으면)
        if ending and vowel_initial(ending) and not fused_past:
            add(l, v, "ㅅ", 1)
            put(stem + "으", 1)                                   # 모았 <- 모으, 떴 handled above                                    # 지었 <- 짓, 부었 <- 붓
        # 러-irregular: 푸르러 <- 푸르, 이르러 <- 이르
        if last == "러" and head.endswith("르"):
            put(head, base)
        # ㄹ-drop: 사는 <- 살, 압니다 <- 알, 아세요 <- 알, 간 <- 갈: only before
        # ㄴ, ㅂ, ㅅ, 오 (the syllabic or jamo ending)
        if ending and (ending[0] in "ㄴㅂ" or ending[0] in "니는네냐느ㅂ세셔셨시십소오우"):
            add(l, v, "ㄹ", 1)
    if t == "ㄹ" and ending and vowel_initial(ending):
        # ㄷ-irregular: 들어 <- 듣, 걸으면 <- 걷
        add(l, v, "ㄷ", 1)
    return out

TENSE = ["었", "았", "였", "겠"]
HON = ["으셨", "으셔", "으시", "으세", "셨", "셔", "시", "세"]
FINAL = [e for e in ENDINGS if e not in TENSE and e not in ("으셨", "으시", "셨", "시")]

def strip_one(f, e):
    """The stem left when ending e is taken off form f, or None."""
    if e[0] in JAMO:
        tail = e[1:]
        if tail and not f.endswith(tail):
            return None
        base = f[: len(f) - len(tail)] if tail else f
        if len(base) < 1 or not is_syl(base[-1]):
            return None
        l, v, t = dec(base[-1])
        if t != e[0]:
            return None
        return base[:-1] + comp(l, v, "")
    if not f.endswith(e) or len(f) <= len(e):
        return None
    return f[: -len(e)]

def candidates(form):
    """{lemma: cost}: the layers are [요] FINAL [TENSE]{0,2} [HON] stem."""
    stems = {}          # stem -> (adjacent ending, passes)
    def note(stem, e, passes):
        if stem and (stem not in stems or stems[stem][1] > passes):
            stems[stem] = (e, passes)
    note(form, None, 0)
    starts = [(form, 0)]
    if form.endswith("요") and len(form) >= 3:
        starts.append((form[:-1], 1))
    for f0, p0 in starts:
        for e in FINAL:
            s1 = strip_one(f0, e)
            if s1 is None:
                continue
            note(s1, e, p0 + 1)
            layer = [(s1, p0 + 1)]
            for _ in range(2):
                nxt = []
                for f1, p1 in layer:
                    for t in TENSE:
                        s2 = strip_one(f1, t)
                        if s2 is not None:
                            note(s2, t, p1 + 1)
                            nxt.append((s2, p1 + 1))
                layer = layer + nxt if nxt else layer
                if not nxt:
                    break
            for f2, p2 in layer:
                for h in HON:
                    s3 = strip_one(f2, h)
                    if s3 is not None:
                        note(s3, h, p2 + 1)
    out = {}
    for st, (e, passes) in stems.items():
        for r, cost in restore_stems(st, e).items():
            lemma = r + "다"
            if lemma == form:
                continue
            c = cost + passes
            if lemma not in out or out[lemma] > c:
                out[lemma] = c
    return out

if __name__ == "__main__":
    nat = json.load(io.open("D:/Code/Hanja/extension/data/native.json", encoding="utf-8"))["words"]
    words = json.load(io.open("D:/Code/Hanja/extension/data/words.json", encoding="utf-8"))
    lemmas = {w for w, v in nat.items() if any(x.get("pos") in ("verb", "adj") for x in v)}
    pairs = []
    with io.open("D:/Code/Hanja/pipeline/cache/kaikki-Korean.jsonl", encoding="utf-8") as f:
        for line in f:
            if '"forms"' not in line:
                continue
            try:
                o = json.loads(line)
            except Exception:
                continue
            w = o.get("word", "")
            if o.get("pos") not in ("verb", "adj") or w not in lemmas:
                continue
            seen = set()
            for fm in o.get("forms", []):
                s = fm.get("form", "")
                if re.fullmatch(r"[가-힣]+", s) and s != w and s not in seen and len(s) >= 2:
                    seen.add(s)
                    pairs.append((s, w, tuple(fm.get("tags", []))))
    print("test pairs:", len(pairs))
    hit = 0; miss = collections.Counter(); ambig = collections.Counter(); misses = []
    first = 0
    for s, w, tags in pairs:
        c = {k: v for k, v in candidates(s).items() if k in lemmas}
        if w in c:
            hit += 1
            ambig[len(c)] += 1
            best = min(c.values())
            if c[w] == best: first += 1
        else:
            miss[tags[-1] if tags else "?"] += 1
            misses.append((s, w, tags[:3]))
    print("recall: %.2f%% (%d of %d); lemma at best cost among hits: %.1f%%" % (100 * hit / len(pairs), hit, len(pairs), 100 * first / hit))
    print("candidate count among hits:", sorted(ambig.items())[:8])
    print("miss by last tag:", miss.most_common(12))
    random.seed(2)
    print("sample misses:", random.sample(misses, min(60, len(misses))))
    byh = [k for k in words["byHangul"] if len(k) >= 2]
    fp = [(k, sorted(c for c in candidates(k) if c in lemmas)) for k in byh]
    fp = [x for x in fp if x[1]]
    print("byHangul keys", len(byh), "deconjugate:", len(fp), "%.2f%%" % (100 * len(fp) / len(byh)))
    print("sample fp:", random.sample(fp, 40))
