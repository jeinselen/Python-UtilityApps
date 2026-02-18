/* ────────────────────────────────────────────────────────────────────────────
   Sheets – app.js
   PyWebView port of the original Dashcode Dashboard widget by iaian7.com

   Translates widget.system() → pywebview.api.process_files()
   Translates widget.preferenceForKey() → pywebview.api.load_prefs() / save_prefs()
   localStorage is used as a fallback when running in a plain browser.
   ──────────────────────────────────────────────────────────────────────────── */

"use strict";

// ── State (mirrors original prefXxx variables) ────────────────────────────────
let prefType        = 0;
let prefSize        = "128x128";
let prefTile        = "4x4";
let prefLocation    = "/opt/homebrew/bin/";
let prefNameSprite  = "Sheet-%d";
let prefNameFile    = "Files-";
let prefScale       = 3;
let prefOutput      = 0;

// ── DOM refs ──────────────────────────────────────────────────────────────────
let typeEl, sizeEl, tileEl, locEl, scaleEl, outputEl;
let nameSpriteEl, nameFileEl;
let dropZone, imStatusEl;

// ─────────────────────────────────────────────────────────────────────────────
// Prefs bridge
// ─────────────────────────────────────────────────────────────────────────────

async function savePrefs() {
  const prefs = {
    type:        prefType,
    size:        prefSize,
    tile:        prefTile,
    loc:         prefLocation,
    nameSprite:  prefNameSprite,
    nameFile:    prefNameFile,
    scale:       prefScale,
    output:      prefOutput,
  };
  if (window.pywebview) {
    await window.pywebview.api.save_prefs(prefs);
  } else {
    localStorage.setItem("sheets_prefs", JSON.stringify(prefs));
  }
}

async function loadPrefsFromStorage() {
  if (window.pywebview) {
    return await window.pywebview.api.load_prefs();
  }
  const stored = localStorage.getItem("sheets_prefs");
  return stored ? JSON.parse(stored) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  typeEl        = document.getElementById("type");
  sizeEl        = document.getElementById("size");
  tileEl        = document.getElementById("tile");
  locEl         = document.getElementById("loc");
  scaleEl       = document.getElementById("scale");
  outputEl      = document.getElementById("output");
  nameSpriteEl  = document.getElementById("nameSprite");
  nameFileEl    = document.getElementById("nameFile");
  dropZone      = document.getElementById("drop-zone");
  imStatusEl    = document.getElementById("im-status");

  const prefs = await loadPrefsFromStorage();
  if (prefs) applyPrefs(prefs);

  updateOpacity();
}

function applyPrefs(prefs) {
  prefType        = parseInt(prefs.type       ?? prefType);
  prefSize        = prefs.size        ?? prefSize;
  prefTile        = prefs.tile        ?? prefTile;
  prefLocation    = prefs.loc         ?? prefLocation;
  prefNameSprite  = prefs.nameSprite  ?? prefNameSprite;
  prefNameFile    = prefs.nameFile    ?? prefNameFile;
  prefScale       = parseInt(prefs.scale      ?? prefScale);
  prefOutput      = parseInt(prefs.output     ?? prefOutput);

  typeEl.value        = prefType;
  sizeEl.value        = prefSize;
  tileEl.value        = prefTile;
  locEl.value         = prefLocation;
  nameSpriteEl.value  = prefNameSprite;
  nameFileEl.value    = prefNameFile;
  scaleEl.value       = prefScale;
  outputEl.value      = prefOutput;
}

// ─────────────────────────────────────────────────────────────────────────────
// Settings handlers – mirror original update* functions
// ─────────────────────────────────────────────────────────────────────────────

function updateType() {
  prefType = parseInt(typeEl.value);
  updateOpacity();
  savePrefs();
}

/**
 * Mirror original updateOpacity():
 *   type >= 5  → both active
 *   type == 4  → tile active, size dimmed
 *   type == 3  → size active, tile dimmed
 *   else       → both dimmed
 */
function updateOpacity() {
  const sizeBox = document.getElementById("size-box");
  const tileBox = document.getElementById("tile-box");

  if (prefType >= 5) {
    sizeBox.classList.remove("inactive");
    tileBox.classList.remove("inactive");
  } else if (prefType === 4) {
    sizeBox.classList.add("inactive");
    tileBox.classList.remove("inactive");
  } else if (prefType === 3) {
    sizeBox.classList.remove("inactive");
    tileBox.classList.add("inactive");
  } else {
    sizeBox.classList.add("inactive");
    tileBox.classList.add("inactive");
  }
}

function updateSize()       { prefSize       = sizeEl.value;       }
function updateTile()       { prefTile       = tileEl.value;       }
function updateLoc()        { prefLocation   = locEl.value;        savePrefs(); }
function updateNameSprite() { prefNameSprite = nameSpriteEl.value; savePrefs(); }
function updateNameFile()   { prefNameFile   = nameFileEl.value;   savePrefs(); }
function updateScale()      { prefScale      = parseInt(scaleEl.value); savePrefs(); }
function updateOutput()     { prefOutput     = parseInt(outputEl.value); savePrefs(); }

// ─────────────────────────────────────────────────────────────────────────────
// ImageMagick check (Settings panel)
// ─────────────────────────────────────────────────────────────────────────────

async function checkIM() {
  imStatusEl.textContent = "Checking…";
  imStatusEl.className   = "setting-hint";

  if (window.pywebview) {
    const result = await window.pywebview.api.check_imagemagick(prefLocation);
    if (result.ok) {
      imStatusEl.textContent = "✓ Found: " + result.path;
      imStatusEl.className   = "setting-hint ok";
    } else {
      imStatusEl.textContent = "✕ Not found at " + result.path;
      imStatusEl.className   = "setting-hint fail";
    }
  } else {
    imStatusEl.textContent = "(Check unavailable in browser mode)";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-and-drop handlers
// Mirror original dragEnter / dragOver / dragDrop
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

function dragLeave(event) {
  dropZone.classList.remove("dragover");
}

async function dragDrop(event) {
  event.stopPropagation();
  event.preventDefault();
  dropZone.classList.remove("dragover");

  // ── Collect file URIs from the dataTransfer ───────────────────────────────
  let uris = [];

  // DataTransferItemList (modern path — used by PyWebView's WebKit)
  if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
    for (const item of event.dataTransfer.items) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) {
          // PyWebView exposes a real path on the file object
          const path = f.path || f.name;
          uris.push(path.startsWith("/") ? "file://" + path : path);
        }
      }
    }
  }

  // Legacy text/uri-list fallback (used by Dashboard / older WebKit)
  if (uris.length === 0) {
    const raw = event.dataTransfer.getData("text/uri-list");
    if (raw) {
      uris = raw.trim().split(/\r?\n/).filter(u => u && !u.startsWith("#"));
    }
  }

  if (uris.length === 0) {
    showFail("No files detected in the drop.", "");
    return;
  }

  // ── Show processing indicator ─────────────────────────────────────────────
  showProcessing(`Processing ${uris.length} file${uris.length !== 1 ? "s" : ""}…`);

  // ── Hand off to Python backend ────────────────────────────────────────────
  const prefs = {
    type:        prefType,
    size:        prefSize,
    tile:        prefTile,
    loc:         prefLocation,
    nameSprite:  prefNameSprite,
    nameFile:    prefNameFile,
    scale:       prefScale,
    output:      prefOutput,
  };

  try {
    let result;
    if (window.pywebview) {
      result = await window.pywebview.api.process_files(uris, prefs);
    } else {
      // Browser-mode stub so the UI can be tested without Python
      result = {
        ok: true,
        message: "Browser mode – no processing performed.",
        commands: ["montage -background none … (stub)"],
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
    showFail("JavaScript error: " + ex.message, "");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel navigation – mirrors original showMain / showSuccess / showFail / showWrong
// ─────────────────────────────────────────────────────────────────────────────

function hideAll() {
  document.getElementById("front").classList.add("hidden");
  document.getElementById("back").classList.add("hidden");
  document.getElementById("success-panel").classList.add("hidden");
  document.getElementById("fail-panel").classList.add("hidden");
  document.getElementById("wrong-panel").classList.add("hidden");
  document.getElementById("processing-panel").classList.add("hidden");
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
  document.getElementById("success-details").textContent = detail  || "";
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
    window.pywebview.api.open_url("https://iaian7.com/dashboard/Sheets");
  } else {
    window.open("https://iaian7.com/dashboard/Sheets", "_blank");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot – guard against PyWebView API not being injected yet
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
