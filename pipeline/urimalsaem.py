#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Urimalsaem (우리말샘) Korean definitions for ko.json (SPEC "Korean language
mode" addendum, "Korean definitions data").

    fetch  ->  preprocess  ->  build (called by build.py)

fetch       downloads the 25 XML chunks of the spellcheck-ko/korean-dict-nikl
            mirror (opendict/, 1.73 GiB) into pipeline/cache/urimalsaem/,
            stored gzipped (~8 MB each). Resumable: chunks already present
            are skipped. Runs once.
preprocess  iterparses every chunk from gzip, drops the example_info and
            multimedia_info subtrees (outside the CC BY-SA grant), applies
            the SPEC sense selection, and writes ONE intermediate file,
            pipeline/cache/urimalsaem/intermediate.json.gz, keyed the way
            the build wants. Not per build: reruns only when the mirror
            updates.
build       consumes only the intermediate and matches it onto the finished
            words.json / native.json / hanja.json objects. Two lanes plus
            chars: hanja-origin senses -> words.json keys; senses of any
            word that is not a pure hanja-origin word (고유어, 외래어,
            혼종어) -> native.json (hangul, POS) rows through POS_MAP;
            single-syllable headwords with a one-char hanja origin -> the
            canonical char. A 지명 sense is dropped only beside an ordinary
            sense on the same key (中國, 美國 keep theirs; never on chars);
            a 명사 지명 sense also lands on the "hangul|지명" key, which
            maps to native.json's place rows ("hangul|name"); surname
            senses sort last; every other proper-noun class and every
            work/slang sense is dropped. The intermediate keeps every
            우리말샘 headword behind a natives key ("native_heads": word_type
            and origin segments per headword; each row names its headword
            by index). pick_dominant, run by the build once words.json
            carries its frequency buckets, resolves each key to ONE
            headword (SPEC "DOMINANT HOMOGRAPH"), whose word_type becomes
            native.json's origin, whose segments become the parts of a
            hybrid, and whose senses become the ko.json entry, so the
            mixed-script spelling and the definition agree. The chars
            lane has a second,
            lower-priority source (SPEC "SECOND CHAR SOURCE"): the 한자
            section of Korean Wiktionary, read from the cached kaikki dump
            by parse_kowiktionary and used only where 우리말샘 has no sense
            for the character. Such an entry carries no sense code.

Usage
    python pipeline/urimalsaem.py fetch [--force]
    python pipeline/urimalsaem.py preprocess
    (build.py runs both automatically on a cold cache)

Sources: National Institute of Korean Language, 우리말샘, CC BY-SA 2.0 KR;
Korean Wiktionary (ko.wiktionary.org), CC BY-SA, via kaikki.org. See
extension/data/DATA-LICENSE.md.
"""

from __future__ import annotations

import collections
import gzip
import itertools
import json
import os
import re
import subprocess
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache", "urimalsaem")
INTERMEDIATE = os.path.join(CACHE, "intermediate.json.gz")

# The chunk list comes from the GitHub contents API, never from assumed
# names; only *.xml entries are corpus chunks (the directory also holds
# the mirror's own update.py).
API_URL = ("https://api.github.com/repos/spellcheck-ko/korean-dict-nikl/"
           "contents/opendict")
RAW_URL = ("https://raw.githubusercontent.com/spellcheck-ko/korean-dict-nikl/"
           "master/opendict/%s")

CAP = 2                       # definitions per entry (SPEC: numbered, cap two)
INTERMEDIATE_VERSION = 4

# Sense selection (SPEC, user-approved). Senses of any type but 일반어 are
# dropped (방언, 옛말, 북한어). PROPER_NOUN_CATS drops the encyclopedic
# senses that share a headword with the ordinary one (강산 the village
# beside 江山); 고유명 일반 is the corpus's own "proper noun, general" class,
# added to the SPEC's pinned four after the cat inventory showed it.
PROPER_NOUN_CATS = frozenset({"지명", "인명", "책명", "매체", "고유명 일반"})
# A definition carrying one of these names a specific work or a slang
# register (가면 the 1925 magazine, 학교 the prison slang). The first row
# is the SPEC's pinned minimum; the second row extends it with the shapes
# measured on the matched lanes (films "감독이 만든 영화", paintings "이
# 그린 그림", choreographed pieces "안무하여 발표한", albums "의 앨범."),
# each checked against every hit before being added. "가 지은" and "이
# 쓴" stay out: 告解 "신자가 지은 죄", 飯盒 "등산객들이 쓴다".
WORK_OR_SLANG = ("이 지은", "작사", "작곡", "의 희곡", "의 소설", "은어로",
                 "속되게 이르는", "낮잡아 이르는",
                 "감독이 만든", "감독의 영화", "개봉하였다", "이 그린 그림",
                 "이 그린 풍경화", "안무한 ", "안무하여", "안무하고",
                 "안무, 발표", "안무·발표", "안무를 맡아", "의 안무로",
                 "의 앨범.", "쓴 희곡", "쓴 소설", "쓴 단편", "발표한 작품",
                 "발표한 희곡", "발표한 첫", "발표한 무용", "발표한 현대 무용",
                 "발표한 독무", "발표한 춤극", "발표한 발레")
# Cross-reference stubs: a body that only points at another headword.
# 방언 / 옛말 / 북한어 stubs are mostly gone with the type filter already;
# 준말 / 원말 / 본말 / 잘못 (misspelling of) / 전 용어 (former term for)
# are 일반어 and need the pattern. "‘X’의 어근." is a description, not a
# pointer, and stays.
RE_STUB = re.compile(
    r"^‘[^’]*’(?:의|를|을)\s*(?:방언|옛말|준말|원말|본말|잘못|북한어|전 용어)\b")
# Inline markup: ASCII-named tags only (<FL>, </FL>, <DR />, <sub>, <img
# ...>). Angle-bracketed Korean titles like <동의 속담> are text, not tags.
RE_TAG = re.compile(r"</?[A-Za-z][A-Za-z0-9]*(?:\s[^>]*)?/?>")
RE_TRAILER = re.compile(r"\s*⇒\s*규범 표기는.*$")
RE_WS = re.compile(r"\s+")
RE_WORD_MARK = re.compile(r"[-^\s]+")
# Surname senses (integrator rule): never dropped (for 姜 or 金 the
# surname IS a meaning) but sorted after every non-surname sense on the
# same key before the first-two cap, so 玉 leads with the stone.
# Corpus forms: "우리나라 성(姓)의 하나", "중국의 성(姓)의 하나", "우리나라
# 성의 하나" (about 520 senses, all without a cat). The boundary before
# 성 keeps 굴성의 하나 / 특성의 하나 / 편성의 하나 out.
RE_SURNAME = re.compile(r"(?:^|\s)성(?:\(姓\))?의 하나")
# Abbreviation senses (integrator rule) sort last the same way: corpus
# forms "‘X’를/을 줄여 이르는 말" (about 1,370), "줄임말" (9), "줄인 말"
# (4), "‘X’의 약칭" (18), and the bare "‘X’을/를 이르는 말." that opens a
# definition (金 = ‘금요일’을 이르는 말; 달리/높여/낮잡아 이르는 말 are
# not this form). The pointer form "‘X’의 준말." (about 3,360) stays a
# cross-reference stub and is dropped.
ABBREV_FORMS = (
    ("줄여 이르는 말", re.compile(r"줄여 이르는 말")),
    ("줄임말", re.compile(r"줄임말")),
    ("줄인 말", re.compile(r"줄인 말")),
    ("의 약칭", re.compile(r"의 약칭")),
    ("‘X’을/를 이르는 말", re.compile(r"^‘[^’]+’(?:을|를) 이르는 말")),
)


def abbrev_form(d):
    for name, rx in ABBREV_FORMS:
        if rx.search(d):
            return name
    return None


def sorts_last(d):
    return bool(RE_SURNAME.search(d)) or abbrev_form(d) is not None
# Root stubs (integrator rule): the corpus files the meaning on the -하다
# headword and leaves "‘긴밀하다’의 어근." on the bare form. Such a sense
# is replaced by the first surviving ordinary sense of headword X, with
# X's target_code so the link opens the -하다 entry; with no such sense
# the stub drops. Targets are collected in a raw-text pre-pass because
# 긴밀 precedes 긴밀하다 in corpus order.
RE_ROOT = re.compile(r"^[‘'“\"]([^’'”\"]+)[’'”\"]의 어근(?:이다)?")
RE_ROOT_ANY = re.compile(r"[‘'“\"]([^’'”\"]+)[’'”\"]의 어근")

# Urimalsaem pos -> native.json POS vocabulary (SPEC: pinned; anything
# else never matches). Table order is also the merge order when two
# Urimalsaem classes land on one native.json row (명사 before 의존 명사).
POS_MAP = collections.OrderedDict([
    ("명사", "noun"), ("의존 명사", "noun"),
    ("동사", "verb"), ("보조 동사", "verb"),
    ("형용사", "adj"), ("보조 형용사", "adj"),
    ("부사", "adv"), ("감탄사", "intj"), ("대명사", "pron"),
    ("수사", "num"), ("관형사", "det"),
    # Not a corpus POS: the preprocess files a 명사 sense with cat 지명 under
    # this pseudo-POS as well (SPEC "Place names and origin markers"), so a
    # native.json place row ("hangul|name") gets its definition.
    ("지명", "name"),
])
POS_RANK = {p: i for i, p in enumerate(POS_MAP)}
# 우리말샘 word_type -> native.json origin (SPEC "Origin markers"). 한자어
# never reaches the natives lane; anything else unlisted stays unmarked.
WORD_TYPE_ORIGIN = {"고유어": "native", "외래어": "loan", "혼종어": "hybrid"}
PLACE_POS = "지명"
# Word types routed to the natives lane (integrator rule): everything that
# is not a pure hanja-origin word, so loanwords (가드) and mixed words
# (가공되다) reach their native.json rows too. An item with an all-한자
# origin alternative stays out of the lane whatever its word_type says.
NATIVE_TYPES = frozenset({"고유어", "외래어", "혼종어"})

# Curated overrides (integrator rule, NOT_RARE discipline): per lane, key
# -> ordered target_codes whose definitions replace the computed ones (the
# cap of two still applies; the first code becomes `s`). Every code must
# exist under its key in the corpus and every entry must change the
# computed result, or the build aborts, so the table can neither rot nor
# drift. Native keys use native.json's POS ("우리|pron").
KO_OVERRIDES = {
    "words": {
        # The corpus orders the 대한 제국 abbreviation (28152) first and
        # files the 대한민국 sense (59082) under 지명, which the survival
        # rule drops beside it. The republic leads; the abbreviation stays
        # second for historical text.
        "韓國": [59082, 28152],
    },
    "natives": {},
    "chars": {},
}

# Glyph-form equivalence for the words lane (integrator rule): Unihan
# variant fields whose pairs count as the same character written the
# other way (畫/畵, 狀/状, 祕/秘). Symmetric; one hop per position. Two
# exclusions keep it to glyph forms: the financial numerals (陸 is not 六
# in a word), and any pair kSimplifiedVariant asserts in either direction
# (穀/谷 is a simplification, not a glyph twin).
VARIANT_FIELDS = frozenset({"kZVariant", "kSemanticVariant",
                            "kSpecializedSemanticVariant",
                            "kTraditionalVariant"})
SIMPLIFIED_FIELD = "kSimplifiedVariant"
NUMERAL_FORMS = frozenset("壹貳參肆伍陸柒捌玖拾")
RE_UPLUS = re.compile(r"U\+([0-9A-F]{4,6})")
GLYPH_COMBOS_CAP = 4096      # substitution combinations tried per origin

# Korean Wiktionary 한자 glosses (SPEC "SECOND CHAR SOURCE"): a gloss that
# only points at another character is dropped. Anchored at the gloss
# start, an optional reading in parentheses after the character (步(보)의
# 속자), so a real gloss with a trailing note ("둘째 지지. 丒의 이체자.")
# is kept. The SPEC names 약자 / 속자 / 본자 / 고자 / 옛말 / 원말, …와 같다
# and a bare "→" cross-reference; the dump also writes the same pointer
# as 간체자, 동자 and 와자 (爾의 간체자, 傑의 동자, 同(동)의 와자), and
# five entries carry a formation note instead of a meaning ("彳의 뜻과
# 卸(사)의 소리를 따른 형성자이다."), which is not a definition either.
KOWIKT_LANG = "한자"
_HAN = r"[㐀-䶿一-鿿豈-﫿\U00020000-\U0003134f]"
_HEAD = r"^" + _HAN + r"(?:\([가-힣]+\))?"
KOWIKT_POINTERS = (
    re.compile(_HEAD + r"(?:의|와|과)\s*"
               r"(?P<kind>약자|속자|본자|고자|옛말|원말|간체자?|동자|와자)"),
    re.compile(_HEAD + r"(?:와|과)\s*(?P<kind>같다)"),
    re.compile(r"^(?P<kind>→)"),
    re.compile(_HEAD + r".*(?P<kind>형성자)이다"),
)


def pointer_kind(gloss):
    """The pointer class a ko-wiktionary gloss belongs to, or None."""
    for rx in KOWIKT_POINTERS:
        m = rx.match(gloss)
        if m:
            return m.group("kind")
    return None


def parse_kowiktionary(path, chars_out):
    """kaikki ko-wiktionary dump -> {char: [gloss, ...]} in entry order.

    One JSON object per line; only lang == 한자 entries whose word is a
    single character with a hanja.json card are read. Glosses are trimmed
    and deduplicated across the character's entries (a few characters
    have one entry per part of speech). Pointer filtering happens in
    wikt_defs, so the counts can be reported per class. -> (glosses,
    lines, entries)
    """
    needle = KOWIKT_LANG.encode("utf-8")
    glosses = collections.OrderedDict()
    lines = entries = 0
    with gzip.open(path, "rb") as fh:
        for line in fh:
            lines += 1
            if needle not in line:
                continue
            try:
                o = json.loads(line)
            except ValueError:
                continue
            if o.get("lang") != KOWIKT_LANG:
                continue
            w = unicodedata.normalize("NFC", (o.get("word") or "").strip())
            if len(w) != 1 or w not in chars_out:
                continue
            entries += 1
            lst = glosses.setdefault(w, [])
            for sense in o.get("senses") or []:
                for g in sense.get("glosses") or []:
                    g = RE_WS.sub(" ", g).strip()
                    if g and g not in lst:
                        lst.append(g)
    return glosses, lines, entries


def wikt_defs(glosses, hits):
    """Pointer glosses dropped, the first CAP survivors; hits counts the
    pointer classes that fired."""
    out = []
    for g in glosses:
        kind = pointer_kind(g)
        if kind is not None:
            hits[kind] += 1
            continue
        out.append(g)
        if len(out) == CAP:
            break
    return out


def log(*a):
    print(*a, flush=True)


def mb(n):
    return "%.1f MB" % (n / (1024.0 * 1024.0))


# ---------------------------------------------------------------- fetch

def list_chunks():
    """-> [(name, size)] of the corpus chunks, sorted by name."""
    r = subprocess.run(["curl", "-sL", "--fail", "--max-time", "60", API_URL],
                       capture_output=True, text=True, encoding="utf-8",
                       errors="replace")
    if r.returncode != 0 or not r.stdout.strip():
        raise SystemExit("urimalsaem: GitHub contents API failed (curl exit %s)"
                         % r.returncode)
    entries = json.loads(r.stdout)
    chunks = sorted((e["name"], int(e["size"])) for e in entries
                    if e.get("type") == "file" and e["name"].endswith(".xml"))
    if not chunks:
        raise SystemExit("urimalsaem: no *.xml chunks listed at " + API_URL)
    return chunks


def _gzip_file(src, dst):
    # gzip -6 class: 77 MB -> ~8 MB, and gzip.open + iterparse reads it back
    # without decompressing to disk.
    tmp = dst + ".part"
    with open(src, "rb") as fi, gzip.open(tmp, "wb", compresslevel=6) as fo:
        while True:
            block = fi.read(1 << 20)
            if not block:
                break
            fo.write(block)
    os.replace(tmp, dst)


def fetch(force=False):
    """Download-if-missing for the corpus chunks; each ends up as <name>.gz.

    An uncompressed <name> already in the cache (a spike download, or an
    interrupted earlier run) is size-checked against the API listing, then
    gzipped in place and removed, never re-downloaded.
    """
    os.makedirs(CACHE, exist_ok=True)
    chunks = list_chunks()
    total = sum(s for _, s in chunks)
    log("  urimalsaem: %d chunks listed (%s raw)" % (len(chunks), mb(total)))
    t0 = time.time()
    done = 0
    for name, size in chunks:
        gz = os.path.join(CACHE, name + ".gz")
        raw = os.path.join(CACHE, name)
        if force and os.path.exists(gz):
            os.remove(gz)
        if os.path.exists(gz):
            done += 1
            log("  cached   %s.gz (%s)" % (name, mb(os.path.getsize(gz))))
            continue
        have = os.path.getsize(raw) if os.path.exists(raw) else 0
        if have and have != size:
            log("  local %s is %s, remote %s; restarting" % (name, mb(have),
                                                             mb(size)))
            os.remove(raw)
            have = 0
        if not have:
            log("  fetching %s (%s)" % (name, mb(size)))
            # -C - resumes a partial file left by an interrupted run.
            rc = subprocess.run(
                ["curl", "-L", "--fail", "--silent", "--show-error",
                 "--retry", "3", "--retry-delay", "2", "-C", "-",
                 "-o", raw, RAW_URL % name]).returncode
            now = os.path.getsize(raw) if os.path.exists(raw) else 0
            if rc != 0 or now != size:
                raise SystemExit("urimalsaem: download failed for %s (curl "
                                 "exit %s, %s of %s)" % (name, rc, mb(now),
                                                          mb(size)))
        log("  gzip     %s -> %s.gz" % (name, name))
        _gzip_file(raw, gz)
        os.remove(raw)
        done += 1
        log("  got      %s.gz (%s)  [%d/%d, %.0fs]"
            % (name, mb(os.path.getsize(gz)), done, len(chunks),
               time.time() - t0))
    return [os.path.join(CACHE, name + ".gz") for name, _ in chunks]


def cached_chunks():
    if not os.path.isdir(CACHE):
        return []
    return sorted(os.path.join(CACHE, f) for f in os.listdir(CACHE)
                  if f.endswith(".xml.gz"))


# ---------------------------------------------------------------- preprocess

def clean_definition(text):
    """Strip inline tags, cut the ⇒규범 표기 trailer, collapse whitespace."""
    s = RE_TAG.sub(" ", text or "")
    s = RE_TRAILER.sub("", s)
    return RE_WS.sub(" ", s).strip()


def split_origins(pairs):
    """[(original_language, language_type)] -> alternatives.

    A dual-notation origin (병기) is a sequence of segments with a literal
    "/" separator element typed "/(병기)" between the alternatives:
    가야 = 伽倻 / 伽耶 / 加耶 arrives as five elements. Each alternative is
    the list of its segments; a mixed word (편협하다 = 偏狹 + 하다) keeps
    both segments inside one alternative.
    """
    alts = [[]]
    for orig, ltype in pairs:
        if ltype == "/(병기)":
            alts.append([])
        else:
            alts[-1].append((orig, ltype))
    return [a for a in alts if a]


def hanja_keys(alts):
    """Alternatives whose every segment is 한자, as NFC hanja strings."""
    out = []
    for a in alts:
        if a and all(t == "한자" for _, t in a):
            k = unicodedata.normalize("NFC", "".join(o for o, _ in a))
            k = RE_WS.sub("", k)
            if k and k not in out:
                out.append(k)
    return out


def root_targets(chunks):
    """Headwords named by ‘X’의 어근 stubs anywhere in the corpus."""
    targets = set()
    for path in chunks:
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            for line in fh:
                if "의 어근" in line:
                    for m in RE_ROOT_ANY.finditer(line):
                        targets.add(RE_WORD_MARK.sub("", m.group(1)))
    return targets


def preprocess(chunks=None):
    """Parse every chunk and write INTERMEDIATE. -> report dict."""
    chunks = chunks or cached_chunks()
    if not chunks:
        raise SystemExit("urimalsaem: no chunks in %s; run "
                         "`python pipeline/urimalsaem.py fetch` first" % CACHE)
    t0 = time.time()
    targets = root_targets(chunks)
    log("  urimalsaem: %s root-stub target headwords (%.0fs)"
        % (format(len(targets), ","), time.time() - t0))
    first_sense = {}        # target headword -> (code, def)
    pending = []            # (container list, row, X) of root stubs
    n_items = 0
    routable = 0
    drop = collections.Counter()
    kept = 0
    capped = 0
    cats_seen = collections.Counter()
    pos_native = collections.Counter()
    pattern_hits = collections.Counter()
    soft = collections.Counter()
    words = collections.OrderedDict()    # hanja key -> [[code, def, hangul]]
    natives = collections.OrderedDict()  # "hangul|pos" -> [[code, def]]
    chars = collections.OrderedDict()    # char -> [[code, def]]
    # Place-name survival (integrator rule): a 지명 sense is HELD here per
    # key and promoted only when the key ends up with no ordinary sense
    # (中國 and 美國 have only 지명 senses; 生日's village stays dropped
    # beside its ordinary sense). Never on the chars lane: a char card
    # falls back to its hun. Every other proper-noun class and every
    # work/slang sense is dropped outright.
    held = {"words": collections.OrderedDict(),
            "natives": collections.OrderedDict()}
    # Surname senses, appended after the key's other senses at resolution.
    late = {"words": collections.OrderedDict(),
            "natives": collections.OrderedDict(),
            "chars": collections.OrderedDict()}
    per_head = collections.Counter()     # (tier, lane, headword, key) -> kept
    # Every headword behind a natives key, in corpus order: [word_type,
    # segments] with the segments as [original_language, language_type]
    # pairs (first alternative of a 병기 origin). Homographs on one key
    # (연습하다: 練習하다, 沿襲하다) differ by word_type or segments; a
    # row names its headword by index so pick_dominant can choose one.
    # The per-headword cap counts per homograph, else a later homograph
    # could lose every sense to the first.
    nheads = {}
    nhead_idx = {}
    # Definitions of the KO_OVERRIDES codes, collected before any filter.
    override_rows = {lane: {} for lane in KO_OVERRIDES}

    for path in chunks:
        name = os.path.basename(path)
        t1 = time.time()
        n0 = n_items
        with gzip.open(path, "rb") as fh:
            for _, el in ET.iterparse(fh, events=("end",)):
                if el.tag != "item":
                    continue
                n_items += 1
                wi = el.find("wordInfo")
                si = el.find("senseInfo")
                # example_info and multimedia_info are never read: the
                # element is cleared below and nothing from those subtrees
                # reaches the intermediate.
                if wi is None or si is None:
                    el.clear()
                    continue
                # Headword markup: "-" affix boundary, "^" compound
                # spacing, and the literal space of a 구 (phrase) entry
                # ("교통 요금" for 交通料金); none of the decorated files
                # carries any of them.
                word = RE_WORD_MARK.sub("", wi.findtext("word") or "")
                pairs = [(o.findtext("original_language") or "",
                          o.findtext("language_type") or "")
                         for o in wi.findall("original_language_info")]
                alts = split_origins(pairs)
                hkeys = hanja_keys(alts)
                pos = (si.findtext("pos") or "").strip()
                wtype = wi.findtext("word_type") or ""
                native_key = None
                if (wtype in NATIVE_TYPES and word and pos
                        and not hkeys):
                    pos_native[pos] += 1
                    native_key = word + "|" + pos
                char_keys = []
                if (len(word) == 1 and alts
                        and all(len(a) == 1 and a[0][1] == "한자" for a in alts)):
                    for a in alts:
                        c = unicodedata.normalize("NFC", a[0][0].strip())
                        if len(c) == 1 and c not in char_keys:
                            char_keys.append(c)
                if not (hkeys or native_key or char_keys):
                    el.clear()
                    continue
                routable += 1
                # target_code is the sense's permanent ID (the corpus's
                # own link field is view?sense_no=<target_code>).
                code = int(el.findtext("target_code") or 0)
                d = clean_definition(si.findtext("definition"))
                # Override codes are collected before any filter: the
                # curator may point at a sense the rules would drop.
                for lane, keys in (("words", hkeys), ("chars", char_keys),
                                   ("natives", [word + "|" + POS_MAP[pos]]
                                    if native_key and pos in POS_MAP
                                    else [])):
                    for k in keys:
                        codes = KO_OVERRIDES[lane].get(k)
                        if codes and code in codes and d:
                            override_rows[lane].setdefault(k, {})[
                                str(code)] = d
                # ---- sense selection (SPEC order) ----
                stype = si.findtext("type") or ""
                cats = [c.text or "" for c in si.findall("cat_info/cat")]
                for c in cats:
                    cats_seen[c] += 1
                reason = None
                if stype != "일반어":
                    reason = "type " + (stype or "(none)")
                elif not d:
                    reason = "empty definition"
                elif RE_STUB.match(d):
                    reason = "cross-reference stub"
                elif any(c in PROPER_NOUN_CATS for c in cats):
                    if "지명" not in cats:
                        reason = "proper-noun cat"
                elif any(p in d for p in WORK_OR_SLANG):
                    reason = "work or slang"
                    pattern_hits[next(p for p in WORK_OR_SLANG
                                      if p in d)] += 1
                if reason:
                    drop[reason] += 1
                    el.clear()
                    continue
                # A 지명 sense is held per key and promoted only on an
                # otherwise empty key (resolved after the last chunk).
                tier = 0
                if "지명" in cats:
                    tier = 1
                    soft["지명"] += 1
                    if char_keys:
                        drop["지명 on the chars lane"] += 1
                        char_keys = []
                elif RE_SURNAME.search(d):
                    tier = 2
                    soft["surname (sorted last)"] += 1
                    kept += 1
                elif abbrev_form(d) is not None:
                    tier = 2
                    soft["abbreviation: " + abbrev_form(d)] += 1
                    kept += 1
                else:
                    kept += 1
                rm = RE_ROOT.match(d)
                root = RE_WORD_MARK.sub("", rm.group(1)) if rm else None
                if (tier == 0 and root is None and word in targets
                        and word not in first_sense):
                    first_sense[word] = (code, d)
                w_tbl = (words, held["words"], late["words"])[tier]
                n_tbl = (natives, held["natives"], late["natives"])[tier]
                c_tbl = (chars, chars, late["chars"])[tier]
                def put(tbl, k, row, hk):
                    if per_head[hk] >= CAP:
                        return False
                    per_head[hk] += 1
                    lst = tbl.setdefault(k, [])
                    lst.append(row)
                    if root is not None:
                        pending.append((lst, row, root))
                    return True
                for k in hkeys:
                    if not put(w_tbl, k, [code, d, word],
                               (tier, "w", word, k)):
                        capped += 1
                if native_key:
                    segs = [list(seg) for seg in alts[0]] if alts else []
                    sig = (wtype, tuple(map(tuple, segs)))

                    def head_index(k):
                        hi = nhead_idx.get((k, sig))
                        if hi is None:
                            hi = len(nheads.setdefault(k, []))
                            nheads[k].append([wtype, segs])
                            nhead_idx[(k, sig)] = hi
                        return hi
                    hi = head_index(native_key)
                    if not put(n_tbl, native_key, [code, d, hi],
                               (tier, "n", word, pos, hi)):
                        capped += 1
                    # A 명사 place sense also lands on the name key, as
                    # ordinary content there (tier 0): the survival rule
                    # governs the noun key only.
                    if tier == 1 and pos == "명사":
                        pkey = word + "|" + PLACE_POS
                        hi = head_index(pkey)
                        if not put(natives, pkey, [code, d, hi],
                                   (0, "n", word, PLACE_POS, hi)):
                            capped += 1
                for c in char_keys:
                    if not put(c_tbl, c, [code, d], (tier, "c", word, c)):
                        capped += 1
                el.clear()
        log("  %s: %s items (%.1fs)" % (name, format(n_items - n0, ","),
                                        time.time() - t1))

    # Resolve the survival rule: a held key with no ordinary sense keeps
    # its held senses; held senses beside an ordinary sense are dropped.
    # Root-stub resolution: replace in place (the stub keeps its slot, so
    # 긴밀 leads with 긴밀하다's sense), or remove.
    root_resolved = root_dropped = 0
    for lst, row, root in pending:
        fs = first_sense.get(root)
        if fs:
            row[0], row[1] = fs
            root_resolved += 1
        else:
            lst.remove(row)
            root_dropped += 1
    for tbl in (words, natives, chars, held["words"], held["natives"],
                late["words"], late["natives"], late["chars"]):
        for k in [k for k, v in tbl.items() if not v]:
            del tbl[k]
    for lane, tbl in (("words", words), ("natives", natives),
                      ("chars", chars)):
        for k, rows in late[lane].items():
            tbl.setdefault(k, []).extend(rows)
    rescued = {"chars": []}
    for lane, tbl in (("words", words), ("natives", natives)):
        keys = []
        for k, rows in held[lane].items():
            if k in tbl:
                drop["held beside ordinary"] += len(rows)
            else:
                tbl[k] = rows
                keys.append(k)
        rescued[lane] = keys
    # The headwords behind each surviving natives key. Only the tier that
    # survived has rows left, so the headwords with a row are exactly the
    # candidates pick_dominant chooses among.
    native_heads = {k: nheads[k] for k in natives}
    homograph_keys = sum(1 for k, rows in natives.items()
                         if len({r[2] for r in rows}) > 1)

    report = {
        "chunks": [os.path.basename(p) for p in chunks],
        "items": n_items,
        "routable": routable,
        "dropped": dict(sorted(drop.items())),
        "held": dict(sorted(soft.items())),
        "kept": kept,
        "capped": capped,
        "words": len(words),
        "natives": len(natives),
        "native_heads": sum(len(v) for v in native_heads.values()),
        "native_homograph_keys": homograph_keys,
        "native_places": sum(1 for k in natives
                             if k.endswith("|" + PLACE_POS)),
        "chars": len(chars),
        "rescued": {k: len(v) for k, v in rescued.items()},
        "root_stubs": {"targets": len(targets), "matched": len(pending),
                       "resolved": root_resolved,
                       "dropped": root_dropped},
        "cats": dict(cats_seen.most_common()),
        "native_pos": dict(pos_native.most_common()),
        "work_or_slang": dict(pattern_hits.most_common()),
    }
    seconds = time.time() - t0
    obj = {"version": INTERMEDIATE_VERSION, "report": report,
           "words": words, "natives": natives, "chars": chars,
           "native_heads": native_heads,
           "rescued": rescued, "overrides": override_rows}
    tmp = INTERMEDIATE + ".part"
    # Key order is corpus order and order-bearing (first survivor first),
    # so no sort_keys here; the emit in build.py sorts what it writes.
    # mtime is pinned so the file is byte-reproducible.
    with open(tmp, "wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", compresslevel=6,
                           mtime=0) as fh:
            fh.write(json.dumps(obj, ensure_ascii=False,
                                separators=(",", ":")).encode("utf-8"))
    os.replace(tmp, INTERMEDIATE)
    log("  urimalsaem: %s items parsed in %.0fs; %s routable, %s kept, "
        "%s over the per-headword cap" % (
            format(n_items, ","), seconds, format(routable, ","),
            format(kept, ","), format(capped, ",")))
    for k, v in report["dropped"].items():
        log("    dropped %-22s %s" % (k, format(v, ",")))
    for k, v in report["held"].items():
        log("    held    %-22s %s" % (k, format(v, ",")))
    log("    root stubs: %s matched, %s resolved onto the target sense, "
        "%s dropped" % (format(len(pending), ","),
                        format(root_resolved, ","),
                        format(root_dropped, ",")))
    log("    work or slang by pattern: " + " ".join(
        "%s=%d" % kv for kv in pattern_hits.most_common()))
    log("  urimalsaem: lanes words %s, natives %s (%s place keys, %s "
        "headwords, %s keys with several), chars %s (keys kept only by "
        "지명 senses: %s / %s) -> %s (%s)" % (
            format(len(words), ","), format(len(natives), ","),
            format(report["native_places"], ","),
            format(report["native_heads"], ","),
            format(homograph_keys, ","),
            format(len(chars), ","), format(len(rescued["words"]), ","),
            format(len(rescued["natives"]), ","),
            os.path.basename(INTERMEDIATE),
            mb(os.path.getsize(INTERMEDIATE))))
    return report


def load_intermediate():
    """-> the intermediate dict, or None when it has not been produced."""
    if not os.path.exists(INTERMEDIATE):
        return None
    with gzip.open(INTERMEDIATE, "rt", encoding="utf-8") as fh:
        obj = json.load(fh)
    if obj.get("version") != INTERMEDIATE_VERSION:
        raise SystemExit("urimalsaem: %s is version %s, want %s; rerun "
                         "`python pipeline/urimalsaem.py preprocess`"
                         % (INTERMEDIATE, obj.get("version"),
                            INTERMEDIATE_VERSION))
    return obj


def ensure_intermediate():
    """The build's cold-cache path: fetch and preprocess when missing."""
    obj = load_intermediate()
    if obj is not None:
        log("  cached   %s (%s)" % (os.path.basename(INTERMEDIATE),
                                    mb(os.path.getsize(INTERMEDIATE))))
        return obj
    log("  %s missing; fetching and preprocessing the Urimalsaem corpus "
        "(1.73 GiB download on a cold cache, several minutes)"
        % os.path.basename(INTERMEDIATE))
    fetch()
    preprocess()
    obj = load_intermediate()
    if obj is None:
        raise SystemExit("urimalsaem: preprocess produced no intermediate; "
                         "run `python pipeline/urimalsaem.py preprocess`")
    return obj


# ------------------------------------------------------- dominant headword

def hanja_stem(segs):
    """The concatenated 한자 segments of a headword's origin, NFC, or ""."""
    stem = "".join(o for o, t in segs if t == "한자")
    return RE_WS.sub("", unicodedata.normalize("NFC", stem))


def pick_dominant(inter, words_out):
    """Resolve every natives key to ONE headword (SPEC "DOMINANT
    HOMOGRAPH"). Among the headwords with a surviving row, the one whose
    hanja stem is a words_out key carrying the lowest f bucket wins, else
    the one with the most rows, else the first in corpus order. The key's
    rows are cut to that headword (and lose their headword index), and
    inter gains "native_types" and "native_segments" (word_type and
    segments of the chosen headword), the tables the build reads.
    -> (keys re-pointed away from the first candidate, report dict)"""
    heads = inter["native_heads"]
    natives = inter["natives"]
    native_types = {}
    native_segments = {}
    changed = 0
    by_rule = collections.Counter()

    def bucket(hi, k):
        stem = hanja_stem(heads[k][hi][1])
        f = [s["f"] for s in words_out.get(stem, ()) if "f" in s]
        return min(f) if f else None

    for k, rows in natives.items():
        counts = collections.Counter(r[2] for r in rows)
        cands = sorted(counts)
        if len(cands) == 1:
            best = cands[0]
        else:
            ranked = []
            for hi in cands:
                f = bucket(hi, k)
                ranked.append((f if f is not None else FREQ_UNRANKED,
                               -counts[hi], hi))
            ranked.sort()
            best = ranked[0][2]
            if ranked[0][0] != FREQ_UNRANKED:
                by_rule["f bucket"] += 1
            elif ranked[0][1] != ranked[1][1]:
                by_rule["most senses"] += 1
            else:
                by_rule["first"] += 1
            if best != cands[0]:
                changed += 1
        natives[k] = [r[:2] for r in rows if r[2] == best]
        wtype, segs = heads[k][best]
        if wtype:
            native_types[k] = wtype
        if segs:
            native_segments[k] = segs
    inter["native_types"] = native_types
    inter["native_segments"] = native_segments
    report = {"homograph_keys": sum(by_rule.values()),
              "repointed": changed, "by_rule": dict(by_rule)}
    return changed, report


# f buckets run 0-9 (build.FREQ_BUCKETS); a stem outside words.json or
# without a bucket sorts after every ranked one.
FREQ_UNRANKED = 99


# ---------------------------------------------------------------- build

def _surname_last(rows):
    # Stable: a merge of several sources keeps surname and abbreviation
    # senses behind every other sense (the intermediate already orders
    # each source).
    return sorted(rows, key=lambda r: sorts_last(r[1]))


def _defs(rows):
    out = []
    for r in rows:
        if r[1] not in out:
            out.append(r[1])
        if len(out) == CAP:
            break
    return out


def parse_equivalence(text):
    """Unihan_Variants.txt -> {char: set of equivalent chars}, symmetric."""
    pairs = set()
    simp = collections.defaultdict(set)   # traditional -> simplified forms
    trad = collections.defaultdict(set)   # simplified -> traditional forms
    for line in text.splitlines():
        if not line or line[0] == "#":
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            continue
        field = parts[1]
        if field != SIMPLIFIED_FIELD and field not in VARIANT_FIELDS:
            continue
        a = chr(int(parts[0][2:], 16))
        for m in RE_UPLUS.finditer(parts[2]):
            b = chr(int(m.group(1), 16))
            # Self entries are kept in the two maps: 谷 listing itself as
            # a traditional form is what marks 谷/穀 as many-to-one.
            if field == SIMPLIFIED_FIELD:
                simp[a].add(b)
            elif field == "kTraditionalVariant":
                trad[a].add(b)
            if b != a:
                pairs.add(frozenset((a, b)))
    # A simplification pair is a glyph twin only when it is one-to-one
    # (狀/状: 状's sole traditional form is 狀, 狀's sole simplified form
    # is 状). 谷 stands for both 穀 and itself, 画 for 畫 and itself, so
    # those merges are excluded.
    excluded = set()
    for t, forms in simp.items():
        for s in forms:
            if s != t and not (simp[t] == {s} and trad.get(s) == {t}):
                excluded.add(frozenset((t, s)))
    eq = collections.defaultdict(set)
    for p in pairs:
        if p in excluded or p & NUMERAL_FORMS:
            continue
        a, b = tuple(p)
        eq[a].add(b)
        eq[b].add(a)
    return eq


def build(inter, words_out, native_words, chars_out, variant_map,
          unihan_variants_text, kowikt=None):
    """-> (ko_obj, report).

    words_out: the finished words.json words dict (keys canonical, NFC).
    inter must have been through pick_dominant (one headword per natives
    key). native_words: the finished native.json words dict {hangul: [{pos,
    glosses}]}. chars_out: the finished hanja.json chars dict. variant_map:
    variants.json's map, for routing a variant-form single char to its
    canonical card. unihan_variants_text: Unihan_Variants.txt, for the
    glyph-form equivalence of the words lane. kowikt: parse_kowiktionary's
    glosses, the chars lane's second source.
    """
    kowikt = kowikt or {}
    equiv = parse_equivalence(unihan_variants_text)

    def glyph_hits(k):
        # Every combination of one-hop substitutions over the positions
        # (fewest substitutions first, then the key), excluding the
        # unchanged string; bounded so a long origin cannot explode.
        options = [[ch] + sorted(equiv.get(ch, ())) for ch in k]
        n = 1
        for o in options:
            n *= len(o)
        if n == 1 or n > GLYPH_COMBOS_CAP:
            return []
        hits = []
        for combo in itertools.product(*options):
            cand = "".join(combo)
            if cand != k and cand in words_out:
                subs = sum(1 for a, b in zip(combo, k) if a != b)
                hits.append((subs, cand))
        return [c for _, c in sorted(hits)]
    def canon(c):
        if c in chars_out:
            return c
        v = variant_map.get(c)
        return v if v in chars_out else None

    def canon_key(k):
        # Urimalsaem writes some words in the other glyph form (絕對 for
        # words.json's 絶對, 腦 for 匘); mapping every char through
        # variants.json rescues ~125 keys (spike: ~0.5%). None when a
        # char has no canonical form.
        out = []
        for ch in k:
            cc = canon(ch)
            if cc is None:
                return None
            out.append(cc)
        return "".join(out)

    # Intermediate keys kept only by held (proper-noun / work / slang)
    # senses. The survival rule holds across the build's own merges too:
    # when a target key gathers both ordinary and held parts, the held
    # parts drop.
    rescued = {lane: set(keys)
               for lane, keys in inter.get("rescued", {}).items()}

    def merge(parts, lane, direct_wins=False):
        # parts: [(rank, source_key, rows)]; ordinary parts lead, then
        # rank, then source key, so every merge is deterministic. With
        # direct_wins, a rank-0 (direct) part silences variant parts.
        held = rescued.get(lane, ())
        ordinary = [p for p in parts if p[1] not in held]
        use = ordinary or parts
        if direct_wins and any(p[0] == 0 for p in use):
            use = [p for p in use if p[0] == 0]
        rows = [r for _, _, rs in sorted(use, key=lambda p: (p[0], p[1]))
                for r in rs]
        return _surname_last(rows), not ordinary, max(p[0] for p in use)

    # words lane: the exact key (rank 0), else the variants.json
    # canonicalization (rank 1), else a glyph-form substitution (rank 2).
    # A direct match always wins: variant parts on a directly decorated
    # key are ignored.
    word_parts = collections.defaultdict(list)
    miss_words = 0
    via_variants = 0
    via_glyph = 0
    glyph_ambiguous = 0
    glyph_source = {}
    for key, rows in inter["words"].items():
        if key in words_out:
            word_parts[key].append((0, key, rows))
            continue
        ck = canon_key(key)
        if ck is not None and ck in words_out:
            word_parts[ck].append((1, key, rows))
            via_variants += 1
            continue
        hits = glyph_hits(key)
        if hits:
            word_parts[hits[0]].append((2, key, rows))
            glyph_source.setdefault(hits[0], key)
            via_glyph += 1
            glyph_ambiguous += len(hits) > 1
        else:
            miss_words += 1
    ko_words = {}
    hangul_disagree = 0
    words_rescued = 0
    glyph_keys = []
    direct_keys = set()
    for key, parts in word_parts.items():
        rows, held_only, rank = merge(parts, "words", direct_wins=True)
        words_rescued += held_only
        if rank == 2:
            glyph_keys.append(key)
        if rank == 0:
            direct_keys.add(key)
        ko_words[key] = {"d": _defs(rows), "s": rows[0][0]}
        if not any(r[2] == s["hangul"] for r in rows for s in words_out[key]):
            hangul_disagree += 1
    # Fan-out (integrator rule): a directly decorated key also decorates
    # every glyph-twin words.json key that has no direct decoration of its
    # own (映畫 reaches 映畵, 狀態 reaches 状態), with the same entry. Two
    # different direct keys claiming one twin leave it undecorated.
    claims = collections.defaultdict(set)
    for key in sorted(direct_keys):
        for twin in glyph_hits(key):
            if twin not in direct_keys:
                claims[twin].add(key)
    fanout_keys = []
    fanout_ambiguous = []
    for twin, sources in sorted(claims.items()):
        if len(sources) > 1:
            fanout_ambiguous.append(twin)
            ko_words.pop(twin, None)
            continue
        src = next(iter(sources))
        ko_words[twin] = dict(ko_words[src])
        glyph_source[twin] = src
        fanout_keys.append(twin)
    glyph_keys = [k for k in glyph_keys if k in ko_words
                  and k not in fanout_keys]

    native_rows = {}
    for hangul, rows in native_words.items():
        for r in rows:
            native_rows[hangul + "|" + r["pos"]] = True
    merged = collections.defaultdict(list)   # "hangul|npos" -> parts
    unmapped = collections.Counter()
    miss_native = 0
    for key, rows in inter["natives"].items():
        hangul, upos = key.rsplit("|", 1)
        npos = POS_MAP.get(upos)
        if npos is None:
            unmapped[upos] += 1
            continue
        nkey = hangul + "|" + npos
        if nkey not in native_rows:
            miss_native += 1
            continue
        merged[nkey].append((POS_RANK[upos], key, rows))
    ko_natives = {}
    natives_rescued = 0
    for nkey, parts in merged.items():
        rows, held_only, _ = merge(parts, "natives")
        natives_rescued += held_only
        ko_natives[nkey] = {"d": _defs(rows), "s": rows[0][0]}

    by_char = collections.defaultdict(list)  # canonical -> parts
    miss_chars = 0
    for c, rows in inter["chars"].items():
        cc = canon(c)
        if cc is None:
            miss_chars += 1
            continue
        # The canonical char's own senses first, then variant forms by
        # code point.
        by_char[cc].append((int(c != cc), c, rows))
    ko_chars = {}
    chars_rescued = 0
    for cc, parts in by_char.items():
        rows, held_only, _ = merge(parts, "chars")
        chars_rescued += held_only
        ko_chars[cc] = {"d": _defs(rows), "s": rows[0][0]}

    # Curated overrides (NOT_RARE discipline): a code missing under its
    # key, a key outside the decorated file, or an entry that leaves the
    # computed result unchanged aborts the build.
    ov_rows = inter.get("overrides", {})
    overrides_fired = 0
    for lane, tbl, decorated in (("words", ko_words, words_out),
                                 ("natives", ko_natives, native_rows),
                                 ("chars", ko_chars, chars_out)):
        for key, codes in sorted(KO_OVERRIDES[lane].items()):
            if key not in decorated:
                raise SystemExit("ko override %s/%s: key not in the decorated "
                                 "file" % (lane, key))
            have = ov_rows.get(lane, {}).get(key, {})
            missing = [c for c in codes if str(c) not in have]
            if missing:
                raise SystemExit("ko override %s/%s: code(s) %s not found "
                                 "under the key in the corpus (rerun "
                                 "preprocess after editing KO_OVERRIDES)"
                                 % (lane, key, missing))
            entry = {"d": _defs([[c, have[str(c)]] for c in codes]),
                     "s": codes[0]}
            if tbl.get(key) == entry:
                raise SystemExit("dead ko override %s/%s: the computed "
                                 "result already matches" % (lane, key))
            tbl[key] = entry
            overrides_fired += 1

    # Second char source (SPEC): a character with no 우리말샘 sense takes
    # the ko-wiktionary glosses, entry order, pointer glosses dropped, cap
    # CAP. No sense code exists, so the entry has no "s"; a character whose
    # glosses were all pointers stays bare. Never a top-up: a character
    # with one 우리말샘 sense keeps exactly that.
    chars_urimalsaem = len(ko_chars)
    wikt_hits = collections.Counter()
    wikt_candidates = wikt_bare = 0
    for c in sorted(kowikt):
        if c in ko_chars:
            continue
        wikt_candidates += 1
        d = wikt_defs(kowikt[c], wikt_hits)
        if d:
            ko_chars[c] = {"d": d}
        else:
            wikt_bare += 1
    chars_wikt = len(ko_chars) - chars_urimalsaem

    # Build-anchored key agreement (SPEC): a key absent from the file it
    # decorates aborts the build rather than shipping.
    foreign = ([k for k in ko_words if k not in words_out]
               + [k for k in ko_natives if k not in native_rows]
               + [k for k in ko_chars if k not in chars_out])
    if foreign:
        raise SystemExit("ko.json key(s) absent from the decorated file: "
                         + " ".join(foreign[:10]))

    # Reconciliation of the two spike counts for English-only chars: 6,735
    # chars have no eumhun at all (the no-eumhun proxy); 6,146 of those
    # carry an English gloss (the "only meaning text is English"
    # criterion); the other 589 have no meaning text of any kind.
    no_hun = [c for c, e in chars_out.items()
              if not any(x.get("hun") for x in e.get("eumhun", []))]
    english_only = sum(1 for c in no_hun if chars_out[c]["glosses"])
    no_text = len(no_hun) - english_only
    no_hun_no_ko = sum(1 for c in no_hun if c not in ko_chars)
    english_only_no_ko = sum(1 for c in no_hun
                             if chars_out[c]["glosses"] and c not in ko_chars)
    # The ko-wiktionary fill splits into chars that had no hun at all (the
    # SPEC's spike figure, about 1,576, formerly English under 한국어) and
    # chars with a hun but no 우리말샘 sense.
    wikt_no_hun = sum(1 for c in no_hun
                      if c in ko_chars and "s" not in ko_chars[c])

    native_heads = {k.rsplit("|", 1)[0] for k in ko_natives}
    # The words.json keys left without a Korean definition, most frequent
    # first (f bucket, then key), for the coverage report.
    koless = sorted((e[0].get("f", 9), k) for k, e in words_out.items()
                    if k not in ko_words)
    report = {
        "items": inter["report"]["items"],
        "words": len(ko_words), "words_total": len(words_out),
        "words_unmatched": miss_words,
        "words_via_variants": via_variants,
        "words_via_glyph": len(glyph_keys),
        "words_glyph_ambiguous": glyph_ambiguous,
        "words_fanout": len(fanout_keys),
        "words_fanout_ambiguous": fanout_ambiguous,
        "words_glyph_top": [
            "%s<-%s(%s f%d)" % (k, glyph_source[k], words_out[k][0]["hangul"],
                                words_out[k][0].get("f", 9))
            for k in sorted(glyph_keys + fanout_keys,
                            key=lambda k: (words_out[k][0].get("f", 9), k))[:10]],
        "words_hangul_disagree": hangul_disagree,
        "words_rescued": words_rescued,
        "overrides": overrides_fired,
        "words_koless": len(koless),
        "words_koless_top": ["%s(%s f%d)" % (k, words_out[k][0]["hangul"], f)
                             for f, k in koless[:10]],
        "natives": len(ko_natives), "native_rows_total": len(native_rows),
        "native_heads": len(native_heads),
        "native_heads_total": len(native_words),
        "natives_unmatched": miss_native,
        "natives_unmapped_pos": dict(unmapped.most_common()),
        "natives_rescued": natives_rescued,
        "chars": len(ko_chars), "chars_total": len(chars_out),
        "chars_urimalsaem": chars_urimalsaem,
        "chars_unmatched": miss_chars,
        "chars_rescued": chars_rescued,
        "chars_wikt": chars_wikt,
        "wikt_chars": len(kowikt),
        "wikt_candidates": wikt_candidates,
        "wikt_bare": wikt_bare,
        "wikt_no_hun": wikt_no_hun,
        "wikt_pointers": dict(wikt_hits.most_common()),
        "no_hun": len(no_hun), "english_only": english_only,
        "no_text": no_text, "no_hun_no_ko": no_hun_no_ko,
        "english_only_no_ko": english_only_no_ko,
    }
    ko_obj = {"version": 1, "words": ko_words, "natives": ko_natives,
              "chars": ko_chars}
    return ko_obj, report


# ---------------------------------------------------------------- main

def main(argv):
    cmd = argv[0] if argv else ""
    if cmd == "fetch":
        fetch(force="--force" in argv)
    elif cmd == "preprocess":
        if not cached_chunks():
            fetch()
        preprocess()
    else:
        raise SystemExit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
