#!/usr/bin/env python3
"""
Sheets – PyWebView port of the original Dashcode Dashboard widget by iaian7.com
Wraps ImageMagick's `montage` command to build sprite sheets and contact sheets
from drag-and-dropped image files.

Requires:  pip install pywebview
Optional:  ImageMagick installed (brew install imagemagick on macOS)
Run:       python main.py
"""

import json
import os
import re
import subprocess
import webbrowser

import webview

# ── Preferences file (written alongside the script) ──────────────────────────
PREFS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sheets_prefs.json")

DEFAULT_PREFS = {
    # Processing mode (maps to prefType index)
    # 0=auto  1=horizontal  2=vertical  3=fixed-size  4=fixed-tile
    # 5=sprite-sheet  6=contact-sheet
    "type":        0,
    "size":        "128x128",
    "tile":        "4x4",
    "loc":         "/opt/homebrew/bin/",   # default Homebrew path on Apple Silicon
    "nameSprite":  "Sheet-%d",
    "nameFile":    "Files-",
    # Scale filter index: 0=Point 1=Box 2=Cubic 3=Quadratic 4=Gaussian
    #                     5=Mitchell 6=Catrom 7=Lanczos  8=none
    "scale":       3,
    # Output channel index: 0=RGBA  1=RGB  2=Alpha  3=All three
    "output":      0,
}

SCALE_FILTERS = [
    "Point", "Box", "Cubic", "Quadratic",
    "Gaussian", "Mitchell", "Catrom", "Lanczos",
]

OUTPUT_MODES = ["rgba", "rgb", "alpha", "all"]


class SheetsAPI:
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

    def check_imagemagick(self, loc: str) -> dict:
        """Verify that ImageMagick montage is reachable at `loc`."""
        binary = os.path.join(loc.rstrip("/"), "montage")
        exists = os.path.isfile(binary) and os.access(binary, os.X_OK)
        # Also try PATH as a fallback
        if not exists:
            import shutil
            exists = shutil.which("montage") is not None
        return {"ok": exists, "path": binary}

    # ── Core processing ───────────────────────────────────────────────────────

    def process_files(self, file_uris: list, prefs: dict) -> dict:
        """
        Receive a list of file:// URIs from the front-end drag-drop, build
        the ImageMagick montage command(s), execute them, and return a result
        dict: { ok: bool, message: str, commands: [str] }
        """
        try:
            # ── Decode URIs → absolute paths ──────────────────────────────────
            paths = []
            for uri in file_uris:
                p = uri.replace("file://localhost", "").replace("file://", "")
                p = p.strip()
                # URL-decode common escapes
                p = p.replace("%20", " ").replace("%28", "(").replace("%29", ")")
                p = os.path.normpath(p)
                paths.append(p)

            if not paths:
                return {"ok": False, "message": "No files received.", "commands": []}

            # ── Validate: all must be image files ─────────────────────────────
            IMAGE_EXTS = {
                ".png", ".jpg", ".jpeg", ".gif", ".tif", ".tiff",
                ".bmp", ".webp", ".psd", ".tga", ".exr",
            }
            for p in paths:
                ext = os.path.splitext(p)[1].lower()
                if ext not in IMAGE_EXTS:
                    return {
                        "ok": False,
                        "message": f"Unsupported file type: {os.path.basename(p)}\n"
                                   "Only image files are accepted.",
                        "commands": [],
                        "wrong_type": True,
                    }

            # ── Sort alphanumerically (mirrors original sortAlphaNum) ──────────
            paths = sorted(paths, key=_alphanum_key)

            # ── Build command parameters ──────────────────────────────────────
            ptype       = int(prefs.get("type", 0))
            psize       = prefs.get("size", "128x128").strip()
            ptile       = prefs.get("tile", "4x4").strip()
            loc         = prefs.get("loc", "/opt/homebrew/bin/").rstrip("/") + "/"
            name_sprite = prefs.get("nameSprite", "Sheet-%d")
            name_file   = prefs.get("nameFile", "Files-")
            pscale      = int(prefs.get("scale", 3))
            poutput     = int(prefs.get("output", 0))

            montage_bin = loc + "montage"

            # Fall back to PATH if the configured binary doesn't exist
            if not os.path.isfile(montage_bin):
                import shutil
                found = shutil.which("montage")
                if found:
                    montage_bin = found
                else:
                    return {
                        "ok": False,
                        "message": (
                            "ImageMagick 'montage' not found.\n"
                            f"Configured path: {loc}\n"
                            "Install via: brew install imagemagick"
                        ),
                        "commands": [],
                    }

            # Scale filter flag
            if pscale < len(SCALE_FILTERS):
                scale_flag = ["-filter", SCALE_FILTERS[pscale]]
            else:
                scale_flag = []

            # Tile / geometry flags and output name(s)
            tile_flag     = []
            geometry_flag = []
            mode_flags    = []   # e.g. padding / label for contact sheet
            padding       = 4

            # Derive base name info from the first file
            first = paths[0]
            first_dir  = os.path.dirname(first)
            first_base = os.path.basename(first)

            # Try to match trailing number + extension
            m = re.match(r"^(.+?)(\d+)(\.\w{2,5})$", first_base)
            if not m:
                m = re.match(r"^(.+?)(\.\w{2,5})$", first_base)
                if m:
                    stem, ext = m.group(1), m.group(2)
                    num_part  = None
                else:
                    stem, ext, num_part = first_base, "", None
            else:
                stem, num_part, ext = m.group(1), m.group(2), m.group(3)

            # Output names for single-sequence drop (wildcard glob)
            if len(paths) == 1 or num_part is not None:
                # Build glob pattern (ImageMagick handles globbing)
                glob_pattern = os.path.join(first_dir, stem + "*" + ext)
                input_spec   = [glob_pattern]
            else:
                input_spec = paths

            out_base_sprite = os.path.join(first_dir, stem + name_sprite + ext)
            out_base_rgb    = os.path.join(first_dir, stem + name_sprite + ".rgb" + ext)
            out_base_alpha  = os.path.join(first_dir, stem + name_sprite + ".a" + ext)

            if ptype == 1:
                tile_flag = ["-tile", "x1"]
            elif ptype == 2:
                tile_flag = ["-tile", "1x"]
            elif ptype == 3:
                geometry_flag = ["-geometry", psize]
            elif ptype == 4:
                tile_flag = ["-tile", ptile]
            elif ptype >= 5:
                geometry_flag = ["-geometry", psize]
                tile_flag     = ["-tile", ptile]
                if ptype == 6:
                    # Contact sheet: add padding and filename labels
                    mode_flags = [
                        "+%d+%d" % (padding, padding),
                        "-label", "%f\n%[width]x%[height]",
                    ]
                    # Contact sheet uses a different name pattern
                    # Match: dir / nameFile + basename
                    m2 = re.match(r"^(.+?)([^/]+)(\.\w{2,5})$", first_base)
                    if m2:
                        out_base_sprite = os.path.join(
                            first_dir, name_file + m2.group(2) + m2.group(3)
                        )
                        out_base_rgb   = os.path.join(
                            first_dir, name_file + m2.group(2) + ".flat" + m2.group(3)
                        )
                        out_base_alpha = os.path.join(
                            first_dir, name_file + m2.group(2) + ".alpha" + m2.group(3)
                        )

            # Geometry mode flag ("+0+0" default, or with padding for contact)
            if not mode_flags:
                if geometry_flag:
                    mode_flags = []          # -geometry already carries position
                else:
                    mode_flags = []

            # ── Build command lists ───────────────────────────────────────────
            base_cmd = (
                [montage_bin, "-background", "none"]
                + scale_flag
                + tile_flag
                + geometry_flag
            )

            commands = []

            def make_cmd(alpha_mode, output_path):
                return base_cmd + ["-alpha", alpha_mode] + input_spec + [output_path]

            if poutput in (0, 3):
                commands.append(make_cmd("set",     out_base_sprite))
            if poutput in (1, 3):
                commands.append(make_cmd("off",     out_base_rgb))
            if poutput in (2, 3):
                commands.append(make_cmd("extract", out_base_alpha))

            if not commands:
                return {"ok": False, "message": "No output mode selected.", "commands": []}

            # ── Execute ───────────────────────────────────────────────────────
            cmd_strings = [" ".join(c) for c in commands]
            errors = []
            for cmd in commands:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
                if result.returncode != 0:
                    errors.append(result.stderr.strip() or f"Exit {result.returncode}")

            if errors:
                return {
                    "ok": False,
                    "message": "ImageMagick reported errors:\n" + "\n".join(errors),
                    "commands": cmd_strings,
                }

            # ── Build a human-readable summary ───────────────────────────────
            outputs = []
            if poutput in (0, 3):
                outputs.append(os.path.basename(out_base_sprite))
            if poutput in (1, 3):
                outputs.append(os.path.basename(out_base_rgb))
            if poutput in (2, 3):
                outputs.append(os.path.basename(out_base_alpha))

            n_files = len(paths) if len(paths) > 1 else "glob"
            summary = (
                f"{len(outputs)} file{'s' if len(outputs) != 1 else ''} written:\n"
                + "\n".join(outputs)
            )

            return {"ok": True, "message": summary, "commands": cmd_strings}

        except subprocess.TimeoutExpired:
            return {"ok": False, "message": "ImageMagick timed out (>120 s).", "commands": []}
        except Exception as ex:
            return {"ok": False, "message": f"Unexpected error: {ex}", "commands": []}


# ── Alphanumeric sort (mirrors original sortAlphaNum) ─────────────────────────
def _alphanum_key(path: str):
    basename = os.path.basename(path)
    parts = re.split(r"(\d+)", basename)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


# ── Window ────────────────────────────────────────────────────────────────────
def main():
    api = SheetsAPI()
    html_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app", "index.html")

    window = webview.create_window(
        title="Sheets",
        url=f"file://{html_path}",
        js_api=api,
        width=310,
        height=220,
        resizable=False,
        background_color="#111111",
        min_size=(310, 220),
    )

    webview.start(debug=False)


if __name__ == "__main__":
    main()
