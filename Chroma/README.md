# Chroma – PyWebView Port

A faithful PyWebView port of the original **Chroma** Dashcode Dashboard widget
by [iaian7.com](https://iaian7.com/dashboard/chroma).

HSV / RGB / HEX colour picker with a persistent, grouped colour library.
All colour conversion happens in the browser — no external tools required.

---

## Requirements

- Python 3.8+
- [pywebview](https://pywebview.flowrl.com/) 4.x

```bash
pip install pywebview
```

Clipboard support uses `pbcopy` / `pbpaste` on macOS, or `xclip` / `xsel`
on Linux (install one with your package manager if needed).

---

## Run

```bash
python main.py
```

---

## Colour picker

### Input fields

| Field | Description |
|---|---|
| H | Hue (display format set in Settings) |
| S | Saturation |
| V | Value (brightness) |
| R | Red |
| G | Green |
| B | Blue |
| X | HEX string (e.g. `#C6E52D`) |

**Arrow keys** nudge values up/down. Hold **Shift** for larger steps.  
**Click the HSV / RGB / HEX tag** on the left of each row to copy that value to the clipboard.  
**Click the colour swatch** to open the Save panel.

### Saving colours

1. Click the swatch (or the `+` that appears on hover).
2. Enter a **group** and a **name** — both must contain at least one letter.
3. Press **Save colour**.

---

## Colour library

Each row in the library shows a colour swatch and formatted values.
- **Hover the swatch** to reveal a **Use** button — loads the colour into the picker.
- **Click a value** to copy it to the clipboard.
- **Hover the row** and click **×** on the right to delete.

---

## Settings (back panel)

| Setting | Options |
|---|---|
| Sort library | Name / Hue / Saturation / Value / Date added |
| Show in list | HSV+RGB+HEX / Name+HSV+HEX / Name+RGB+HEX |
| HSV format | 0–360°/0–100% · 0–255 · 0–100% · 0.00–1.00 |
| RGB format | 0–255 · 0–100% · 0.00–1.00 |
| Clipboard decimal places | 2 · 4 · 6 |

### Library import / export

**Export** — copies the entire library as CSV to the clipboard.  
Each line: `group,name,H,S,V,R,G,B,HEX,timestamp`

**Import** — reads CSV from the clipboard. You can **Replace** or **Add** the imported colours.

---

## File layout

```
chroma-app/
├── main.py              # Python host – window + clipboard API
├── chroma_prefs.json    # Created automatically (stores all settings + library)
└── app/
    ├── index.html       # UI shell
    ├── style.css        # Dark widget styles
    └── app.js           # All logic – translated from original main.js
```

---

## Package as a native .app (macOS)

```bash
pip install pyinstaller

pyinstaller --windowed --onefile \
  --name "Chroma" \
  --add-data "app:app" \
  main.py
```

---

## Differences from the original widget

| Original | Port |
|---|---|
| AppleScrollArea + list dataSource pattern | Plain `<ul>` re-rendered by `renderLibrary()` |
| `widget.system("pbcopy/pbpaste"…)` | `pywebview.api.clipboard_write/read()` with `navigator.clipboard` fallback |
| `AppleAnimator` for hover/copy flashes | CSS `@keyframes` / transitions |
| `alert()` debug calls | Removed |
| `versionCheck()` HTTP request | Removed |
| `sortDate()` referenced undefined `x`/`y` | Fixed |
| Library key `"library"` (no wid prefix) | Preserved — shared in single-file `chroma_prefs.json` |
| Dashcode `stack`/`stack2` view switching | Hidden-class panel toggling |

---

## Colour data format

Each library entry is a 10-element array:

| Index | Field | Range |
|---|---|---|
| 0 | group | string |
| 1 | name | string |
| 2 | H | 0–360 |
| 3 | S | 0.0–1.0 |
| 4 | V | 0.0–1.0 |
| 5 | R | 0.0–1.0 |
| 6 | G | 0.0–1.0 |
| 7 | B | 0.0–1.0 |
| 8 | HEX | 6 uppercase chars |
| 9 | timestamp | `Date.now()` integer |

Packed format for storage: entries joined with `:`, rows joined with `::`.  
CSV export format: entries joined with `,`, rows joined with `\n`.
