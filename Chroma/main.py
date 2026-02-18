#!/usr/bin/env python3
"""
Chroma – PyWebView port of the original Dashcode Dashboard widget by iaian7.com
HSV/RGB/HEX colour picker with a persistent, grouped colour library.

Requires:  pip install pywebview
Run:       python main.py
"""

import json
import os
import subprocess

import webview

# ── Paths ─────────────────────────────────────────────────────────────────────
APP_DIR    = os.path.dirname(os.path.abspath(__file__))
PREFS_PATH = os.path.join(APP_DIR, "chroma_prefs.json")

DEFAULT_PREFS = {
    # Current colour (HSV stored as H=0–360, S/V=0–1 float; RGB=0–1 float)
    "H": 70,
    "S": 0.8,
    "V": 0.9,
    "R": 0.78,
    "G": 0.90,
    "B": 0.18,
    "X": "C6E52D",
    # Library: packed string using the original "::" / ":" format
    "library": (
        "grayscale:black:0.0:0.0:0.0:0.0:0.0:0.0:000000:2::"
        "grayscale:gray:0.0:0.0:0.5:0.5:0.5:0.5:656565:3::"
        "grayscale:white:0.0:0.0:1.0:1.0:1.0:1.0:FFFFFF:4::"
        "group:grassy green:70:0.8:0.9:0.78:0.90:0.18:C6E52D:1"
    ),
    # UI preferences
    "sort":       0,
    "show":       0,
    "formatHSV":  0,
    "formatRGB":  0,
    "accuracy":   1,
    "group":      "group",
    "name":       "name",
    "scroll":     0,
}


class ChromaAPI:
    """Python-side API exposed to JS via window.pywebview.api.*"""

    # ── Prefs ─────────────────────────────────────────────────────────────────

    def load_prefs(self) -> dict:
        if os.path.exists(PREFS_PATH):
            try:
                with open(PREFS_PATH) as f:
                    saved = json.load(f)
                return {**DEFAULT_PREFS, **saved}
            except Exception:
                pass
        return dict(DEFAULT_PREFS)

    def save_prefs(self, prefs: dict) -> bool:
        try:
            merged = {**DEFAULT_PREFS, **prefs}
            with open(PREFS_PATH, "w") as f:
                json.dump(merged, f, indent=2)
            return True
        except Exception as e:
            return str(e)

    def erase_prefs(self) -> bool:
        if os.path.exists(PREFS_PATH):
            os.remove(PREFS_PATH)
        return True

    # ── Clipboard ─────────────────────────────────────────────────────────────

    def clipboard_write(self, text: str) -> bool:
        """Write text to the system clipboard via pbcopy (macOS) or xclip/xsel (Linux)."""
        try:
            # macOS
            p = subprocess.run(["pbcopy"], input=text.encode(), timeout=5)
            return p.returncode == 0
        except FileNotFoundError:
            pass
        # Linux
        for cmd in (["xclip", "-selection", "clipboard"],
                    ["xsel", "--clipboard", "--input"]):
            try:
                p = subprocess.run(cmd, input=text.encode(), timeout=5)
                return p.returncode == 0
            except FileNotFoundError:
                continue
        return False

    def clipboard_read(self) -> str | None:
        """Read text from the system clipboard via pbpaste (macOS) or xclip/xsel (Linux)."""
        try:
            result = subprocess.run(
                ["pbpaste"], capture_output=True, timeout=5
            )
            if result.returncode == 0:
                return result.stdout.decode("utf-8", errors="replace")
        except FileNotFoundError:
            pass
        for cmd in (["xclip", "-selection", "clipboard", "-o"],
                    ["xsel", "--clipboard", "--output"]):
            try:
                result = subprocess.run(cmd, capture_output=True, timeout=5)
                if result.returncode == 0:
                    return result.stdout.decode("utf-8", errors="replace")
            except FileNotFoundError:
                continue
        return None

    # ── Website ───────────────────────────────────────────────────────────────

    def open_url(self, url: str) -> bool:
        import webbrowser
        webbrowser.open(url)
        return True


# ── Window ────────────────────────────────────────────────────────────────────

def main():
    api      = ChromaAPI()
    html_path = os.path.join(APP_DIR, "app", "index.html")

    webview.create_window(
        title="Chroma",
        url=f"file://{html_path}",
        js_api=api,
        width=340,
        height=480,
        resizable=True,
        background_color="#111111",
        min_size=(300, 400),
    )
    webview.start(debug=False)


if __name__ == "__main__":
    main()
