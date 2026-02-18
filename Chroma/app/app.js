/* ────────────────────────────────────────────────────────────────────────────
   Chroma – app.js
   PyWebView port of the original Dashcode Dashboard widget by iaian7.com

   Faithful translation of main.js with the following changes:
   - widget.preferenceForKey() → pywebview.api.load_prefs() / save_prefs()
   - widget.system("pbcopy/pbpaste"…) → pywebview.api.clipboard_write/read()
     with navigator.clipboard as a browser-mode fallback
   - AppleScrollArea list → plain <ul> DOM rendered by renderLibrary()
     (the Dashcode list/dataSource pattern is not available outside Dashboard)
   - AppleAnimator → CSS transition / keyframe animations
   - alert() debug calls removed
   - versionCheck() removed (no network call needed)
   - The "library" pref key is intentionally NOT prefixed with wid so it is
     shared across instances, matching the original widget behaviour
   ──────────────────────────────────────────────────────────────────────────── */

"use strict";

// ── Colour state (indexes mirror original pref[] array) ───────────────────────
// pref[2]=H(0–360)  pref[3]=S(0–1)  pref[4]=V(0–1)
// pref[5]=R(0–1)    pref[6]=G(0–1)  pref[7]=B(0–1)
// pref[8]=HEX string (6 uppercase chars, no #)
const pref = [null, null, 70, 0.8, 0.9, 0.78, 0.90, 0.18, "C6E52D"];

// ── Library ───────────────────────────────────────────────────────────────────
// Each entry: [group, name, H, S, V, R, G, B, HEX, timestamp]
let prefLibrary = [];

// ── Settings prefs ────────────────────────────────────────────────────────────
let prefSort      = 0;
let prefShow      = 0;
let prefFormatHSV = 0;
let prefFormatRGB = 0;
let prefAccuracy  = 1;
let prefGroup     = "group";
let prefName      = "name";
let prefScroll    = 0;

// ── Clipboard import staging area ─────────────────────────────────────────────
let clipboardImport = null;


// ─────────────────────────────────────────────────────────────────────────────
// Library packing / unpacking  (mirrors original packLibrary / unpackLibrary)
// Format: "grp:name:H:S:V:R:G:B:HEX:ts::grp:name:…"
// arrayClean keeps only entries where index [9] (timestamp) is truthy
// ─────────────────────────────────────────────────────────────────────────────

function arrayClean(arr) {
  return arr.filter(row => row[9]);
}

function packLibrary(data) {
  return arrayClean(data)
    .map(row => row.join(":"))
    .join("::");
}

function unpackLibrary(data) {
  if (!data || !data.trim()) return [];
  return arrayClean(
    data.split("::").map(entry => entry.split(":"))
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Prefs bridge
// ─────────────────────────────────────────────────────────────────────────────

async function savePrefs() {
  const prefs = {
    H: pref[2], S: pref[3], V: pref[4],
    R: pref[5], G: pref[6], B: pref[7], X: pref[8],
    library:      packLibrary(prefLibrary),
    sort:         prefSort,
    show:         prefShow,
    formatHSV:    prefFormatHSV,
    formatRGB:    prefFormatRGB,
    accuracy:     prefAccuracy,
    group:        prefGroup,
    name:         prefName,
    scroll:       prefScroll,
  };
  if (window.pywebview) {
    await window.pywebview.api.save_prefs(prefs);
  } else {
    localStorage.setItem("chroma_prefs", JSON.stringify(prefs));
  }
}

async function loadPrefsFromStorage() {
  if (window.pywebview) {
    return await window.pywebview.api.load_prefs();
  }
  const s = localStorage.getItem("chroma_prefs");
  return s ? JSON.parse(s) : null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  const saved = await loadPrefsFromStorage();
  if (saved) {
    pref[2] = parseFloat(saved.H   ?? pref[2]);
    pref[3] = parseFloat(saved.S   ?? pref[3]);
    pref[4] = parseFloat(saved.V   ?? pref[4]);
    pref[5] = parseFloat(saved.R   ?? pref[5]);
    pref[6] = parseFloat(saved.G   ?? pref[6]);
    pref[7] = parseFloat(saved.B   ?? pref[7]);
    pref[8] = String(saved.X       ?? pref[8]).replace("#","").toUpperCase();

    prefLibrary   = unpackLibrary(saved.library   ?? "");
    prefSort      = parseInt(saved.sort      ?? 0);
    prefShow      = parseInt(saved.show      ?? 0);
    prefFormatHSV = parseInt(saved.formatHSV ?? 0);
    prefFormatRGB = parseInt(saved.formatRGB ?? 0);
    prefAccuracy  = parseInt(saved.accuracy  ?? 1);
    prefGroup     = saved.group ?? "group";
    prefName      = saved.name  ?? "name";
    prefScroll    = parseInt(saved.scroll    ?? 0);
  }

  // Apply settings dropdowns
  el("sort").value      = prefSort;
  el("show").value      = prefShow;
  el("formatHSV").value = prefFormatHSV;
  el("formatRGB").value = prefFormatRGB;
  el("accuracy").value  = prefAccuracy;

  updateAll();
  processLibrary();

  // Restore scroll position
  setTimeout(() => {
    const wrap = el("library-wrap");
    if (wrap) wrap.scrollTop = parseInt(prefScroll) || 0;
  }, 50);
}


// ─────────────────────────────────────────────────────────────────────────────
// updateAll – refresh all displayed values from pref[]
// Mirrors original updateAll(event) — the `skip` argument avoids circular
// updates when the user is typing in that specific field group.
// ─────────────────────────────────────────────────────────────────────────────

function updateAll(skip) {
  if (skip !== "HSV") {
    el("H").value = parseH(pref[2]);
    el("S").value = parseSV(pref[3]);
    el("V").value = parseSV(pref[4]);
  }
  if (skip !== "RGB") {
    el("R").value = parseRGB(pref[5]);
    el("G").value = parseRGB(pref[6]);
    el("B").value = parseRGB(pref[7]);
  }
  if (skip !== "HEX") {
    el("X").value = "#" + pref[8];
  }

  const hex = "#" + pref[8];
  const swEl = el("swatch");
  if (swEl) swEl.style.backgroundColor = hex;
  const ssEl = el("swatch-save");
  if (ssEl) ssEl.style.backgroundColor = hex;

  el("groupTitle").value = prefGroup;
  el("nameTitle").value  = prefName;
}


// ─────────────────────────────────────────────────────────────────────────────
// Settings handlers (mirror original update* functions)
// ─────────────────────────────────────────────────────────────────────────────

function updateSort() {
  prefSort = parseInt(el("sort").value);
  processLibrary();
}

function updateShow() {
  prefShow = parseInt(el("show").value);
  renderLibrary();
  savePrefs();
}

function updateFormatHSV() {
  prefFormatHSV = parseInt(el("formatHSV").value);
  updateAll();
  renderLibrary();
  savePrefs();
}

function updateFormatRGB() {
  prefFormatRGB = parseInt(el("formatRGB").value);
  updateAll();
  renderLibrary();
  savePrefs();
}

function updateAccuracy() {
  prefAccuracy = parseInt(el("accuracy").value);
  renderLibrary();
  savePrefs();
}

function updateGroup() { prefGroup = el("groupTitle").value; }
function updateName()  { prefName  = el("nameTitle").value; }

function updateScroll() {
  const wrap = el("library-wrap");
  if (wrap) prefScroll = wrap.scrollTop;
}


// ─────────────────────────────────────────────────────────────────────────────
// Keyboard input handler  (mirrors original updateInput exactly)
// Handles arrow-key nudging, typed values, and HEX paste for all 7 fields.
// ─────────────────────────────────────────────────────────────────────────────

function updateInput(event) {
  let data     = parseFloat(event.target.value);
  let dataFrom = data;
  let prefId   = 8;
  let increment      = (prefFormatRGB === 0) ? 0.015625 : 0.01;
  let incrementShift = (prefFormatRGB === 0) ? 0.0625   : 0.1;

  switch (event.target.id) {
    case "H":
      prefId        = 2;
      dataFrom      = fromH(data);
      increment      = 1;
      incrementShift = 10;
      break;
    case "S":
      prefId        = 3;
      dataFrom      = fromSV(data);
      increment      = (prefFormatHSV === 1) ? 0.015625 : 0.01;
      incrementShift = (prefFormatHSV === 1) ? 0.0625   : 0.1;
      break;
    case "V":
      prefId        = 4;
      dataFrom      = fromSV(data);
      increment      = (prefFormatHSV === 1) ? 0.015625 : 0.01;
      incrementShift = (prefFormatHSV === 1) ? 0.0625   : 0.1;
      break;
    case "R":
      prefId   = 5;
      dataFrom = fromRGB(data);
      break;
    case "G":
      prefId   = 6;
      dataFrom = fromRGB(data);
      break;
    case "B":
      prefId   = 7;
      dataFrom = fromRGB(data);
      break;
    default:
      // HEX field — paste-only, never arrow-key incremented
      prefId        = 8;
      increment      = false;
      incrementShift = false;
      data = event.target.value.match(/([0-9a-f]{6})/i);
      if (data && event.keyCode > 40) {
        pref[8] = data[1].replace("#", "").toUpperCase();
        if (!data[0].match("#")) event.target.value = "#" + pref[8];
        HEXtoRGB();
        RGBtoHSV();
        updateAll("HEX");
        return selectAll(event);
      }
      return false;
  }

  if (event.keyCode === 38 && increment) {
    // Up arrow
    data  = pref[prefId];
    data += (event.shiftKey) ? incrementShift : increment;
  } else if (event.keyCode === 40 && increment) {
    // Down arrow
    data  = pref[prefId];
    data -= (event.shiftKey) ? incrementShift : increment;
  } else if (pref[prefId] === dataFrom) {
    // No change — do nothing (prevents updates on non-entry keypresses)
    return false;
  } else if (data >= 0) {
    // Typed numeric value — convert to internal float
    if (prefId === 2)        data = fromH(data);
    else if (prefId <= 4)    data = fromSV(data);
    else                     data = fromRGB(data);
  } else {
    data = pref[prefId];
  }

  // Rollover hue; clamp others to [0, 1]
  if (prefId === 2)        data = ((data % 360) + 360) % 360;
  else if (data > 1)       data = 1.0;
  if (data < 0)            data = 0;

  pref[prefId] = data;

  if (prefId <= 4) {
    HSVtoRGB();
    RGBtoHEX();
    updateAll("HSV");
  } else {
    RGBtoHSV();
    RGBtoHEX();
    updateAll("RGB");
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Library management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add current colour to the library.
 * Mirrors original addLibrary() — requires both group and name to contain
 * at least one letter.
 */
function addLibrary() {
  if (!prefGroup.match(/[a-z]/i) || !prefName.match(/[a-z]/i)) {
    return showAlert();
  }
  updateScroll();
  prefLibrary.push([
    prefGroup, prefName,
    pref[2], pref[3], pref[4],
    pref[5], pref[6], pref[7],
    pref[8],
    Date.now(),
  ]);
  processLibrary();
  showValues();
}

/**
 * Delete a library entry by timestamp key.
 * Mirrors original editLibrary(event) where event = timestamp string.
 */
function deleteLibraryEntry(timestamp) {
  updateScroll();
  const idx = prefLibrary.findIndex(row => String(row[9]) === String(timestamp));
  if (idx !== -1) prefLibrary.splice(idx, 1);
  processLibrary();
}

/**
 * Load a library entry into the colour picker.
 * Mirrors original fromLibrary(event).
 */
function fromLibrary(entry) {
  prefGroup = entry[0];
  prefName  = entry[1];
  pref[2]   = parseFloat(entry[2]);
  pref[3]   = parseFloat(entry[3]);
  pref[4]   = parseFloat(entry[4]);
  pref[5]   = parseFloat(entry[5]);
  pref[6]   = parseFloat(entry[6]);
  pref[7]   = parseFloat(entry[7]);
  pref[8]   = String(entry[8]).toUpperCase();
  updateAll();
}

/**
 * Sort, group-header-insert, render, and save the library.
 * Mirrors original processLibrary().
 */
function processLibrary() {
  let lib = arrayClean(prefLibrary);

  // Sort (only when more than one entry exists)
  if (lib.length > 1) {
    switch (parseInt(prefSort)) {
      case 1: lib.sort(sortHue);        break;
      case 2: lib.sort(sortSaturation); break;
      case 3: lib.sort(sortValue);      break;
      case 4: lib.sort(sortDate);       break;
      default: lib.sort(sortName);
    }
  }

  // Insert group header rows (entries with only one element)
  lib = arrayGroup(lib);

  prefLibrary = lib;
  renderLibrary();
  savePrefs();
}

/**
 * Build DOM for the library list.
 * Replaces the AppleList/dataSource pattern from the original.
 */
function renderLibrary() {
  const list = el("library-list");
  list.innerHTML = "";

  const lib = prefLibrary;

  if (lib.length === 0 || (lib.length === 1 && !lib[0][1])) {
    const empty = document.createElement("li");
    empty.id = "library-empty";
    empty.textContent = "Library is empty — save a colour to get started";
    list.appendChild(empty);
    return;
  }

  const decimal = (prefAccuracy * 2) + 2;

  for (let i = 0; i < lib.length; i++) {
    const row = lib[i];

    // Group header (single-element array, no timestamp)
    if (!row[9]) {
      const li = document.createElement("li");
      li.className = "lib-group-header";
      li.textContent = row[0] || "";
      list.appendChild(li);
      continue;
    }

    // Colour entry
    const li = document.createElement("li");
    li.className = "lib-row";

    // ── Build value strings ───────────────────────────────────────────────
    const hsvStr  = parseH(row[2])  + " " + parseSV(row[3])  + " " + parseSV(row[4]);
    const rgbStr  = parseRGB(row[5]) + " " + parseRGB(row[6]) + " " + parseRGB(row[7]);
    const hexStr  = row[8];

    // Clipboard text (decimal format for HSV/RGB mode 3 / mode 2)
    const clipHSV = (prefFormatHSV === 3)
      ? (row[2]/360).toFixed(decimal) + ", " + parseFloat(row[3]).toFixed(decimal) + ", " + parseFloat(row[4]).toFixed(decimal)
      : hsvStr.replace(" ", ", ");
    const clipRGB = (prefFormatRGB === 2)
      ? parseFloat(row[5]).toFixed(decimal) + ", " + parseFloat(row[6]).toFixed(decimal) + ", " + parseFloat(row[7]).toFixed(decimal)
      : rgbStr.replace(" ", ", ");
    const clipHEX = hexStr;

    // ── Swatch + use button ───────────────────────────────────────────────
    const swatchWrap = document.createElement("div");
    swatchWrap.className = "lib-swatch-wrap";

    const swatchBox = document.createElement("div");
    swatchBox.className = "lib-swatch-box";
    swatchBox.style.backgroundColor = "#" + hexStr;

    const swatch = document.createElement("div");
    swatch.className = "lib-swatch";
    swatch.style.backgroundColor = "#" + hexStr;

    const useBtn = document.createElement("div");
    useBtn.className = "lib-use-btn";
    useBtn.textContent = "use";
    useBtn.addEventListener("mousedown", () => fromLibrary(row));

    swatch.appendChild(useBtn);
    swatchWrap.appendChild(swatchBox);
    swatchWrap.appendChild(swatch);

    // ── Labels ────────────────────────────────────────────────────────────
    const labels = document.createElement("div");
    labels.className = "lib-labels";

    if (prefShow === 0) {
      // HSV + RGB + HEX
      const lHSV = makeLabel("lib-label lib-hsv", hsvStr, clipHSV);
      const lRGB = makeLabel("lib-label lib-rgb", rgbStr, clipRGB);
      const lHEX = makeLabel("lib-label lib-hex", "#" + hexStr, clipHEX);
      labels.append(lHSV, lRGB, lHEX);
    } else {
      // Name + (HSV or RGB) + HEX
      const lName = document.createElement("div");
      lName.className = "lib-label lib-name";
      lName.textContent = row[1] || "";

      let lValue;
      if (prefShow === 1) {
        lValue = makeLabel("lib-label lib-rgb", hsvStr, clipHSV);
      } else {
        lValue = makeLabel("lib-label lib-rgb", rgbStr, clipRGB);
      }
      const lHEX = makeLabel("lib-label lib-hex", "#" + hexStr, clipHEX);
      labels.append(lName, lValue, lHEX);
    }

    // ── Delete button ─────────────────────────────────────────────────────
    const delBtn = document.createElement("div");
    delBtn.className = "lib-del-btn";
    delBtn.textContent = "×";
    delBtn.title = "Delete";
    const ts = row[9];
    delBtn.addEventListener("click", () => deleteLibraryEntry(ts));

    li.appendChild(swatchWrap);
    li.appendChild(labels);
    li.appendChild(delBtn);
    list.appendChild(li);
  }
}

function makeLabel(cls, display, clip) {
  const d = document.createElement("div");
  d.className = cls;
  d.textContent = display;
  d.title = "Copy: " + clip;
  d.addEventListener("click", e => copyText(e, clip));
  return d;
}


// ─────────────────────────────────────────────────────────────────────────────
// Array utilities (mirrors original)
// ─────────────────────────────────────────────────────────────────────────────

function arrayMatch(arr, ind, str) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][ind] === str) return i;
  }
  return false;
}

function arrayGroup(arr) {
  const out  = [];
  let   hold = "";
  for (const row of arr) {
    if (row[0] !== hold) {
      hold = row[0];
      out.push([row[0]]);   // group header row
    }
    out.push(row);
  }
  return out;
}


// ─────────────────────────────────────────────────────────────────────────────
// Sort comparators (mirrors original exactly, including sortDate undefined-x bug fix)
// ─────────────────────────────────────────────────────────────────────────────

function sortName(a, b) {
  let x = a[0].toLowerCase(), y = b[0].toLowerCase();
  if (x === y && !a[1]) return -1;
  if (x === y && !b[1]) return  1;
  if (x === y) { x = a[1].toLowerCase(); y = b[1].toLowerCase(); }
  return x < y ? -1 : x > y ? 1 : 0;
}

function sortHue(a, b) {
  const x = a[0].toLowerCase(), y = b[0].toLowerCase();
  if (x === y && !a[1]) return -1;
  if (x === y && !b[1]) return  1;
  return x < y ? 1 : x > y ? -1 : a[2] - b[2];
}

function sortSaturation(a, b) {
  const x = a[0].toLowerCase(), y = b[0].toLowerCase();
  if (x === y && !a[1]) return -1;
  if (x === y && !b[1]) return  1;
  return x < y ? 1 : x > y ? -1 : a[3] - b[3];
}

function sortValue(a, b) {
  const x = a[0].toLowerCase(), y = b[0].toLowerCase();
  if (x === y && !a[1]) return -1;
  if (x === y && !b[1]) return  1;
  return x < y ? 1 : x > y ? -1 : a[4] - b[4];
}

function sortDate(a, b) {
  // Original had a reference to undefined `x`/`y` — fixed here
  if (!a[1]) return -1;
  if (!b[1]) return  1;
  return a[9] - b[9];
}


// ─────────────────────────────────────────────────────────────────────────────
// Clipboard  (mirrors original copy/copyHSV/copyRGB/copyHEX)
// ─────────────────────────────────────────────────────────────────────────────

async function clipWrite(text) {
  if (window.pywebview) {
    return await window.pywebview.api.clipboard_write(text);
  }
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

async function clipRead() {
  if (window.pywebview) {
    return await window.pywebview.api.clipboard_read();
  }
  try { return await navigator.clipboard.readText(); } catch { return null; }
}

async function copyText(event, text) {
  flashTag(event && event.target);
  await clipWrite(text);
}

function copyHSV(event) {
  const decimal = (prefAccuracy * 2) + 2;
  const temp    = parseH(pref[2]) + ", " + parseSV(pref[3]) + ", " + parseSV(pref[4]);
  const clip    = (prefFormatHSV === 3)
    ? (pref[2]/360).toFixed(decimal) + ", " + pref[3].toFixed(decimal) + ", " + pref[4].toFixed(decimal)
    : temp;
  flashTag(el("tag-hsv"));
  clipWrite(clip);
}

function copyRGB(event) {
  const decimal = (prefAccuracy * 2) + 2;
  const temp    = parseRGB(pref[5]) + ", " + parseRGB(pref[6]) + ", " + parseRGB(pref[7]);
  const clip    = (prefFormatRGB === 2)
    ? pref[5].toFixed(decimal) + ", " + pref[6].toFixed(decimal) + ", " + pref[7].toFixed(decimal)
    : temp;
  flashTag(el("tag-rgb"));
  clipWrite(clip);
}

function copyHEX(event) {
  flashTag(el("tag-hex"));
  clipWrite(pref[8]);
}

function flashTag(tagEl) {
  if (!tagEl) return;
  tagEl.classList.remove("flash");
  // Force reflow to restart animation
  void tagEl.offsetWidth;
  tagEl.classList.add("flash");
}


// ─────────────────────────────────────────────────────────────────────────────
// Library import / export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Export the library as CSV to the system clipboard.
 * Mirrors original exportLibrary() — writes one "group,name,H,S,V,R,G,B,HEX,ts" per line.
 */
async function exportLibrary() {
  const clean = arrayClean(prefLibrary);
  const csv   = clean.map(row => row.join(",")).join("\n");
  await clipWrite(csv);
  showLibraryExportOk();
}

/**
 * Read CSV from clipboard and validate.
 * Mirrors original importLibrary() — expects ≥10 fields, checks [9] (timestamp).
 */
async function importLibrary() {
  const raw = await clipRead();
  if (!raw || raw.length < 24) return showLibraryImportFail();

  let rows = raw.trim().split("\n").map(line => line.split(","));
  rows = arrayClean(rows);

  if (!rows.length || !rows[0][9]) return showLibraryImportFail();

  // Version check — old versions stored S/V/R/G/B as 0–100 / 0–255
  if (libraryVersion(rows)) rows = libraryConvert(rows);

  clipboardImport = rows;
  el("lib-import-count").textContent =
    `Found ${rows.length} colour${rows.length !== 1 ? "s" : ""}. Replace or add?`;
  showLibraryImportConfirm();
}

function importLibraryReplace() {
  prefLibrary = clipboardImport;
  clipboardImport = null;
  processLibrary();
  showLibraryImportSuccess();
}

function importLibraryAdd() {
  prefLibrary = prefLibrary.concat(clipboardImport);
  clipboardImport = null;
  processLibrary();
  showLibraryImportSuccess();
}

function importLibraryCancel() {
  clipboardImport = null;
  showLibraryMenu();
}

/**
 * Detect old-format library where S/V were 0–100 and R/G/B were 0–255.
 * Mirrors original libraryVersion().
 */
function libraryVersion(arr) {
  for (const row of arr) {
    if (row[3] > 1.0) return true;
    if (row[4] > 1.0) return true;
    if (row[5] > 1.0) return true;
    if (row[6] > 1.0) return true;
    if (row[7] > 1.0) return true;
  }
  return false;
}

/**
 * Convert old-format values to 0–1 floats.
 * Mirrors original libraryConvert().
 */
function libraryConvert(arr) {
  return arr.map(row => {
    const r = [...row];
    r[3] = r[3] / 100;
    r[4] = r[4] / 100;
    r[5] = r[5] / 255;
    r[6] = r[6] / 255;
    r[7] = r[7] / 255;
    return r;
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// Colour conversion  (exact ports of original algorithms)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RGB → HSV.  r/g/b are 0–1 floats.  Result stored in pref[2–4].
 */
function RGBtoHSV(r, g, b) {
  r = (r !== undefined) ? r : pref[5];
  g = (g !== undefined) ? g : pref[6];
  b = (b !== undefined) ? b : pref[7];

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d   = max - min;
  let   h, s;
  const v = max;

  s = max === 0 ? 0 : d / max;

  if (max === min) {
    h = 0;
  } else {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  h = (s === 0.0) ? 0 : h * 360;
  pref[2] = parseFloat(h);
  pref[3] = parseFloat(s);
  pref[4] = parseFloat(v);
  return [h, s, v];
}

/**
 * HSV → RGB.  h=0–360, s/v=0–1.  Result stored in pref[5–7].
 */
function HSVtoRGB(h, s, v) {
  h = (h !== undefined) ? h : pref[2] / 360;
  s = (s !== undefined) ? s : pref[3];
  v = (v !== undefined) ? v : pref[4];

  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }

  pref[5] = parseFloat(r);
  pref[6] = parseFloat(g);
  pref[7] = parseFloat(b);
  return [r, g, b];
}

/** RGB floats → 6-char uppercase HEX string.  Stored in pref[8]. */
function RGBtoHEX(rgb) {
  rgb = rgb || [pref[5], pref[6], pref[7]];
  const h = rgb.map(c => {
    let s = Math.round(c * 255).toString(16);
    return s.length < 2 ? "0" + s : s;
  });
  pref[8] = (h[0] + h[1] + h[2]).toUpperCase();
  return pref[8];
}

/** 6-char HEX string → RGB floats.  Stored in pref[5–7]. */
function HEXtoRGB(hex) {
  hex = (hex || pref[8]).replace("#", "");
  pref[5] = parseInt(hex.substring(0, 2), 16) / 255;
  pref[6] = parseInt(hex.substring(2, 4), 16) / 255;
  pref[7] = parseInt(hex.substring(4, 6), 16) / 255;
  return [pref[5], pref[6], pref[7]];
}


// ─────────────────────────────────────────────────────────────────────────────
// Display parsers (mirrors original parseH / parseSV / parseRGB etc.)
// ─────────────────────────────────────────────────────────────────────────────

function parseH(value) {
  value = parseFloat(value);
  switch (parseInt(prefFormatHSV)) {
    case 0: return Math.round(value);
    case 1: return Math.round((value / 360) * 255);
    case 2: return Math.round((value / 360) * 100);
    case 3: return (value / 360).toFixed(2);
  }
}

function fromH(value) {
  value = parseFloat(value);
  switch (parseInt(prefFormatHSV)) {
    case 0: return parseInt(value);
    case 1: return (value / 255) * 360;
    case 2: return (value / 100) * 360;
    case 3: return value * 360;
  }
}

function parseSV(value) {
  value = parseFloat(value);
  switch (parseInt(prefFormatHSV)) {
    case 0: return Math.round(value * 100);
    case 1: return Math.round(value * 255);
    case 2: return Math.round(value * 100);
    case 3: return value.toFixed(2);
  }
}

function fromSV(value) {
  value = parseFloat(value);
  switch (parseInt(prefFormatHSV)) {
    case 0: return value / 100;
    case 1: return value / 255;
    case 2: return value / 100;
    case 3: return value;
  }
}

function parseRGB(value) {
  value = parseFloat(value);
  switch (parseInt(prefFormatRGB)) {
    case 0: return Math.round(value * 255);
    case 1: return Math.round(value * 100);
    case 2: return value.toFixed(2);
  }
}

function fromRGB(value) {
  value = parseFloat(value);
  switch (parseInt(prefFormatRGB)) {
    case 0: return value / 255;
    case 1: return value / 100;
    case 2: return value;
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// Panel navigation
// ─────────────────────────────────────────────────────────────────────────────

function showFront() {
  savePrefs();
  el("back").classList.add("hidden");
  el("front").classList.remove("hidden");
  setTimeout(() => {
    const wrap = el("library-wrap");
    if (wrap) wrap.scrollTop = parseInt(prefScroll) || 0;
  }, 0);
}

function showBack() {
  updateScroll();
  el("front").classList.add("hidden");
  el("back").classList.remove("hidden");
}

function showValues() {
  el("panel-values").classList.remove("hidden");
  el("panel-names").classList.add("hidden");
  el("panel-alert").classList.add("hidden");
}

function showNames() {
  el("panel-values").classList.add("hidden");
  el("panel-alert").classList.add("hidden");
  el("panel-names").classList.remove("hidden");
}

function showAlert() {
  el("panel-values").classList.add("hidden");
  el("panel-names").classList.add("hidden");
  el("panel-alert").classList.remove("hidden");
}

// Library sub-panels (back face)
function showLibraryMenu() {
  el("panel-lib-menu").classList.remove("hidden");
  el("panel-lib-export-ok").classList.add("hidden");
  el("panel-lib-import-confirm").classList.add("hidden");
  el("panel-lib-import-fail").classList.add("hidden");
  el("panel-lib-import-success").classList.add("hidden");
}

function showLibraryExportOk() {
  el("panel-lib-menu").classList.add("hidden");
  el("panel-lib-export-ok").classList.remove("hidden");
}

function showLibraryImportConfirm() {
  el("panel-lib-menu").classList.add("hidden");
  el("panel-lib-import-confirm").classList.remove("hidden");
}

function showLibraryImportFail() {
  el("panel-lib-menu").classList.add("hidden");
  el("panel-lib-import-fail").classList.remove("hidden");
}

function showLibraryImportSuccess() {
  el("panel-lib-menu").classList.add("hidden");
  el("panel-lib-import-success").classList.remove("hidden");
}


// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }

function selectAll(event) {
  const t = event.target || event;
  if (t && t.select) t.select();
}

function openWebsite() {
  if (window.pywebview) {
    window.pywebview.api.open_url("https://iaian7.com/dashboard/chroma");
  } else {
    window.open("https://iaian7.com/dashboard/chroma", "_blank");
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
