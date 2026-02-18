#!/usr/bin/env python3
"""
Alchemist – PyWebView port of the original Dashcode Dashboard widget by iaian7.com
Batch video/audio converter wrapping FFmpeg and (optionally) the legacy qt_export tool.

Requires:  pip install pywebview
Optional:  FFmpeg (brew install ffmpeg), ffmpeg2theora (brew install ffmpeg2theora)
           qt_export + QuickTime (legacy macOS only, for ProRes/HDV/AIC modes)
Run:       python main.py
"""

import json
import os
import re
import shutil
import subprocess
import threading
import webbrowser

import webview

# ── Preferences ───────────────────────────────────────────────────────────────
PREFS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "alchemist_prefs.json")
APP_DIR    = os.path.dirname(os.path.abspath(__file__))

DEFAULT_PREFS = {
    # Conversion mode index (matches original prefType)
    "type":            0,
    # qt_export binary directory (legacy QuickTime tools)
    "location":        "/opt/local/bin/",
    # ffmpeg binary directory
    "location2":       "/opt/homebrew/bin/",
    # ffmpeg2theora binary directory
    "location3":       "/opt/homebrew/bin/",
    # Rename settings (UI hidden in original, kept for completeness)
    "spacer":          "_",
    "dateSpacer":      "-",
    "prefix":          "prefix",
    "preBox":          False,
    "suffix":          "suffix",
    "sufBox":          False,
    "dateBox":         False,
    "dateReverseBox":  True,
}

# ── Conversion mode table ─────────────────────────────────────────────────────
# Each entry: (label, tool, [output_spec, ...])
# output_spec: (flags_list, output_extension, multipass?)
#
# tool values:
#   "qt_tools"    → qt_export --loadsettings (legacy)
#   "ffmpeg"      → single-pass ffmpeg
#   "ffmpegMulti" → two-pass ffmpeg
#   "ffmpeg2theora"
#
# Note: qt_export uses the bundled binary .st preset files shipped in app/qt_tools/
# FFmpeg equivalents are provided for all modes so the app works on modern macOS.

CONVERSION_MODES = [
    # 0 – ProRes 422
    {
        "label": "QuickTime ProRes 422",
        "outputs": [
            {
                "tool":    "qt_tools",
                "preset":  "qt_export_prores422.st",
                "ext":     ".prores422.mov",
                # Modern ffmpeg fallback
                "ffmpeg_flags": ["-c:v", "prores_ks", "-profile:v", "2",
                                 "-c:a", "pcm_s16le"],
            },
        ],
    },
    # 1 – HDV 1080p
    {
        "label": "QuickTime HDV 1080p",
        "outputs": [
            {
                "tool":    "qt_tools",
                "preset":  "qt_export_hdv_1080p.st",
                "ext":     ".hdv1080.mov",
                "ffmpeg_flags": ["-c:v", "mpeg2video", "-b:v", "25M",
                                 "-vf", "scale=1440:1080", "-c:a", "ac3", "-b:a", "192k"],
            },
        ],
    },
    # 2 – HDV 720p
    {
        "label": "QuickTime HDV 720p",
        "outputs": [
            {
                "tool":    "qt_tools",
                "preset":  "qt_export_hdv_720p.st",
                "ext":     ".hdv720.mov",
                "ffmpeg_flags": ["-c:v", "mpeg2video", "-b:v", "19.7M",
                                 "-vf", "scale=1280:720", "-c:a", "ac3", "-b:a", "192k"],
            },
        ],
    },
    # 3 – Apple Intermediate Codec (AIC) — no modern ffmpeg equivalent
    {
        "label": "QuickTime AIC",
        "outputs": [
            {
                "tool":    "qt_tools",
                "preset":  "qt_export_aic.st",
                "ext":     ".aic.mov",
                # AIC has no open codec; best alternative is ProRes LT
                "ffmpeg_flags": ["-c:v", "prores_ks", "-profile:v", "1",
                                 "-c:a", "pcm_s16le"],
                "ffmpeg_note": "AIC has no open FFmpeg codec; using ProRes LT as fallback",
            },
        ],
    },
    # 4 – HTML5 (MP4 + OGG + WebM at 720p and 540p)
    {
        "label": "MP4, OGG, WebM  720p / 540p",
        "outputs": [
            {
                "tool":       "ffmpegMulti",
                "ffmpeg_flags": ["-c:v", "libx264", "-b:v", "1536k",
                                  "-minrate", "128k", "-maxrate", "3072k", "-bufsize", "224k",
                                  "-vf", "lutyuv=y=gammaval(1.2),scale=1280:720",
                                  "-c:a", "aac", "-b:a", "160k"],
                "ext":        ".720p.mp4",
            },
            {
                "tool":       "ffmpegMulti",
                "ffmpeg_flags": ["-c:v", "libx264", "-b:v", "1024k",
                                  "-minrate", "128k", "-maxrate", "2560k", "-bufsize", "224k",
                                  "-vf", "lutyuv=y=gammaval(1.2),scale=960:540",
                                  "-c:a", "aac", "-b:a", "128k"],
                "ext":        ".540p.mp4",
            },
            {
                "tool":       "ffmpeg",
                "ffmpeg_flags": ["-c:v", "libx264", "-crf", "18",
                                  "-trellis", "1", "-me_range", "32",
                                  "-i_qfactor", "0.71", "-g", "60",
                                  "-sc_threshold", "20", "-qmin", "4", "-qmax", "48",
                                  "-qdiff", "8",
                                  "-vf", "lutyuv=y=gammaval(1.2),scale=1280:720",
                                  "-c:a", "aac", "-b:a", "160k"],
                "ext":        ".720p.Q.mp4",
            },
            {
                "tool":       "ffmpeg",
                "ffmpeg_flags": ["-c:v", "libx264", "-crf", "18",
                                  "-trellis", "1", "-me_range", "32",
                                  "-i_qfactor", "0.71", "-g", "60",
                                  "-sc_threshold", "20", "-qmin", "4", "-qmax", "48",
                                  "-qdiff", "8",
                                  "-vf", "lutyuv=y=gammaval(1.2),scale=960:540",
                                  "-c:a", "aac", "-b:a", "128k"],
                "ext":        ".540p.Q.mp4",
            },
            {
                "tool":       "ffmpeg2theora",
                "ffmpeg_flags": ["-V", "2560k", "-A", "160k",
                                  "--two-pass", "--speedlevel", "0",
                                  "--max_size", "1280x720"],
                "ext":        ".720p.ogg",
            },
            {
                "tool":       "ffmpeg2theora",
                "ffmpeg_flags": ["-V", "1920k", "-A", "128k",
                                  "--two-pass", "--speedlevel", "0",
                                  "--max_size", "960x540"],
                "ext":        ".540p.ogg",
            },
            {
                "tool":       "ffmpeg",
                "ffmpeg_flags": ["-c:v", "libvpx", "-b:v", "1280k",
                                  "-minrate", "0k", "-maxrate", "2048k", "-bufsize", "224k",
                                  "-vf", "lutyuv=y=gammaval(1.1),scale=1280:720",
                                  "-f", "webm", "-c:a", "libvorbis", "-b:a", "160k"],
                "ext":        ".720p.webm",
            },
            {
                "tool":       "ffmpeg",
                "ffmpeg_flags": ["-c:v", "libvpx", "-b:v", "1024k",
                                  "-minrate", "0k", "-maxrate", "1536k", "-bufsize", "224k",
                                  "-vf", "lutyuv=y=gammaval(1.1),scale=960:540",
                                  "-f", "webm", "-c:a", "libvorbis", "-b:a", "128k"],
                "ext":        ".540p.webm",
            },
        ],
    },
    # 5 – Desktop (MP4 + WMV 720p)
    {
        "label": "MP4, WMV  720p",
        "outputs": [
            {
                "tool":       "ffmpegMulti",
                "ffmpeg_flags": ["-c:v", "libx264", "-b:v", "2048k",
                                  "-minrate", "128k", "-maxrate", "4096k", "-bufsize", "224k",
                                  "-vf", "lutyuv=y=gammaval(1.2),scale=1280:720",
                                  "-c:a", "aac", "-b:a", "160k"],
                "ext":        ".720p.mp4",
            },
            {
                "tool":       "ffmpegMulti",
                "ffmpeg_flags": ["-c:v", "wmv2", "-b:v", "3072k",
                                  "-vf", "lutyuv=y=gammaval(1.2),scale=1280:720",
                                  "-c:a", "wmav2", "-b:a", "160k"],
                "ext":        ".720p.wmv",
            },
        ],
    },
    # 6 – Mobile (MP4 480p + 360p)
    {
        "label": "MP4  480p / 360p",
        "outputs": [
            {
                "tool":       "ffmpegMulti",
                "ffmpeg_flags": ["-c:v", "libx264", "-b:v", "1024k",
                                  "-minrate", "128k", "-maxrate", "1536k", "-bufsize", "224k",
                                  "-vf", "scale=854:480",
                                  "-c:a", "aac", "-b:a", "128k"],
                "ext":        ".480p.mp4",
            },
            {
                "tool":       "ffmpegMulti",
                "ffmpeg_flags": ["-c:v", "libx264", "-b:v", "768k",
                                  "-minrate", "128k", "-maxrate", "1280k", "-bufsize", "224k",
                                  "-vf", "scale=640:360",
                                  "-c:a", "aac", "-b:a", "128k"],
                "ext":        ".360p.mp4",
            },
        ],
    },
]

VIDEO_EXTENSIONS = {
    ".mov", ".mp4", ".m4v", ".avi", ".mkv", ".wmv", ".flv",
    ".webm", ".mpg", ".mpeg", ".mts", ".m2ts", ".dv", ".ogv",
    ".3gp", ".mxf",
}


class AlchemistAPI:
    """Python-side API exposed to JS via window.pywebview.api.*"""

    def __init__(self):
        self._window = None   # set after window creation

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

    # ── Tool checks ───────────────────────────────────────────────────────────

    def check_tool(self, loc: str, name: str) -> dict:
        binary = os.path.join(loc.rstrip("/"), name)
        if os.path.isfile(binary) and os.access(binary, os.X_OK):
            return {"ok": True, "path": binary}
        found = shutil.which(name)
        if found:
            return {"ok": True, "path": found}
        return {"ok": False, "path": binary}

    def open_url(self, url: str) -> bool:
        webbrowser.open(url)
        return True

    # ── Core processing ───────────────────────────────────────────────────────

    def process_files(self, file_paths: list, prefs: dict) -> dict:
        """
        Run the selected conversion on each dropped video file.
        Returns { ok, message, commands, jobs_total }
        """
        try:
            # ── Normalise paths ───────────────────────────────────────────────
            paths = _decode_paths(file_paths)

            if not paths:
                return {"ok": False, "message": "No files received.", "commands": []}

            # ── Validate: video files only ────────────────────────────────────
            for p in paths:
                ext = os.path.splitext(p)[1].lower()
                if ext not in VIDEO_EXTENSIONS:
                    return {
                        "ok": False,
                        "message": (
                            f"Unsupported file type: {os.path.basename(p)}\n\n"
                            "Alchemist only accepts video files\n"
                            f"({', '.join(sorted(VIDEO_EXTENSIONS))})."
                        ),
                        "wrong_type": True,
                        "commands": [],
                    }
                if not os.path.isfile(p):
                    return {
                        "ok": False,
                        "message": f"File not found:\n{os.path.basename(p)}",
                        "commands": [],
                    }

            # ── Sort alphanumerically ─────────────────────────────────────────
            paths = sorted(paths, key=_alphanum_key)

            # ── Select mode ───────────────────────────────────────────────────
            ptype = int(prefs.get("type", 0))
            if ptype < 0 or ptype >= len(CONVERSION_MODES):
                return {"ok": False, "message": "Invalid conversion mode.", "commands": []}

            mode    = CONVERSION_MODES[ptype]
            outputs = mode["outputs"]

            # ── Resolve tool binaries ─────────────────────────────────────────
            loc1  = prefs.get("location",  "/opt/local/bin/").rstrip("/") + "/"
            loc2  = prefs.get("location2", "/opt/homebrew/bin/").rstrip("/") + "/"
            loc3  = prefs.get("location3", "/opt/homebrew/bin/").rstrip("/") + "/"

            ffmpeg_bin       = _resolve_bin(loc2, "ffmpeg")
            ffmpeg2theora_bin = _resolve_bin(loc3, "ffmpeg2theora")
            qt_export_bin    = _resolve_bin(loc1, "qt_export")

            # Check FFmpeg availability for modes that need it
            needs_ffmpeg = any(o["tool"] in ("ffmpeg", "ffmpegMulti") for o in outputs)
            needs_theora = any(o["tool"] == "ffmpeg2theora" for o in outputs)
            needs_qt     = any(o["tool"] == "qt_tools" for o in outputs)

            if needs_ffmpeg and not ffmpeg_bin:
                return {
                    "ok": False,
                    "message": (
                        "FFmpeg not found.\n"
                        f"Configured path: {loc2}\n\n"
                        "Install via: brew install ffmpeg"
                    ),
                    "commands": [],
                }
            if needs_theora and not ffmpeg2theora_bin:
                return {
                    "ok": False,
                    "message": (
                        "ffmpeg2theora not found.\n"
                        f"Configured path: {loc3}\n\n"
                        "Install via: brew install ffmpeg2theora"
                    ),
                    "commands": [],
                }
            if needs_qt and not qt_export_bin:
                # Fall through to FFmpeg fallback — noted in output
                qt_export_bin = None

            # ── Build and launch jobs in a background thread ──────────────────
            jobs = []
            for path in paths:
                d     = os.path.dirname(path)
                stem  = os.path.splitext(os.path.basename(path))[0]
                ext_i = os.path.splitext(path)[1]

                for out in outputs:
                    tool    = out["tool"]
                    out_ext = out["ext"]
                    out_path = os.path.join(d, stem + out_ext)
                    note     = out.get("ffmpeg_note", "")

                    if tool == "qt_tools":
                        if qt_export_bin:
                            preset_path = os.path.join(APP_DIR, "app", "qt_tools", out["preset"])
                            cmd = [qt_export_bin,
                                   f"--loadsettings={preset_path}",
                                   path, out_path]
                            jobs.append({"cmd": cmd, "out": out_path, "note": note, "multipass": False})
                        else:
                            # FFmpeg fallback
                            ff_flags = out.get("ffmpeg_flags", [])
                            cmd = [ffmpeg_bin, "-i", path] + ff_flags + [out_path, "-y"]
                            jobs.append({
                                "cmd": cmd, "out": out_path,
                                "note": note or "qt_export not found — using FFmpeg fallback",
                                "multipass": False
                            })
                    elif tool == "ffmpegMulti":
                        log = os.path.join(os.path.expanduser("~/.Trash"), stem + out_ext)
                        pass1 = ([ffmpeg_bin, "-i", path, "-pass", "1",
                                  "-passlogfile", log] + out["ffmpeg_flags"] + [out_path, "-y"])
                        pass2 = ([ffmpeg_bin, "-i", path, "-pass", "2",
                                  "-passlogfile", log] + out["ffmpeg_flags"] + [out_path, "-y"])
                        jobs.append({"cmd": pass1, "cmd2": pass2,
                                     "out": out_path, "note": note, "multipass": True})
                    elif tool == "ffmpeg2theora":
                        flags = out["ffmpeg_flags"]
                        cmd = [ffmpeg2theora_bin] + flags + ["-o", out_path, path]
                        jobs.append({"cmd": cmd, "out": out_path, "note": note, "multipass": False})
                    else:  # plain ffmpeg
                        cmd = [ffmpeg_bin, "-i", path] + out["ffmpeg_flags"] + [out_path, "-y"]
                        jobs.append({"cmd": cmd, "out": out_path, "note": note, "multipass": False})

            if not jobs:
                return {"ok": False, "message": "No jobs were generated.", "commands": []}

            # Launch jobs in background thread so the UI stays responsive
            cmd_strings = [" ".join(j["cmd"]) for j in jobs]
            threading.Thread(
                target=self._run_jobs,
                args=(jobs,),
                daemon=True,
            ).start()

            n = len(paths)
            return {
                "ok": True,
                "message": (
                    f"Encoding started:\n"
                    f"{n} file{'s' if n != 1 else ''} × "
                    f"{len(outputs)} output{'s' if len(outputs) != 1 else ''} = "
                    f"{len(jobs)} job{'s' if len(jobs) != 1 else ''}"
                ),
                "label": mode["label"],
                "commands": cmd_strings,
                "jobs_total": len(jobs),
            }

        except Exception as ex:
            return {"ok": False, "message": f"Unexpected error:\n{ex}", "commands": []}

    def _run_jobs(self, jobs: list):
        """Background worker — runs all encode jobs sequentially."""
        errors = []
        done   = 0
        for j in jobs:
            try:
                cmds = [j["cmd"]]
                if j.get("multipass"):
                    cmds.append(j["cmd2"])
                for cmd in cmds:
                    result = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        timeout=3600,
                    )
                    if result.returncode != 0:
                        err = (result.stderr or "").strip().split("\n")[-1]
                        errors.append(f"{os.path.basename(j['out'])}: {err}")
                done += 1
            except subprocess.TimeoutExpired:
                errors.append(f"{os.path.basename(j['out'])}: timed out")
            except Exception as ex:
                errors.append(f"{os.path.basename(j['out'])}: {ex}")

        # Signal the front-end via evaluate_js
        if self._window:
            if errors:
                msg = json.dumps("Encoding completed with errors:\n" + "\n".join(errors))
            else:
                msg = json.dumps(f"Encoding complete – {done} file{'s' if done != 1 else ''} written.")
            ok  = json.dumps(len(errors) == 0)
            try:
                self._window.evaluate_js(f"onEncodingComplete({ok}, {msg})")
            except Exception:
                pass


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_bin(loc: str, name: str) -> str | None:
    binary = os.path.join(loc.rstrip("/"), name)
    if os.path.isfile(binary) and os.access(binary, os.X_OK):
        return binary
    return shutil.which(name)


def _decode_paths(raw: list) -> list:
    out = []
    for p in raw:
        p = p.replace("file://localhost", "").replace("file://", "").strip()
        p = re.sub(r"%([0-9A-Fa-f]{2})", lambda m: chr(int(m.group(1), 16)), p)
        p = os.path.normpath(p)
        out.append(p)
    return out


def _alphanum_key(path: str):
    basename = os.path.basename(path)
    parts = re.split(r"(\d+)", basename)
    return [int(p) if p.isdigit() else p.lower() for p in parts]


# ── Window ────────────────────────────────────────────────────────────────────

def main():
    api = AlchemistAPI()
    html_path = os.path.join(APP_DIR, "app", "index.html")

    window = webview.create_window(
        title="Alchemist",
        url=f"file://{html_path}",
        js_api=api,
        width=320,
        height=230,
        resizable=False,
        background_color="#111111",
        min_size=(320, 230),
    )

    api._window = window
    webview.start(debug=False)


if __name__ == "__main__":
    main()
