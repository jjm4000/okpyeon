# Deconjugation SPIKE (2026-09-05), kept as the seed of the real module:
# a generous rule generator gated by the lemma set, measured for recall
# against Wiktionary's conjugation tables. See deconjugation-kickoff.md.
# Not part of the build. Run: PYTHONIOENCODING=utf-8 python pipeline/spike_deconjugation.py
import io, json, re, collections, sys

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

# Endings that attach to a stem (after the stem's own last syllable is
# restored). Ordered longest-first at use. Deliberately generous.
ENDINGS = """
습니다 습니까 ㅂ니다 ㅂ니까 습디다 읍시다 ㅂ시다 세요 셔요 십시오 으십시오 으세요 으셔요
어요 아요 여요 에요 예요 어 아 여 었 았 였 겠 어서 아서 여서 어야 아야 여야 어도 아도 여도
어라 아라 여라 어라 으라 라 자 잖아 잖아요 지 지요 죠 지만 지요 네 네요 군요 구나 는군요
고 고요 고서 면 으면 면서 으면서 며 으며 니 으니 니까 으니까 려고 으려고 러 으러 게 든
든지 거나 다가 다 다고 는다 ㄴ다 는다고 ㄴ다고 는데 은데 ㄴ데 던데 는 은 ㄴ 을 ㄹ 던
을까 ㄹ까 을까요 ㄹ까요 을게 ㄹ게 을게요 ㄹ게요 을래 ㄹ래 을래요 ㄹ래요 을수록 ㄹ수록
는지 은지 ㄴ지 을지 ㄹ지 기 음 ㅁ 나 나요 냐 느냐 으냐 소 오 우 구려 십니다 십니까
시 으시 셨 으셨 세 으세 려 으려 려면 으려면 는구나 는군 더라 더군 더니 던지 대 다면
다면서 냐고 자고 라고 으라고 시죠 시지 시네 시고 셔 셔서 셨어 셨어요 셨습니다
""".split()
ENDINGS = sorted(set(ENDINGS), key=len, reverse=True)

def restore_stems(stem):
    """Given the material before an ending (possibly a fused/irregular
    syllable), yield candidate dictionary stems (without 다)."""
    out = set()
    if not stem:
        return out
    out.add(stem)  # already a bare stem (먹 + 어요 stripped -> 먹)
    last = stem[-1]
    if not is_syl(last):
        return out
    l, v, t = dec(last)
    head = stem[:-1]
    # Fused infinitive vowels: 가 <- 가+아, 서 <- 서+어, 봐 <- 보+아, 줘 <- 주+어,
    # 해 <- 하+여, 돼 <- 되+어, 써 <- 쓰+어, 켜 <- 키+어, 폈 handled via ㅆ below.
    def add(l2, v2, t2):
        try:
            out.add(head + comp(l2, v2, t2))
        except ValueError:
            pass
    if t == "ㅆ":  # past 었/았 fused: 갔 -> 가, 했 -> 하, 됐 -> 되, 봤 -> 보
        t = ""
        add(l, v, "")
        last2 = comp(l, v, "")
        l, v, t = dec(last2)
        head = stem[:-1]
    if t == "":
        if v == "ㅘ": add(l, "ㅗ", "")          # 봐 -> 보
        if v == "ㅝ": add(l, "ㅜ", "")          # 줘 -> 주
        if v == "ㅐ": add(l, "ㅏ", ""); add(l, "ㅐ", "")   # 해 -> 하 (여 fusion) ; 보내 -> 보내
        if v == "ㅙ": add(l, "ㅚ", "")          # 돼 -> 되
        if v == "ㅕ": add(l, "ㅣ", ""); add(l, "ㅕ", "")   # 켜 <- 키+어 ; 펴 stays
        if v == "ㅓ": add(l, "ㅡ", ""); add(l, "ㅓ", "")   # 써 -> 쓰 (으 drop) ; 서 stays
        if v == "ㅏ": add(l, "ㅏ", ""); add(l, "ㅡ", "")   # 가 stays ; 바빠 -> 바쁘 (으 drop, 아 harmony)
        if v == "ㅔ": add(l, "ㅔ", "")
        if v in ("ㅏ", "ㅓ", "ㅐ", "ㅔ"):
            # ㅎ irregular: 그래 <- 그렇, 빨개 <- 빨갛, 하얘 <- 하얗
            add(l, "ㅏ" if v in ("ㅐ",) else v, "ㅎ")
            if v == "ㅐ": add(l, "ㅓ", "ㅎ")
        # 르 irregular: 몰라 <- 모르 (head ends in ㄹ-coda syllable)
        if head and is_syl(head[-1]):
            hl, hv, ht = dec(head[-1])
            if ht == "ㄹ" and l == "ㄹ" and v in ("ㅏ", "ㅓ"):
                out.add(head[:-1] + comp(hl, hv, "") + "르")
        # ㅂ irregular: 더워 <- 덥 (워 <- 우+어), 도와 <- 돕 (와 <- 오+아)
        if v in ("ㅝ", "ㅘ") and head:
            out.add(head[:-1] + dec_join(head[-1], "ㅂ")) if is_syl(head[-1]) else None
        # 우 variant of ㅂ: 고마워 <- 고맙 ; 도와 <- 돕 handled above via head
        # ㅅ irregular: 나아 <- 낫, 지어 <- 짓
        if v in ("ㅏ", "ㅓ") and head and is_syl(head[-1]):
            hl, hv, ht = dec(head[-1])
            if ht == "":
                out.add(head[:-1] + comp(hl, hv, "ㅅ"))
                out.add(head[:-1] + comp(hl, hv, "ㄷ") if False else head[:-1] + comp(hl, hv, "ㅅ"))
        # honorific 시 fused: 하세 (하시+어) -> 하 ; 셔 -> 시+어
        if v == "ㅕ" and l == "ㅅ": out.add(head)
        if v == "ㅔ" and l == "ㅅ": out.add(head)
    if t == "ㄴ" or t == "ㄹ" or t == "ㅁ":
        # adnominal/nominal endings fused onto an open stem: 간 <- 가+ㄴ, 갈 <- 가+ㄹ, 감 <- 가+ㅁ
        add(l, v, "")
        if t == "ㄴ" or t == "ㄹ":
            add(l, v, "ㅎ")   # 빨간 <- 빨갛+ㄴ (ㅎ irregular)
    if t == "ㄹ":
        out.add(stem)         # ㄹ stems: 살 -> 살다
    if t == "":
        # ㄹ-drop before ㄴ/ㅂ/ㅅ endings: 사는 <- 살, 압니다 <- 알, 아세요 <- 알
        add(l, v, "ㄹ")
    # ㄷ irregular: 들어 <- 듣 (ㄹ coda before vowel ending)
    if t == "ㄹ":
        add(l, v, "ㄷ")
    return {s for s in out if s}

def dec_join(syl, coda):
    l, v, t = dec(syl)
    return comp(l, v, coda)

def candidates(form):
    """All dictionary-form lemmas the generator proposes for a surface form."""
    cands = set()
    stems = set()
    # strip zero or one ending (endings may stack: 셨어요 = 시+었+어요; try two passes)
    frontier = {form}
    for _ in range(3):
        nxt = set()
        for f in frontier:
            for e in ENDINGS:
                if f.endswith(e) and len(f) > len(e):
                    nxt.add(f[: -len(e)])
                elif e[0] in "ㄴㄹㅁㅂ" and len(e) >= 1 and f and is_syl(f[-1]):
                    # jamo-initial endings (ㄴ다, ㄹ까, ㅂ니다, ㅁ): the jamo sits as the coda
                    l, v, t = dec(f[-1])
                    rest = e[1:]
                    if t == e[0] and (rest == "" or False):
                        nxt.add(f[:-1] + comp(l, v, ""))
                    elif t == e[0] and f.endswith(rest) and rest:
                        pass
            # jamo-initial endings with a tail (ㄴ다, ㄹ까, ㅂ니다): match tail then coda
            for e in ENDINGS:
                if e[0] in "ㄴㄹㅁㅂ" and len(e) > 1 and f.endswith(e[1:]) and len(f) > len(e) - 1:
                    base = f[: -(len(e) - 1)]
                    if base and is_syl(base[-1]):
                        l, v, t = dec(base[-1])
                        if t == e[0]:
                            nxt.add(base[:-1] + comp(l, v, ""))
        stems |= frontier
        frontier = nxt - stems
        if not frontier:
            break
    stems |= frontier
    for s in stems:
        for r in restore_stems(s):
            cands.add(r + "다")
    return cands

if __name__ == "__main__":
    nat = json.load(io.open("D:/Code/Hanja/extension/data/native.json", encoding="utf-8"))["words"]
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
                if re.fullmatch(r"[가-힣]+", s) and s != w and s not in seen:
                    seen.add(s)
                    pairs.append((s, w, tuple(fm.get("tags", []))))
    print("test pairs (distinct surface per lemma):", len(pairs))
    hit = 0; miss = collections.Counter(); ambig = collections.Counter(); misses = []
    for s, w, tags in pairs:
        c = candidates(s) & lemmas
        if w in c:
            hit += 1
            ambig[len(c)] += 1
        else:
            key = tags[-1] if tags else "?"
            miss[key] += 1
            if len(misses) < 40:
                misses.append((s, w, tags[:3]))
    print("recall: %.1f%% (%d of %d)" % (100 * hit / len(pairs), hit, len(pairs)))
    print("candidate count among hits:", sorted(ambig.items())[:8])
    print("miss by last tag:", miss.most_common(12))
    print("sample misses:", misses[:40])
