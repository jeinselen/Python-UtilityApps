#!/usr/bin/env python3
"""
Ratio - PyWebView port of the original Dashcode Dashboard widget.
Requires: pip install pywebview
Run:      python main.py
"""

import webview
import json
import os

# ──────────────────────────────────────────────
# Preferences are stored in a small JSON file
# alongside the script (mirrors widget.preferenceForKey)
# ──────────────────────────────────────────────
PREFS_PATH = os.path.join(os.path.dirname(__file__), "ratio_prefs.json")

DEFAULT_PREFS = {
    "preset":    1,
    "limit":     10,
    "limitID":   2,
    "scale":     66.67,
    "ratio":     "16 x 9",
    "aspect":    1.778,
    "lock":      False,
    "width":     1920,
    "height":    1080,
}


class RatioAPI:
    """Python-side API exposed to the JS front-end via window.pywebview.api.*"""

    # ── prefs ──────────────────────────────────────────────────────────────

    def load_prefs(self):
        if os.path.exists(PREFS_PATH):
            try:
                with open(PREFS_PATH) as f:
                    saved = json.load(f)
                prefs = {**DEFAULT_PREFS, **saved}
                return prefs
            except Exception:
                pass
        return dict(DEFAULT_PREFS)

    def save_prefs(self, prefs: dict):
        try:
            with open(PREFS_PATH, "w") as f:
                json.dump(prefs, f, indent=2)
            return True
        except Exception as e:
            return str(e)

    def erase_prefs(self):
        if os.path.exists(PREFS_PATH):
            os.remove(PREFS_PATH)
        return True

    # ── open external URL ──────────────────────────────────────────────────

    def open_url(self, url: str):
        import webbrowser
        webbrowser.open(url)
        return True


def main():
    api = RatioAPI()
    html_path = os.path.join(os.path.dirname(__file__), "app", "index.html")

    window = webview.create_window(
        title="Ratio",
        url=f"file://{html_path}",
        js_api=api,
        width=275,
        height=235,
        resizable=True,
        background_color="#1a1a1a",
        min_size=(270, 145),
    )

    webview.start(debug=False)


if __name__ == "__main__":
    main()