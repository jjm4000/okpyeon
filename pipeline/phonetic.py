#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Phonetic-component pins (SPEC "Phonetic components" ADDENDUM).

Marks which emitted decomp part gives a character its sound: 請 is 言 + 靑
and 靑 is there for 청. Two tiers, SERIES (shared kPhonetic series number,
survives sound drift) then EXACT (shared eum); the fuzzy tier was measured
and rejected, it never ships. One pin per char or none.

Local module of pipeline/build.py, stdlib only.
"""

from __future__ import annotations

import re

RE_SERIES = re.compile(r"^\d+")

# Curated pins in the NOT_RARE discipline: every entry must change the
# computed result or the build aborts. None forces no pin; an integer
# forces that part-row index. 樂 computes an exact-tier pin on 幺 via its
# 요 reading, but 樂 is a pictograph, not phono-semantic (SPEC spot-check).
OVERRIDES = {"樂": None}


# ---------------------------------------------------------------- parse

def parse_kphonetic(text: str):
    """char -> set of kPhonetic series-id strings, from the text of
    Unihan_DictionaryLikeData.txt. Values are space-separated tokens whose
    leading digits are the series id ("1024A" -> "1024")."""
    out = {}
    for raw in text.splitlines():
        if raw.startswith("#"):
            continue
        p = raw.split("\t")
        if len(p) != 3 or p[1] != "kPhonetic":
            continue
        ids = set()
        for tok in p[2].split():
            m = RE_SERIES.match(tok)
            if m:
                ids.add(m.group(0))
        if ids:
            out[chr(int(p[0][2:], 16))] = ids
    return out


# ---------------------------------------------------------------- build

def build(decomp_parts, chars, kphonetic, strokes):
    """(phon map {char: row index}, stats) over the emitted decomp parts.

    Candidate rows are the clickable ones (target carries a card) whose
    target is not the char itself and not a single-stroke glyph: Korean
    tradition names strokes after characters (丶 점 주), so a one-stroke
    "match" is circular, never etymology (the stroke rule). Best tier wins;
    distinct qualifying targets within it suppress the pin entirely.
    """
    stats = {"pinned": 0, "series": 0, "exact": 0,
             "ambiguous": 0, "stroke_excluded": 0, "override_fired": 0}

    def eums(c):
        e = chars[c]
        return set(e["readings"]) | {x["eum"] for x in e["eumhun"]}

    phon, tier_of = {}, {}
    for ch, rows in decomp_parts.items():
        ch_series = kphonetic.get(ch, set())
        ch_eums = eums(ch)
        series_hits, exact_hits = [], []
        for i, r in enumerate(rows):
            if len(r) > 1 and not isinstance(r[1], str):
                continue
            t = r[1] if len(r) > 1 else r[0]
            if t == ch or t not in chars:
                continue
            in_series = bool(ch_series & kphonetic.get(t, set()))
            in_exact = bool(ch_eums & eums(t))
            if strokes.get(t) == 1:
                if in_series or in_exact:
                    stats["stroke_excluded"] += 1
                continue
            if in_series:
                series_hits.append((i, t))
            if in_exact:
                exact_hits.append((i, t))
        tier, hits = ("series", series_hits) if series_hits \
            else ("exact", exact_hits)
        targets = {t for _, t in hits}
        if len(targets) > 1:
            stats["ambiguous"] += 1
            continue
        if not targets:
            continue
        phon[ch] = hits[0][0]
        tier_of[ch] = tier
        stats["pinned"] += 1
        stats[tier] += 1

    for ch in sorted(OVERRIDES):
        want = OVERRIDES[ch]
        dead = (ch not in phon) if want is None else (phon.get(ch) == want)
        if dead:
            # A dead override means the detection moved under the list;
            # that deserves a human look, not a silent pass.
            raise SystemExit("dead phonetic override: %s already computes %r"
                             % (ch, want))
        if want is None:
            stats["pinned"] -= 1
            stats[tier_of.pop(ch)] -= 1
            del phon[ch]
        else:
            if ch not in phon:
                stats["pinned"] += 1
            else:
                stats[tier_of.pop(ch)] -= 1
            phon[ch] = want
        stats["override_fired"] += 1

    # An out-of-range or inert pin would ship a marker the UI cannot place
    # (the rare-flag lesson: file and index must not be able to drift).
    for ch, i in phon.items():
        rows = decomp_parts.get(ch)
        bad = (rows is None or not isinstance(i, int)
               or not 0 <= i < len(rows))
        if not bad:
            r = rows[i]
            t = r[1] if len(r) > 1 else r[0]
            bad = (len(r) > 1 and not isinstance(r[1], str)) \
                or t not in chars
        if bad:
            raise SystemExit("phonetic pin %s -> %r is out of range or "
                             "not clickable" % (ch, i))
    return phon, stats
