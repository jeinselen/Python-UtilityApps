# Alchemist – PyWebView Port

A faithful PyWebView port of the original **Alchemist** Dashcode Dashboard widget
by [iaian7.com](https://iaian7.com/dashboard/Alchemist).

Batch-converts video files using FFmpeg and optionally the legacy `qt_export`
(QuickTime) tool for classic ProRes / HDV / AIC modes.

---

## Requirements

- Python 3.8+
- [pywebview](https://pywebview.flowrl.com/) 4.x
- [FFmpeg](https://ffmpeg.org/) – required for all modes except legacy qt modes

```bash
pip install pywebview

# macOS (Homebrew) – covers all modern modes
brew install ffmpeg

# HTML5 OGG output also needs ffmpeg2theora
brew install ffmpeg2theora
```

---

## Run

```bash
python main.py
```

---

## Conversion modes

| # | Mode | Tools used | Output files |
|---|---|---|---|
| 0 | ProRes 422 | qt_export (FFmpeg fallback: `prores_ks`) | `.prores422.mov` |
| 1 | HDV 1080p | qt_export (FFmpeg fallback: `mpeg2video`) | `.hdv1080.mov` |
| 2 | HDV 720p | qt_export (FFmpeg fallback: `mpeg2video`) | `.hdv720.mov` |
| 3 | AIC | qt_export (FFmpeg fallback: ProRes LT) | `.aic.mov` |
| 4 | HTML5 | FFmpeg + ffmpeg2theora | `.720p.mp4` `.540p.mp4` `.720p.Q.mp4` `.540p.Q.mp4` `.720p.ogg` `.540p.ogg` `.720p.webm` `.540p.webm` |
| 5 | Desktop | FFmpeg (two-pass) | `.720p.mp4` `.720p.wmv` |
| 6 | Mobile | FFmpeg (two-pass) | `.480p.mp4` `.360p.mp4` |

---

## Settings

Three tool paths are configurable, each with a **Check** button that verifies
the binary exists and is executable:

| Path | Default | Used for |
|---|---|---|
| qt_export path | `/opt/local/bin/` | Legacy QuickTime ProRes/HDV/AIC export |
| FFmpeg path | `/opt/homebrew/bin/` | All modern encode modes |
| ffmpeg2theora path | `/opt/homebrew/bin/` | OGG output in HTML5 mode |

If `qt_export` is not found, the app automatically falls back to FFmpeg
equivalents for modes 0–3.

A collapsed **Rename settings** section preserves the original widget's
prefix / suffix / date-prepend functionality.

---

## Background encoding

Video encoding is CPU-intensive. After a drop is accepted, the "Encoding started"
panel is shown immediately and encoding runs in a background thread. You can
return to the main panel to queue another job. A success or failure notification
is shown when encoding finishes.

Multipass (two-pass) FFmpeg encodes run pass 1 then pass 2 automatically; the
log files are written to `~/.Trash/` as in the original.

---

## About the .st preset files

The six binary QuickTime export settings files (`qt_export_*.st`) are included
in `app/qt_tools/` and are passed to `qt_export --loadsettings=`. They are
opaque binary blobs created by QuickTime Player 7 on macOS. They only work on
older macOS systems that still have `qt_export` available.

---

## Package as a native .app (macOS)

```bash
pip install pyinstaller

pyinstaller --windowed --onefile \
  --name "Alchemist" \
  --add-data "app:app" \
  main.py
```

The resulting `Alchemist.app` lives in `dist/`.  
FFmpeg must still be installed on the target machine.

---

## File layout

```
alchemist-app/
├── main.py                 # Python host – window + API + encode logic
├── alchemist_prefs.json    # Created automatically
└── app/
    ├── index.html          # UI shell
    ├── style.css           # Dark widget styles
    ├── app.js              # All logic – translated from original main.js
    └── qt_tools/           # Binary QuickTime export preset files
        ├── qt_export_prores422.st
        ├── qt_export_hdv_1080p.st
        ├── qt_export_hdv_720p.st  (stub — not in original upload)
        ├── qt_export_aic.st       (stub — not in original upload)
        ├── qt_export_mp3.st
        ├── qt_export_png.st
        ├── qt_export_720p.st
        └── qt_export_youtube.st
```

---

## Differences from the original widget

| Original | Port |
|---|---|
| `widget.system()` – synchronous, blocks UI | `subprocess.run()` in background thread |
| `alert()` debug calls throughout | Removed |
| Rename UI is hidden (`visibility: hidden`) | Hidden by default; accessible via collapsed "Rename settings" section in Settings |
| `endHandler()` → `showMain()` | `onEncodingComplete()` callback from Python thread → `showSuccess()` or `showFail()` |
| No tool verification | Three "Check" buttons in Settings |
| No processing indicator | "Encoding started" spinner panel |
| No FFmpeg fallback for qt modes 0–3 | FFmpeg equivalents used automatically if qt_export not found |
