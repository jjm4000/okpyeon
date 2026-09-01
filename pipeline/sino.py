#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sibling Sino readings (SPEC "Sibling Sino readings" ADDENDUM 2026-08-31).

Builds extension/data/sino.json: for each dictionary character, the same
Sino root's sound in Japanese (on'yomi) and Mandarin (pinyin), each reading
paired with the card eum it corresponds to. Alignment is baked here at
build time; the runtime never sorts.

Local module of pipeline/build.py, stdlib only, the decomp.py precedent:
pure functions, build.py orchestrates and emits. The mechanisms were
settled by the 2026-08-31 spike (sino-spike-extract/-align/-gates34);
this module is their promotion, not a re-derivation.
"""

from __future__ import annotations

import collections
import html
import itertools
import re
import unicodedata

# Per language, at most this many readings ship (SPEC: cap TWO, applied
# after ordering).
CAP = 2

# Tier 2 (non-joyo chars): a reading is attested by at least this many
# distinct aligned kaikki words. NO frequency band: the spike killed the
# planned top-K gate because the ja frequency list is too weak to gate on
# (34,504 badly tokenized entries; even 醤油 is absent), and N=5 would
# wrongly lose 醬 (admitted with 4 words). It weights ordering ONLY.
TIER2_MIN_WORDS = 3

# ---------------------------------------------------------------- script sets

KATA = re.compile(r"^[ァ-ヶー]+$")
KANA_ONLY = re.compile(r"^[぀-ゟ゠-ヿー]+$")
HAN_ANY = re.compile(r"[㐀-鿿豈-﫿\U00020000-\U0002FFFF]")
# The bridge walks words.json keys index by index, so its words must be
# all-Han and BMP (words.json keys are).
HAN_WORD = re.compile(r"^[㐀-鿿豈-﫿]+$")


def to_kata(s):
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c
                   for c in s)


# ---------------------------------------------------------------- kana aligner

# The regular sound changes a base on'yomi undergoes inside a compound.
VOICE = {"カ": "ガ", "キ": "ギ", "ク": "グ", "ケ": "ゲ", "コ": "ゴ",
         "サ": "ザ", "シ": "ジ", "ス": "ズ", "セ": "ゼ", "ソ": "ゾ",
         "タ": "ダ", "チ": "ヂ", "ツ": "ヅ", "テ": "デ", "ト": "ド",
         "ハ": "バ", "ヒ": "ビ", "フ": "ブ", "ヘ": "ベ", "ホ": "ボ"}
VOICE_ALT = {"チ": "ジ", "ツ": "ズ"}   # modern spellings of ヂ/ヅ
PFORM = {"ハ": "パ", "ヒ": "ピ", "フ": "プ", "ヘ": "ペ", "ホ": "ポ"}


def surface_forms(base, kana_pos, prev_kana):
    """(surface, cost) shapes a base on'yomi can take at this position.
    Identity costs 0; each transform (rendaku, p-form, sokuon) costs 1."""
    outs = {base: 0}
    if kana_pos > 0:
        v = VOICE.get(base[0])
        if v:
            outs.setdefault(v + base[1:], 1)
        v2 = VOICE_ALT.get(base[0])
        if v2:
            outs.setdefault(v2 + base[1:], 1)
        if prev_kana in "ッン" and base[0] in PFORM:
            outs.setdefault(PFORM[base[0]] + base[1:], 1)
    for f, c in list(outs.items()):
        if len(f) >= 2 and f[-1] in "クキツチ":
            outs.setdefault(f[:-1] + "ッ", c + 1)
    return outs


# ---------------------------------------------------------------- ja corpus

# Form tags on the kaikki ja extract. Single-char entries leak the char's
# whole dictionary reading table as transliteration-tagged forms; a row
# carrying a reading-type tag is such a dictionary row, not a word
# attestation, and MUST be excluded (SPEC).
READING_TYPE_TAGS = frozenset({"kun", "ko-kun", "go-on", "kan-on", "to-on",
                               "kan'yo-on", "kanyo-on", "on"})
BAD_FORM_TAGS = frozenset({"rare", "obsolete", "archaic", "historical",
                           "dated"})


def collect_ja_word(o, words):
    """Harvest one kaikki ja entry into words: word -> {"kana", "kyu"} sets.

    Called from build.py's single pass over ja-extract.jsonl.gz, so the
    61 MB gz is only ever decompressed once per build.
    """
    if o.get("lang_code") != "ja":
        return
    w = o.get("word") or ""
    if not HAN_ANY.search(w) or len(w) > 8:
        return
    if o.get("pos") == "character":
        return
    kana, kyu = set(), set()
    for f in o.get("forms") or []:
        form = f.get("form") or ""
        tags = set(f.get("tags") or [])
        if "transliteration" in tags and KANA_ONLY.match(form):
            if tags & BAD_FORM_TAGS:
                continue
            if len(w) == 1 and tags & READING_TYPE_TAGS:
                continue
            kana.add(form)
        # kyujitai spellings bridge glyph twins that variants.json lacks
        # (説 words carry 說 forms), see the compound bridge below.
        if ("kyūjitai" in tags or "kyujitai" in tags) and HAN_ANY.search(form):
            kyu.add(form)
    if not kana and not kyu:
        return
    d = words.setdefault(w, {"kana": set(), "kyu": set()})
    d["kana"] |= kana
    d["kyu"] |= kyu


# ---------------------------------------------------------------- joyo table

RE_JOYO_WIKT = re.compile(r"\[\[wikt:([^#|\]]+)#Japanese")
RE_JOYO_ROW = re.compile(r"^\|\d+\|\|")
RE_JOYO_REF = re.compile(r"<ref[^<]*(</ref>|/>)")
RE_JOYO_TMPL = re.compile(r"\{\{[^}]*\}\}")


def _reading_tokens(cell):
    """[(katakana token, restricted)] in cell order. Parenthesized readings
    are restricted-use but REAL joyo readings: they stay in the set and the
    flag only pushes them to the back of the source order at emit time."""
    out = []
    tok, depth = "", 0
    for ch in cell + "、":
        if ch in "（(":
            if tok.strip():
                out.append((tok.strip(), depth > 0))
            tok, depth = "", depth + 1
        elif ch in "）)":
            if tok.strip():
                out.append((tok.strip(), depth > 0))
            tok, depth = "", max(0, depth - 1)
        elif ch in "、，,":
            if tok.strip():
                out.append((tok.strip(), depth > 0))
            tok = ""
        else:
            tok += ch
    return [(t, r) for t, r in out if KATA.match(t)]


def parse_joyo(text):
    """The Wikipedia joyo table -> (joyo_on, joyo_restricted, old2new, rows).

    joyo_on: new form -> [on'yomi in table order] (katakana tokens of the
    readings cell, before the first <br>; kun readings are hiragana and drop
    out). old2new: kyujitai column -> new form; the old forms map straight
    onto our canonical chars. Parsed through html.unescape because five
    chars ship as hex entities (児 舎 奨 麦 晩).
    """
    joyo_on, joyo_restricted, old2new = {}, {}, {}
    rows = 0
    for line in text.split("\n"):
        if not RE_JOYO_ROW.match(line):
            continue
        line = html.unescape(line)
        cells = line.rstrip("\n").split("||")
        if len(cells) < 9:
            continue
        m = RE_JOYO_WIKT.search(cells[1])
        if not m:
            continue
        new = m.group(1)
        m2 = RE_JOYO_WIKT.search(cells[2])
        if m2:
            old2new[m2.group(1)] = new
        kana_part = cells[-1].split("<br")[0]
        kana_part = RE_JOYO_REF.sub("", kana_part)
        kana_part = RE_JOYO_TMPL.sub("", kana_part)
        toks = _reading_tokens(kana_part)
        ons = []
        for t, _ in toks:
            if t not in ons:
                ons.append(t)
        joyo_on[new] = ons
        joyo_restricted[new] = {t for t, r in toks if r}
        rows += 1
    return joyo_on, joyo_restricted, old2new, rows


# ---------------------------------------------------------------- Unihan

def parse_readings(text):
    """Unihan_Readings.txt -> (unihan_on, kmandarin, kxhc, pinlu).

    unihan_on keeps only the katakana tokens of kJapanese: on'yomi are
    katakana there, kun'yomi hiragana. kXHC1983 positions are stripped to
    the bare readings. kHanyuPinlu is reading -> corpus count.
    """
    unihan_on, kmandarin, kxhc, pinlu = {}, {}, {}, {}
    for line in text.split("\n"):
        if not line or line[0] == "#" or "\t" not in line:
            continue
        cp, field, val = line.rstrip("\r").split("\t", 2)
        if field not in ("kJapanese", "kMandarin", "kXHC1983", "kHanyuPinlu"):
            continue
        try:
            ch = chr(int(cp[2:], 16))
        except ValueError:
            continue
        if field == "kJapanese":
            ons = [t for t in val.split() if KATA.match(t)]
            if ons:
                unihan_on[ch] = ons
        elif field == "kMandarin":
            kmandarin[ch] = val.split()
        elif field == "kXHC1983":
            rs = []
            for seg in val.split():
                r = seg.split(":")[-1]
                if r not in rs:
                    rs.append(r)
            kxhc[ch] = rs
        else:
            d = {}
            for seg in val.split():
                m = re.match(r"(.+)\((\d+)\)$", seg)
                if m:
                    d[m.group(1)] = int(m.group(2))
            pinlu[ch] = d
    return unihan_on, kmandarin, kxhc, pinlu


def parse_zvariants(text):
    """Unihan_Variants.txt -> {char: kZVariant target}. REQUIRED in the
    bridging path: variants.json deliberately lacks glyph-twin links between
    two chars that both have their own entry (説 and 說), which would
    otherwise silently orphan such chars from the compound bridge."""
    zvar = {}
    for line in text.split("\n"):
        if "\tkZVariant\t" not in line:
            continue
        cp, _, val = line.rstrip("\r").split("\t", 2)
        tgt = val.split()[0].split("<")[0]
        zvar[chr(int(cp[2:], 16))] = chr(int(tgt[2:], 16))
    return zvar


def parse_ja_freq(text):
    """word -> OpenSubtitles count. Ordering weight ONLY, never a gate:
    the list is badly tokenized (spike-measured WEAK)."""
    freq = {}
    for line in text.split("\n"):
        parts = line.split()
        if len(parts) == 2 and parts[0] not in freq:
            try:
                freq[parts[0]] = int(parts[1])
            except ValueError:
                pass
    return freq


# ------------------------------------------------- Korean initial-sound law

ONSET_COUNT, VOWEL_COUNT, CODA_COUNT = 19, 21, 28


def _decompose(syl):
    code = ord(syl) - 0xAC00
    if code < 0 or code > 11171:
        return None
    return code // 588, (code % 588) // 28, code % 28


def _compose(o, v, c):
    return chr(0xAC00 + o * 588 + v * 28 + c)


IY_VOWELS = {2, 3, 6, 7, 12, 17, 20}  # ya yae yeo ye yo yu i


def norm_eum(eum, rset):
    """Duum-law variants (낙/락, 여/녀) collapse onto the ㄹ/ㄴ dictionary
    form when the char also lists it; all pairings are stated over that."""
    d = _decompose(eum)
    if not d:
        return eum
    o, v, c = d
    cands = []
    if o == 2:                        # ㄴ -> ㄹ (any vowel)
        cands = [_compose(5, v, c)]
    elif o == 11 and v in IY_VOWELS:  # ㅇ -> ㄹ/ㄴ only on the i/y row
        cands = [_compose(5, v, c), _compose(2, v, c)]
    for x in cands:
        if x in rset:
            return x
    return eum


def duum_candidates(syl, initial):
    """Surface syllable -> possible canonical eums (initial position only)."""
    outs = {syl}
    if not initial:
        return outs
    d = _decompose(syl)
    if not d:
        return outs
    o, v, c = d
    if o == 2:                # ㄴ surface: canonical may be ㄹ
        outs.add(_compose(5, v, c))
    if o == 11:               # ㅇ surface: canonical may be ㄹ or ㄴ
        if v in IY_VOWELS or v == 20 or v == 8:
            outs.add(_compose(5, v, c))
            outs.add(_compose(2, v, c))
    return outs


# ------------------------------------------------- Mandarin correspondence

def strip_tone(p):
    s = unicodedata.normalize("NFD", p)
    return "".join(c for c in s if not unicodedata.combining(c))


INITIALS = ["zh", "ch", "sh", "b", "p", "m", "f", "d", "t", "n", "l",
            "g", "k", "h", "j", "q", "x", "r", "z", "c", "s", "y", "w"]


def pinyin_parts(p):
    b = strip_tone(p).lower()
    for ini in INITIALS:
        if b.startswith(ini):
            return ini, b[len(ini):]
    return "", b


# Korean onset index -> plausible pinyin initials, by strength. The class
# table the SPEC points at: MC-derived correspondences (ㄹ↔l, null-ㅇ↔y/w,
# palatalized ㄱ↔j beside plain ㄱ↔g/k, and the rest).
ONSET_MAP = {
    0:  {"g": 2, "k": 2, "j": 2, "q": 1, "h": 1, "x": 1},             # ㄱ
    1:  {"g": 2, "k": 2},                                             # ㄲ
    2:  {"n": 2},                                                     # ㄴ
    3:  {"d": 2, "t": 2, "zh": 1, "ch": 1},                           # ㄷ
    5:  {"l": 2},                                                     # ㄹ
    6:  {"m": 2, "w": 1},                                             # ㅁ
    7:  {"b": 2, "p": 2, "f": 2},                                     # ㅂ
    9:  {"s": 2, "sh": 2, "x": 2, "c": 1, "ch": 1, "z": 1},           # ㅅ
    10: {"s": 2, "sh": 2},                                            # ㅆ
    11: {"": 2, "y": 2, "w": 2, "r": 2, "e": 1, "n": 1},              # ㅇ
    12: {"z": 2, "zh": 2, "j": 2, "c": 1, "ch": 1, "q": 1, "sh": 1},  # ㅈ
    14: {"c": 2, "ch": 2, "q": 2, "z": 1, "zh": 1, "j": 1, "sh": 1},  # ㅊ
    15: {"k": 2, "q": 1, "g": 1},                                     # ㅋ
    16: {"t": 2, "d": 1},                                             # ㅌ
    17: {"p": 2, "f": 2, "b": 1},                                     # ㅍ
    18: {"h": 2, "x": 2, "f": 1},                                     # ㅎ
}

# Vowel nucleus bonus (small; breaks ties like 독/두 vs du/dou).
NUC_BONUS = {0: {"a": 1, "ia": 1, "e": .5, "ue": .5, "o": .25},
             1: {"ai": 1, "e": .75, "ie": .5, "a": .5, "i": .25},
             4: {"e": .5, "uo": .5, "o": .5, "u": .25},
             5: {"e": 1, "i": .5},
             6: {"ie": 1, "e": .5, "ua": .25, "i": .25, "u": .25},
             8: {"o": 1, "uo": 1, "u": .75, "ao": .5, "ou": .25},
             9: {"ua": 1, "uo": .5, "a": .5},
             11: {"ui": 1, "uei": 1, "uai": .5},
             12: {"iao": 1, "ue": .5, "iu": .5, "ao": .5, "u": .25},
             13: {"u": .75, "ou": 1, "iu": .5, "o": .25},
             16: {"ui": 1, "uei": 1},
             17: {"iu": 1, "u": .75, "ou": .25},
             18: {"i": .5, "u": .25, "e": .25},
             19: {"i": .75, "ei": .5},
             20: {"i": 1, "ei": .5, "ai": .25, "": .25}}


def score_eum_py(eum, py):
    """Correspondence score of one eum against one toneless pinyin."""
    d = _decompose(eum)
    if not d:
        return -9
    o, v, c = d
    ini, fin = pinyin_parts(py)
    s = 0.0
    m = ONSET_MAP.get(o, {})
    if ini in m:
        s += m[ini]
    elif ini == "" and "y" in m:
        s += 1
    else:
        s -= 1
    nuc = fin[:-2] if fin.endswith("ng") else \
        (fin[:-1] if fin.endswith("n") else fin)
    s += NUC_BONUS.get(v, {}).get(nuc, 0)
    nasal = fin.endswith("n") or fin.endswith("ng")
    if c == 0:                          # open eum
        s += 1 if not nasal else -2
    elif c in (1, 8, 17):               # ㄱ ㄹ ㅂ codas: MC stops, zh open
        s += 1 if not nasal else -2
    elif c in (4, 16):                  # ㄴ ㅁ -> -n
        if fin.endswith("ng"):
            s -= 1
        elif fin.endswith("n"):
            s += 2
        else:
            s -= 2
    elif c == 21:                       # ㅇ coda -> -ng
        if fin.endswith("ng"):
            s += 2
        elif fin.endswith("n"):
            s -= 1
        else:
            s -= 2
    return s


def tone_groups(pys, km_set, pl):
    """[(representative, [members])] grouped by toneless base, in first-
    appearance order. The scorer cannot hear tones, and tone-only
    alternates (è/ě) are one correspondence class. Representative: the
    kMandarin reading if in the group, else the highest kHanyuPinlu count,
    else the first listed."""
    order, groups = [], {}
    for p in pys:
        base = strip_tone(p).lower()
        if base not in groups:
            groups[base] = []
            order.append(base)
        if p not in groups[base]:
            groups[base].append(p)
    out = []
    for base in order:
        members = groups[base]
        rep = next((p for p in members if p in km_set), None)
        if rep is None:
            rep = max(members,
                      key=lambda p: (pl.get(p, 0), -members.index(p)))
        out.append((rep, members))
    return out


def zh_assign(eums, reps):
    """Best injective assignment eums -> tone-group representatives.
    Returns (pairs, margin); margin <= 0 means the best assignment is tied
    and nothing may be trusted from it."""
    eums = list(dict.fromkeys(eums))[:4]
    reps = reps[:4]
    k = min(len(eums), len(reps))
    best = []
    for esub in itertools.combinations(eums, k):
        for perm in itertools.permutations(reps, k):
            tot = sum(score_eum_py(e, p) for e, p in zip(esub, perm))
            # card order is evidence: a later eum must clearly beat an
            # earlier one to displace it from the assignment
            tot -= 0.75 * sum(eums.index(e) - i
                              for i, e in enumerate(esub))
            best.append((tot, list(zip(esub, perm))))
    best.sort(key=lambda t: -t[0])
    if not best:
        return [], 99
    if len(best) == 1:
        return best[0][1], 99
    return best[0][1], best[0][0] - best[1][0]


# ------------------------------------------------- direct ja-zh check

# Property test 2 composes the bridge's eum->on'yomi map with the scorer's
# eum->pinyin map and re-checks the induced on'yomi<->pinyin pairing with
# the same MC class logic applied DIRECTLY between ja and zh, no Korean in
# the loop. Ties tolerated; disagreements reported for curation, never
# silently resolved.
KANA_INI = {}
for _row, _ini in [("カキクケコァャュョ", "k"), ("ガギグゲゴ", "g"),
                   ("サシスセソ", "s"), ("ザジズゼゾ", "z"),
                   ("タチツテト", "t"), ("ダヂヅデド", "d"),
                   ("ナニヌネノ", "n"), ("ハヒフヘホ", "h"),
                   ("バビブベボ", "b"), ("パピプペポ", "p"),
                   ("マミムメモ", "m"), ("ヤユヨ", "y"),
                   ("ラリルレロ", "r"), ("ワヰヱヲ", "w"),
                   ("アイウエオ", "")]:
    for _ch in _row:
        KANA_INI[_ch] = _ini

JAZH_INI = {
    "k": {"g": 2, "k": 2, "j": 2, "q": 2, "h": 2, "x": 2},
    "g": {"y": 2, "w": 2, "": 2, "e": 2, "g": 1, "k": 1, "j": 1, "q": 1,
          "h": 1, "x": 1, "n": 1},
    "s": {"s": 2, "sh": 2, "x": 2, "z": 1, "zh": 1, "j": 1, "c": 1,
          "ch": 1, "q": 1},
    "z": {"z": 2, "zh": 2, "j": 2, "s": 1, "sh": 1, "x": 1, "c": 1,
          "ch": 1, "q": 1},
    "t": {"t": 2, "d": 2, "zh": 1, "ch": 1},
    "d": {"d": 2, "t": 1, "zh": 2, "ch": 1, "n": 1, "y": 1},
    "n": {"n": 2, "r": 2},
    "h": {"f": 2, "b": 2, "p": 2, "h": 1},
    "b": {"f": 2, "b": 2, "p": 2, "m": 1, "w": 1},
    "p": {"f": 2, "b": 2, "p": 2},
    "m": {"m": 2, "w": 2},
    "y": {"y": 2, "": 2, "e": 1, "w": 1},
    "r": {"l": 2},
    "w": {"w": 2, "y": 1, "": 1, "h": 1},
    "": {"y": 2, "w": 2, "": 2, "e": 2},
}


def jazh_score(on, py):
    ini, fin = pinyin_parts(py)
    s = 0.0
    ji = KANA_INI.get(on[0], None)
    if ji is None:
        return -9
    s += JAZH_INI.get(ji, {}).get(ini, -1)
    nasal = fin.endswith("n") or fin.endswith("ng")
    if len(on) >= 2 and on[-1] in "クキツチ" or on.endswith("ッ"):
        s += 1 if not nasal else -2
    elif on.endswith("ン"):
        if fin.endswith("n"):
            s += 2
        elif fin.endswith("ng"):
            s -= 1
        else:
            s -= 2
    elif on.endswith("ウ"):
        s += 1 if fin.endswith("ng") else 0
    else:
        s += 0.5 if not nasal else -1
    return s


# ------------------------------------------------- curated zh overrides

# The scorer's ambiguous chars (SPEC: the 26 school-level ties, 行 among
# them) resolved by hand: eum -> the exact pinyin that eum descends from.
# The named pinyin also becomes its tone group's display representative
# (宿: the 별자리 eum 수 is xiù, not the group's kMandarin pick xiǔ). An
# eum the table leaves out has no Mandarin sibling in the char's reading
# set and stays untagged. NOT_RARE discipline: every entry must fire during
# the build, and an entry whose char the scorer meanwhile resolves on its
# own is dead; either aborts the build (see the SystemExit in build) so the
# curation is re-reviewed rather than silently drifting.
SINO_ZH_OVERRIDES = {
    "伯": {"백": "bó"},                   # 우두머리 패 is bà, absent from the set
    "似": {"사": "sì"},                   # shì lives only in 似的
    "兒": {"아": "ér", "예": "ní"},       # 다시 난 이 예 = the 郳/倪 reading ní
    "冒": {"모": "mào", "목": "mò"},      # 목 keeps the entering -k: 冒頓 mò
    "券": {"권": "quàn"},                 # xuàn (arched) has no Korean sibling
    "堤": {"제": "dī"},                   # 제방 堤防 dīfáng
    "宿": {"숙": "sù", "수": "xiù"},      # 별자리 수 = xiù, the star lodge
    "尺": {"척": "chǐ"},                  # chě is the gongche note
    "巷": {"항": "xiàng"},                # one MC source; xiàng is the live one
    "思": {"사": "sī"},                   # sāi (cheek) has no Korean sibling
    "折": {"절": "zhé"},                  # 절 = the break morpheme zhé/shé
    "提": {"제": "tí"},                   # dī lives only in 提防
    "於": {"어": "yú", "오": "wū"},       # 어조사 어 / 감탄사 오 (於乎 wūhū)
    "暴": {"포": "bào", "폭": "pù"},      # 폭 keeps the entering -k
    "泊": {"박": "bó"},                   # 정박 停泊 tíngbó; pō is 湖泊
    "番": {"번": "fān", "반": "pān"},     # 땅 이름 반 = 番禺 Pānyú
    "省": {"성": "xǐng", "생": "shěng"},  # 반성 fǎnxǐng / 생략 shěnglüè
    "般": {"반": "bān"},                  # 일반 一般 yìbān
    "若": {"약": "ruò", "야": "rě"},      # 반야 般若 bōrě
    "莫": {"막": "mò", "모": "mù"},       # 저물 모 = the 暮 sense mù
    "著": {"저": "zhù"},                  # 저자 著者 zhùzhě
    "行": {"행": "xíng", "항": "háng"},   # the bridge cannot place 항 either:
                                          # both its eums use コウ in Japanese
    "誰": {"수": "shuí"},
    "趣": {"취": "qù", "축": "cù"},       # 축 = the 促-like cù
    "食": {"식": "shí", "사": "sì", "이": "yì"},   # 簞食 사 / 酈食其 이
    "鳥": {"조": "niǎo"},                 # diǎo is the vulgar homophone
}


# ---------------------------------------------------------------- build

def build(chars, variants, words_ko, joyo_text, readings_text,
          variants_text, ja_freq_text, ja_words):
    """-> (sino_obj, report).

    chars: the finished hanja.json chars dict (readings order is the card's
    eum order, the master the SPEC aligns everything to). variants: the
    variants.json map. words_ko: the finished words.json words dict (the
    compound bridge's Korean side). ja_words: the harvest collect_ja_word
    gathered on build.py's ja-extract pass.
    """
    joyo_on, joyo_restricted, old2new, joyo_rows = parse_joyo(joyo_text)
    unihan_on, kmandarin, kxhc, pinlu = parse_readings(readings_text)
    zvar = parse_zvariants(variants_text)
    freq_count = parse_ja_freq(ja_freq_text)

    def canon(ch):
        if ch in chars:
            return ch
        v = variants.get(ch)
        return v if v in chars else None

    def eums_of(cc):
        return chars[cc]["readings"]

    def norm_eums(cc):
        rs = eums_of(cc)
        out = []
        for r in rs:
            n = norm_eum(r, set(rs))
            if n not in out:
                out.append(n)
        return out

    rev = collections.defaultdict(set)
    for v, t in variants.items():
        rev[t].add(v)

    def joyo_form(cc):
        """The joyo new form whose reading set covers this canonical char,
        or None. Checked through the kyujitai column, the variants map, and
        kZVariant: the table's 説 row has an EMPTY old-form cell and
        variants.json lacks glyph-twin links between two chars that both
        have entries, so without the kZVariant hop 說 (and 娛 悅 稅 銳 and
        three more) would be orphaned from tier 1. Deterministic (sorted)
        over the variant fan-in."""
        for c in [cc, zvar.get(cc)] + sorted(rev.get(cc, ())):
            if not c:
                continue
            if c in joyo_on:
                return c
            n = old2new.get(c)
            if n in joyo_on:
                return n
        return None

    # ---- candidate on'yomi per corpus char --------------------------
    cand_cache = {}

    def cands_of(ch):
        got = cand_cache.get(ch)
        if got is None:
            got = []
            seen = set()
            for source_ch in (ch, old2new.get(ch), variants.get(ch)):
                if not source_ch:
                    continue
                for r in (joyo_on.get(source_ch, [])
                          + unihan_on.get(source_ch, [])):
                    if r not in seen:
                        seen.add(r)
                        got.append(r)
            # a kyujitai in our canonical set may have its readings keyed
            # under the shinjitai form
            c = canon(ch)
            if c and c != ch:
                for r in joyo_on.get(c, []) + unihan_on.get(c, []):
                    if r not in seen:
                        seen.add(r)
                        got.append(r)
            cand_cache[ch] = got
        return got

    # ---- align every kaikki word's kana against candidate on'yomi ----
    def align(word, kana):
        """The single best parse ([(char, base on'yomi)] over the kanji
        positions) or None. Best = lowest total transform cost, ties broken
        by candidate priority (joyo order first, then Unihan order). Words
        that do not align (jukujikun: 今日) are skipped, never guessed."""
        kana = to_kata(kana)
        wchars = list(word)
        if "々" in word or "ヶ" in word or "ゝ" in word:
            return None
        parses = []

        def rec(ci, kp, cost, idxs, acc):
            if len(parses) >= 32:
                return
            if ci == len(wchars):
                if kp == len(kana):
                    parses.append((cost, tuple(idxs), tuple(acc)))
                return
            ch = wchars[ci]
            if not HAN_ANY.search(ch):
                lit = to_kata(ch)
                if kana.startswith(lit, kp):
                    rec(ci + 1, kp + len(lit), cost, idxs, acc)
                return
            prev = kana[kp - 1] if kp > 0 else ""
            for i, base in enumerate(cands_of(ch)):
                for f, c in surface_forms(base, kp, prev).items():
                    if kana.startswith(f, kp):
                        rec(ci + 1, kp + len(f), cost + c, idxs + [i],
                            acc + [(ch, base)])

        rec(0, 0, 0, [], [])
        if not parses:
            return None
        return list(min(parses)[2])

    # kana/kyu sets become sorted lists here so every later float sum and
    # first-match probe walks in one fixed order (determinism).
    jaw = {w: (sorted(d["kana"]), sorted(d["kyu"]))
           for w, d in ja_words.items() if d["kana"]}
    word_parse = {}
    n_skipped = 0
    for w, (kanas, _) in jaw.items():
        got = []
        for kana in kanas:
            p = align(w, kana)
            if p:
                got.append(p)
        if got:
            word_parse[w] = got
        else:
            n_skipped += 1

    # ---- attestation votes ------------------------------------------
    # votes1: joyo new-form space, frequency-listed words only; feeds
    # property test 1. votes2: canonical char space, every aligned word;
    # feeds tier 2 attestation and the ordering weight.
    votes1 = collections.defaultdict(lambda: collections.defaultdict(float))
    words1 = collections.defaultdict(lambda: collections.defaultdict(set))
    votes2 = collections.defaultdict(lambda: collections.defaultdict(float))
    words2 = collections.defaultdict(lambda: collections.defaultdict(set))
    for w, ps in word_parse.items():
        cnt = freq_count.get(w)
        for parse in ps:
            frac = 1.0 / len(ps)
            for ch, base in parse:
                jch = old2new.get(ch, ch)
                if cnt:
                    votes1[jch][base] += cnt * frac
                    words1[jch][base].add(w)
                cc = canon(ch)
                if cc:
                    votes2[cc][base] += (cnt or 0) * frac
                    words2[cc][base].add(w)

    # ---- property test 1: joyo validation floor ---------------------
    seen_joyo = [c for c in joyo_on if joyo_on[c] and c in votes1]
    p1_ok, p1_bad = 0, []
    for c in seen_joyo:
        top = max(votes1[c].items(), key=lambda kv: kv[1])
        if top[0] in joyo_on[c]:
            p1_ok += 1
        else:
            ex = sorted(words1[c][top[0]],
                        key=lambda w: (-freq_count.get(w, 0), w))[:3]
            p1_bad.append((votes1[c][top[0]], c, top[0], " ".join(ex)))
    p1_bad.sort(reverse=True)
    p1 = {"seen": len(seen_joyo), "ok": p1_ok,
          "pct": 100.0 * p1_ok / max(len(seen_joyo), 1),
          "exceptions": ["%s top=%s (w=%.0f, %s) joyo=%s"
                         % (c, r, wgt, ex, "/".join(joyo_on[c]))
                         for wgt, c, r, ex in p1_bad]}

    # ---- compound bridge --------------------------------------------
    # Shared spelled words vote, weighted by word frequency, on which eum
    # pairs with which on'yomi (음악 uses 악 and おんがく uses ガク, so
    # 악 <-> ガク). Evidence only, no phonology. Votes are attributed to
    # the words.json KEY char, which is canonical by construction.
    bridge = collections.defaultdict(lambda: collections.defaultdict(float))
    n_shared = 0
    for w, ps in word_parse.items():
        if not HAN_WORD.match(w):
            continue
        keys = []
        cs = "".join(canon(ch) or "?" for ch in w)
        if "?" not in cs:
            keys.append(cs)
            zs = "".join(zvar.get(ch, ch) for ch in cs)
            if zs != cs:
                keys.append(zs)
        for kf in jaw.get(w, ((), ()))[1]:
            if len(kf) == len(w):
                ks = "".join(canon(ch) or ch for ch in kf)
                if ks not in keys:
                    keys.append(ks)
        key = next((k for k in keys if k in words_ko), None)
        if not key:
            continue
        hangul = words_ko[key][0].get("hangul") or ""
        if len(hangul) != len(key):
            continue
        n_shared += 1
        wgt = freq_count.get(w, 0) + 1.0
        for parse in ps:
            if len(parse) != len(key):
                continue
            frac = 1.0 / len(ps)
            for i, (ch, on) in enumerate(parse):
                cc = key[i]
                if cc not in chars:
                    continue
                syl = hangul[i]
                cand = duum_candidates(syl, i == 0) & set(eums_of(cc))
                eum = cand.pop() if len(cand) == 1 else syl
                eum = norm_eum(eum, set(eums_of(cc)))
                bridge[cc][(eum, on)] += wgt * frac

    def bridge_assign(cc, ons, allowed_eums):
        """Greedy injective (eum -> on) assignment from bridge votes. Only
        eums the card actually lists may take part: a stray syllable from a
        jukujikun-ish hangul must not consume an on'yomi."""
        pairs = sorted(bridge.get(cc, {}).items(), key=lambda kv: -kv[1])
        used_e, used_o, out = set(), set(), []
        for (eum, on), wgt in pairs:
            if on not in ons or eum not in allowed_eums:
                continue
            if eum in used_e or on in used_o:
                continue
            used_e.add(eum)
            used_o.add(on)
            out.append((eum, on, wgt))
        return out

    # ---- per-char ja entry ------------------------------------------
    tier_of = {}

    def ja_entry(cc):
        """[[reading, eum], ...] in display order, or None. Two tiers, one
        mechanism: joyo chars keep the canonical joyo on'yomi set, never
        dropped even when the corpus undersamples one; beyond joyo a
        reading needs TIER2_MIN_WORDS distinct aligned kaikki words."""
        jf = joyo_form(cc)
        if jf is not None:
            ons = joyo_on[jf]
            if not ons:
                return None       # kun-only joyo char: no Sino sound to show
            restricted = joyo_restricted.get(jf, set())
            # source order: table order, restricted trailing unless the
            # corpus promotes them (the weight term below)
            base = ([r for r in ons if r not in restricted]
                    + [r for r in ons if r in restricted])
            tier_of[cc] = 1
        else:
            wl = words2.get(cc)
            if not wl:
                return None
            base = [r for r in cands_of(cc)
                    if len(wl.get(r, ())) >= TIER2_MIN_WORDS]
            if not base:
                return None
            tier_of[cc] = 2
        eums = norm_eums(cc)
        if len(eums) == 1:
            # single Sino eum: every on'yomi is a borrowing of the same
            # morpheme, so the pairing is trivial
            assign = {r: eums[0] for r in base}
        else:
            got = bridge_assign(cc, set(base), set(eums))
            assign = {on: eum for eum, on, _ in got}
        pos = {e: i for i, e in enumerate(eums)}
        src = {r: i for i, r in enumerate(base)}
        wgt = votes2.get(cc, {})

        def key(r):
            e = assign.get(r)
            return (0 if e is not None else 1,
                    pos.get(e, 0),
                    -wgt.get(r, 0.0),
                    src[r])

        ordered = sorted(base, key=key)[:CAP]
        return [[r, assign.get(r, "")] for r in ordered]

    # ---- per-char zh entry ------------------------------------------
    fired = collections.defaultdict(set)
    dead = []

    def zh_entry(cc):
        """[[pinyin, eum], ...] in display order, or None. The set is
        kMandarin plus kXHC1983's alternatives; assignment by the
        correspondence scorer, curated overrides where it ties."""
        pys = list(kmandarin.get(cc, []))
        for r in kxhc.get(cc, []):
            if r not in pys:
                pys.append(r)
        if not pys:
            return None
        groups = tone_groups(pys, set(kmandarin.get(cc, [])),
                             pinlu.get(cc, {}))
        eums = norm_eums(cc)
        pairs, margin = zh_assign(eums, [rep for rep, _ in groups])
        reps = [rep for rep, _ in groups]
        assign = {}                     # group index -> eum
        ov = SINO_ZH_OVERRIDES.get(cc)
        if ov is not None:
            if margin > 0:
                dead.append("%s (the scorer now resolves it unaided)" % cc)
            for eum, py in ov.items():
                gi = next((i for i, (_, members) in enumerate(groups)
                           if py in members), None)
                if eum not in eums or gi is None:
                    dead.append("%s(%s->%s)" % (cc, eum, py))
                    continue
                reps[gi] = py           # the curated pinyin is the display rep
                assign[gi] = eum
                fired[cc].add((eum, py))
        elif margin > 0:
            rep_pos = {rep: i for i, rep in enumerate(reps)}
            for eum, rep in pairs:
                assign[rep_pos[rep]] = eum
        pos = {e: i for i, e in enumerate(eums)}
        gwgt = [max((pinlu.get(cc, {}).get(p, 0) for p in members),
                    default=0) for _, members in groups]

        def key(gi):
            e = assign.get(gi)
            return (0 if e is not None else 1,
                    pos.get(e, 0),
                    -gwgt[gi],
                    gi)

        ordered = sorted(range(len(groups)), key=key)[:CAP]
        return [[reps[gi], assign.get(gi, "")] for gi in ordered]

    # ---- emit --------------------------------------------------------
    sino_chars = {}
    n_ja = n_zh = 0
    tier_counts = collections.Counter()
    tier2_lvl = collections.Counter()
    for cc in chars:
        entry = {}
        ja = ja_entry(cc)
        if ja:
            entry["ja"] = ja
            n_ja += 1
            tier_counts[tier_of[cc]] += 1
            if tier_of[cc] == 2:
                tier2_lvl[chars[cc]["lvl"]] += 1
        zh = zh_entry(cc)
        if zh:
            entry["zh"] = zh
            n_zh += 1
        if entry:
            sino_chars[cc] = entry

    for cc, ov in SINO_ZH_OVERRIDES.items():
        missed = set(ov.items()) - fired[cc]
        for eum, py in sorted(missed):
            tag = "%s(%s->%s)" % (cc, eum, py)
            if tag not in dead:
                dead.append(tag)
    if dead:
        # A dead override means the scorer or the data moved under the
        # table: the char stopped tying, or lost the eum or the reading.
        # Both deserve a human look, not a silent pass (NOT_RARE pattern).
        raise SystemExit("dead sino override(s): " + ", ".join(sorted(dead)))

    # ---- property test 2: bridge/scorer agreement -------------------
    # Both mechanisms emit injective partial maps eum -> reading; where
    # both align 2+ shared eums of a char, composing them yields
    # on'yomi <-> pinyin pairs, and they agree when no alternative pinyin
    # scores strictly higher for that on'yomi under the direct ja-zh check.
    shin2trad = {}
    for cc in chars:
        n = old2new.get(cc)
        if n and n != cc:
            shin2trad.setdefault(n, cc)

    def bridge_char(c):
        cc = canon(c)
        if cc and bridge.get(cc):
            return cc
        alt = shin2trad.get(c)
        if alt and bridge.get(alt):
            return alt
        return cc

    p2_both = p2_agree = 0
    p2_pairs, p2_dis = [], []
    sandhi = lambda r: r.endswith("ッ")
    for c in sorted(c for c, ons in joyo_on.items() if len(ons) >= 2):
        cc = bridge_char(c)
        if not cc:
            continue
        ons = [r for r in joyo_on[c] if not sandhi(r)]
        eums = norm_eums(cc)
        ja_map = {e: o for e, o, _ in
                  bridge_assign(cc, set(ons), set(eums))}
        pys = list(kmandarin.get(cc, []))
        for r in kxhc.get(cc, []):
            if r not in pys:
                pys.append(r)
        groups = tone_groups(pys, set(kmandarin.get(cc, [])),
                             pinlu.get(cc, {}))
        if len(groups) < 2 or len(ja_map) < 2:
            continue
        pairs, margin = zh_assign(eums, [rep for rep, _ in groups])
        if margin <= 0:
            continue
        zh_map = dict(pairs)
        common = [e for e in eums if e in ja_map and e in zh_map]
        if len(set(common)) < 2:
            continue
        p2_both += 1
        ok = True
        for e in common:
            mine = jazh_score(ja_map[e], zh_map[e])
            if any(jazh_score(ja_map[e], zh_map[e2]) > mine
                   for e2 in common):
                ok = False
        rows = "  ".join("%s/%s/%s" % (e, ja_map[e], zh_map[e])
                         for e in common)
        if ok:
            p2_agree += 1
            p2_pairs.append("%s: %s" % (cc, rows))
        else:
            p2_dis.append("%s: %s" % (cc, rows))
    p2 = {"both": p2_both, "agree": p2_agree,
          "agreements": p2_pairs, "disagreements": p2_dis}

    # ---- report ------------------------------------------------------
    lvl_total = collections.Counter(e["lvl"] for e in chars.values())
    lvl_ja = collections.Counter(chars[c]["lvl"] for c in sino_chars
                                 if "ja" in sino_chars[c])
    report = {
        "joyo_rows": joyo_rows,
        "joyo_with_on": sum(1 for v in joyo_on.values() if v),
        "joyo_kun_only": sum(1 for v in joyo_on.values() if not v),
        "old2new": len(old2new),
        "ja_words": len(jaw),
        "ja_aligned": len(word_parse),
        "ja_skipped": n_skipped,
        "bridge_shared": n_shared,
        "tier1": tier_counts[1],
        "tier2": tier_counts[2],
        "tier2_lvl": dict(tier2_lvl),
        "ja_chars": n_ja,
        "zh_chars": n_zh,
        "chars": len(sino_chars),
        "ja_cov_m": 100.0 * lvl_ja["m"] / max(lvl_total["m"], 1),
        "ja_cov_h": 100.0 * lvl_ja["h"] / max(lvl_total["h"], 1),
        "overrides": sum(len(v) for v in SINO_ZH_OVERRIDES.values()),
        "p1": p1,
        "p2": p2,
    }
    return {"version": 1, "chars": sino_chars}, report
