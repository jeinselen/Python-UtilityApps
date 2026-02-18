/* ────────────────────────────────────────────────────────────────────────────
   Alchemist – app.js
   PyWebView port of the original Dashcode Dashboard widget by iaian7.com

   Translates widget.system() → pywebview.api.process_files() (async,
   background-threaded for long video encodes)

   Key changes from original:
   - All alert() debug calls removed
   - Dead rename code kept but moved into a collapsed Settings section
     (matching original CSS: visibility: hidden on #renameInputs)
   - FFmpeg fallback provided for all qt_export modes
   - onEncodingComplete() callback receives the background-thread result
   ──────────────────────────────────────────────────────────────────────────── */

"use strict";

// ── State (mirrors original prefXxx variables) ────────────────────────────────
let prefType           = 0;
let prefLocation       = "/opt/local/bin/";
let prefLocation2      = "/opt/homebrew/bin/";
let prefLocation3      = "/opt/homebrew/bin/";
let prefSpacer         = "_";
let prefDateSpacer     = "-";
let prefPrefix         = "prefix";
let prefPreBox         = false;
let prefSuffix         = "suffix";
let prefSufBox         = false;
let prefDateBox        = false;
let prefDateReverseBox = true;

// ── DOM refs ──────────────────────────────────────────────────────────────────
let typeEl, loc1El, loc2El, loc3El;
let spacerEl, dateSpacerEl, prefixEl, preBoxEl;
let suffixEl, sufBoxEl, dateBoxEl, dateRevEl;
let dropZone, feedbackEl;

// ── Mode labels (mirrors original updateFeedback switch) ──────────────────────
const MODE_LABELS = [
  "QuickTime ProRes 422",
  "QuickTime HDV 1080p",
  "QuickTime HDV 720p",
  "QuickTime AIC",
  "MP4, OGG, WebM  720p / 540p",
  "MP4, WMV  720p",
  "MP4  480p / 360p",
];

// ─────────────────────────────────────────────────────────────────────────────
// Prefs bridge
// ─────────────────────────────────────────────────────────────────────────────

async function savePrefs() {
  const prefs = {
    type:           prefType,
    location:       prefLocation,
    location2:      prefLocation2,
    location3:      prefLocation3,
    spacer:         prefSpacer,
    dateSpacer:     prefDateSpacer,
    prefix:         prefPrefix,
    preBox:         prefPreBox,
    suffix:         prefSuffix,
    sufBox:         prefSufBox,
    dateBox:        prefDateBox,
    dateReverseBox: prefDateReverseBox,
  };
  if (window.pywebview) {
    await window.pywebview.api.save_prefs(prefs);
  } else {
    localStorage.setItem("alchemist_prefs", JSON.stringify(prefs));
  }
}

async function loadPrefsFromStorage() {
  if (window.pywebview) {
    return await window.pywebview.api.load_prefs();
  }
  const stored = localStorage.getItem("alchemist_prefs");
  return stored ? JSON.parse(stored) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  typeEl       = document.getElementById("type");
  loc1El       = document.getElementById("location");
  loc2El       = document.getElementById("location2");
  loc3El       = document.getElementById("location3");
  spacerEl     = document.getElementById("spacer");
  dateSpacerEl = document.getElementById("dateSpacer");
  prefixEl     = document.getElementById("prefix");
  preBoxEl     = document.getElementById("preBox");
  suffixEl     = document.getElementById("suffix");
  sufBoxEl     = document.getElementById("sufBox");
  dateBoxEl    = document.getElementById("dateBox");
  dateRevEl    = document.getElementById("dateReverseBox");
  dropZone     = document.getElementById("drop-zone");
  feedbackEl   = document.getElementById("feedback");

  const prefs = await loadPrefsFromStorage();
  if (prefs) applyPrefs(prefs);

  updateFeedback();
  updateDateReverseFeedback();
}

function applyPrefs(prefs) {
  prefType           = parseInt(prefs.type           ?? prefType);
  prefLocation       = prefs.location       ?? prefLocation;
  prefLocation2      = prefs.location2      ?? prefLocation2;
  prefLocation3      = prefs.location3      ?? prefLocation3;
  prefSpacer         = prefs.spacer         ?? prefSpacer;
  prefDateSpacer     = prefs.dateSpacer     ?? prefDateSpacer;
  prefPrefix         = prefs.prefix         ?? prefPrefix;
  prefPreBox         = prefs.preBox         ?? prefPreBox;
  prefSuffix         = prefs.suffix         ?? prefSuffix;
  prefSufBox         = prefs.sufBox         ?? prefSufBox;
  prefDateBox        = prefs.dateBox        ?? prefDateBox;
  prefDateReverseBox = prefs.dateReverseBox ?? prefDateReverseBox;

  typeEl.value       = prefType;
  loc1El.value       = prefLocation;
  loc2El.value       = prefLocation2;
  loc3El.value       = prefLocation3;
  spacerEl.value     = prefSpacer;
  dateSpacerEl.value = prefDateSpacer;
  prefixEl.value     = prefPrefix;
  preBoxEl.checked   = prefPreBox;
  suffixEl.value     = prefSuffix;
  sufBoxEl.checked   = prefSufBox;
  dateBoxEl.checked  = prefDateBox;
  dateRevEl.checked  = prefDateReverseBox;
}

// ─────────────────────────────────────────────────────────────────────────────
// Setting handlers – mirror original update* functions
// ─────────────────────────────────────────────────────────────────────────────

function updateType() {
  prefType = parseInt(typeEl.value);
  updateFeedback();
  savePrefs();
}

function updateLocation()  { prefLocation  = loc1El.value;         savePrefs(); }
function updateLocation2() { prefLocation2 = loc2El.value;         savePrefs(); }
function updateLocation3() { prefLocation3 = loc3El.value;         savePrefs(); }
function updateSpacer()    { prefSpacer    = spacerEl.value;        }
function updatePrefix()    { prefPrefix    = prefixEl.value;        }
function updatePreBox()    { prefPreBox    = preBoxEl.checked;      }
function updateSuffix()    { prefSuffix    = suffixEl.value;        }
function updateSufBox()    { prefSufBox    = sufBoxEl.checked;      }
function updateDateBox()   { prefDateBox   = dateBoxEl.checked;     }

function updateDateSpacer() {
  prefDateSpacer = dateSpacerEl.value;
  updateDateReverseFeedback();
}

function updateDateReverseBox() {
  prefDateReverseBox = dateRevEl.checked;
  updateDateReverseFeedback();
  savePrefs();
}

/**
 * Updates the date format preview label.
 * Mirrors original updateDateReverseFeedback().
 */
function updateDateReverseFeedback() {
  const s = prefDateSpacer || "-";
  const el = document.getElementById("dateReverseFeedback");
  if (!el) return;
  el.textContent = prefDateReverseBox
    ? `yyyy${s}mm${s}dd`
    : `dd${s}mm${s}yyyy`;
}

/**
 * Updates the feedback label below the mode selector.
 * Mirrors original updateFeedback() switch statement exactly.
 */
function updateFeedback() {
  feedbackEl.textContent = MODE_LABELS[prefType] ?? "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool path verifier ("Check" buttons)
// ─────────────────────────────────────────────────────────────────────────────

async function checkTool(name, statusId) {
  const statusEl = document.getElementById(statusId);
  statusEl.textContent = "Checking…";
  statusEl.className   = "setting-hint";

  // Pick the right location input based on tool name
  const locMap = {
    qt_export:       prefLocation,
    ffmpeg:          prefLocation2,
    ffmpeg2theora:   prefLocation3,
  };
  const loc = locMap[name] ?? prefLocation2;

  if (window.pywebview) {
    const result = await window.pywebview.api.check_tool(loc, name);
    if (result.ok) {
      statusEl.textContent = "✓ " + result.path;
      statusEl.className   = "setting-hint ok";
    } else {
      statusEl.textContent = "✕ Not found at " + result.path;
      statusEl.className   = "setting-hint fail";
    }
  } else {
    statusEl.textContent = "(Check unavailable in browser mode)";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Drag-and-drop
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

  const prefs = {
    type:      prefType,
    location:  prefLocation,
    location2: prefLocation2,
    location3: prefLocation3,
  };

  try {
    let result;
    if (window.pywebview) {
      result = await window.pywebview.api.process_files(filePaths, prefs);
    } else {
      result = {
        ok: true,
        message: "Browser mode – no encoding performed.",
        label:   MODE_LABELS[prefType] ?? "",
        commands: [],
        jobs_total: 0,
      };
    }

    if (!result.ok) {
      if (result.wrong_type) {
        showWrong(result.message);
      } else {
        showFail(result.message, result.commands ? result.commands[0] ?? "" : "");
      }
      return;
    }

    // Encoding kicked off in background — show "started" panel
    showStarted(result.message, result.label);

  } catch (ex) {
    showFail("JavaScript error:\n" + ex.message, "");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Background callback (called by Python via evaluate_js)
// Mirrors original endHandler() behaviour
// ─────────────────────────────────────────────────────────────────────────────

function onEncodingComplete(ok, message) {
  if (ok) {
    showSuccess(message, "");
  } else {
    showFail(message, "");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel navigation
// ─────────────────────────────────────────────────────────────────────────────

function hideAll() {
  ["front", "back", "started-panel", "success-panel",
   "fail-panel", "wrong-panel"]
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

function showStarted(message, detail) {
  hideAll();
  document.getElementById("started-text").textContent   = message ?? "Encoding started…";
  document.getElementById("started-detail").textContent = detail  ?? "";
  document.getElementById("started-panel").classList.remove("hidden");
}

function showSuccess(message, detail) {
  hideAll();
  document.getElementById("success-text").textContent   = message ?? "Done!";
  document.getElementById("success-detail").textContent = detail  ?? "";
  document.getElementById("success-panel").classList.remove("hidden");
}

function showFail(message, detail) {
  hideAll();
  document.getElementById("fail-text").textContent   = message ?? "Something went wrong.";
  document.getElementById("fail-detail").textContent = detail  ?? "";
  document.getElementById("fail-panel").classList.remove("hidden");
}

function showWrong(detail) {
  hideAll();
  document.getElementById("wrong-detail").textContent = detail ?? "";
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
    window.pywebview.api.open_url("https://iaian7.com/dashboard/Alchemist");
  } else {
    window.open("https://iaian7.com/dashboard/Alchemist", "_blank");
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
