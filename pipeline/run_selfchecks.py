"""Run the browser self-check pages in headless Chrome.

    python pipeline/run_selfchecks.py [--page index|embed|both] [--port N]
                                      [--timeout S] [--keep]

test-page/index.html and test-page/embed.html each carry hundreds of check()
assertions behind a "Run self-checks" button, driven by a fake chrome.runtime.
Opening them in a visible browser is the manual route; this script is the
unattended one. It serves the repo root over http (the pages fetch the
extension's own source for some checks, which file:// forbids), launches one
headless Chrome through the CDP client in cdp.py, and for each page:

  1. opens it in a fresh tab at a fixed 1280x1000 viewport, device scale
     factor 1 (several checks measure the popup against the viewport and
     were calibrated at scale 1),
  2. clicks the page's #run button once the document has loaded,
  3. polls #out until the suite has rewritten it (the pages write the whole
     transcript in one go when they finish: one PASS/FAIL/SKIP line per
     check, THREW for an uncaught error, and a closing ALL PASS (n) or
     n FAILED / m passed line), or gives up after --timeout seconds,
  4. prints the counts, then every FAIL and THREW line verbatim.

The check count printed per page is pass + fail, the number of assertions that
actually ran; skipped checks are listed separately. Compare it with the suite
size recorded in the last commit that touched the page.

Exit status is 0 only when every requested page completed with no failures
and no thrown error. Downloads are denied at the browser level, so the embed
page's export checks (which click a real download anchor) can never write to
the Downloads folder even if the page's own preventDefault guard changes.

Flags
-----
    --page index|embed|both   which page(s) to run (default both)
    --port N                  serve on a fixed port instead of a free one
    --timeout S               seconds to wait for one page's suite (default 300)
    --keep                    also write each page's full transcript to a file
                              in the system temp directory and print the path
"""

import argparse
import json
import re
import sys
import tempfile
import time
from pathlib import Path

from cdp import Chrome, Tab, serve_root

PAGES = {
    "index": "test-page/index.html",
    "embed": "test-page/embed.html",
}

VIEW_W, VIEW_H = 1280, 1000
LOAD_TIMEOUT = 30

SUMMARY_PASS = re.compile(r"^ALL PASS \((\d+)\)")
SUMMARY_FAIL = re.compile(r"^(\d+) FAILED / (\d+) passed")
SUMMARY_SKIP = re.compile(r"(\d+) skipped")


def wait_for(tab, expression, timeout, what):
    """Poll a JS expression until it is truthy. Evaluation errors while the
    page is still navigating are retried, not raised."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            value = tab.evaluate(expression)
        except RuntimeError:
            value = None
        if value:
            return value
        time.sleep(0.25)
    raise TimeoutError(f"{what} after {timeout}s")


def run_page(chrome, port, name, timeout):
    url = f"http://127.0.0.1:{port}/{PAGES[name]}"
    tab = Tab(chrome, VIEW_W, VIEW_H)
    try:
        # Headless Chrome throttles timers in tabs it considers hidden, and
        # the suites lean on setTimeout throughout, so the tab is made the
        # active one and told it has focus before anything runs.
        chrome.call("Target.activateTarget", {"targetId": tab.target})
        tab.call("Emulation.setFocusEmulationEnabled", {"enabled": True})
        tab.navigate(url)
        wait_for(tab, 'document.readyState === "complete"'
                      ' && !!document.getElementById("run")'
                      ' && !!document.getElementById("out")',
                 LOAD_TIMEOUT, f"{name}: page never finished loading")
        before = tab.evaluate('document.getElementById("out").textContent')
        started = time.time()
        tab.evaluate('document.getElementById("run").click(); true')
        text = wait_for(
            tab,
            f'(function () {{ var t = document.getElementById("out").textContent;'
            f' return t === {json.dumps(before)} ? null : t; }})()',
            timeout, f"{name}: self-checks did not finish")
        elapsed = time.time() - started
    finally:
        tab.close()
    return url, text, elapsed


def parse(text):
    """Split a transcript into counts and the lines worth repeating."""
    lines = text.split("\n")
    failing = [l for l in lines if l.startswith("FAIL  ") or l.startswith("THREW  ")]
    counted = {
        "pass": sum(1 for l in lines if l.startswith("PASS  ")),
        "fail": sum(1 for l in lines if l.startswith("FAIL  ")),
        "skip": sum(1 for l in lines if l.startswith("SKIP  ")),
        "threw": sum(1 for l in lines if l.startswith("THREW  ")),
    }
    summary = next((l for l in reversed(lines) if l.strip()), "")
    m = SUMMARY_PASS.match(summary)
    if m:
        reported = (int(m.group(1)), 0)
    else:
        m = SUMMARY_FAIL.match(summary)
        reported = (int(m.group(2)), int(m.group(1))) if m else None
    skipped = SUMMARY_SKIP.search(summary)
    return {
        "counted": counted,
        "reported": reported,
        "reported_skip": int(skipped.group(1)) if skipped else 0,
        "summary": summary,
        "failing": failing,
        "complete": reported is not None,
    }


def report(name, url, text, elapsed):
    r = parse(text)
    c = r["counted"]
    print(f"{PAGES[name]}  ({elapsed:.1f}s)")
    if not r["complete"]:
        print("  DID NOT COMPLETE; the page wrote:")
        for line in text.split("\n")[:20]:
            print("    " + line)
        return False
    ran = c["pass"] + c["fail"]
    print(f"  checks: {ran}  pass {c['pass']}  fail {c['fail']}"
          f"  skipped {c['skip']}  threw {c['threw']}")
    print(f"  {r['summary']}")
    if r["reported"] != (c["pass"], c["fail"]) or r["reported_skip"] != c["skip"]:
        # The closing line and the per-check lines disagree, which means the
        # transcript was not read the way the page wrote it.
        print(f"  WARNING: closing line says pass {r['reported'][0]}"
              f" fail {r['reported'][1]} skipped {r['reported_skip']},"
              f" but the lines count differently")
    for line in r["failing"]:
        print("  " + line)
    return c["fail"] == 0 and c["threw"] == 0


def main():
    # Check names carry hanja and hangul; the Windows console default is cp1252.
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--page", choices=["index", "embed", "both"], default="both")
    parser.add_argument("--port", type=int, default=0,
                        help="static server port (default: a free one)")
    parser.add_argument("--timeout", type=float, default=300,
                        help="seconds to wait for one page's suite (default 300)")
    parser.add_argument("--keep", action="store_true",
                        help="write each transcript to the system temp directory")
    args = parser.parse_args()
    names = ["index", "embed"] if args.page == "both" else [args.page]

    server, port = serve_root(args.port)
    chrome = None
    ok = True
    try:
        chrome = Chrome(window=(VIEW_W, VIEW_H))
        chrome.call("Browser.setDownloadBehavior", {"behavior": "deny"})
        for name in names:
            try:
                url, text, elapsed = run_page(chrome, port, name, args.timeout)
            except TimeoutError as exc:
                print(f"{PAGES[name]}")
                print(f"  DID NOT COMPLETE: {exc}")
                ok = False
                continue
            if args.keep:
                out = Path(tempfile.gettempdir()) / f"okp-selfchecks-{name}.txt"
                out.write_text(text, encoding="utf-8")
                print(f"  transcript: {out}")
            ok = report(name, url, text, elapsed) and ok
    finally:
        if chrome is not None:
            chrome.close()
        server.shutdown()
        server.server_close()

    print("all green" if ok else "FAILURES above")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
