# Sheets – PyWebView Port

A faithful PyWebView port of the original **Sheets** Dashcode Dashboard widget
by [iaian7.com](https://iaian7.com/dashboard/Sheets).

Generates sprite sheets and contact sheets from drag-and-dropped image files
by wrapping ImageMagick's `montage` command.

---

## Requirements

- Python 3.8+
- [pywebview](https://pywebview.flowrl.com/) 4.x
- [ImageMagick](https://imagemagick.org/) (for actual processing)

```bash
pip install pywebview

# macOS (Homebrew)
brew install imagemagick

# Ubuntu / Debian
sudo apt install imagemagick
```

---

## Run

```bash
python main.py
```

---

## Settings

Open the Settings panel (⚙ button) to configure:

| Setting | Default | Notes |
|---|---|---|
| ImageMagick path | `/opt/homebrew/bin/` | Directory containing the `montage` binary. Use "Check" to verify. |
| Scale filter | Quadratic | Resampling algorithm passed to `-filter`. |
| Output | RGBA | Which alpha modes to generate (RGBA / RGB / Alpha / All three). |
| Sprite sheet name | `Sheet-%d` | Suffix appended to sequential sprite sheets. |
| Contact sheet name | `Files-` | Prefix for contact sheet output. |

---

## Processing modes

| Mode | What it does |
|---|---|
| Auto | No tile/size constraints; ImageMagick decides |
| Horizontal strip | `-tile x1` — one row |
| Vertical strip | `-tile 1x` — one column |
| Fixed size | `-geometry WxH` — each cell at a fixed size |
| Fixed tile | `-tile CxR` — fixed column × row grid |
| Sprite sheet | Fixed size **and** fixed tile |
| Contact sheet | Sprite sheet with filename + dimension labels and padding |

---

## Drag-and-drop

Drop one or more image files onto the drop zone. Accepted formats:
PNG, JPG/JPEG, GIF, TIF/TIFF, BMP, WebP, PSD, TGA, EXR.

Files are sorted alphanumerically (same as the original widget) before being
passed to `montage`. If you drop a single file that matches a numbered
sequence (e.g. `frame001.png`), Sheets automatically uses a wildcard glob
(`frame*.png`) so ImageMagick picks up the whole sequence — exactly matching
the original widget behaviour.

Output files are written to the same directory as the dropped files.

---

## Package as a native .app (macOS)

```bash
pip install pyinstaller

pyinstaller --windowed --onefile \
  --name "Sheets" \
  --add-data "app:app" \
  main.py
```

The resulting `Sheets.app` lives in `dist/`.

> **Note:** The packaged app still requires ImageMagick to be installed on
> the target machine (it calls the system `montage` binary at runtime).

---

## File layout

```
sheets-app/
├── main.py             # Python host – window + API
├── sheets_prefs.json   # Created automatically (stores settings)
└── app/
    ├── index.html      # UI shell
    ├── style.css       # Dark widget styles
    └── app.js          # All logic – translated from original main.js
```

---

## Features preserved from the original widget

| Feature | Status |
|---|---|
| All 7 processing modes | ✅ |
| Drag-and-drop image files | ✅ |
| Alphanumeric file sorting | ✅ (Python-side) |
| Single-file wildcard glob | ✅ |
| ImageMagick path setting | ✅ |
| Scale filter selection | ✅ |
| RGBA / RGB / Alpha / All output | ✅ |
| Sprite sheet + contact sheet naming | ✅ |
| Success / fail / wrong-type panels | ✅ |
| Size and tile field dim/active per mode | ✅ |
| Persistent preferences | ✅ |
| Settings / info back panel | ✅ |
| Link to original widget page | ✅ |
| ImageMagick path verifier ("Check" button) | ✅ (new) |
| Processing spinner | ✅ (new) |
