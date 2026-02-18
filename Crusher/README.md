# Crusher – PyWebView Port

A faithful PyWebView port of the original **Crusher** Dashcode Dashboard widget
by [iaian7.com](https://iaian7.com/dashboard/Crusher).

Reduces PNG color depth (palette quantization) by wrapping the `pngquant`
command-line tool. Drop one or more PNG files, choose a color count and dither
mode, and get compressed output files alongside the originals.

---

## Requirements

- Python 3.8+
- [pywebview](https://pywebview.flowrl.com/) 4.x
- [pngquant](https://pngquant.org/) (for actual processing)

```bash
pip install pywebview

# macOS (Homebrew)
brew install pngquant

# Ubuntu / Debian
sudo apt install pngquant
```

---

## Run

```bash
python main.py
```

---

## Controls

| Control | What it does |
|---|---|
| Colors (8–256) | Target palette size. Type a value or drag the slider. Arrow keys nudge ±4 (Shift ±16). |
| Dither | Enables Floyd-Steinberg dithering. Without it, pngquant uses `--nofs` (ordered dither). |
| IE6 fix | Passes `--iebug` to pngquant for IE6 PNG transparency compatibility. |

---

## Settings

Open the Settings panel (⚙ button) to configure:

| Setting | Default | Notes |
|---|---|---|
| pngquant path | `/opt/homebrew/bin/` | Directory containing `pngquant`. Use "Check" to verify. Falls back to system PATH automatically. |
| Speed / quality | Balanced | Maps to pngquant `--speed` (1=slowest/best … 5=fastest). |
| Existing files | Overwrite | Whether to pass `--force` and overwrite existing output files. |
| Suffix — colors | `.%d` | Appended before `.png`; `%d` is replaced by the color count. e.g. `image.256.png` |
| Suffix — dither | `.dither` | Extra suffix added when dither mode is on. |
| Suffix — IE6 | `.ie6` | Extra suffix added when IE6 fix is on. |

**Example output names** (source: `photo.png`, colors: 64, dither on, IE6 off):
- `.%d` + `.dither` → `photo.64.dither.png`

---

## Drag-and-drop

Drop one or more PNG files onto the drop zone. Files are sorted
alphanumerically before processing (same as the original widget).
Output files are written to the same directory as each source file.

Only PNG files are accepted — dropping other image types shows the
"wrong file type" error panel.

---

## Package as a native .app (macOS)

```bash
pip install pyinstaller

pyinstaller --windowed --onefile \
  --name "Crusher" \
  --add-data "app:app" \
  main.py
```

The resulting `Crusher.app` lives in `dist/`.  
pngquant must still be installed on the target machine.

---

## File layout

```
crusher-app/
├── main.py              # Python host – window + API
├── crusher_prefs.json   # Created automatically (stores settings)
└── app/
    ├── index.html       # UI shell
    ├── style.css        # Dark widget styles
    └── app.js           # All logic – translated from original main.js
```

---

## Differences from the original widget

| Original | Port |
|---|---|
| `widget.system()` fire-and-forget | `subprocess.run()` with captured stderr, shown in fail panel |
| `alert()` debug calls throughout | Removed (they were development leftovers) |
| `prefLoc` typo (should be `prefLocation`) | Fixed |
| No binary verification | "Check" button in Settings verifies pngquant path |
| No processing indicator | Spinner panel shown while pngquant runs |
| `.colors` default suffix | Changed to `.%d` so the color count is embedded (e.g. `.256`) |

---

## Features preserved from the original widget

| Feature | Status |
|---|---|
| Color count slider (8–256) | ✅ |
| Arrow-key nudging on colors input (±4 / ±16) | ✅ |
| Dither toggle | ✅ |
| IE6 fix toggle | ✅ |
| Drop zone for PNG files | ✅ |
| Alphanumeric file sorting | ✅ |
| pngquant path setting | ✅ |
| Speed / quality setting | ✅ |
| Overwrite / skip setting | ✅ |
| Three output suffix patterns | ✅ |
| Success / fail / wrong-type panels | ✅ |
| Persistent preferences | ✅ |
| Settings back panel | ✅ |
| Link to original widget page | ✅ |
