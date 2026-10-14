"""Build the Firefox package from the Chrome source tree.

    python pipeline/make_firefox.py

SPEC "Firefox and the English name": extension/ stays the Chrome package
exactly as it is. This script copies it to dist/firefox/ (gitignored),
rewrites only manifest.json for Firefox, checks the result, and zips it to
okpyeon-firefox-<version>.zip at the repo root. Zip entries use forward
slashes (zipfile always does), the property make_zip.ps1 has to enforce by
hand on Windows.

The manifest transform:
  - background: Firefox runs MV3 background scripts as event pages, never as
    service workers, so {"service_worker": ...} becomes {"scripts": [...]}
    with the same module type.
  - side_panel and the sidePanel permission go; sidebar_action takes their
    place with the same page, the localized name and the same icons.
  - host_permissions ["<all_urls>"] is added, matching the content script's
    reach, so Firefox asks for site access at install.
  - browser_specific_settings.gecko carries the add-on id, the minimum
    version, and the data collection declaration (Okpyeon collects nothing).
Everything else carries over unchanged.
"""

import json
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "extension")
OUT = os.path.join(ROOT, "dist", "firefox")

GECKO_ID = "okpyeon@jjm4000.github.io"   # permanent once submitted to AMO
MIN_VERSION = "140.0"          # data_collection_permissions needs 140
MIN_ANDROID = "142.0"          # and 142 on Android
SKIP = {"package.json"}                    # Node-only, as in make_zip.ps1


def firefox_manifest(chrome):
    """The Firefox manifest for a Chrome manifest dict (pure)."""
    m = json.loads(json.dumps(chrome))     # deep copy, key order kept
    bg = m.pop("background")
    m["background"] = {"scripts": [bg["service_worker"]]}
    if bg.get("type"):
        m["background"]["type"] = bg["type"]
    panel = m.pop("side_panel")
    m["permissions"] = [p for p in m.get("permissions", []) if p != "sidePanel"]
    m["host_permissions"] = ["<all_urls>"]
    m["sidebar_action"] = {
        "default_panel": panel["default_path"],
        "default_title": m["name"],
        "default_icon": dict(m["action"]["default_icon"]),
        "open_at_install": False,
    }
    m["browser_specific_settings"] = {
        "gecko": {
            "id": GECKO_ID,
            "strict_min_version": MIN_VERSION,
            "data_collection_permissions": {"required": ["none"]},
        },
        "gecko_android": {"strict_min_version": MIN_ANDROID},
    }
    return m


def check(chrome, firefox, out_dir):
    """The SPEC's output checks; returns a list of problems (empty is good)."""
    problems = []
    if firefox.get("version") != chrome.get("version"):
        problems.append("version differs from the Chrome manifest")
    for key in ("side_panel",):
        if key in firefox:
            problems.append("Chrome-only key left: %s" % key)
    if "sidePanel" in firefox.get("permissions", []):
        problems.append("Chrome-only permission left: sidePanel")
    if "service_worker" in firefox.get("background", {}):
        problems.append("background still names a service worker")
    named = list(firefox["background"]["scripts"])
    named.append(firefox["sidebar_action"]["default_panel"])
    named.extend(firefox["sidebar_action"]["default_icon"].values())
    named.extend(firefox.get("icons", {}).values())
    for cs in firefox.get("content_scripts", []):
        named.extend(cs.get("js", []))
        named.extend(cs.get("css", []))
    named.append("_locales/%s/messages.json" % firefox["default_locale"])
    for rel in named:
        if not os.path.isfile(os.path.join(out_dir, rel)):
            problems.append("manifest names a missing file: %s" % rel)
    return problems


def main():
    with open(os.path.join(SRC, "manifest.json"), encoding="utf-8") as f:
        chrome = json.load(f)
    firefox = firefox_manifest(chrome)

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT, ignore=shutil.ignore_patterns(*SKIP))
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(firefox, f, ensure_ascii=False, indent=2)
        f.write("\n")

    problems = check(chrome, firefox, OUT)
    if problems:
        for p in problems:
            print("FAIL  " + p)
        sys.exit(1)

    zip_path = os.path.join(ROOT, "okpyeon-firefox-%s.zip" % firefox["version"])
    if os.path.exists(zip_path):
        os.remove(zip_path)
    count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for dirpath, _dirs, files in os.walk(OUT):
            for name in sorted(files):
                full = os.path.join(dirpath, name)
                rel = os.path.relpath(full, OUT).replace(os.sep, "/")
                z.write(full, rel)
                count += 1
    print("built %s (%d files, %.2f MB)" % (zip_path, count, os.path.getsize(zip_path) / 1048576))
    print("unpacked copy for web-ext: %s" % OUT)


if __name__ == "__main__":
    main()
