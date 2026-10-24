"""Word-level Japanese and Mandarin readings: coverage spike (2026-10-24).

Not part of the build. Run: PYTHONIOENCODING=utf-8 python pipeline/spike_word_readings.py

Sources: the English-Wiktionary Japanese and Chinese dumps from kaikki.org
(pipeline/cache/kaikki-Japanese.jsonl, kaikki-Chinese.jsonl). Japanese kana
come from the entry's head template (ja-noun 国民 -> こくみん); an entry's
kyujitai forms (國民) are joined to it, and every spelling is canonicalized
through variants.json so 国民 meets the words.json key 國民. Mandarin pinyin
come from the entry's Mandarin Pinyin pronunciation (大學 -> dàxué).

Measured per words.json frequency band: share of words with a Japanese
reading, with a Mandarin reading, and (Mandarin) how often the
per-character alignment through the hangul, the roadmap's original plan,
disagrees with the attested word reading.
"""

import collections
import io
import json
import re
import unicodedata

ROOT = "D:/Code/Hanja/"
L = lambda n: json.load(io.open(ROOT + "extension/data/" + n, encoding="utf-8"))
words, variants, sino = L("words.json"), L("variants.json"), L("sino.json")
wt, vmap, sc = words["words"], variants["map"], sino["chars"]
canon = lambda s: "".join(vmap.get(c, c) for c in unicodedata.normalize("NFC", s))
HAN2 = re.compile(r"^[\u3400-\u9fff\uf900-\ufaff\U00020000-\U0003134f]{2,}$")
KANA = re.compile(r"[\u3041-\u3096\u30a1-\u30fa\u30fc]")
PINYIN = re.compile(r"^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüê' ]+$", re.I)


def kana_of(arg):
    k = "".join(KANA.findall(arg or ""))
    return k or None


ja = collections.defaultdict(list)
with open(ROOT + "pipeline/cache/kaikki-Japanese.jsonl", encoding="utf-8") as f:
    for line in f:
        o = json.loads(line)
        w = o.get("word") or ""
        if not HAN2.match(w) or o.get("pos") in ("character", "soft-redirect"):
            continue
        reads = []
        for h in o.get("head_templates") or []:
            if (h.get("name") or "").startswith("ja-"):
                k = kana_of((h.get("args") or {}).get("1"))
                if k and k not in reads:
                    reads.append(k)
        if not reads:
            continue
        spellings = {w} | {x.get("form") for x in (o.get("forms") or [])
                           if "kyūjitai" in (x.get("tags") or []) and HAN2.match(x.get("form") or "")}
        for sp in spellings:
            for r in reads:
                if r not in ja[canon(sp)]:
                    ja[canon(sp)].append(r)

zh = {}
with open(ROOT + "pipeline/cache/kaikki-Chinese.jsonl", encoding="utf-8") as f:
    for line in f:
        if '"Pinyin"' not in line:
            continue
        o = json.loads(line)
        w = o.get("word") or ""
        if not HAN2.match(w):
            continue
        pins = [s.get("zh_pron") for s in (o.get("sounds") or [])
                if "Mandarin" in (s.get("tags") or []) and "Pinyin" in (s.get("tags") or [])]
        pins = [p for p in pins if p and PINYIN.match(p)]
        if pins and canon(w) not in zh:
            zh[canon(w)] = pins[0]


def strip_tones(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn").replace(" ", "").replace("'", "")


def aligned(word, hangul):
    if len(word) != len(hangul):
        return None
    out = []
    for ch, syl in zip(word, hangul):
        pairs = (sc.get(ch) or {}).get("zh") or []
        hit = [r for r, e in pairs if e == syl] or ([pairs[0][0]] if len(pairs) == 1 else [])
        if not hit:
            return None
        out.append(hit[0])
    return "".join(out)


band_of = lambda f: "f0-4" if f <= 4 else "f5-6" if f <= 6 else "f7-9" if f <= 9 else "unranked"
tot, ja_ok, zh_ok, zh_cmp, zh_bad = (collections.Counter() for _ in range(5))
bad_ex, miss_ja = [], []
for k, raw in wt.items():
    es = raw if isinstance(raw, list) else [raw]
    f = min((e.get("f", 99) for e in es if isinstance(e, dict)), default=99)
    b = band_of(f)
    tot[b] += 1
    if k in ja:
        ja_ok[b] += 1
    elif f <= 4 and len(miss_ja) < 15:
        miss_ja.append(k)
    if k in zh:
        zh_ok[b] += 1
        a = aligned(k, es[0].get("hangul", ""))
        if a is not None:
            zh_cmp[b] += 1
            if strip_tones(a) != strip_tones(zh[k]) or unicodedata.normalize("NFC", a) != unicodedata.normalize("NFC", zh[k].replace(" ", "")):
                if strip_tones(a) != strip_tones(zh[k]):
                    zh_bad[b] += 1
                    if f <= 6 and len(bad_ex) < 15:
                        bad_ex.append((k, a, zh[k]))

print("Japanese entries with kana: %s spellings; Chinese entries with pinyin: %s"
      % (format(len(ja), ","), format(len(zh), ",")))
print("%-9s %7s %8s %8s %18s" % ("band", "words", "ja", "zh", "aligned zh wrong"))
for b in ("f0-4", "f5-6", "f7-9", "unranked"):
    n = tot[b]
    print("%-9s %7s %7.1f%% %7.1f%% %10.1f%% of %s"
          % (b, format(n, ","), 100 * ja_ok[b] / n, 100 * zh_ok[b] / n,
             100 * zh_bad[b] / max(zh_cmp[b], 1), format(zh_cmp[b], ",")))
n = sum(tot.values())
print("%-9s %7s %7.1f%% %7.1f%%" % ("all", format(n, ","), 100 * sum(ja_ok.values()) / n, 100 * sum(zh_ok.values()) / n))
print("aligned-vs-attested disagreements (syllables differ, tones ignored):", bad_ex)
print("common words with no Japanese reading:", miss_ja)
print("samples:", [(w, ja.get(w), zh.get(w)) for w in ("國民", "學校", "音樂", "大學", "經濟", "明日", "電話", "事實")])


# --- Follow-up 1: union with the Japanese-language Wiktionary word list the
# build already parses (sino.collect_ja_word over ja-extract.jsonl.gz).
import gzip, sys
sys.path.insert(0, ROOT + "pipeline")
import sino as sino_mod
jw = {}
with gzip.open(ROOT + "pipeline/cache/ja-extract.jsonl.gz", "rt", encoding="utf-8") as f:
    for line in f:
        if '"lang_code": "ja"' in line:
            sino_mod.collect_ja_word(json.loads(line), jw)
ja2 = collections.defaultdict(set)
for w, d in jw.items():
    if d["kana"]:
        for sp in {w} | d["kyu"]:
            ja2[canon(sp)] |= d["kana"]
uni = collections.Counter(); only_old = []
for k, raw in wt.items():
    es = raw if isinstance(raw, list) else [raw]
    b = band_of(min((e.get("f", 99) for e in es if isinstance(e, dict)), default=99))
    if k in ja or k in ja2:
        uni[b] += 1
    if k in ja2 and k not in ja and len(only_old) < 10:
        only_old.append((k, sorted(ja2[k])))
print("\nJapanese, English dump plus the Japanese-language dump:")
for b in ("f0-4", "f5-6", "f7-9", "unranked"):
    print("  %-9s %5.1f%%" % (b, 100 * uni[b] / tot[b]))
print("  all       %5.1f%%" % (100 * sum(uni.values()) / sum(tot.values())))
print("  found only in the Japanese-language dump, e.g.:", only_old)

# --- Follow-up 2: what the attested words say about each character's
# Mandarin reading order on the character cards (sino.json zh pairs).
def split_pinyin(word, pin):
    rest = strip_tones(pin)
    out = []
    for ch in word:
        cands = [(strip_tones(r), r) for r, _e in ((sc.get(ch) or {}).get("zh") or [])]
        cands.sort(key=lambda c: -len(c[0]))
        hit = next((r for t, r in cands if t and rest.startswith(t)), None)
        if hit is None:
            return None
        out.append(hit)
        rest = rest[len(strip_tones(hit)):]
    return out if rest == "" else None

use = collections.defaultdict(collections.Counter)
for w, p in zh.items():
    parts = split_pinyin(w, p)
    if parts:
        for ch, r in zip(w, parts):
            use[ch][r] += 1
flip, tie, decided = [], 0, 0
hj = L("hanja.json")["chars"]
for ch, e in sc.items():
    pairs = e.get("zh") or []
    if len(pairs) != 2:
        continue
    a, b2 = pairs[0][0], pairs[1][0]
    ua, ub = use[ch][a], use[ch][b2]
    if ua == ub:
        tie += 1
        continue
    decided += 1
    if ub > ua:
        flip.append((ch, hj.get(ch, {}).get("lvl"), a, ua, b2, ub))
school = [x for x in flip if x[1] in ("m", "h")]
print("\nCharacter cards with two Mandarin readings: %d decided by word usage, %d tied or unattested" % (decided, tie))
print("  order would flip on %d (school-level %d), e.g.:" % (len(flip), len(school)), school[:16])
