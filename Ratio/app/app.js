/* ────────────────────────────────────────────────────────────────────────────
   Ratio – app.js
   PyWebView port of the original Dashcode Dashboard widget by iaian7.com

   All core logic translated directly from main.js. Preferences are persisted
   via window.pywebview.api (Python side), falling back to localStorage when
   running in a plain browser for easy development testing.
   ──────────────────────────────────────────────────────────────────────────── */

"use strict";

// ── State (mirrors the original prefXxx variables) ────────────────────────────
let prefPreset   = 1;
let prefLimit    = 10;
let prefLimitID  = 2;
let prefScale    = 66.67;
let prefRatio    = "16 × 9";
let prefAspect   = 1.778;
let prefLock     = false;
let prefWidth    = 1920;
let prefHeight   = 1080;

// ── DOM shortcuts (set after DOMContentLoaded) ────────────────────────────────
let inputX, inputY, outputX, outputY, slider, scaleEl, ratioEl, aspectEl;
let presetsEl, limitsEl, lockBtn, lockIcon;

// ─────────────────────────────────────────────────────────────────────────────
// Prefs bridge – works with PyWebView API or localStorage fallback
// ─────────────────────────────────────────────────────────────────────────────

async function savePrefs() {
  const prefs = {
    preset:   prefPreset,
    limit:    prefLimit,
    limitID:  prefLimitID,
    scale:    prefScale,
    ratio:    prefRatio,
    aspect:   prefAspect,
    lock:     prefLock,
    width:    prefWidth,
    height:   prefHeight,
  };
  if (window.pywebview) {
    await window.pywebview.api.save_prefs(prefs);
  } else {
    localStorage.setItem("ratio_prefs", JSON.stringify(prefs));
  }
}

async function loadPrefs() {
  let prefs = null;
  if (window.pywebview) {
    prefs = await window.pywebview.api.load_prefs();
  } else {
    const stored = localStorage.getItem("ratio_prefs");
    if (stored) prefs = JSON.parse(stored);
  }
  if (!prefs) return;

  prefPreset  = prefs.preset  ?? prefPreset;
  prefLimit   = prefs.limit   ?? prefLimit;
  prefLimitID = prefs.limitID ?? prefLimitID;
  prefScale   = parseFloat(prefs.scale  ?? prefScale);
  prefRatio   = prefs.ratio   ?? prefRatio;
  prefAspect  = parseFloat(prefs.aspect ?? prefAspect);
  prefLock    = prefs.lock    ?? prefLock;
  prefWidth   = parseFloat(prefs.width  ?? prefWidth);
  prefHeight  = parseFloat(prefs.height ?? prefHeight);
}

// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  // Grab DOM refs
  inputX   = document.getElementById("inputX");
  inputY   = document.getElementById("inputY");
  outputX  = document.getElementById("outputX");
  outputY  = document.getElementById("outputY");
  slider   = document.getElementById("slider");
  scaleEl  = document.getElementById("scale");
  ratioEl  = document.getElementById("ratio");
  aspectEl = document.getElementById("aspect");
  presetsEl = document.getElementById("presets");
  limitsEl  = document.getElementById("limits");
  lockBtn  = document.getElementById("lock-btn");
  lockIcon = document.getElementById("lock-icon");

  // Wire preset selector
  presetsEl.addEventListener("change", updatePreset);

  await loadPrefs();
  applyLoadedPrefs();
  update(true, true, true, true, true);
}

function applyLoadedPrefs() {
  // Restore input fields
  inputX.value = prefWidth;
  inputY.value = prefHeight;

  // Restore preset selector index
  if (prefPreset >= 0 && prefPreset < presetsEl.options.length) {
    presetsEl.selectedIndex = prefPreset;
  }

  // Restore limit selector
  restoreLimitSelector();

  // Restore lock
  if (prefLock) {
    lockBtn.classList.add("locked");
    lockIcon.textContent = "🔒";
  }
}

function restoreLimitSelector() {
  // Match stored limit value against option values
  const opts = limitsEl.options;
  for (let i = 0; i < opts.length; i++) {
    const v = opts[i].value;
    const n = v === "none" ? "none" : parseFloat(v);
    if (n == prefLimit || (prefLimit === "none" && v === "none")) {
      limitsEl.selectedIndex = i;
      return;
    }
  }
  limitsEl.selectedIndex = prefLimitID < opts.length ? prefLimitID : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core update engine
// Mirrors the original update(vx, vy, vs, vp, vr, active) exactly.
//
//   vx     – recalculate / display outputX
//   vy     – recalculate / display outputY
//   vs     – update slider thumb position
//   vp     – update scale percentage text
//   vr     – recalculate ratio & aspect labels
//   active – which input field is the "source" when lock is on
//             ("inputX" | "inputY" | "both" | undefined)
// ─────────────────────────────────────────────────────────────────────────────

function update(vx, vy, vs, vp, vr, active) {
  const limit = prefLimit === "none" ? "none" : parseFloat(prefLimit);

  if (vx && vy) {
    // When lock is active, mirror the constrained dimension back to the source
    if (prefLock && active) {
      if (active === "inputX") {
        inputY.value = isInt(prefHeight) ? prefHeight.toFixed(0) : prefHeight.toFixed(2);
      } else if (active === "inputY") {
        inputX.value = isInt(prefWidth)  ? prefWidth.toFixed(0)  : prefWidth.toFixed(2);
      }
    }

    if (active === "both") {
      inputX.value = prefWidth.toFixed(0);
      inputY.value = prefHeight.toFixed(0);
    }

    let ox = prefWidth  * (prefScale * 0.01);
    let oy = prefHeight * (prefScale * 0.01);

    if (limit === "none") {
      outputX.value = ox.toFixed(2);
      outputY.value = oy.toFixed(2);
    } else if ((ox % limit === 0 && oy % limit === 0) || vs === vp) {
      outputX.value = ox.toFixed(0);
      outputY.value = oy.toFixed(0);
    } else {
      // Round to nearest step
      ox = Math.round(ox / limit) * limit;
      oy = Math.round(oy / limit) * limit;
      outputX.value = ox.toFixed(0);
      outputY.value = oy.toFixed(0);
    }
  } else if (vy) {
    const oy = prefHeight * (prefScale * 0.01);
    outputY.value = isInt(oy) ? oy.toFixed(0) : oy.toFixed(2);
  } else if (vx) {
    const ox = prefWidth * (prefScale * 0.01);
    outputX.value = isInt(ox) ? ox.toFixed(0) : ox.toFixed(2);
  }

  if (vs) {
    slider.value = prefScale;
  }

  if (vp) {
    scaleEl.value = isInt(prefScale) ? prefScale.toFixed(0) : prefScale.toFixed(2);
  }

  if (vr && prefWidth > 0 && prefHeight > 0 && !prefLock) {
    let w = 1;
    let foundRatio = false;
    while (!foundRatio && w <= 100) {
      const h = (prefHeight / prefWidth) * w;
      if (isInt(w) && isInt(h)) {
        prefRatio  = w + " × " + h;
        foundRatio = true;
      }
      w++;
    }
    prefAspect = prefWidth / prefHeight;
    ratioEl.textContent  = prefRatio;
    aspectEl.textContent = prefAspect.toFixed(3);
  }
}

function isInt(n) {
  return (n % 1) === 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event handlers – match original function signatures
// ─────────────────────────────────────────────────────────────────────────────

function updatePreset() {
  const val = presetsEl.value;
  prefPreset = presetsEl.selectedIndex;

  if (val !== "presets") {
    const parts = val.split("x");
    prefWidth  = inputX.value = parseFloat(parts[0]);
    prefHeight = inputY.value = parseFloat(parts[1]);
  }

  savePrefs();
  update(true, true, false, false, true);
}

function updateLimit() {
  const val = limitsEl.value;
  prefLimit   = val === "none" ? "none" : parseFloat(val);
  prefLimitID = limitsEl.selectedIndex;
  savePrefs();
}

function updateSource(event) {
  const ix = parseFloat(inputX.value);
  const iy = parseFloat(inputY.value);
  let active = "both";

  if (event.target.id === "inputX" && ix > 0) {
    prefWidth  = ix;
    if (prefLock) prefHeight = ix / prefAspect;
    active = "inputX";
  } else if (event.target.id === "inputY" && iy > 0) {
    prefHeight = iy;
    if (prefLock) prefWidth = iy * prefAspect;
    active = "inputY";
  }

  update(true, true, false, false, true, active);
}

function updateX() {
  const ox = parseFloat(outputX.value);
  if (ox > 0) {
    prefScale = (ox / prefWidth) * 100;
  } else {
    return update(true, true, false, false, true);
  }
  update(false, true, true, true, false);
}

function updateY() {
  const oy = parseFloat(outputY.value);
  if (oy > 0) {
    prefScale = (oy / prefHeight) * 100;
  } else {
    return update(true, true, false, false, true);
  }
  update(true, false, true, true, false);
}

function updateSlider() {
  prefScale = parseFloat(slider.value);
  update(true, true, false, true, false);
}

function updateScale() {
  const val = parseFloat(scaleEl.value);
  if (val > 0) {
    prefScale = val;
  }
  update(true, true, true, false, false);
}

// ── Arrow-key nudging (original keyboard() function) ─────────────────────────
function keyboard(event) {
  const target = event.target;
  const data   = parseFloat(target.value) || 0;
  const step   = event.shiftKey ? 10 : 1;

  if (event.key === "ArrowUp") {
    target.value = data + step;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    event.preventDefault();
  } else if (event.key === "ArrowDown") {
    target.value = data - step;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    event.preventDefault();
  }
  // Enter – just blur so change fires naturally
  if (event.key === "Enter") target.blur();
}

function selectAll(event) {
  event.target.select();
}

// ── Swap width ↔ height ───────────────────────────────────────────────────────
function swap() {
  const tempX  = parseFloat(inputX.value);
  const tempY  = parseFloat(inputY.value);
  prefWidth    = tempY;
  prefHeight   = tempX;
  inputX.value = prefWidth;
  inputY.value = prefHeight;
  update(true, true, false, false, true);
}

// ── Aspect lock toggle ────────────────────────────────────────────────────────
function toggleLock() {
  prefLock = !prefLock;
  lockBtn.classList.toggle("locked", prefLock);
  lockIcon.textContent = prefLock ? "🔒" : "🔓";
  savePrefs();
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-generate list panel
// Mirrors the original auto() function
// ─────────────────────────────────────────────────────────────────────────────

function auto() {
  const tbody  = document.getElementById("ratio-tbody");
  const limit  = prefLimit === "none" ? 1 : parseFloat(prefLimit);
  tbody.innerHTML = "";

  let width  = Math.floor(prefWidth);
  let rows   = 0;

  while (width >= limit * 2) {
    width -= limit;
    const height = (prefHeight / prefWidth) * width;

    if ((width % limit === 0) && (height % limit === 0)) {
      const pct = ((width / prefWidth) * 100).toFixed(2);
      const tr  = document.createElement("tr");
      tr.innerHTML = `<td>${pct}%</td><td>${width} × ${height}</td>`;
      // Clicking a row applies that scale (mirrors original row onclick)
      tr.addEventListener("click", () => {
        prefScale = parseFloat(pct);
        showFront();
        update(true, true, true, true, false);
        savePrefs();
      });
      tbody.appendChild(tr);
      rows++;
    }
  }

  if (rows === 0) {
    const tr = document.createElement("tr");
    tr.className = "no-results";
    tr.innerHTML = `<td colspan="2">No results — try a smaller step size</td>`;
    tbody.appendChild(tr);
  }

  showList();
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel navigation
// ─────────────────────────────────────────────────────────────────────────────

function showFront() {
  savePrefs();
  document.getElementById("front").classList.remove("hidden");
  document.getElementById("list-panel").classList.add("hidden");
  document.getElementById("back").classList.add("hidden");
}

function showList() {
  document.getElementById("front").classList.add("hidden");
  document.getElementById("list-panel").classList.remove("hidden");
  document.getElementById("back").classList.add("hidden");
}

function showBack() {
  savePrefs();
  document.getElementById("front").classList.add("hidden");
  document.getElementById("list-panel").classList.add("hidden");
  document.getElementById("back").classList.remove("hidden");
}

// ─────────────────────────────────────────────────────────────────────────────
// External link
// ─────────────────────────────────────────────────────────────────────────────

function openWebsite() {
  if (window.pywebview) {
    window.pywebview.api.open_url("https://iaian7.com/dashboard/Ratio");
  } else {
    window.open("https://iaian7.com/dashboard/Ratio", "_blank");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Boot
// PyWebView fires window.onload reliably; we also guard against the
// pywebview API not being ready yet with a short poll.
// ─────────────────────────────────────────────────────────────────────────────

function tryInit() {
  if (window.pywebview && typeof window.pywebview.api === "undefined") {
    // API not injected yet – retry
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