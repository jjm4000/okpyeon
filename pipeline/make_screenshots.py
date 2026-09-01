"""Regenerate the Chrome Web Store screenshot set.

    python pipeline/make_screenshots.py

Writes screenshots/1-character-lookup.png through 9-decomposition.png, all
1280x800 24-bit RGB with no alpha channel, which is what the store accepts.
The promotional tiles are a separate script (make_promo.py); this one only
touches the numbered shots.

How it works
------------
Chrome 151 headless ignores --load-extension, so there is no way to capture the
real extension running on a real page. Instead two staging pages in
pipeline/screenshots/ load the REAL extension code (lookup.js, saved.js,
content.js, the sidepanel scripts, the shipped CSS, the shipped data files)
behind the __hanjaHoverTestRuntime stub those scripts already accept in place of
chrome.runtime. Everything in the resulting pixels is the product's own
rendering; only the message transport is local. See pipeline/README.md.

This script then:

  1. serves the repo root over http on a free port (the staging pages use ES
     modules and fetch, neither of which works from file://),
  2. drives ONE headless Chrome over CDP -- a small websocket client and a
     synchronous JSON-RPC loop live in cdp.py, shared with run_selfchecks.py,
     so the whole tool is Python 3.12 stdlib plus PIL and there is no Node
     dependency,
  3. captures each scene in its own tab, with the viewport size set BEFORE
     navigation (content.js hides the popup on resize, so a late resize would
     empty the shot),
  4. mounts the side-panel shots alone, centered on a quiet neutral backdrop
     (the panel is those shots' whole subject; a page beside it only shrank
     it), keeping the page-beside-panel composite path for any future shot
     that needs it,
  5. asserts, per shot, both what the DOM says (the popup is up, the variant
     note rendered, the settings view mounted) and what the pixels say (exact
     size, RGB, no alpha, the corner seal actually visible where it is the
     point of the shot),
  6. and only then moves the files into screenshots/. Any failed assertion
     leaves the committed set untouched.

Flags
-----
    --only 3,8      regenerate just these shots (still writes atomically)
    --keep-temp     leave the working directory in place for inspection
"""

import argparse
import shutil
import sys
import tempfile
import time
import urllib.parse
from pathlib import Path

from PIL import Image

from cdp import Chrome, Tab, serve_root

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "screenshots"
STAGE_DIR = "pipeline/screenshots"

SHOT_W, SHOT_H = 1280, 800
# A side panel defaults to 360 wide; Chrome draws a 1px separator, leaving 919
# for the page. 919 + 1 + 360 = 1280. The panel is user-resizable, so a shot
# may override the split with "panel_w". A shot may also set "dark": True to
# capture under prefers-color-scheme: dark (both staging pages and all the
# product surfaces restyle themselves).
PAGE_W, PANEL_W = 919, 360
SEPARATOR = (218, 220, 224)
SEPARATOR_DARK = (60, 64, 67)

# A "solo" shot mounts the panel alone: captured 640 wide and canvas-height
# minus the margins tall, centered on a flat neutral backdrop. The backdrop
# (#e9ebef) must sit far enough under the panel's white that the panel reads
# as a card; the border is rgba(0,0,0,0.12) flattened onto the backdrop, and
# the halo is a 3px band of fainter grey standing in for a shadow.
SOLO_PANEL_W = 640
SOLO_MARGIN = 24
SOLO_PANEL_H = SHOT_H - 2 * SOLO_MARGIN
SOLO_BACKDROP = (233, 235, 239)
SOLO_BORDER = (205, 207, 210)
SOLO_HALO = (224, 226, 230)


# --------------------------------------------------------------------------
# The scenes.
#
# Every shot is a whole-viewport page capture ("page"), a side-panel capture
# mounted alone on the neutral backdrop ("solo"), or a page capture docked
# beside a side-panel capture ("composite", currently unused). `page` and
# `panel` are query strings for the staging pages; a "set" key in either turns
# the named settings toggles on for the scene (the committed seeding path; no
# defaults are ever hand-edited for a capture). `checks` are JS expressions
# that must all evaluate true after the page signals ready, before anything is
# captured.
# --------------------------------------------------------------------------

# Shorthands for the checks, which all run against the content script's own
# test hook rather than poking at the DOM blind.
POPUP_UP = ("popup is visible", "globalThis.__hanjaHover.isVisible()")


def head_is(text):
    return (
        f"card headline is {text}",
        f'globalThis.__hanjaHover.query(".card .surface").textContent === "{text}"',
    )


def has_text(label, selector, text):
    return (
        label,
        f'[...globalThis.__hanjaHover.queryAll("{selector}")]'
        f'.some((n) => n.textContent.includes("{text}"))',
    )


def panel_has(label, selector, text=None):
    if text is None:
        return (label, f'!!document.querySelector("{selector}")')
    return (
        label,
        f'[...document.querySelectorAll("{selector}")]'
        f'.some((n) => n.textContent.includes("{text}"))',
    )


SHOTS = [
    {
        "n": 1,
        "name": "1-character-lookup.png",
        "kind": "page",
        # 天 highlighted in the opening paragraph: one character, its eumhun,
        # its glosses and the compounds it builds. 天 replaced 學 for variety
        # (學生 already fronts the Japanese shot) and won on glyph simplicity
        # and compound appeal (천사, 천재).
        # 1.2: both readings toggles seeded, so the card carries its muted
        # JP テン · CN tiān sub-line inside the same composition.
        "page": {"scene": "1", "scroll": 0, "set": "jaReadings,zhReadings"},
        "checks": [POPUP_UP, head_is("\u5929"),
                   has_text("compounds listed", ".compounds .cpd-hangul", "\ucc9c\uc0ac"),
                   ("reading sub-line carries both languages",
                    'globalThis.__hanjaHover.query(".sino-line").textContent'
                    ' === "JP\u30c6\u30f3\u00b7CNti\u0101n"')],
    },
    {
        "n": 2,
        "name": "2-hangul-reverse-lookup.png",
        # 국민 (hangul) highlighted: the hangul-to-hanja direction. Captured
        # dark: one shot of the five-store set answers "does it do dark mode",
        # and this one reads best inverted.
        # 1.2: readings seeded, so the nested 國 and 民 component cards carry
        # their smaller sibling-reading lines.
        "kind": "page",
        "dark": True,
        "page": {"scene": "2", "scroll": 262, "set": "jaReadings,zhReadings"},
        "checks": [POPUP_UP, head_is("\u570b\u6c11"),
                   has_text("hangul headline", ".card .hangul", "\uad6d\ubbfc"),
                   ("a nested reading line rendered",
                    'globalThis.__hanjaHover.queryAll(".card.component .sino-line")'
                    ".length >= 1")],
    },
    {
        "n": 3,
        "name": "3-recursive-breakdown.png",
        # 자본 highlighted, then "used in larger words" opened and 資本主義
        # followed: the popup's own navigation, two levels deep.
        "kind": "page",
        "page": {"scene": "3", "scroll": 393, "bottom": 100},
        "checks": [POPUP_UP, head_is("\u8cc7\u672c\u4e3b\u7fa9"),
                   ("breadcrumb trail present",
                    '!!globalThis.__hanjaHover.query(".crumbs .crumb")')],
    },
    {
        "n": 4,
        "name": "4-homophone-browse.png",
        # A single hangul syllable, 국: every hanja read that way.
        "kind": "page",
        "page": {"scene": "4", "scroll": 566, "bottom": 80},
        "checks": [POPUP_UP,
                   ("several hanja share the reading",
                    'globalThis.__hanjaHover.queryAll(".reading-row").length >= 3'),
                   has_text("\u570b among them", ".reading-row", "\u570b")],
    },
    {
        "n": 5,
        "name": "5-sidebar-search.png",
        "kind": "solo",
        "panel": {"view": "search", "q": "\uad6d\ubbfc", "set": "nativeWords"},
        # Solo mount: the panel is the subject, so no article shares the frame.
        # The search view renders through content.js, so its nodes live in the
        # embedded panel's shadow root and only its own query hook sees them.
        # 1.2: nativeWords seeded, so the scope pills sit above the results, in
        # the panel page's own light DOM (hence document.* checks), All words
        # active as the fresh-open default. 국민 is Sino-Korean, so the result
        # list itself is unchanged.
        "checks": [head_is("國民"),
                   has_text("component cards", ".card .surface", "民"),
                   ("component section present",
                    '!!globalThis.__hanjaHover.query(".components")'),
                   ("both scope pills render",
                    'document.querySelectorAll(".scopebar .scope-pill")'
                    ".length === 2"),
                   ("All words is the active pill",
                    'document.querySelector(".scope-pill--active")'
                    '.textContent === "All words"')],
    },
    {
        "n": 6,
        "name": "6-saved-words.png",
        "kind": "solo",
        # Solo mount: the panel is the subject, so no article shares the frame.
        # Five rendered rows is the most the seal's room rule tolerates in the
        # 752px solo viewport (254px of room; a sixth row leaves 202 where the
        # rule wants 230), so the expanded folder is the five-row exam one and
        # the other two are collapsed, which is also the honest picture of a
        # library with three folders in it.
        "panel": {"view": "saved", "collapse": "Saved,\uad50\uacfc\uc11c"},
        "checks": [
            panel_has("saved view mounted", ".view--saved"),
            ("seal has room", 'document.querySelector(".view--saved")'
                              '.classList.contains("view--roomy")'),
            panel_has("filter reads All (13)", ".saved-bar", "All (13)"),
            panel_has("delete action present", ".saved-actions", "Delete"),
            panel_has("expanded folder rows", ".saved-row", "\u7d93\u6fdf"),
        ],
        "pixels": "seal",
    },
    {
        "n": 7,
        "name": "7-settings.png",
        "kind": "solo",
        "panel": {"view": "settings"},
        # Solo mount: the panel is the subject, so no article shares the frame.
        # 1.2 made this view taller (the Search and Character cards groups, the
        # about footer), and the product's own room rule now retires the seal:
        # the room under the content falls far short of the 230 the rule wants.
        # The seal checks left with it; the footer bound proves the taller view
        # still fits the 752px solo viewport uncropped.
        "checks": [
            panel_has("settings view mounted", ".view--settings"),
            panel_has("anki export section", ".view--settings", "Anki export"),
            panel_has("search group present", ".settings-group", "Search"),
            panel_has("character cards group present", ".settings-group",
                      "Character cards"),
            ("about footer fully in frame",
             'document.querySelector(".settings-about")'
             ".getBoundingClientRect().bottom < 752"),
        ],
    },
    {
        "n": 8,
        "name": "8-japanese-lookup.png",
        "kind": "page",
        # A Japanese page: 学生 highlighted resolves to the canonical 學生, and
        # the variant note that says so is the whole point of the shot.
        # 1.2: readings seeded, the natural fit: the component cards' JP lines
        # (ガク, セイ・ショウ) sit beside Japanese body text.
        "page": {"scene": "5", "scroll": 230, "set": "jaReadings,zhReadings"},
        "checks": [
            POPUP_UP,
            head_is("\u5b78\u751f"),
            has_text("variant note", ".canonical", "\u5b66\u751f \u2192 \u5b78\u751f"),
            has_text("component card 學", ".card .surface", "\u5b78"),
            has_text("component card 生", ".card .surface", "\u751f"),
            has_text("reading line on a component card",
                     ".card.component .sino-line", "ガク"),
            ("both component heads are in frame",
             '[...globalThis.__hanjaHover.queryAll(".card .surface")]'
             ".every((n) => n.getBoundingClientRect().bottom < 800)"),
        ],
    },
    {
        "n": 9,
        "name": "9-decomposition.png",
        "kind": "solo",
        # Solo mount: the panel is the subject, so no article shares the frame.
        # 樂 searched in the panel, its "Made of" row opened: four parts with
        # their readings (幺's arrives via the readings[0] fallback), and the
        # "Part of" row underneath — 樂 is inside 9 characters, 藥 among them.
        # Replaced 學 here for variety: 學生 already fronts the Japanese shot.
        # 1.2: readings seeded; 樂 is the set's richest entry, two readings in
        # each language, aligned pairwise (악 ↔ ガク ↔ yuè).
        "panel": {"view": "search", "q": "樂", "expand": "madeof",
                  "set": "jaReadings,zhReadings"},
        "checks": [
            head_is("樂"),
            ("reading line reads both languages in display order",
             'globalThis.__hanjaHover.query(".sino-line").textContent'
             ' === "JPガク·ラク·CNyuè·lè"'),
            ("made-of row is open",
             'globalThis.__hanjaHover.query(".madeof-row")'
             '.getAttribute("aria-expanded") === "true"'),
            ("part list is showing",
             '!globalThis.__hanjaHover.query(".madeof-list").hidden'),
            ("four part rows",
             'globalThis.__hanjaHover.queryAll(".madeof-part").length === 4'),
            # Every row must carry a reading: a bare glyph in the shot would
            # advertise the feature failing to join.
            ("every part row reads as a character",
             '[...globalThis.__hanjaHover.queryAll(".madeof-part")]'
             '.every((n) => n.classList.contains("nav") &&'
             ' (n.querySelector(".r-eumhun") || {}).textContent)'),
            has_text("나무 목 among the parts", ".madeof-part", "나무 목"),
            ("part-of row present",
             '!!globalThis.__hanjaHover.query(".foundin-row")'),
            ("part-of names a plausible count",
             '(globalThis.__hanjaHover.query(".foundin-row b").textContent | 0) >= 1'),
            ("the whole section is in frame",
             'globalThis.__hanjaHover.query(".foundin-row")'
             ".getBoundingClientRect().bottom < 752"),
        ],
    },
]


def stage_url(port, page, params):
    query = urllib.parse.urlencode(params)
    return f"http://127.0.0.1:{port}/{STAGE_DIR}/{page}?{query}"


def run_checks(tab, checks, shot_name):
    for label, expression in checks:
        try:
            ok = tab.evaluate(expression)
        except RuntimeError as exc:
            raise AssertionError(f"{shot_name}: check {label!r} threw: {exc}") from None
        if ok is not True:
            raise AssertionError(f"{shot_name}: check failed -- {label}")


def capture(chrome, port, page, params, width, checks=(), dark=False, height=SHOT_H):
    tab = Tab(chrome, width, height, dark)
    try:
        tab.navigate(stage_url(port, page, params))
        tab.wait_ready()
        run_checks(tab, checks, page)
        image = tab.screenshot()
    finally:
        tab.close()
    if image.size != (width, height):
        raise AssertionError(f"{page}: captured {image.size}, wanted {(width, height)}")
    return image


def compose(page_image, panel_image, dark=False):
    """Dock the panel to the right edge of the page, with the 1px separator
    Chrome draws between them."""
    out = Image.new("RGB", (SHOT_W, SHOT_H),
                    SEPARATOR_DARK if dark else SEPARATOR)
    out.paste(page_image, (0, 0))
    out.paste(panel_image, (page_image.width + 1, 0))
    return out


def compose_solo(panel_image):
    """Center the panel on the neutral backdrop, framed as a card: a 1px
    border under a 3px halo, both pasted as solid rectangles so the whole
    mount stays plain PIL."""
    out = Image.new("RGB", (SHOT_W, SHOT_H), SOLO_BACKDROP)
    x = (SHOT_W - panel_image.width) // 2
    y = (SHOT_H - panel_image.height) // 2
    for inset, color in ((4, SOLO_HALO), (1, SOLO_BORDER)):
        ring = Image.new("RGB", (panel_image.width + 2 * inset,
                                 panel_image.height + 2 * inset), color)
        out.paste(ring, (x - inset, y - inset))
    out.paste(panel_image, (x, y))
    return out


def assert_image(image, name):
    if image.size != (SHOT_W, SHOT_H):
        raise AssertionError(f"{name}: {image.size}, wanted {(SHOT_W, SHOT_H)}")
    if image.mode != "RGB":
        raise AssertionError(f"{name}: mode {image.mode}, wanted RGB")
    if "transparency" in image.info:
        raise AssertionError(f"{name}: carries a transparency key")


def assert_seal(image, name, corner=(SHOT_W, SHOT_H)):
    """The jade 玉篇 seal sits in the panel's lower-right corner when the view
    leaves room for it. Its ink is the only non-grey thing down there, so a
    green cast in that box is proof it rendered. `corner` is the panel's
    lower-right corner on the canvas; the default is the composite dock,
    where the panel ends at the canvas edge."""
    right, bottom = corner
    box = image.crop((right - 130, bottom - 230, right - 10, bottom - 10))
    pixels = box.tobytes()
    jade = 0
    for i in range(0, len(pixels), 3):
        r, g, b = pixels[i], pixels[i + 1], pixels[i + 2]
        if g > r + 8 and g > b + 4 and g < 245:
            jade += 1
    if jade < 200:
        raise AssertionError(f"{name}: seal not visible ({jade} jade pixels)")


def build(shot, chrome, port, work_dir):
    dark = shot.get("dark", False)
    seal_corner = (SHOT_W, SHOT_H)
    if shot["kind"] == "solo":
        panel_image = capture(chrome, port, "shots-panel.html", shot["panel"],
                              SOLO_PANEL_W, shot["checks"], dark,
                              height=SOLO_PANEL_H)
        image = compose_solo(panel_image)
        seal_corner = ((SHOT_W + SOLO_PANEL_W) // 2, SOLO_MARGIN + SOLO_PANEL_H)
    else:
        panel_w = shot.get("panel_w", PANEL_W)
        page_width = SHOT_W if shot["kind"] == "page" else SHOT_W - panel_w - 1
        page_checks = shot["checks"] if shot["kind"] == "page" else ()
        page_image = capture(chrome, port, "shots-page.html", shot["page"],
                             page_width, page_checks, dark)
        if shot["kind"] == "page":
            image = page_image
        else:
            panel_image = capture(chrome, port, "shots-panel.html", shot["panel"],
                                  panel_w, shot["checks"], dark)
            image = compose(page_image, panel_image, dark)

    assert_image(image, shot["name"])
    if shot.get("pixels") == "seal":
        assert_seal(image, shot["name"], seal_corner)

    out = work_dir / shot["name"]
    image.save(out, "PNG", optimize=True)
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="comma-separated shot numbers, e.g. 3,8")
    parser.add_argument("--keep-temp", action="store_true")
    args = parser.parse_args()

    wanted = SHOTS
    if args.only:
        keep = {int(n) for n in args.only.split(",")}
        wanted = [s for s in SHOTS if s["n"] in keep]
        if not wanted:
            raise SystemExit(f"--only {args.only} matched no shots")

    server, port = serve_root()
    work_dir = Path(tempfile.mkdtemp(prefix="okp-screenshots-"))
    chrome = Chrome()
    written = []
    try:
        for shot in wanted:
            started = time.time()
            path = build(shot, chrome, port, work_dir)
            written.append((shot, path))
            print(f"  ok  {shot['name']}  ({time.time() - started:.1f}s)")
    except BaseException:
        # A failed run must leave the committed set exactly as it was.
        if not args.keep_temp:
            shutil.rmtree(work_dir, ignore_errors=True)
        raise
    finally:
        chrome.close()
        server.shutdown()

    # Nothing lands until every shot passed every check.
    OUT_DIR.mkdir(exist_ok=True)
    for shot, path in written:
        shutil.move(str(path), str(OUT_DIR / shot["name"]))
    if not args.keep_temp:
        shutil.rmtree(work_dir, ignore_errors=True)
    print(f"wrote {len(written)} screenshot(s) to {OUT_DIR}")


if __name__ == "__main__":
    sys.exit(main())
