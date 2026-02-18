#!/usr/bin/env python3
"""
Crusher – PyWebView port of the original Dashcode Dashboard widget by iaian7.com
Reduces PNG color depth using pngquant.

Requires:  pip install pywebview
Optional:  pngquant installed (brew install pngquant on macOS)
Run:       python main.py
"""

import json
import os
import re
import shutil
import subprocess
import webbrowser

import webview

# ── Preferences file ──────────────────────────────────────────────────────────
PREFS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "crusher_prefs.json")

DEFAULT_PREFS = {
    "dither":      False,
    "ie6":         False,
    "colors":      256,
    "loc":         "/opt/homebrew/bin/",
    # quality/speed index: 0=Fastest … 4=Best (maps to pngquant --speed 5..1)
    "quality":     2,
    # overwrite index: 0=Skip existing  1=Overwrite  (maps to pngquant --force / no flag)
    "overwrite":   1,
    # Output suffix patterns (%d is replaced by the color count)
    "name":        ".%d",
    "nameDither":  ".dither",
    "nameIE6":     ".ie6",
}

# pngquant speed flag: quality index → --speed value (1=slowest/best, 11=fastest/worst)
SPEED_MAP = [5, 4, 3, 2, 1]


class CrusherAPI:
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
            with open(PREFS_PATH, "w") as f:
                json.dump(prefs, f, indent=2)
            return True
        except Exception as e:
            return str(e)

    def erase_prefs(self) -> bool:
        if os.path.exists(PREFS_PATH):
            os.remove(PREFS_PATH)
        return True

    # ── System utility ────────────────────────────────────────────────────────

    def open_url(self, url: str) -> bool:
        webbrowser.open(url)
        return True

    def check_pngquant(self, loc: str) -> dict:
        """Verify that pngquant is reachable at `loc`."""
        binary = os.path.join(loc.rstrip("/"), "pngquant")
        if os.path.isfile(binary) and os.access(binary, os.X_OK):
            return {"ok": True, "path": binary}
        found = shutil.which("pngquant")
        if found:
            return {"ok": True, "path": found}
        return {"ok": False, "path": binary}

    # ── Core processing ───────────────────────────────────────────────────────

    def process_files(self, file_paths: list, prefs: dict) -> dict:
        """
        Run pngquant on each dropped PNG file.
        Returns { ok, message, commands, results }
        """
        try:
            # ── Normalise paths ───────────────────────────────────────────────
            paths = []
            for p in file_paths:
                p = p.replace("file://localhost", "").replace("file://", "").strip()
                p = re.sub(r"%([0-9A-Fa-f]{2})", lambda m: chr(int(m.group(1), 16)), p)
                p = os.path.normpath(p)
                paths.append(p)

            if not paths:
                return {"ok": False, "message": "No files received.", "commands": []}

            # ── Validate: PNGs only ───────────────────────────────────────────
            for p in paths:
                if not p.lower().endswith(".png"):
                    return {
                        "ok": False,
                        "message": f"Wrong file type:\n{os.path.basename(p)}\n\nCrusher only processes PNG files.",
                        "commands": [],
                        "wrong_type": True,
                    }
                if not os.path.isfile(p):
                    return {
                        "ok": False,
                        "message": f"File not found:\n{os.path.basename(p)}",
                        "commands": [],
                    }

            # ── Sort alphanumerically (mirrors original sortAlphaNum) ──────────
            paths = sorted(paths, key=_alphanum_key)

            # ── Resolve pngquant binary ───────────────────────────────────────
            loc = prefs.get("loc", "/opt/homebrew/bin/").rstrip("/") + "/"
            pngquant_bin = loc + "pngquant"
            if not (os.path.isfile(pngquant_bin) and os.access(pngquant_bin, os.X_OK)):
                found = shutil.which("pngquant")
                if found:
                    pngquant_bin = found
                else:
                    return {
                        "ok": False,
                        "message": (
                            "pngquant not found.\n"
                            f"Configured path: {loc}\n\n"
                            "Install via: brew install pngquant"
                        ),
                        "commands": [],
                    }

            # ── Build pngquant flags ──────────────────────────────────────────
            dither    = bool(prefs.get("dither", False))
            ie6       = bool(prefs.get("ie6", False))
            colors    = int(prefs.get("colors", 256))
            colors    = max(8, min(256, colors))
            quality   = int(prefs.get("quality", 2))
            overwrite = int(prefs.get("overwrite", 1))
            name      = str(prefs.get("name", ".%d")).replace("%d", str(colors))
            name_d    = str(prefs.get("nameDither", ".dither"))
            name_ie6  = str(prefs.get("nameIE6", ".ie6"))

            speed = SPEED_MAP[quality] if quality < len(SPEED_MAP) else 3

            # Build the --ext suffix: base + optional dither + optional IE6
            ext_suffix = name
            if dither:
                ext_suffix += name_d
            if ie6:
                ext_suffix += name_ie6
            ext_suffix += ".png"

            flags = []
            if overwrite == 1:
                flags += ["--force"]
            flags += ["--speed", str(speed)]
            if not dither:
                flags += ["--nofs"]
            if ie6:
                flags += ["--iebug"]
            flags += ["--ext", ext_suffix]

            # ── Process each file ─────────────────────────────────────────────
            commands  = []
            errors    = []
            successes = []

            for path in paths:
                cmd = [pngquant_bin] + flags + [str(colors), path]
                commands.append(" ".join(cmd))

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=60,
                )

                basename = os.path.basename(path)
                if result.returncode == 0:
                    # Derive expected output filename
                    stem = os.path.splitext(basename)[0]
                    out_name = stem + ext_suffix
                    successes.append(out_name)
                elif result.returncode == 99:
                    # pngquant exit 99 = file already exists (no --force)
                    errors.append(f"{basename}: output already exists (enable overwrite)")
                else:
                    err = (result.stderr or result.stdout or "").strip()
                    errors.append(f"{basename}: {err or f'exit {result.returncode}'}")

            # ── Build result summary ──────────────────────────────────────────
            if errors and not successes:
                return {
                    "ok": False,
                    "message": "\n".join(errors),
                    "commands": commands,
                }

            msg_parts = []
            if successes:
                msg_parts.append(
                    f"{len(successes)} file{'s' if len(successes) != 1 else ''} crushed:"
                )
                msg_parts += successes
            if errors:
                msg_parts.append("\nWarnings:")
                msg_parts += errors

            return {
                "ok": True,
                "message": "\n".join(msg_parts),
                "commands": commands,
            }

        except subprocess.TimeoutExpired:
            return {"ok": False, "message": "pngquant timed out (>60 s).", "commands": []}
        except Exception as ex:
            return {"ok": False, "message": f"Unexpected error:\n{ex}", "commands": []}


# ── Alphanumeric sort (mirrors original sortAlphaNum) ─────────────────────────
def _alphanum_key(path: str):
    basename = os.path.basename(path)
    parts = re.split(r"(\d+)", basename)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


# ── Window ────────────────────────────────────────────────────────────────────
def main():
    api = CrusherAPI()
    html_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "app", "index.html"
    )

    window = webview.create_window(
        title="Crusher",
        url=f"file://{html_path}",
        js_api=api,
        width=300,
        height=200,
        resizable=False,
        background_color="#111111",
        min_size=(300, 200),
    )

    webview.start(debug=False)


if __name__ == "__main__":
    main()
