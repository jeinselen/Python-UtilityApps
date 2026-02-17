# Ratio – PyWebView Port

A faithful PyWebView port of the original **Ratio** Dashcode Dashboard widget
by [iaian7.com](https://iaian7.com/dashboard/Ratio).

Calculates aspect ratios and scaled output dimensions from a source resolution,
with optional step-size snapping and an aspect-lock mode.

---

## Requirements

- Python 3.8+
- [pywebview](https://pywebview.flowrl.com/) 4.x

```bash
pip install pywebview
```

On macOS, PyWebView uses the system WebKit engine — no extra dependencies.

---

## Run

```bash
python main.py
```

---

## Package as a native .app (macOS)

Install PyInstaller, then:

```bash
pip install pyinstaller

pyinstaller --windowed --onefile \
  --name "Ratio" \
  --add-data "app:app" \
  main.py
```

The resulting `Ratio.app` lives in `dist/`.  
No Python installation required on the target machine.

---

## File layout

```
ratio-app/
├── main.py            # Python host — creates the window, exposes the API
├── ratio_prefs.json   # Created automatically on first run (stores preferences)
└── app/
    ├── index.html     # UI shell
    ├── style.css      # Dark widget styles
    └── app.js         # All logic — translated from the original main.js
```

---

## Features preserved from the original widget

| Feature | Status |
|---|---|
| Source width / height inputs | ✅ |
| Arrow-key nudging (±1, Shift ±10) | ✅ |
| Ratio & aspect ratio display | ✅ |
| Aspect ratio lock | ✅ |
| Swap width ↔ height | ✅ |
| Output width / height inputs | ✅ |
| Scale slider (0–200%) | ✅ |
| Scale percentage text input | ✅ |
| Step-size snapping (2/4/8/10/16/32/64/none) | ✅ |
| Preset resolutions | ✅ |
| Auto-generate list of valid scaled sizes | ✅ |
| Click list row to apply that scale | ✅ |
| Persistent preferences across sessions | ✅ |
| Info / back panel | ✅ |
| Link to original widget page | ✅ |

---

## Development / browser testing

Open `app/index.html` directly in any browser. Preferences will fall back to
`localStorage` automatically when the PyWebView API is not present.