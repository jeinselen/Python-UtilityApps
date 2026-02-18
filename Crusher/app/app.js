/* ────────────────────────────────────────────────────────────────────────────
   Crusher – app.js
   PyWebView port of the original Dashcode Dashboard widget by iaian7.com

   Translates widget.system() → pywebview.api.process_files()
   Translates widget.preferenceForKey() → pywebview.api.load_prefs() / save_prefs()
   localStorage fallback for browser-only development testing.

   Key cleanup from the original:
   - All alert() debug calls removed
   - Commented-out dead code (montage section) removed
   - checkbox toggling unified via the standard `change` event
   - prefLoc typo corrected to prefLocation
   ──────────────────────────────────────────────────────────────────────────── */

"use strict";

// ── State (mirrors original prefXxx variables) ────────────────────────────────
let prefDither      = false;
let prefIE6         = false;
let prefColors      = 256;
let prefLocation    = "/opt/homebrew/bin/";
let prefQuality     = 2;
let prefOverwrite   = 1;
let prefName        = ".%d";
let prefNameDither  = ".dither";
let prefNameIE6     = ".ie6";

// ── DOM refs ──────────────────────────────────────────────────────────────────
let colorsEl, sliderEl, ditherEl, ie6El;
let locEl, qualityEl, overwriteEl;
let nameEl, nameDitherEl, nameIE6El;
let dropZone, pqStatusEl;

// ─────────────────────────────────────────────────────────────────────────────
// Prefs bridge
// ─────────────────────────────────────────────────────────────────────────────

async function savePrefs() {
  const prefs = {
    dither:      prefDither,
    ie6:         prefIE6,
    colors:      prefColors,
    loc:         prefLocation,
    quality:     prefQuality,
    overwrite:   prefOverwrite,
    name:        prefName,
    nameDither:  prefNameDither,
    nameIE6:     prefNameIE6,
  };
  if (window.pywebview) {
    await window.pywebview.api.save_prefs(prefs);
  } else {
    localStorage.setItem("crusher_prefs", JSON.stringify(prefs));
  }
}

async function loadPrefsFromStorage() {
  if (window.pywebview) {
    return await window.pywebview.api.load_prefs();
  }
  const stored = localStorage.getItem("crusher_prefs");
  return stored ? JSON.parse(stored) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  colorsEl      = document.getElementById("colors");
  sliderEl      = document.getElementById("slider");
  ditherEl      = document.getElementById("ditherInput");
  ie6El         = document.getElementById("ie6Input");
  locEl         = document.getElementById("loc");
  qualityEl     = document.getElementById("quality");
  overwriteEl   = document.getElementById("overwrite");
  nameEl        = document.getElementById("name");
  nameDitherEl  = document.getElementById("nameDither");
  nameIE6El     = document.getElementById("nameIE6");
  dropZone      = document.getElementById("drop-zone");
  pqStatusEl    = document.getElementById("pq-status");

  const prefs = await loadPrefsFromStorage();
  if (prefs) applyPrefs(prefs);
}

function applyPrefs(prefs) {
  prefDither     = prefs.dither     ?? prefDither;
  prefIE6        = prefs.ie6        ?? prefIE6;
  prefColors     = parseInt(prefs.colors     ?? prefColors);
  prefLocation   = prefs.loc        ?? prefLocation;
  prefQuality    = parseInt(prefs.quality    ?? prefQuality);
  prefOverwrite  = parseInt(prefs.overwrite  ?? prefOverwrite);
  prefName       = prefs.name       ?? prefName;
  prefNameDither = prefs.nameDither ?? prefNameDither;
  prefNameIE6    = prefs.nameIE6    ?? prefNameIE6;

  // Apply to DOM
  colorsEl.value      = prefColors;
  sliderEl.value      = prefColors;
  ditherEl.checked    = prefDither;
  ie6El.checked       = prefIE6;
  locEl.value         = prefLocation;
  qualityEl.value     = prefQuality;
  overwriteEl.value   = prefOverwrite;
  nameEl.value        = prefName;
  nameDitherEl.value  = prefNameDither;
  nameIE6El.value     = prefNameIE6;
}

// ─────────────────────────────────────────────────────────────────────────────
// Front-face control handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Slider moved – update colors input to match.
 * Mirrors original updateSlider().
 */
function updateSlider() {
  prefColors = parseInt(sliderEl.value);
  colorsEl.value = prefColors;
}

/**
 * Colors text input changed.
 * Mirrors original updateColors() including arrow-key nudging.
 * Original steps: ±4 / ±16 with Shift. Clamp 8–256.
 */
function updateColorsInput(event) {
  let data = parseInt(colorsEl.value) || 0;
  data = clampColors(data);
  prefColors = data;
  sliderEl.value = prefColors;
}

function colorsKeyDown(event) {
  let data = parseInt(colorsEl.value) || 0;

  if (event.key === "ArrowUp") {
    data += event.shiftKey ? 16 : 4;
    data = clampColors(data);
    colorsEl.value = data;
    colorsEl.select();
    prefColors = data;
    sliderEl.value = prefColors;
    event.preventDefault();
  } else if (event.key === "ArrowDown") {
    data -= event.shiftKey ? 16 : 4;
    data = clampColors(data);
    colorsEl.value = data;
    colorsEl.select();
    prefColors = data;
    sliderEl.value = prefColors;
    event.preventDefault();
  } else if (event.key === "Enter") {
    data = clampColors(data);
    colorsEl.value = data;
    colorsEl.select();
    prefColors = data;
    sliderEl.value = prefColors;
  }
}

function clampColors(v) {
  return Math.max(8, Math.min(256, isNaN(v) ? 8 : v));
}

/**
 * Dither checkbox changed.
 * Mirrors original updateDither() – reads checked state directly.
 */
function updateDither() {
  prefDither = ditherEl.checked;
  savePrefs();
}

/**
 * IE6 checkbox changed.
 * Mirrors original updateIE6().
 */
function updateIE6() {
  prefIE6 = ie6El.checked;
  savePrefs();
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings panel handlers
// ─────────────────────────────────────────────────────────────────────────────

function updateLoc()        { prefLocation   = locEl.value;          savePrefs(); }
function updateQuality()    { prefQuality    = parseInt(qualityEl.value);   savePrefs(); }
function updateOverwrite()  { prefOverwrite  = parseInt(overwriteEl.value); savePrefs(); }
function updateName()       { prefName       = nameEl.value;          savePrefs(); }
function updateNameDither() { prefNameDither = nameDitherEl.value;    savePrefs(); }
function updateNameIE6()    { prefNameIE6    = nameIE6El.value;       savePrefs(); }

async function checkPngquant() {
  pqStatusEl.textContent = "Checking…";
  pqStatusEl.className   = "setting-hint";

  if (window.pywebview) {
    const result = await window.pywebview.api.check_pngquant(prefLocation);
    if (result.ok) {
      pqStatusEl.textContent = "✓ Found: " + result.path;
      pqStatusEl.className   = "setting-hint ok";
    } else {
      pqStatusEl.textContent = "✕ Not found at " + result.path;
      pqStatusEl.className   = "setting-hint fail";
    }
  } else {
    pqStatusEl.textContent = "(Check unavailable in browser mode)";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-and-drop handlers
// ─────────────────────────────────────────────────────────────────────────────

function dragEnter(event) {
  event.stopPropagation();
  event.preventDefault();
  dropZone.classList.add("dragover");
}

function dragOver(event) {
  event.stopPropagation();
  event.preventDefault();
  dropZone.classList.add("dragover");
}

function dragLeave() {
  dropZone.classList.remove("dragover");
}

async function dragDrop(event) {
  event.stopPropagation();
  event.preventDefault();
  dropZone.classList.remove("dragover");

  // ── Collect file paths ────────────────────────────────────────────────────
  let filePaths = [];

  if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
    for (const item of event.dataTransfer.items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) {
          const p = f.path || f.name;
          filePaths.push(p.startsWith("/") ? "file://" + p : p);
        }
      }
    }
  }

  // Legacy uri-list fallback
  if (filePaths.length === 0) {
    const raw = event.dataTransfer.getData("text/uri-list");
    if (raw) {
      filePaths = raw.trim().split(/\r?\n/).filter(u => u && !u.startsWith("#"));
    }
  }

  if (filePaths.length === 0) {
    showFail("No files detected.", "");
    return;
  }

  const n = filePaths.length;
  showProcessing(`Crushing ${n} file${n !== 1 ? "s" : ""}…`);

  const prefs = {
    dither:      prefDither,
    ie6:         prefIE6,
    colors:      prefColors,
    loc:         prefLocation,
    quality:     prefQuality,
    overwrite:   prefOverwrite,
    name:        prefName,
    nameDither:  prefNameDither,
    nameIE6:     prefNameIE6,
  };

  try {
    let result;
    if (window.pywebview) {
      result = await window.pywebview.api.process_files(filePaths, prefs);
    } else {
      // Browser stub
      result = {
        ok: true,
        message: "Browser mode – no processing performed.\nDrop PNGs when running via main.py.",
        commands: [],
      };
    }

    if (result.ok) {
      showSuccess(result.message, result.commands.join("\n"));
    } else if (result.wrong_type) {
      showWrong(result.message);
    } else {
      showFail(result.message, result.commands ? result.commands.join("\n") : "");
    }
  } catch (ex) {
    showFail("JavaScript error:\n" + ex.message, "");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel navigation
// ─────────────────────────────────────────────────────────────────────────────

function hideAll() {
  ["front", "back", "success-panel", "fail-panel", "wrong-panel", "processing-panel"]
    .forEach(id => document.getElementById(id).classList.add("hidden"));
}

function showFront() {
  savePrefs();
  hideAll();
  document.getElementById("front").classList.remove("hidden");
}

function showBack() {
  hideAll();
  document.getElementById("back").classList.remove("hidden");
}

function showProcessing(detail) {
  hideAll();
  document.getElementById("processing-detail").textContent = detail || "";
  document.getElementById("processing-panel").classList.remove("hidden");
}

function showSuccess(message, detail) {
  hideAll();
  document.getElementById("success-text").textContent   = message || "Done!";
  document.getElementById("success-detail").textContent = detail  || "";
  document.getElementById("success-panel").classList.remove("hidden");
}

function showFail(message, detail) {
  hideAll();
  document.getElementById("fail-text").textContent   = message || "Something went wrong.";
  document.getElementById("fail-detail").textContent = detail  || "";
  document.getElementById("fail-panel").classList.remove("hidden");
}

function showWrong(detail) {
  hideAll();
  document.getElementById("wrong-detail").textContent = detail || "";
  document.getElementById("wrong-panel").classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function selectAll(event) {
  event.target.select();
}

function openWebsite() {
  if (window.pywebview) {
    window.pywebview.api.open_url("https://iaian7.com/dashboard/Crusher");
  } else {
    window.open("https://iaian7.com/dashboard/Crusher", "_blank");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────────────────

function tryInit() {
  if (window.pywebview && typeof window.pywebview.api === "undefined") {
    setTimeout(tryInit, 50);
    return;
  }
  init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", tryInit);
} else {
  tryInit();
}
