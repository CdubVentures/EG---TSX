/***************************************************************
  webp-all-options.jsx
  Photoshop script — export comprehensive WebP sets with presets,
  width/height sizing, orientation-aware padding (with editable %),
  a numbering helper for base names, and a clean UI.

  ─────────────────────────────────────────────────────────────────
  IMAGE SIZE BY SUFFIX (CONTAINER PIXELS)
  • “Container” = the dimension you are targeting:
      - Width set (W): container = WIDTH in pixels.
      - Height set (H): container = HEIGHT in pixels.
      - Auto (A): picks W or H by source aspect ratio, then uses the
        corresponding container value from the active set.
    Padding (if any) is applied AFTER resizing and expands the canvas.

  Width set (W)  → container = target WIDTH (px)
    _xxs   = 100 px
    _xs    = 200 px
    _s     = 400 px
    _m     = 600 px
    _l     = 800 px
    _xl    = 1000 px
    _xxl   = 2000 px
    _zoom  = 3200 px
    _blur  = 200 px   (low-quality blurred tiny preview)

  Height set (H) → container = target HEIGHT (px)
    _xxs   = 100 px
    _xs    = 200 px
    _s     = 360 px
    _m     = 450 px
    _l     = 600 px
    _xl    = 1000 px
    _xxl   = 1200 px
    _zoom  = 2000 px  (lossless in H-set defaults)
    _blur  = 100 px   (lowest quality blurred tiny preview)

  Always added (independent of set; ALWAYS NO PADDING):
    _t      = container 300, quality 85, lossy, canvasPct 0 (no padding ever)
    _t_blur = container 40,  quality 1,  lossy, canvasPct 0 (no padding ever)

  WHAT THIS DOES
  • Exports a family of WebP images from the active document.
  • Works with any source format Photoshop can open (converts to 8-bit sRGB).
  • Size by Width (W) or Height (H), or Auto (A = picks W/H by aspect).
  • Two version-sets (W and H):
      - Fixed KB OFF (default): both sets target size by KB (binary-searches WebP quality).
      - Fixed KB ON: both sets use fixed per-suffix Quality (faster; file sizes vary).
      - Note: Lossless variants have no adjustable quality; in Target-KB mode we try lossless once,
        and if it exceeds the size cap we automatically fall back to Lossy at the best quality under the cap.
  • Padding percent is editable per-direction:
      - Top/Bottom % and Left/Right %
      - "Add to Output" Checkboxes: FORCE this padding to be added to the pixels.
  • Direction can be:
      - AUTO (Orientation/Fill based)
      - Top & Bottom
      - Left & Right
      - Minimum Padding (16:9 Safe Area)
  • "Target 16:9 Container Efficiency":
      - Unlocks if exactly one "Add to Output" is checked.
      - Calculates padding to hit a specific fill % in a 16:9 box.
      - DETECTS LIMITS: If the forced dimension prevents hitting the target (e.g. 40%),
        it caps at the maximum possible efficiency (0 padding) rather than adding nonsense padding.
  • A 16:9 preview panel shows detailed calculations including Aspect Ratio fractions.
  • Numbering control (#) with quick-pick 1–10 and an editable box.
  • CATEGORY COLORS + DESCRIPTION dropdowns are preserved (JSON-driven).
****************************************************************/


(function () {
    var PRESET_BASENAMES = [
        "default",
        "hero-img",
        "hero-alt-img",
        "box-art-cover",
        "feature-image",
        "img",
        "top",
        "bottom",
        "left",
        "right",
        "sangle",
        "angle",
        "front",
        "rear"
    ];

    // Dropdown labels (display text). Must stay index-aligned with PRESET_BASENAMES.
    var PRESET_DROPDOWN_LABELS = PRESET_BASENAMES.slice(0);
    (function () {
        function _idx(arr, v) {
            for (var i = 0; i < arr.length; i++) {
                if (String(arr[i]) === String(v)) return i;
            }
            return -1;
        }

        var iS = _idx(PRESET_BASENAMES, "sangle");
        if (iS >= 0) PRESET_DROPDOWN_LABELS[iS] = "sangle (front/side 3/4)";

        var iA = _idx(PRESET_BASENAMES, "angle");
        if (iA >= 0) PRESET_DROPDOWN_LABELS[iA] = "angle (rear/top 3/4)";
    })();


    var PRESET_AUTO_LOWERFILL_UNLOCK = [
        "top",
        "bottom",
        "left",
        "right",
        "sangle",
        "angle",
        "front",
        "rear"
    ];

    // Presets now support forcePadTB, forcePadLR, targetEff (optional)
    var PRESET_INFO = {
        "default": { mode: "W", paddingPctTB: 0, paddingPctLR: 0, paddingDir: "AUTO", autoLowerFill: false, baseName: "", note: "Width-based; padding 0% with AUTO direction (by orientation). Base name must be entered to enable OK. Always adds _t and _t_blur (no padding) every run." },
        "hero-img": { mode: "W", paddingPctTB: 0, paddingPctLR: 0, paddingDir: "AUTO", autoLowerFill: false, baseName: "hero-img", note: "Width-based; padding 0% with AUTO direction. Always adds _t and _t_blur (no padding) every run." },
        "hero-alt-img": { mode: "W", paddingPctTB: 0, paddingPctLR: 0, paddingDir: "AUTO", autoLowerFill: false, baseName: "hero-alt-img", note: "Width-based; padding 0% with AUTO direction. Always adds _t and _t_blur (no padding) every run." },
        "box-art-cover": { mode: "W", paddingPctTB: 0, paddingPctLR: 0, paddingDir: "AUTO", autoLowerFill: false, baseName: "box-art-cover", note: "Width-based; padding 0% with AUTO direction. Always adds _t and _t_blur (no padding) every run." },
        "feature-image": { mode: "W", paddingPctTB: 0, paddingPctLR: 0, paddingDir: "AUTO", autoLowerFill: false, baseName: "feature-image", note: "Width-based set targeting KB; padding 0% with AUTO direction. Always adds _t and _t_blur (no padding) every run." },
        "img": { mode: "W", paddingPctTB: 0, paddingPctLR: 0, paddingDir: "AUTO", autoLowerFill: false, baseName: "img", note: "Width-based; padding 0% with AUTO direction. Always adds _t and _t_blur (no padding) every run." },

        // TOP / BOTTOM: Height Dominant (Correct)
        "top": { mode: "H", paddingPctTB: 20, paddingPctLR: 0, paddingDir: "TB", forcePadTB: true, autoLowerFill: true, baseName: "top", note: "Height-based; padding TB 20%. Force TB ensures vertical scale consistency." },
        "bottom": { mode: "H", paddingPctTB: 20, paddingPctLR: 0, paddingDir: "TB", forcePadTB: true, autoLowerFill: true, baseName: "bot", note: "Height-based; padding TB 20%. Force TB ensures vertical scale consistency." },

        // LEFT / RIGHT: Width Dominant (Updated)
        "left": { mode: "W", paddingPctTB: 0, paddingPctLR: 20, paddingDir: "LR", forcePadLR: true, autoLowerFill: false, baseName: "left", note: "Width-based; padding LR 20%. Force LR ensures horizontal scale consistency." },

        "right": { mode: "W", paddingPctTB: 20, paddingPctLR: 20, paddingDir: "LR", forcePadLR: true, targetEff: 40, autoLowerFill: false, baseName: "right", note: "Width-based; padding LR 20%. Force LR ensures horizontal scale consistency." },
        // FRONT / REAR: Minimum Padding (Updated for Target Efficiency)
        "front": { mode: "W", paddingPctTB: 20, paddingPctLR: 20, paddingDir: "MIN", forcePadLR: true, targetEff: 40, autoLowerFill: false, baseName: "front", note: "Minimum Padding Mode. LR 20% Forced. TB calculated to hit 40% Efficiency." },
        "rear": { mode: "W", paddingPctTB: 20, paddingPctLR: 20, paddingDir: "MIN", forcePadLR: true, targetEff: 40, autoLowerFill: false, baseName: "rear", note: "Minimum Padding Mode. LR 20% Forced. TB calculated to hit 40% Efficiency." },

        // SANGLE / ANGLE: Hero Shots (Correct with Target Efficiency)
        "sangle": { mode: "W", paddingPctTB: 20, paddingPctLR: 20, paddingDir: "MIN", forcePadLR: true, targetEff: 40, autoLowerFill: false, baseName: "sangle", note: "SANGLE: Width-based; Minimum Padding Mode. LR 20% Forced. TB calculated to hit 40% Efficiency." },
        "angle": { mode: "W", paddingPctTB: 20, paddingPctLR: 20, paddingDir: "MIN", forcePadLR: true, targetEff: 40, autoLowerFill: false, baseName: "angle", note: "ANGLE: Width-based; Minimum Padding Mode. LR 20% Forced. TB calculated to hit 40% Efficiency." }
    };


var versionsW = [
        // NOTE: When “Fixed KB” is enabled, W/H set exports use the `quality` values below (fast, no target-KB searching).
        // When “Fixed KB” is OFF (default), W/H set exports use `targetKB` and binary-search WebP quality to hit the size cap (±10% tolerance).
        // For LOSSLESS variants in Target-KB mode: we try lossless once, and if the result exceeds the cap,
        // we automatically fall back to LOSSY at the best quality under the cap.
        { suffix: "_xxs", container: 100, compType: "compressionLossy", targetKB: 5, quality: 75 },
        { suffix: "_xs", container: 200, compType: "compressionLossy", targetKB: 15, quality: 80 },
        { suffix: "_s", container: 400, compType: "compressionLossy", targetKB: 30, quality: 85 },
        { suffix: "_m", container: 600, compType: "compressionLossy", targetKB: 50, quality: 85 },
        { suffix: "_l", container: 800, compType: "compressionLossy", targetKB: 75, quality: 90 },
        { suffix: "_xl", container: 1000, compType: "compressionLossy", targetKB: 110, quality: 90 },
        { suffix: "_xxl", container: 2000, compType: "compressionLossy", targetKB: 300, quality: 90 },
        { suffix: "_zoom", container: 3200, compType: "compressionLossy", targetKB: 600, quality: 95 },
        { suffix: "_blur", container: 200, compType: "compressionLossy", targetKB: 1, quality: 1 }
    ];

    var versionsH = [
        { suffix: "_xxs", container: 100, compType: "compressionLossy", targetKB: 5, quality: 65 },
        { suffix: "_xs", container: 200, compType: "compressionLossy", targetKB: 15, quality: 75 },
        { suffix: "_s", container: 360, compType: "compressionLossy", targetKB: 30, quality: 85 },
        { suffix: "_m", container: 450, compType: "compressionLossy", targetKB: 45, quality: 85 },
        { suffix: "_l", container: 600, compType: "compressionLossy", targetKB: 75, quality: 85 },
        { suffix: "_xl", container: 1000, compType: "compressionLossy", targetKB: 110, quality: 85 },
        { suffix: "_xxl", container: 1200, compType: "compressionLossy", targetKB: 250, quality: 95 },
        { suffix: "_zoom", container: 2000, compType: "compressionLossy", targetKB: 450, quality: 95 },
        { suffix: "_blur", container: 100, compType: "compressionLossy", targetKB: 1, quality: 1 }
    ];
    
    var ALWAYS_T = { suffix: "_t", container: 300, quality: 85, canvasPct: 0, compType: "compressionLossy" };
    var ALWAYS_T_BLUR = { suffix: "_t_blur", container: 40, quality: 1, canvasPct: 0, compType: "compressionLossy" };

    var WEB_CONTAINER_ASPECT = 16 / 9;

    // When Fixed KB is OFF: we aim for targetKB (best quality under a size cap).
    // Allow up to +10% above the target to preserve quality (prevents needless extra artifacts).
    var TARGET_KB_TOLERANCE_PCT = 10;

    /*────────────────────────────────────────────────────────────
      Category Colors loader + category detection + filename helper
    ────────────────────────────────────────────────────────────*/

    // ────────────────────────────────────────────────────────────
    // JSON path resolver (works across multiple PCs / OneDrive Desktop redirection)
    // ────────────────────────────────────────────────────────────

    function _normSlashes(p) { return String(p || "").replace(/\\/g, "/"); }

    function resolveEgDataJson(fileName) {
        var cand = [];
        var p = "";
        var f = null;

        // 1) Same folder as this .jsx
        try {
            var sf = new File($.fileName);
            if (sf && sf.parent) {
                cand.push(_normSlashes(sf.parent.fsName) + "/" + fileName);
                cand.push(_normSlashes(sf.parent.fsName) + "/data/" + fileName);
            }
        } catch (e0) { }

        // 2) Desktop\EG\data (Folder.desktop follows OneDrive Desktop redirection on Windows)
        try {
            if (Folder.desktop) cand.push(_normSlashes(Folder.desktop.fsName) + "/EG/data/" + fileName);
        } catch (e1) { }

        // 3) OneDrive env vars (extra safety)
        try {
            var od = $.getenv("OneDrive");
            if (od) cand.push(_normSlashes(od) + "/Desktop/EG/data/" + fileName);
        } catch (e2) { }
        try {
            var odc = $.getenv("OneDriveConsumer");
            if (odc) cand.push(_normSlashes(odc) + "/Desktop/EG/data/" + fileName);
        } catch (e3) { }

        // 4) Legacy hardcoded fallbacks (kept only as last resort)
        cand.push("C:/Users/Chris/OneDrive/Desktop/EG/data/" + fileName);
        cand.push("C:/Users/Chris/Desktop/EG/data/" + fileName);

        for (var i = 0; i < cand.length; i++) {
            try {
                f = new File(cand[i]);
                if (f.exists) return f.fsName;
            } catch (e4) { }
        }

        // If nothing exists yet, return the Desktop guess (most likely correct)
        try {
            if (Folder.desktop) return _normSlashes(Folder.desktop.fsName) + "/EG/data/" + fileName;
        } catch (e5) { }

        return cand.length ? cand[0] : fileName;
    }

    var CATEGORY_COLORS_JSON = resolveEgDataJson("category_colors.json");
    var CATEGORY_DESC_JSON = resolveEgDataJson("category_image_descriptive_text.json");

    var __CATEGORY_COLORS_CACHE = null;
    var __CATEGORY_DESC_CACHE = null;

    // Per-category list caches (avoid re-sorting / re-trimming on every UI interaction)
    var __CATEGORY_COLORS_LIST_CACHE = {};
    var __CATEGORY_DESC_LIST_CACHE = {};


    function _normalizeSlashes(p) { return String(p || "").replace(/\\/g, "/"); }
    function _trim(s) { return String(s || "").replace(/^\s+|\s+$/g, ""); }
    function _safeLower(s) { return _trim(s).toLowerCase(); }

    function _readTextFile(pathStr) {
        try {
            var f = new File(pathStr);
            if (!f.exists) return null;
            f.encoding = "UTF8";

            // Retry once if a non-empty file reads as empty (can happen sporadically on some setups).
            var attempts = 0;
            var txt = null;
            while (attempts < 2) {
                attempts++;
                if (!f.open("r")) { txt = null; continue; }
                txt = f.read();
                f.close();

                try {
                    if (txt !== "" || f.length === 0) break;
                } catch (eLen) {
                    break;
                }
            }

            return txt;
        } catch (e) { return null; }
    }

    function _parseJSON(txt) {
        if (txt === null || txt === undefined) return null;
        try {
            if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function") {
                return JSON.parse(String(txt));
            }
        } catch (e1) { }
        try { return eval("(" + String(txt) + ")"); } catch (e2) { }
        return null;
    }

    function loadCategoryColorsMap() {
        if (__CATEGORY_COLORS_CACHE) return __CATEGORY_COLORS_CACHE;
        var txt = _readTextFile(CATEGORY_COLORS_JSON);
        var parsed = _parseJSON(txt);
        if (!parsed || typeof parsed !== "object" || (parsed instanceof Array)) parsed = {};
        __CATEGORY_COLORS_CACHE = parsed;
        return parsed;
    }

    function loadCategoryDescriptionsMap() {
        if (__CATEGORY_DESC_CACHE) return __CATEGORY_DESC_CACHE;
        var txt = _readTextFile(CATEGORY_DESC_JSON);
        var parsed = _parseJSON(txt);
        if (!parsed || typeof parsed !== "object" || (parsed instanceof Array)) parsed = {};
        __CATEGORY_DESC_CACHE = parsed;
        return parsed;
    }

    function getActiveDocFsPath(docRef) {
        try { if (docRef && docRef.fullName && docRef.fullName.fsName) return docRef.fullName.fsName; } catch (e1) { }
        try { if (docRef && docRef.path && docRef.path.fsName) return docRef.path.fsName; } catch (e2) { }
        return "";
    }

    function detectCategoryFromDocPath(fsPath) {
        var p = _normalizeSlashes(fsPath);
        if (!p) return "";
        var parts = p.split("/");
        var idx = -1;
        for (var i = 0; i < parts.length; i++) {
            if (_safeLower(parts[i]) === "images") { idx = i; break; }
        }
        if (idx < 0) return "";
        if (idx + 1 >= parts.length) return "";
        return _safeLower(parts[idx + 1]);
    }

    // When category can't be detected (e.g. recovered/unsaved docs), fall back to a global union list
    // so Color / Description dropdowns never appear "empty" unless the JSON file can't be read.
    var __ALL_COLORS_LIST_CACHE = null;
    var __ALL_DESC_LIST_CACHE = null;

    function getAllColors() {
        if (__ALL_COLORS_LIST_CACHE) return __ALL_COLORS_LIST_CACHE;
        var map = loadCategoryColorsMap();
        var seen = {};
        var out = [];
        try {
            for (var k in map) {
                if (!map.hasOwnProperty(k)) continue;
                var arr = map[k];
                if (!(arr instanceof Array)) continue;
                for (var i = 0; i < arr.length; i++) {
                    var v = _trim(arr[i]);
                    if (!v) continue;
                    var kk = _safeLower(v);
                    if (!kk || seen[kk]) continue;
                    seen[kk] = true;
                    out.push(v);
                }
            }
        } catch (e) { }
        // Keep colors sorted for fast scanning.
        out.sort(function (a, b) {
            var la = _safeLower(a), lb = _safeLower(b);
            if (la < lb) return -1;
            if (la > lb) return 1;
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });
        __ALL_COLORS_LIST_CACHE = out;
        return out;
    }

    function getAllDescriptions() {
        if (__ALL_DESC_LIST_CACHE) return __ALL_DESC_LIST_CACHE;
        var map = loadCategoryDescriptionsMap();
        var seen = {};
        var out = [];
        try {
            for (var k in map) {
                if (!map.hasOwnProperty(k)) continue;
                var arr = map[k];
                if (!(arr instanceof Array)) continue;
                for (var i = 0; i < arr.length; i++) {
                    var v = _trim(arr[i]);
                    if (!v) continue;
                    var kk = _safeLower(v);
                    if (!kk || seen[kk]) continue;
                    seen[kk] = true;
                    out.push(v);
                }
            }
        } catch (e) { }
        // Keep insertion order (more "natural" than sorting large phrases).
        __ALL_DESC_LIST_CACHE = out;
        return out;
    }

    function getColorsForCategory(category) {
        var key = _safeLower(category);

        // Cache hit? (Category data is static during a single run of the script)
        try {
            if (__CATEGORY_COLORS_LIST_CACHE && __CATEGORY_COLORS_LIST_CACHE.hasOwnProperty(key)) {
                return __CATEGORY_COLORS_LIST_CACHE[key];
            }
        } catch (eCache) { }

        var map = loadCategoryColorsMap();

        if (!key) {
            var all0 = getAllColors();
            try { __CATEGORY_COLORS_LIST_CACHE[key] = all0; } catch (eSet0) { }
            return all0;
        }

        var arr = map[key];
        if (!(arr instanceof Array)) {
            var all1 = getAllColors();
            try { __CATEGORY_COLORS_LIST_CACHE[key] = all1; } catch (eSet1) { }
            return all1;
        }

        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var v = _trim(arr[i]);
            if (v) out.push(v);
        }

        // Keep colors sorted for fast scanning in dropdown builders.
        out.sort(function (a, b) {
            var la = _safeLower(a), lb = _safeLower(b);
            if (la < lb) return -1;
            if (la > lb) return 1;
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });

        if (!out.length) out = getAllColors();

        try { __CATEGORY_COLORS_LIST_CACHE[key] = out; } catch (eSet2) { }
        return out;
    }

    function getDescriptionsForCategory(category) {
        var key = _safeLower(category);

        // Cache hit? (Category data is static during a single run of the script)
        try {
            if (__CATEGORY_DESC_LIST_CACHE && __CATEGORY_DESC_LIST_CACHE.hasOwnProperty(key)) {
                return __CATEGORY_DESC_LIST_CACHE[key];
            }
        } catch (eCache) { }

        var map = loadCategoryDescriptionsMap();

        if (!key) {
            var all0 = getAllDescriptions();
            try { __CATEGORY_DESC_LIST_CACHE[key] = all0; } catch (eSet0) { }
            return all0;
        }

        var arr = map[key];
        if (!(arr instanceof Array)) {
            var all1 = getAllDescriptions();
            try { __CATEGORY_DESC_LIST_CACHE[key] = all1; } catch (eSet1) { }
            return all1;
        }

        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var v = _trim(arr[i]);
            if (v) out.push(v);
        }
        if (!out.length) out = getAllDescriptions();

        try { __CATEGORY_DESC_LIST_CACHE[key] = out; } catch (eSet2) { }
        return out;
    }


    function clearDropdown(dd) { try { while (dd.items.length) dd.remove(dd.items[0]); } catch (e) { } }

    function setDropdownItems(dd, items) {
        clearDropdown(dd);
        dd.add("item", "");
        if (items && items.length) {
            for (var i = 0; i < items.length; i++) {
                dd.add("item", String(items[i]));
            }
        }
        try { dd.selection = 0; } catch (e) { }
    }

    function selectDropdownByText(dd, text) {
        var t = String(text || "");
        var tl = _safeLower(t);
        var found = 0;
        try {
            for (var i = 0; i < dd.items.length; i++) {
                var it = dd.items[i];
                if (_safeLower(it.text) === tl) { found = i; break; }
            }
            dd.selection = found;
        } catch (e) { }
    }

    function normalizeColorValue(s) {
        var raw = _safeLower(s);
        if (!raw) return "";
        var out = raw.replace(/['"]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9\-_+]/g, "").replace(/-*\+-*/g, "+").replace(/-{2,}/g, "-").replace(/^-+/, "").replace(/-+$/, "");
        return out;
    }

    function _stripDiacriticsLower(s) {
        var out = String(s || "");
        out = out.replace(/[\u0300-\u036f]/g, "");
        out = out.replace(/æ/g, "ae").replace(/œ/g, "oe").replace(/ß/g, "ss");
        out = out.replace(/[àáâãäå]/g, "a").replace(/[èéêë]/g, "e").replace(/[ìíîï]/g, "i").replace(/[òóôõö]/g, "o").replace(/[ùúûü]/g, "u");
        return out;
    }

    function slugify(str) {
        if (!str) return "";
        var s = String(str);
        s = _stripDiacriticsLower(s.toLowerCase());
        s = _trim(s);
        s = s.replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
        return s;
    }

    function buildWebpFileName(name, color, suffix, description) {
        var n = _trim(name);
        var d = slugify(description);
        var c = normalizeColorValue(color);
        var suf = String(suffix || "");
        var out = n;
        if (d) out += "___" + d;
        if (c) out += "---" + c;
        out += suf + ".webp";
        return out;
    }


    if (!app.documents.length) { alert("Error: No open documents!"); return; }

    // ────────────────────────────────────────────────────────────
    // MULTI-DOCUMENT UI (Tabbed: Summary + one tab per open doc)
    // ────────────────────────────────────────────────────────────

    function stripExtension(name) {
        return String(name || "").replace(/\.[^\.]+$/, '');
    }

    function safeDocId(docRef) {
        try { return String(docRef.id); } catch (e) { }
        // Fallback: best-effort stable-ish key
        try { return String(docRef.name) + "_" + String(docRef.width.as("px")) + "x" + String(docRef.height.as("px")); } catch (ee) { }
        return String(new Date().getTime());
    }

    function isDocAlive(docRef) {
        try { var _n = docRef.name; return !!_n; } catch (e) { }
        return false;
    }

    function cloneVers(list) {
        var out = [];
        for (var i = 0; i < list.length; i++) {
            var v = list[i], cp = {};
            for (var k in v) if (v.hasOwnProperty(k)) cp[k] = v[k];
            out.push(cp);
        }
        return out;
    }

    // These helpers are used by BOTH the per-doc UI and the execution stage.
    function digitsOnly(s) { return String(s || "").replace(/[^\d]/g, ""); }
    function isPresetNoNC(pName) { return (pName === "default" || pName === "hero-img" || pName === "hero-alt-img" || pName === "box-art-cover" || pName === "feature-image"); }
    function isPresetNumOnly(pName) { return (pName === "img"); }
    function isPresetNumOrColor(pName) { return (pName === "top" || pName === "left" || pName === "front" || pName === "rear" || pName === "sangle" || pName === "bottom" || pName === "right" || pName === "angle"); }
    function isAutoLowerFillUnlockedPreset(pName) {
        for (var i = 0; i < PRESET_AUTO_LOWERFILL_UNLOCK.length; i++) {
            if (PRESET_AUTO_LOWERFILL_UNLOCK[i] === pName) return true;
        }
        return false;
    }


    function formatError(e) {
        try {
            if (!e) return "Unknown error";
            var msg = (e && e.message) ? String(e.message) : String(e);
            if (e && typeof e === "object") {
                if (e.line) msg += " (line " + e.line + ")";
                if (e.fileName) msg += " [" + e.fileName + "]";
                if (e.number !== undefined && e.number !== null) msg += " (#" + e.number + ")";
            }
            return msg;
        } catch (err) {
            return String(e);
        }
    }

    function getPhotoshopVersionInfo() {
        var raw = "";
        try { raw = String(app.version || ""); } catch (e) { raw = ""; }
        var parts = raw.split(".");
        var major = parseInt(parts[0], 10); if (isNaN(major)) major = 0;
        var minor = parseInt(parts[1], 10); if (isNaN(minor)) minor = 0;
        return { raw: raw, major: major, minor: minor };
    }

    function supportsNativeWebP() {
        // Adobe docs: "full support" for WebP is Photoshop 23.2+
        var v = getPhotoshopVersionInfo();
        return (v.major > 23) || (v.major === 23 && v.minor >= 2);
    }

    function getResampleFallback() {
        var cands = [];
        try { if (ResampleMethod.PRESERVEDETAILS2) cands.push(ResampleMethod.PRESERVEDETAILS2); } catch (e) { }
        try { if (ResampleMethod.BICUBICSHARPER) cands.push(ResampleMethod.BICUBICSHARPER); } catch (e2) { }
        return cands.length ? cands[0] : null;
    }
    function getResampleMethodName(rm) {
        var map = {};
        try { map[ResampleMethod.PRESERVEDETAILS2] = "PRESERVEDETAILS2"; } catch (e) { }
        try { map[ResampleMethod.BICUBICSHARPER] = "BICUBICSHARPER"; } catch (e2) { }
        return map[rm] || "UNKNOWN";
    }

    function makeThumbnailForDoc(docRef, maxSizePx) {
        var prev = null;
        try { prev = app.activeDocument; } catch (e0) { }
        var dup = null;
        var thumbFile = null;
        try {
            var id = safeDocId(docRef).replace(/[^\w\-]/g, "");
            var r = Math.floor(Math.random() * 1000000);
            thumbFile = new File(Folder.temp.fsName + "/webp_all_options_thumb_" + id + "_" + r + ".png");

            // Duplicate merged for speed (avoids pulling full layer stacks).
            dup = docRef.duplicate("thumb_tmp_" + id, true);
            try { app.activeDocument = dup; } catch (eA) { }

            var w = Number(dup.width.as("px"));
            var h = Number(dup.height.as("px"));
            if (isNaN(w) || w <= 0) w = 1;
            if (isNaN(h) || h <= 0) h = 1;

            var tW, tH;
            if (w >= h) { tW = maxSizePx; tH = maxSizePx * (h / w); }
            else { tH = maxSizePx; tW = maxSizePx * (w / h); }

            if (tW < 1) tW = 1;
            if (tH < 1) tH = 1;

            var sharp = null; try { sharp = ResampleMethod.BICUBICSHARPER; } catch (e3) { sharp = null; }
            try {
                if (sharp) dup.resizeImage(UnitValue(tW, "px"), UnitValue(tH, "px"), dup.resolution, sharp);
                else dup.resizeImage(UnitValue(tW, "px"), UnitValue(tH, "px"), dup.resolution);
            } catch (eRz) { }

            var pngOpt = new PNGSaveOptions();
            pngOpt.interlaced = false;

            var saved = false;
            try {
                // Fast-path: most docs are already 8-bit RGB; avoid conversion unless needed.
                dup.saveAs(thumbFile, pngOpt, true, Extension.LOWERCASE);
                saved = true;
            } catch (eSave1) { saved = false; }

            if (!saved) {
                // Fallback: convert to 8-bit sRGB for widest compatibility.
                try { ensure8bitSRGB(dup); } catch (e1) { }
                try { dup.flatten(); } catch (e2) { }
                try {
                    dup.saveAs(thumbFile, pngOpt, true, Extension.LOWERCASE);
                    saved = true;
                } catch (eSave2) { saved = false; }
            }

            if (!saved) {
                try { if (thumbFile && thumbFile.exists) thumbFile.remove(); } catch (eD) { }
                return null;
            }

            return thumbFile;
        } catch (e) {
            try { if (thumbFile && thumbFile.exists) thumbFile.remove(); } catch (eR) { }
            return null;
        } finally {
            try { if (dup) dup.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) { }
            try { if (prev) app.activeDocument = prev; } catch (eB) { }
        }
    }

    function seedSettingsForDoc(docRef) {
        var defaultBaseName = stripExtension(docRef.name);
        var seedPreset = resolvePresetName(defaultBaseName) || "feature-image";
        var seedInfo = PRESET_INFO[seedPreset] || PRESET_INFO["feature-image"];

        var seedPadTB = (typeof seedInfo.paddingPctTB !== "undefined") ? seedInfo.paddingPctTB : (seedInfo.paddingPct || 0);
        var seedPadLR = (typeof seedInfo.paddingPctLR !== "undefined") ? seedInfo.paddingPctLR : (seedInfo.paddingPct || 0);

        return {
            presetName: seedPreset,
            baseName: defaultBaseName,
            dimMode: seedInfo.mode,
            paddingPctTB: seedPadTB,
            paddingPctLR: seedPadLR,
            paddingDir: seedInfo.paddingDir,
            autoLowerFill: !!seedInfo.autoLowerFill,
            forcePadTB: !!seedInfo.forcePadTB,
            forcePadLR: !!seedInfo.forcePadLR,
            targetEff: (typeof seedInfo.targetEff !== "undefined") ? seedInfo.targetEff : 0
        };
    }

    function getSelectedPresetKeyFromDropdown(dd) {
        try {
            if (dd && dd.selection) {
                var idx = dd.selection.index;
                if (idx >= 0 && idx < PRESET_BASENAMES.length) return String(PRESET_BASENAMES[idx]);
            }
        } catch (e) { }
        return "feature-image";
    }

    function collectDocConfig(docState) {
        var ui = docState.ui || {};
        var docRef = docState.doc;

        var presetName = getSelectedPresetKeyFromDropdown(ui.presetDropdown);
        var baseNameRoot = "";
        try { baseNameRoot = ui.nameInput.text.replace(/^\s+|\s+$/g, ''); } catch (e1) { baseNameRoot = ""; }
        if (!baseNameRoot) return null;

        var dimMode = "W";
        try { dimMode = String(ui.dimDropdown.selection.text); } catch (e2) { dimMode = "W"; }

        var padPctTB = 0;
        var padPctLR = 0;
        try { padPctTB = parseFloat(ui.padPctTBInput.text); if (isNaN(padPctTB)) padPctTB = 0; } catch (e3) { padPctTB = 0; }
        try { padPctLR = parseFloat(ui.padPctLRInput.text); if (isNaN(padPctLR)) padPctLR = 0; } catch (e4) { padPctLR = 0; }

        var useForceTB = !!ui.chkForceTB.value;
        var useForceLR = !!ui.chkForceLR.value;

        var useTargetEff = false;
        try { useTargetEff = !!(ui.chkTargetEff.value && ui.chkTargetEff.enabled); } catch (e5) { useTargetEff = false; }
        var targetEffVal = 0;
        if (useTargetEff) {
            try { if (ui.ddTargetEff.selection) targetEffVal = parseFloat(ui.ddTargetEff.selection.text); } catch (e6) { targetEffVal = 0; }
        }

        var padDirSel = "";
        try { padDirSel = String(ui.padDirDropdown.selection.text); } catch (e7) { padDirSel = "Auto"; }
        var padDir = "AUTO";
        if (padDirSel.indexOf("Top") === 0) padDir = "TB";
        else if (padDirSel.indexOf("Left") === 0) padDir = "LR";
        else if (padDirSel.indexOf("Minimum") === 0) padDir = "MIN";

        var autoLowerFill = false;
        try { autoLowerFill = !!(ui.autoLowerFillCheckbox.enabled && ui.autoLowerFillCheckbox.value); } catch (e8) { autoLowerFill = false; }

        var numberSuffix = "";
        try { numberSuffix = digitsOnly(ui.numberInput.text); } catch (e9) { numberSuffix = ""; }

        var colorSuffix = "";
        try { colorSuffix = normalizeColorValue(ui.colorInput.text); } catch (e10) { colorSuffix = ""; }

        var descriptionRaw = "";
        try { descriptionRaw = (ui.descQuick.selection ? String(ui.descQuick.selection.text) : ""); } catch (e11) { descriptionRaw = ""; }

        var baseNameFinal = baseNameRoot;
        if (!isPresetNoNC(presetName)) {
            if (isPresetNumOnly(presetName) || isPresetNumOrColor(presetName)) {
                if (numberSuffix) baseNameFinal = baseNameRoot + numberSuffix;
            }
        }

        // Determine which VERSION SET to use (W/H) for this doc.
        // NOTE: This does NOT change how we resize (that's dimMode), it only chooses the version list.
        var containerSetType = dimMode;
        if (dimMode === "A") {
            var wpx = 0, hpx = 0;
            try { wpx = Number(docRef.width.as("px")); hpx = Number(docRef.height.as("px")); } catch (e12) { wpx = 0; hpx = 0; }
            containerSetType = (wpx >= hpx) ? "W" : "H";
        }

        return {
            presetName: presetName,
            baseNameRoot: baseNameRoot,
            baseNameFinal: baseNameFinal,
            dimMode: dimMode,
            containerSetType: containerSetType,

            padPctTB: padPctTB,
            padPctLR: padPctLR,
            padDir: padDir,
            autoLowerFill: autoLowerFill,
            useForceTB: useForceTB,
            useForceLR: useForceLR,
            targetEffVal: targetEffVal,

            numberSuffix: numberSuffix,
            colorSuffix: colorSuffix,
            descriptionRaw: descriptionRaw
        };
    }
    function promptVersionsDialog(containerSetType, defaultsList, opts) {
        var vers = cloneVers(defaultsList);
        opts = opts || {};

        var isW = (containerSetType === "W");

        // Fixed KB ON  => Fixed Quality per suffix (fast; sizes vary).
        // Fixed KB OFF => Target KB per suffix (binary-search quality) for BOTH W and H sets.
        var useFixedQuality = !!opts.useFixedQuality;
        var useTargetKB = !useFixedQuality;

        var dlgTitle = "Versions (" + (isW ? "W" : "H") + (useTargetKB ? " — Target KB" : " — Fixed Quality") + ")";
        var dlg2 = new Window("dialog", dlgTitle);
        dlg2.orientation = "column";
        dlg2.alignChildren = ["fill", "top"];

        var helpLine = useTargetKB
            ? "Target KB will be achieved by adjusting WebP quality (best quality under the KB cap)."
            : "Fixed Quality mode: skips target-KB searching (faster). File sizes will vary.";
        dlg2.add("statictext", undefined, helpLine);

        for (var i = 0; i < vers.length; i++) {
            var v = vers[i];
            var g = dlg2.add("group");
            g.orientation = "row";
            g.add("statictext", undefined, v.suffix + ":");

            if (useTargetKB) {
                g.add("statictext", undefined, "Target (KB):");
                var defTarget = (v.targetKB !== undefined && v.targetKB !== null) ? v.targetKB : ((v.suffix && v.suffix.indexOf("_blur") !== -1) ? 1 : 20);
                v._targetInput = g.add("edittext", undefined, String(defTarget));
                v._targetInput.characters = 6;
            } else {
                g.add("statictext", undefined, "Quality:");
                var defQ = (v.quality !== undefined && v.quality !== null) ? v.quality : 85;
                v._qualityInput = g.add("edittext", undefined, String(defQ));
                v._qualityInput.characters = 4;
            }

            g.add("statictext", undefined, "Container:");
            v._containerInput = g.add("edittext", undefined, String(v.container || 400));
            v._containerInput.characters = 6;
        }

        var b2 = dlg2.add("group"); b2.alignment = "center";
        b2.add("button", undefined, "OK", { name: "ok" });
        b2.add("button", undefined, "Cancel", { name: "cancel" });

        if (dlg2.show() != 1) return null;

        for (var j = 0; j < vers.length; j++) {
            var vv = vers[j];
            var cval = parseInt(vv._containerInput.text, 10); if (!isNaN(cval)) vv.container = cval;

            if (useTargetKB) {
                var tval = parseInt(vv._targetInput.text, 10); if (!isNaN(tval)) vv.targetKB = tval;
            } else {
                var qval = parseInt(vv._qualityInput.text, 10); if (!isNaN(qval)) vv.quality = qval;
            }

            delete vv._containerInput; delete vv._targetInput; delete vv._qualityInput;
        }

        return vers;
    }

    function exportFromDoc(docRef, cfg, vers, shiftIsDown, log, useFixedKBMode, progressCtx) {
        if (!docRef || !isDocAlive(docRef)) {
            log.push("SKIP (document not available)");
            return;
        }

        var presetName = cfg.presetName;
        var baseNameFinal = cfg.baseNameFinal;
        var dimMode = cfg.dimMode;

        var padPctTB = cfg.padPctTB;
        var padPctLR = cfg.padPctLR;
        var padDir = cfg.padDir;
        var autoLowerFill = cfg.autoLowerFill;
        var useForceTB = cfg.useForceTB;
        var useForceLR = cfg.useForceLR;
        var targetEffVal = cfg.targetEffVal;

        var colorSuffix = cfg.colorSuffix;
        var descriptionRaw = cfg.descriptionRaw;

        var containerSetType = cfg.containerSetType;
        useFixedKBMode = !!useFixedKBMode;
        // Fixed KB ON  = fixed-quality per suffix (fast; file size varies).
        // Fixed KB OFF = target-KB mode (binary-search quality to hit a size cap) for BOTH W and H sets.
        var useTargetKBMode = (!useFixedKBMode);

        var outFolder = (docRef.path && docRef.path.fsName) ? new Folder(docRef.path) : Folder.myDocuments;
        if (shiftIsDown && outFolder.parent) outFolder = outFolder.parent;
        var outPath = outFolder.fsName;

        var pd2Method = getResampleFallback();

        // Notify progress UI (if present) that this doc is about to start.
        try {
            if (progressCtx && progressCtx.onDocStart) progressCtx.onDocStart(docRef, cfg, vers);
        } catch (eP0) { }

        // ─────────────────────────────────────────────────────────────
        // PERFORMANCE: duplicate + convert ONCE, then reuse via History
        // ─────────────────────────────────────────────────────────────
        var prevDoc = null;
        try { prevDoc = app.activeDocument; } catch (e0) { prevDoc = null; }

        var prevDialogs = null;
        try { prevDialogs = app.displayDialogs; app.displayDialogs = DialogModes.NO; } catch (eD) { prevDialogs = null; }

        var workDoc = null;
        try {
            // Duplicate merged for speed (avoids pulling full layer stacks) and protects the original.
            workDoc = docRef.duplicate(docRef.name + "_webp_work", true);

            // Convert once (previous version did this per-variant and also inside every WebP save).
            ensure8bitSRGB(workDoc);

            try { app.activeDocument = workDoc; } catch (eA) { }

            // Capture a "baseline" history state we can return to before each export.
            var baseState = null;
            try { baseState = workDoc.activeHistoryState; } catch (eH) { baseState = null; }

            // Cache original dimensions once (we always return to baseState, so these are stable).
            var baseW = Number(workDoc.width.as("px"));
            var baseH = Number(workDoc.height.as("px"));
            if (isNaN(baseW) || baseW <= 0) baseW = 1;
            if (isNaN(baseH) || baseH <= 0) baseH = 1;
            var autoPick = (baseW >= baseH) ? "W" : "H";

            // For Target-KB mode, we can speed up convergence by reusing the previous
            // variant's solved quality as a *hint* for the next one.
            // IMPORTANT: We do NOT clamp maxQ — smaller images can often support higher quality
            // while still meeting a smaller target size.
            var lastSetQualityHint = -1;

            function resetWorkDoc() {
                if (baseState) {
                    try { workDoc.activeHistoryState = baseState; } catch (eR) { }
                }
            }

            function getChosenResample(suffix) {
                var sharp = null; try { sharp = ResampleMethod.BICUBICSHARPER; } catch (eS) { sharp = null; }
                return (suffix && suffix.indexOf("_blur") !== -1 && sharp) ? sharp : (pd2Method || sharp);
            }

            function resizeToContainer(containerSize, forceMode, suffix) {
                var pick = (forceMode === "AUTO") ? autoPick : forceMode;
                var tW, tH;

                if (pick === "W") { tW = containerSize; tH = containerSize * (baseH / baseW); }
                else { tH = containerSize; tW = containerSize * (baseW / baseH); }

                if (tW < 1) tW = 1;
                if (tH < 1) tH = 1;

                var chosen = getChosenResample(suffix);
                workDoc.resizeImage(UnitValue(tW, "px"), UnitValue(tH, "px"), workDoc.resolution, chosen);
                return chosen;
            }

            function exportAlways(spec) {
                var suffix = spec.suffix;
                var containerSize = spec.container;
                var compType = spec.compType;
                var quality = spec.quality;

                var outFileName = buildWebpFileName(baseNameFinal, colorSuffix, suffix, descriptionRaw);
                var chosen = null;
                var saveFile = null;
                var kb = 0;
                var ok = false;
                var err = null;

                try {
                    if (progressCtx && progressCtx.onVariantStart) {
                        progressCtx.onVariantStart(outFileName, {
                            suffix: suffix,
                            container: containerSize,
                            compType: compType,
                            quality: quality,
                            isAlways: true
                        });
                    }
                } catch (eP1) { }

                try {
                    resetWorkDoc();
                    try { app.activeDocument = workDoc; } catch (eA2) { }

                    chosen = resizeToContainer(containerSize, "AUTO", suffix);

                    saveFile = new File(outPath + "/" + outFileName);
                    saveAsWebP(saveFile, compType, quality, false, false, false, true);

                    kb = saveFile.exists ? Math.round(saveFile.length / 1024) : 0;
                    ok = true;
                    log.push(outFileName + " | Resample: " + getResampleMethodName(chosen) + " | Comp: " + (compType === "compressionLossless" ? "Lossless" : "Lossy") + " | Quality: " + quality + " | Size: " + kb + " KB");
                } catch (e1) {
                    err = e1;
                    log.push(outFileName + " | Export failed: " + formatError(e1));
                }

                try {
                    if (progressCtx && progressCtx.onVariantDone) {
                        progressCtx.onVariantDone(outFileName, ok, {
                            suffix: suffix,
                            container: containerSize,
                            kb: kb,
                            quality: quality,
                            isAlways: true,
                            error: err
                        });
                    }
                } catch (eP2) { }
            }

            function exportVersion(v, targetValue) {
                var suffix = v.suffix;
                var containerSize = v.container;
                var compType = v.compType;

                var outFileName = buildWebpFileName(baseNameFinal, colorSuffix, suffix, descriptionRaw);

                var chosen = null;
                var saveFile = null;
                var kb = 0;
                var finalQuality = (useTargetKBMode ? -1 : targetValue);
                var ok = false;
                var err = null;

                try {
                    if (progressCtx && progressCtx.onVariantStart) {
                        progressCtx.onVariantStart(outFileName, {
                            suffix: suffix,
                            container: containerSize,
                            compType: compType,
                            target: targetValue,
                            useTargetKBMode: useTargetKBMode,
                            isAlways: false
                        });
                    }
                } catch (eP3) { }

                try {
                    resetWorkDoc();
                    try { app.activeDocument = workDoc; } catch (eA3) { }

                    // Determine sizing mode:
                    //  - User-selected dimMode applies to the main W/H set.
                    //  - "AUTO" means match longest side to container (preserving aspect).
                    var forceMode;
                    if (dimMode === "H") forceMode = "H";
                    else if (dimMode === "W") forceMode = "W";
                    else forceMode = "AUTO";

                    // In our helper, "W"/"H" means width-locked or height-locked.
                    // Convert to our internal pick logic:
                    var chosen;
                    if (forceMode === "H") {
                        // Height-locked
                        var tH = containerSize;
                        var tW = containerSize * (baseW / baseH);
                        if (tW < 1) tW = 1;
                        if (tH < 1) tH = 1;
                        chosen = getChosenResample(suffix);
                        workDoc.resizeImage(UnitValue(tW, "px"), UnitValue(tH, "px"), workDoc.resolution, chosen);
                    } else if (forceMode === "W") {
                        // Width-locked
                        var tW2 = containerSize;
                        var tH2 = containerSize * (baseH / baseW);
                        if (tW2 < 1) tW2 = 1;
                        if (tH2 < 1) tH2 = 1;
                        chosen = getChosenResample(suffix);
                        workDoc.resizeImage(UnitValue(tW2, "px"), UnitValue(tH2, "px"), workDoc.resolution, chosen);
                    } else {
                        // AUTO
                        chosen = resizeToContainer(containerSize, "AUTO", suffix);
                    }

                    if (padPctTB > 0 || padPctLR > 0) {
                        applyPadding(workDoc, padPctTB, padPctLR, padDir, autoLowerFill, useForceTB, useForceLR, targetEffVal);
                    }

                    saveFile = new File(outPath + "/" + outFileName);

                    if (useTargetKBMode) {
                        // Target-size mode (KB): binary-search quality (LOSSY), allowing a small tolerance to preserve quality.
                        var tolKB = Math.round(Number(targetValue) * (TARGET_KB_TOLERANCE_PCT / 100));
                        if (isNaN(tolKB) || tolKB < 0) tolKB = 0;

                        if (compType === "compressionLossless") {
                            // LOSSLESS has no adjustable "quality" knob.
                            // We try lossless once; if it exceeds the cap, fall back to LOSSY to respect the target size.
                            saveAsWebP(saveFile, compType, 0, false, false, false, true);
                            var kbLossless = saveFile.exists ? Math.round(saveFile.length / 1024) : 0;

                            if (kbLossless <= (Number(targetValue) + tolKB)) {
                                finalQuality = "LOSSLESS";
                            } else {
                                var hintQ = (typeof v.quality === "number" && !isNaN(v.quality)) ? (v.quality | 0) : 95;
                                finalQuality = saveWithTargetSize(saveFile, "compressionLossy", 0, 100, targetValue, {
                                    qualityHint: (lastSetQualityHint >= 0 ? lastSetQualityHint : hintQ),
                                    toleranceKB: tolKB
                                });
                                if (typeof finalQuality === "number") lastSetQualityHint = finalQuality;
                                compType = "compressionLossy";
                            }
                        } else {
                            finalQuality = saveWithTargetSize(saveFile, compType, 0, 100, targetValue, {
                                qualityHint: lastSetQualityHint,
                                toleranceKB: tolKB
                            });
                            if (typeof finalQuality === "number") lastSetQualityHint = finalQuality;
                        }
                    } else {
                        saveAsWebP(saveFile, compType, targetValue, false, false, false, true);
                        finalQuality = targetValue;
                    }

                    kb = saveFile.exists ? Math.round(saveFile.length / 1024) : 0;
                    ok = true;
                    log.push(outFileName + " | Resample: " + getResampleMethodName(chosen) + " | Comp: " + (compType === "compressionLossless" ? "Lossless" : "Lossy") + " | Quality: " + finalQuality + " | Size: " + kb + " KB");
                } catch (e1) {
                    err = e1;
                    log.push(outFileName + " | Export failed: " + formatError(e1));
                }

                try {
                    if (progressCtx && progressCtx.onVariantDone) {
                        progressCtx.onVariantDone(outFileName, ok, {
                            suffix: suffix,
                            container: containerSize,
                            kb: kb,
                            quality: finalQuality,
                            target: targetValue,
                            useTargetKBMode: useTargetKBMode,
                            isAlways: false,
                            error: err
                        });
                    }
                } catch (eP4) { }
            }

            // ALWAYS versions (independent of W/H sets) — NO PADDING EVER
            exportAlways(ALWAYS_T);
            exportAlways(ALWAYS_T_BLUR);

            // Version set versions (preserve user-defined order)
            for (var vi = 0; vi < vers.length; vi++) {
                var v = vers[vi];
                exportVersion(v, useTargetKBMode ? v.targetKB : v.quality);
            }
        } catch (eOuter) {
            log.push("Export failed: " + eOuter);
        } finally {
            try { if (workDoc) workDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (eC) { }
            try { if (prevDoc) app.activeDocument = prevDoc; } catch (eB) { }
            try { if (prevDialogs !== null && prevDialogs !== undefined) app.displayDialogs = prevDialogs; } catch (eDD) { }

            // Notify progress UI (if present) that this doc is complete.
            try {
                if (progressCtx && progressCtx.onDocEnd) progressCtx.onDocEnd(docRef, cfg, vers);
            } catch (eP9) { }
        }
    }


    function resolvePresetName(name) {
        if (!name && name !== 0) return "";
        var raw = String(name).replace(/^\s+|\s+$/g, '');
        var lower = raw.toLowerCase();
        if (lower === "img1") return "img";
        for (var i = 0; i < PRESET_BASENAMES.length; i++) {
            if (PRESET_BASENAMES[i].toLowerCase() === lower) return PRESET_BASENAMES[i];
        }
        return raw;
    }

    function indexOfPreset(name) {
        for (var i = 0; i < PRESET_BASENAMES.length; i++) {
            if (PRESET_BASENAMES[i] === name) return i;
        }
        return 0;
    }

    function idxOf(list, val) {
        for (var i = 0; i < list.length; i++) if (String(list[i]) === String(val)) return i;
        return 0;
    }

    function dirToPadDropdownIndex(dir) {
        var d = String(dir || "AUTO").toUpperCase();
        if (d === "TB" || d === "TOPBOTTOM" || d === "TOP" || d === "TOP&BOTTOM") return 1;
        if (d === "LR" || d === "LEFTRIGHT" || d === "LEFT" || d === "LEFT&RIGHT") return 2;
        if (d === "MIN" || d === "MINIMUM" || d.indexOf("MIN") === 0) return 3;
        return 0;
    }

    // ────────────────────────────────────────────────────────────
    // MAIN DIALOG
    // ────────────────────────────────────────────────────────────

    var docStates = [];
    for (var di = 0; di < app.documents.length; di++) {
        var d = app.documents[di];
        var seed = seedSettingsForDoc(d);
        var ds = {
            id: safeDocId(d),
            doc: d,
            docName: d.name,
            detectedCategory: detectCategoryFromDocPath(getActiveDocFsPath(d)),
            seed: seed,

            // Thumbnail used by the Summary table and each doc tab header.
            // Created lazily (first time buildDocTabUI runs) to keep initial UI build fast.
            thumbFile: null,
            _thumbImage: null,

            tab: null,
            ui: {},

            // Summary table UI + selection state
            summaryUI: null,
            _summarySelected: true,
            _summaryIndex: di
        };
        docStates.push(ds);
    }

    // ────────────────────────────────────────────────────────────
    // RUN STATE (keeps the UI open; supports multiple runs)
    // ────────────────────────────────────────────────────────────
    var __RUN_STATE = {
        running: false,
        runSeq: 0,
        lastLog: []
    };

    var dlgMain = new Window("dialog", "WebP — All Options (Multi-Doc)", undefined, { resizeable: true });
    dlgMain.orientation = "column";
    dlgMain.alignChildren = ["fill", "top"];
    // Allow expanding/shrinking the UI to better handle many document tabs.
    // Keep a reasonably large minimum so the footer panels (selection / bulk / run) never get hidden.
    try { dlgMain.minimumSize = [1240, 760]; } catch (eMS) { }

    // Default size (roomy, but clamped so it doesn't open off-screen).
    // Requested: open with up to ~1200px of vertical room so the rows/table are the main focus.
    var __defaultW = 1900;
    var __defaultH = 1200;

    // Clamp to ~95% of the primary screen so the dialog always fits.
    // (Still capped at 1900×1200 for a consistent, professional default.)
    try {
        if ($.screens && $.screens.length) {
            var s0 = $.screens[0];
            var sw = 0, sh = 0;
            try {
                if (typeof s0.right !== "undefined" && typeof s0.left !== "undefined") sw = Number(s0.right) - Number(s0.left);
                if (typeof s0.bottom !== "undefined" && typeof s0.top !== "undefined") sh = Number(s0.bottom) - Number(s0.top);
            } catch (eScr0) { sw = 0; sh = 0; }
            if (sw > 0) __defaultW = Math.min(__defaultW, Math.max(1240, Math.floor(sw * 0.95)));
            if (sh > 0) __defaultH = Math.min(__defaultH, Math.max(760, Math.floor(sh * 0.95)));
        }
    } catch (eScr) { }

    try { dlgMain.preferredSize = [__defaultW, __defaultH]; } catch (ePS) { }
    try { dlgMain.size = [__defaultW, __defaultH]; } catch (eS) { }

    dlgMain.onResizing = function () {
        // Keep the UI responsive while dragging: just resize + enforce the core flex layout.
        // (Avoid heavy column work here; we do that on onResize.)
        try { this.layout.resize(); } catch (e1) { }
        try { enforceSummaryLayout(); } catch (e0) { }
        // Intentionally do NOT call resizeSummaryColumns() here.
        // ScriptUI can lag badly if we resize dozens of controls every mouse-move.
    };

    dlgMain.onResize = function () {
        // Resize the UI first, then enforce the Summary "table-first" layout,
        // then apply column sizing (cheap enough to run once per resize end).
        try { this.layout.resize(); } catch (e1) { }
        try { enforceSummaryLayout(); } catch (e0) { }
        try { this.layout.resize(); } catch (e1b) { }
        try { resizeSummaryColumns(); } catch (e2) { }
        // resizeSummaryColumns() calls updateSummaryScroll() internally.
    };

    // Run a final layout pass once the dialog is actually visible.
    // (Some ScriptUI hosts report zero/incorrect sizes until onShow.)
    dlgMain.onShow = function () {
        // Run an initial layout pass first.
        // (Some ScriptUI hosts report zero/incorrect sizes until after the first layout.)
        try { this.layout.layout(true); } catch (e1) { }

        // Then enforce the Summary tab's "table-first" resizing behavior.
        try { enforceSummaryLayout(); } catch (e0) { }
        try { this.layout.layout(true); } catch (e1b) { }

        // Finally, size columns & scrollbars using the now-correct viewport dimensions.
        try { resizeSummaryColumns(true); } catch (e2) { }
        // resizeSummaryColumns() calls updateSummaryScroll() internally.
    };
    var tabsPanel = dlgMain.add("tabbedpanel");
    tabsPanel.alignChildren = ["fill", "fill"];
    // Let the tabbed panel grow/shrink with the window.
    tabsPanel.alignment = ["fill", "fill"];
    try { tabsPanel.minimumSize = [900, 600]; } catch (eTP) { }
    // Start large by default; the tabbed panel will still resize with the window.
    try { tabsPanel.preferredSize.width = __defaultW - 20; } catch (eTPW) { }
    try { tabsPanel.preferredSize.height = __defaultH - 90; } catch (eTPH) { }

    // --- Summary Tab (front tab) ---
    var tabSummary = tabsPanel.add("tab", undefined, "Summary");
    tabSummary.orientation = "column";
    tabSummary.alignment = ["fill", "fill"];
    tabSummary.alignChildren = ["fill", "fill"]; // list/table expands; footer stays compact via top-aligned panels
    // Slightly tighter default spacing for a cleaner, denser Summary UI.
    try { tabSummary.spacing = 4; } catch (eSp0) { }
    try { tabSummary.margins = [10, 10, 10, 8]; } catch (eMg0) { }

    // TOP: title + the scrollable table panel live in summaryTop
    var summaryTop = tabSummary.add("group");
    summaryTop.orientation = "column";
    summaryTop.alignChildren = ["fill", "fill"];
    summaryTop.alignment = ["fill", "fill"];
    try { summaryTop.spacing = 4; } catch (eSp1) { }

    var summaryTitle = summaryTop.add("statictext", undefined, "Open Documents: " + docStates.length);
    summaryTitle.alignment = ["fill", "top"];
    summaryTitle.graphics.font = ScriptUI.newFont("dialog", "bold", 13);

    // THIS is the resizable area
    var listPanel = summaryTop.add("panel", undefined, "Select documents to run");
    listPanel.orientation = "column";
    listPanel.alignChildren = ["fill", "fill"];
    listPanel.alignment = ["fill", "fill"];


    // ────────────────────────────────────────────────────────────
    // SUMMARY TABLE (custom rows with per-cell dropdowns)
    //  • X (close button) FIRST column
    //  • Larger thumbnails (2K-friendly)
    //  • Ctrl-click multi-select (highlight stays visible; thumbnails never disappear)
    //  • Per-row dropdowns: Preset / # / Color / Description
    //  • Bulk Edit Selected updates rows immediately (no Apply button)
    // ────────────────────────────────────────────────────────────

    var SUMMARY_THUMB_PX = 64;   // slightly larger than prior (good on 2K monitors)
    var SUMMARY_ROW_H = 74;      // row height so thumbs + dropdowns fit comfortably
    var SUMMARY_SCROLL_W = 18;

    // Column widths are recalculated on resize (Filename + Description get the slack)
    var __sumColW = { x: 28, thumb: 72, size: 110, file: 220, preset: 230, num: 90, color: 200, desc: 260, prev: 360 };
    var __sumColsAppliedOnce = false;

    // Wrapper that contains header + scrollable rows
    var sumTableWrap = listPanel.add("group");
    sumTableWrap.orientation = "column";
    sumTableWrap.alignChildren = ["fill", "fill"];
    sumTableWrap.alignment = ["fill", "fill"];
    sumTableWrap.spacing = 2;

    // Header row
    var sumHdr = sumTableWrap.add("group");
    sumHdr.orientation = "row";
    sumHdr.alignChildren = ["left", "center"];
    sumHdr.alignment = ["fill", "top"];
    sumHdr.spacing = 6;
    sumHdr.margins = [2, 2, 2, 2];

    var hdrX = sumHdr.add("statictext", undefined, "X");
    var hdrThumb = sumHdr.add("statictext", undefined, "Thumb");
    var hdrSize = sumHdr.add("statictext", undefined, "Size (px)");
    var hdrFile = sumHdr.add("statictext", undefined, "Filename");
    var hdrPreset = sumHdr.add("statictext", undefined, "Preset");
    var hdrNum = sumHdr.add("statictext", undefined, "#");
    var hdrColor = sumHdr.add("statictext", undefined, "Color");
    var hdrDesc = sumHdr.add("statictext", undefined, "Description");
    var hdrPrev = sumHdr.add("statictext", undefined, "Container Preview");

    // ────────────────────────────────────────────────────────────
    // Header sorting (clickable headers like a normal table)
    //  • Click a header to sort ascending
    //  • Click again to toggle descending
    //  • "Organize" uses Color → Description → Preset → Filename
    // ────────────────────────────────────────────────────────────

    var __summarySortKey = "";
    var __summarySortDir = 1;
    var __summaryHdrBase = {
        x: "X",
        thumb: "Thumb",
        size: "Size (px)",
        file: "Filename",
        preset: "Preset",
        num: "#",
        color: "Color",
        desc: "Description",
        prev: "Container Preview"
    };

    function updateSummaryHeaderSortIndicators() {
        var arrow = (__summarySortDir >= 0) ? " ▲" : " ▼";

        function setHdr(ctrl, key) {
            if (!ctrl) return;
            try {
                var base = __summaryHdrBase[key] || String(ctrl.text || "");
                ctrl.text = String(base) + ((__summarySortKey === key) ? arrow : "");
            } catch (e) { }
        }

        setHdr(hdrX, "x");
        setHdr(hdrThumb, "thumb");
        setHdr(hdrSize, "size");
        setHdr(hdrFile, "file");
        setHdr(hdrPreset, "preset");
        setHdr(hdrNum, "num");
        setHdr(hdrColor, "color");
        setHdr(hdrDesc, "desc");
        setHdr(hdrPrev, "prev");
    }

    function requestSummarySort(key, toggle) {
        if (!key) return;

        var doToggle = (toggle !== false); // default: toggle when same header clicked repeatedly

        if (doToggle && __summarySortKey === key) {
            __summarySortDir = -__summarySortDir;
        } else {
            __summarySortKey = key;
            __summarySortDir = 1;
        }

        updateSummaryHeaderSortIndicators();
        try { applySummarySort(__summarySortKey, __summarySortDir); } catch (e) { }
    }

    function bindSummaryHeaderSort(ctrl, key) {
        if (!ctrl) return;

        try { ctrl.helpTip = ""; } catch (e0) { }

        try {
            ctrl.addEventListener("mousedown", function () { requestSummarySort(key, true); });
        } catch (e) {
            try { ctrl.onClick = function () { requestSummarySort(key, true); }; } catch (e2) { }
        }
    }

    // Bind sort to headers
    bindSummaryHeaderSort(hdrX, "x");
    bindSummaryHeaderSort(hdrThumb, "thumb");
    bindSummaryHeaderSort(hdrSize, "size");
    bindSummaryHeaderSort(hdrFile, "file");
    bindSummaryHeaderSort(hdrPreset, "preset");
    bindSummaryHeaderSort(hdrNum, "num");
    bindSummaryHeaderSort(hdrColor, "color");
    bindSummaryHeaderSort(hdrDesc, "desc");
    bindSummaryHeaderSort(hdrPrev, "prev");

    // Add a spacer so headers align with the scrollable body (accounts for the scrollbar)
    var hdrScrollSpacer = sumHdr.add("statictext", undefined, "");


    // Scrollable body
    var sumBody = sumTableWrap.add("group");
    sumBody.orientation = "row";
    sumBody.alignChildren = ["fill", "fill"];
    sumBody.alignment = ["fill", "fill"];

    var sumViewport = sumBody.add("panel", undefined, "");
    sumViewport.margins = 0;
    sumViewport.orientation = "column";
    sumViewport.alignChildren = ["fill", "top"];
    sumViewport.alignment = ["fill", "fill"];

    var sumRows = sumViewport.add("group");
    sumRows.orientation = "column";
    sumRows.alignChildren = ["fill", "top"];
    sumRows.alignment = ["fill", "top"];
    sumRows.spacing = 0;
    sumRows.margins = 0;
    try { sumRows.location = [0, 0]; } catch (eLoc) { }

    var sumScroll = sumBody.add("scrollbar");
    sumScroll.alignment = ["right", "fill"];
    try { sumScroll.preferredSize.width = SUMMARY_SCROLL_W; } catch (eSW) { }
    sumScroll.value = 0;
    // Match step to row height so each notch scrolls roughly one row.
    try { sumScroll.stepdelta = SUMMARY_ROW_H; } catch (eStep) { }

    function presetLabelFromKey(pName) {
        // Use the dropdown labels list if available; fallback to key
        var idx = indexOfPreset(pName);
        try {
            if (idx >= 0 && idx < PRESET_DROPDOWN_LABELS.length) return String(PRESET_DROPDOWN_LABELS[idx]);
        } catch (e) { }
        return String(pName || "");
    }

    function docPxSizeString(docRef) {
        try {
            var wpx = Math.round(Number(docRef.width.as("px")));
            var hpx = Math.round(Number(docRef.height.as("px")));
            if (isNaN(wpx) || isNaN(hpx)) return "";
            return String(wpx) + "×" + String(hpx);
        } catch (e) { }
        return "";
    }

    // ------------------------------------------------------------------
    // Summary-only "Container Preview" column (text-only for speed)
    // ------------------------------------------------------------------

    function _fmtNum(n, decimals) {
        try {
            var num = Number(n);
            if (isNaN(num) || !isFinite(num)) return "";
            var d = Math.max(0, Math.min(6, Number(decimals) || 0));
            var p = Math.pow(10, d);
            return String(Math.round(num * p) / p);
        } catch (e) { }
        return "";
    }

    function _closestAspectLabel(w, h) {
        try {
            var ww = Number(w), hh = Number(h);
            if (!isFinite(ww) || !isFinite(hh) || ww <= 0 || hh <= 0) return "";
            var r = ww / hh;

            var ratios = [
                { label: "1:1", value: 1.0 },
                { label: "4:5", value: 4 / 5 },
                { label: "5:4", value: 5 / 4 },
                { label: "2:3", value: 2 / 3 },
                { label: "3:2", value: 3 / 2 },
                { label: "3:4", value: 3 / 4 },
                { label: "4:3", value: 4 / 3 },
                { label: "9:16", value: 9 / 16 },
                { label: "16:9", value: 16 / 9 },
                { label: "2:1", value: 2.0 }
            ];

            var best = ratios[0];
            var bestDiff = Math.abs(r - best.value);
            for (var i = 1; i < ratios.length; i++) {
                var d = Math.abs(r - ratios[i].value);
                if (d < bestDiff) { bestDiff = d; best = ratios[i]; }
            }

            // If it's not close, show a numeric label like 1.33:1 or 1:1.33
            if (bestDiff > 0.06) {
                if (r >= 1) return _fmtNum(r, 2) + ":1";
                return "1:" + _fmtNum(1 / r, 2);
            }
            return best.label;
        } catch (e) { }
        return "";
    }

    function _efficiency16x9Pct(origW, origH, finalW, finalH) {
        try {
            var ow = Number(origW), oh = Number(origH), fw = Number(finalW), fh = Number(finalH);
            if (!isFinite(ow) || !isFinite(oh) || !isFinite(fw) || !isFinite(fh) || ow <= 0 || oh <= 0 || fw <= 0 || fh <= 0) return 0;

            var rFinal = fw / fh;
            var containerArea;
            if (rFinal >= 1.77777) containerArea = fw * (fw / 1.77777);
            else containerArea = (fh * 1.77777) * fh;

            if (!isFinite(containerArea) || containerArea <= 0) return 0;
            var origArea = ow * oh;
            return (origArea / containerArea) * 100;
        } catch (e) { }
        return 0;
    }

    function buildContainerPreviewSnippet(ds) {
        try {
            if (!ds || !ds.doc) return "";
            var docRef = ds.doc;

            var wpx = Math.round(Number(docRef.width.as("px")));
            var hpx = Math.round(Number(docRef.height.as("px")));
            if (!wpx || !hpx || isNaN(wpx) || isNaN(hpx)) return "";

            // Default to seed values (then override from UI if available)
            var tbPct = (ds.seed && typeof ds.seed.paddingPctTB !== "undefined") ? Number(ds.seed.paddingPctTB) : 0;
            var lrPct = (ds.seed && typeof ds.seed.paddingPctLR !== "undefined") ? Number(ds.seed.paddingPctLR) : 0;
            var selDir = (ds.seed && ds.seed.paddingDir) ? String(ds.seed.paddingDir) : "LR"; // LR/TB/AUTO/MIN
            var autoLowerFill = (ds.seed && ds.seed.autoLowerFill) ? true : false;
            var forceTB = (ds.seed && ds.seed.forcePadTB) ? true : false;
            var forceLR = (ds.seed && ds.seed.forcePadLR) ? true : false;
            var targetEffVal = (ds.seed && ds.seed.targetEff) ? Number(ds.seed.targetEff) : 0;
            var useEff = (targetEffVal && targetEffVal > 0);

            // Override with live UI values, if that doc tab exists.
            try { if (ds.ui && ds.ui.padPctTBInput) tbPct = parseFloat(ds.ui.padPctTBInput.text) || 0; } catch (e0) { }
            try { if (ds.ui && ds.ui.padPctLRInput) lrPct = parseFloat(ds.ui.padPctLRInput.text) || 0; } catch (e1) { }
            try { if (ds.ui && ds.ui.chkForceTB) forceTB = !!ds.ui.chkForceTB.value; } catch (e2) { }
            try { if (ds.ui && ds.ui.chkForceLR) forceLR = !!ds.ui.chkForceLR.value; } catch (e3) { }
            try { if (ds.ui && ds.ui.autoLowerFillCheckbox) autoLowerFill = !!ds.ui.autoLowerFillCheckbox.value; } catch (e4) { }

            try {
                if (ds.ui && ds.ui.padDirDropdown && ds.ui.padDirDropdown.selection) {
                    var t = String(ds.ui.padDirDropdown.selection.text || "");
                    if (t.indexOf("Top") >= 0) selDir = "TB";
                    else if (t.indexOf("Left") >= 0) selDir = "LR";
                    else if (t.indexOf("Auto") >= 0) selDir = "AUTO";
                    else if (t.indexOf("Minimum") >= 0) selDir = "MIN";
                }
            } catch (e5) { }

            try { if (ds.ui && ds.ui.chkTargetEff && ds.ui.chkTargetEff.enabled) useEff = !!ds.ui.chkTargetEff.value; } catch (e6) { }
            try {
                if (useEff && ds.ui && ds.ui.ddTargetEff && ds.ui.ddTargetEff.selection) {
                    var effTxt = String(ds.ui.ddTargetEff.selection.text || "");
                    var mEff = effTxt.match(/([0-9.]+)\s*%/);
                    if (mEff && mEff[1]) targetEffVal = parseFloat(mEff[1]) || 0;
                }
            } catch (e7) { }

            var info = analyzePaddingFor16x9(wpx, hpx, tbPct, lrPct, forceTB, forceLR, targetEffVal);
            var pT = 0, pB = 0, pL = 0, pR = 0;

            var isMinMode = (String(selDir) === "MIN");
            if (isMinMode || useEff) {
                pT = info.minPad.pt; pB = info.minPad.pb; pL = info.minPad.pl; pR = info.minPad.pr;
            } else {
                var chosenDir = String(selDir);
                if (chosenDir === "AUTO") chosenDir = autoLowerFill ? info.autoDirLowerFill : info.autoDirOrientation;

                if (chosenDir === "TB" || forceTB) {
                    pT = Math.round(hpx * (tbPct / 100) / 2);
                    pB = pT;
                }
                if (chosenDir === "LR" || forceLR) {
                    pL = Math.round(wpx * (lrPct / 100) / 2);
                    pR = pL;
                }

                // Make AUTO explicit in the preview so it's obvious what was chosen.
                if (String(selDir) === "AUTO") selDir = "AUTO->" + chosenDir;
            }

            var finalW = wpx + pL + pR;
            var finalH = hpx + pT + pB;

            var modeLine = isMinMode ? "MODE: MINIMUM PADDING" : ("MODE: Standard (" + String(selDir) + ")");
            var padLine = "Padding Added: TB: " + String(pT + pB) + "px | LR: " + String(pL + pR) + "px";
            var sizeLine = "Final Size:   " + String(finalW) + " x " + String(finalH) + " px";
            var aspect = (finalH > 0) ? (finalW / finalH) : 0;
            var aspectLine = "Final Aspect: " + _fmtNum(aspect, 3) + " (" + _closestAspectLabel(finalW, finalH) + ")";
            var eff = _efficiency16x9Pct(wpx, hpx, finalW, finalH);
            var effLine = "16:9 Container Efficiency: " + _fmtNum(eff, 1) + "% (Product vs. 16:9 Box)";

            return [modeLine, padLine, sizeLine, aspectLine, effLine].join("\n");
        } catch (e) { }
        return "";
    }

    function syncSummaryPreview(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.previewTxt) return;
        try {
            var s = buildContainerPreviewSnippet(ds);
            if (ds.summaryUI._prevCache !== s) {
                ds.summaryUI.previewTxt.text = s;
                ds.summaryUI._prevCache = s;
            }
        } catch (e) { }
    }

    function getDocPresetKey(ds) {
        var k = "";
        try { if (ds.ui && ds.ui.presetDropdown) k = getSelectedPresetKeyFromDropdown(ds.ui.presetDropdown); } catch (e1) { k = ""; }
        if (!k) try { k = String(ds.seed.presetName || ""); } catch (e2) { k = ""; }
        if (!k) k = "feature-image";
        return k;
    }

    function getDocFileNameForSummary(ds) {
        // This is the export base file name ("Base File Name" from the doc tab).
        var v = "";
        try { if (ds.ui && ds.ui.nameInput) v = String(ds.ui.nameInput.text); } catch (e1) { v = ""; }
        if (!v) try { v = String(ds.seed.baseName || ""); } catch (e2) { v = ""; }
        if (!v) try { v = stripExtension(ds.docName); } catch (e3) { v = ""; }
        return v;
    }

    function getDocNumberForSummary(ds) {
        try { if (ds.ui && ds.ui.numberInput) return digitsOnly(ds.ui.numberInput.text); } catch (e) { }
        return "";
    }

    function getDocColorForSummary(ds) {
        try { if (ds.ui && ds.ui.colorInput) return String(ds.ui.colorInput.text || ""); } catch (e) { }
        return "";
    }

    function getDocDescForSummary(ds) {
        try { if (ds.ui && ds.ui.descQuick && ds.ui.descQuick.selection) return String(ds.ui.descQuick.selection.text || ""); } catch (e) { }
        return "";
    }

    function _isCtrlDown(ev) {
        // Prefer event modifiers when available (more reliable than keyboardState in some ScriptUI hosts)
        try {
            if (ev) {
                if (typeof ev.ctrlKey !== "undefined" || typeof ev.metaKey !== "undefined") {
                    return !!(ev.ctrlKey || ev.metaKey);
                }
            }
        } catch (eEv) { }

        try {
            var ks = ScriptUI.environment.keyboardState;
            return !!(ks && (ks.ctrlKey || ks.metaKey));
        } catch (e) { }
        return false;
    }
    function _isShiftDown(ev) {
        try {
            if (ev) {
                if (typeof ev.shiftKey !== "undefined") return !!ev.shiftKey;
            }
        } catch (eEv) { }

        try {
            var ks = ScriptUI.environment.keyboardState;
            return !!(ks && ks.shiftKey);
        } catch (e) { }
        return false;
    }

    // Selection state (we manage our own selection to keep the custom rows fast and predictable)
    var __lastSelIndex = -1;
    var __lastClickTime = 0;
    var __lastClickId = "";

    function getSelectedDocStatesFromSummary() {
        var out = [];
        for (var i = 0; i < docStates.length; i++) {
            if (docStates[i] && docStates[i]._summarySelected) out.push(docStates[i]);
        }
        return out;
    }

    function updateRowVisual(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.row) return;
        var row = ds.summaryUI.row;
        var sel = !!ds._summarySelected;

        // Best-effort: colorize row background without obscuring thumbnails.
        try {
            var g = row.graphics;
            if (g) {
                var idx = (typeof ds._summaryIndex === "number") ? ds._summaryIndex : 0;
                var odd = ((idx % 2) === 1);

                // Zebra striping (unselected) + stronger selected state
                var baseCol = odd ? [0.18, 0.18, 0.18, 1] : [0.21, 0.21, 0.21, 1];
                var selCol = [0.20, 0.40, 0.75, 1]; // light blue highlight (easy to spot)

                var b = g.newBrush(g.BrushType.SOLID_COLOR, sel ? selCol : baseCol);
                row.graphics.backgroundColor = b;
            }
        } catch (e) { }

    }

    function clearAllSelections(suppressBulk) {
        for (var i = 0; i < docStates.length; i++) {
            var ds = docStates[i];
            if (!ds) continue;
            ds._summarySelected = false;
            updateRowVisual(ds);
        }
        if (!suppressBulk) refreshBulkControlsFromSelection();
    }

    function selectRange(a, b, suppressBulk) {
        var lo = Math.min(a, b);
        var hi = Math.max(a, b);
        for (var i = 0; i < docStates.length; i++) {
            var ds = docStates[i];
            if (!ds) continue;
            ds._summarySelected = (i >= lo && i <= hi);
            updateRowVisual(ds);
        }
        if (!suppressBulk) refreshBulkControlsFromSelection();
    }

    function setSelected(ds, on, suppressBulk) {
        if (!ds) return;
        ds._summarySelected = !!on;
        updateRowVisual(ds);
        if (!suppressBulk) refreshBulkControlsFromSelection();
    }

    function selectOnly(ds, suppressBulk) {
        for (var i = 0; i < docStates.length; i++) {
            var d = docStates[i];
            if (!d) continue;
            d._summarySelected = (d === ds);
            updateRowVisual(d);
        }
        if (!suppressBulk) refreshBulkControlsFromSelection();
    }

    function handleRowClick(ds, ev) {
        if (!ds) return;

        var idx = (typeof ds._summaryIndex === "number") ? ds._summaryIndex : -1;
        var ctrl = _isCtrlDown(ev);
        var shift = _isShiftDown(ev);

        // De-dupe row clicks: in some ScriptUI builds a single click can trigger multiple handlers
        // (row + child controls). Without this, Ctrl-click toggles twice and appears broken.
        try {
            var now = (new Date()).getTime();
            var sig = String(idx) + "|" + (ctrl ? "1" : "0") + (shift ? "1" : "0");
            if (__lastClickId === sig && (now - __lastClickTime) < 45) {
                return;
            }
            __lastClickId = sig;
            __lastClickTime = now;
        } catch (eDedup) { }

        if (shift && __lastSelIndex >= 0 && idx >= 0) {
            // Shift selects a range
            selectRange(__lastSelIndex, idx, true);
        } else if (ctrl) {
            // Ctrl toggles this row without clearing others
            ds._summarySelected = !ds._summarySelected;
            updateRowVisual(ds);
            __lastSelIndex = idx;
        } else {
            // Normal click selects only this row
            selectOnly(ds, true);
            __lastSelIndex = idx;
        }

        refreshBulkControlsFromSelection();

        // IMPORTANT:
        // Do NOT auto-jump to the doc tab from a row click.
        // Use the "Go To Tab" button instead (keeps selection + Ctrl multi-select usable).
    }


    function ensureRowSelectedForControl(ds) {
        if (!ds) return;

        // If already selected, do nothing.
        if (ds._summarySelected) return;

        // If Ctrl is down, add this row to the selection without clearing others.
        if (_isCtrlDown()) {
            ds._summarySelected = true;
            updateRowVisual(ds);
            __lastSelIndex = (typeof ds._summaryIndex === "number") ? ds._summaryIndex : -1;
            refreshBulkControlsFromSelection();
            return;
        }

        // Otherwise behave like a normal table: clicking into a cell selects that row only.
        selectOnly(ds, false);
        __lastSelIndex = (typeof ds._summaryIndex === "number") ? ds._summaryIndex : -1;
    }


    function setSummaryHelpTip(ds) {
        // Tooltips disabled by request.
        if (!ds || !ds.summaryUI) return;

        try { ds.summaryUI.row.helpTip = ""; } catch (e0) { }
        try { ds.summaryUI.btnX.helpTip = ""; } catch (e1) { }
        try { ds.summaryUI.thumbImg.helpTip = ""; } catch (e2) { }
        try { ds.summaryUI.sizeTxt.helpTip = ""; } catch (e3) { }
        try { ds.summaryUI.fileTxt.helpTip = ""; } catch (e4) { }
        try { ds.summaryUI.presetDD.helpTip = ""; } catch (e5) { }
        try { ds.summaryUI.numDD.helpTip = ""; } catch (e6) { }
        try { ds.summaryUI.colorDD.helpTip = ""; } catch (e7) { }
        try { ds.summaryUI.descDD.helpTip = ""; } catch (e8) { }
    }


    function buildRowNumberItems() {
        // Per-row # dropdown list (simple + fast)
        return ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Custom..."];
    }

    function ensureDropdownHasItem(dd, textVal, insertBeforeLast) {
        // insertBeforeLast=true keeps "Custom..." last
        var v = String(textVal || "");
        if (!v) return 0;
        var tl = _safeLower(v);
        try {
            for (var i = 0; i < dd.items.length; i++) {
                if (_safeLower(dd.items[i].text) === tl) return i;
            }
            if (insertBeforeLast && dd.items.length) {
                var lastIdx = dd.items.length - 1;
                dd.add("item", v);
                // Move it right before the last item (Custom...)
                try {
                    var newIdx = dd.items.length - 1;
                    if (newIdx !== lastIdx) { /* nothing */ }
                } catch (e0) { }
                // NOTE: ScriptUI doesn't allow true reordering, but adding before last is enough
            } else {
                dd.add("item", v);
            }
            return dd.items.length - 1;
        } catch (e) { }
        return 0;
    }

    function rebuildColorDropdownForRow(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.colorDD) return;
        var dd = ds.summaryUI.colorDD;

        var cat = "";
        try { cat = String(ds.detectedCategory || ""); } catch (e0) { cat = ""; }

        var items = [];
        items.push(""); // blank
        try {
            var arr = getColorsForCategory(cat);
            for (var i = 0; i < arr.length; i++) items.push(String(arr[i]));
        } catch (e1) { }
        // Ensure current value is present even if not in JSON
        var current = getDocColorForSummary(ds);
        if (current) items.push(current);
        items.push("Custom...");

        // De-dup (case-insensitive) while preserving order
        var seen = {};
        var uniq = [];
        for (var j = 0; j < items.length; j++) {
            var t = String(items[j] || "");
            var k = _safeLower(t);
            if (seen[k]) continue;
            seen[k] = true;
            uniq.push(t);
        }

        try { while (dd.items.length) dd.remove(dd.items[0]); } catch (e2) { }
        for (var k = 0; k < uniq.length; k++) dd.add("item", uniq[k]);
    }

    function rebuildDescDropdownForRow(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.descDD) return;
        var dd = ds.summaryUI.descDD;

        var cat = "";
        try { cat = String(ds.detectedCategory || ""); } catch (e0) { cat = ""; }

        var items = [];
        items.push(""); // blank
        try {
            var arr = getDescriptionsForCategory(cat);
            for (var i = 0; i < arr.length; i++) items.push(String(arr[i]));
        } catch (e1) { }
        // Ensure current value is present even if not in JSON
        var current = getDocDescForSummary(ds);
        if (current) items.push(current);
        items.push("Custom...");

        // De-dup (case-insensitive) while preserving order
        var seen = {};
        var uniq = [];
        for (var j = 0; j < items.length; j++) {
            var t = String(items[j] || "");
            var k = _safeLower(t);
            if (seen[k]) continue;
            seen[k] = true;
            uniq.push(t);
        }

        try { while (dd.items.length) dd.remove(dd.items[0]); } catch (e2) { }
        for (var k = 0; k < uniq.length; k++) dd.add("item", uniq[k]);
    }

    // Rebuilding large dropdowns on every keystroke is a major source of UI lag.
    // Only rebuild when the category changes, or when the current value isn't present.
    function dropdownHasTextCI(dd, textVal) {
        var v = String(textVal || "");
        if (!v || !dd || !dd.items) return true;
        var tl = _safeLower(v);
        try {
            for (var i = 0; i < dd.items.length; i++) {
                if (_safeLower(dd.items[i].text) === tl) return true;
            }
        } catch (e) { }
        return false;
    }

    function ensureColorDropdownForRow(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.colorDD) return;
        var cat = "";
        try { cat = _safeLower(String(ds.detectedCategory || "")); } catch (e0) { cat = ""; }
        var built = "";
        try { built = String(ds.summaryUI._colorBuiltCat || ""); } catch (e1) { built = ""; }

        var current = "";
        try { current = String(getDocColorForSummary(ds) || ""); } catch (e2) { current = ""; }

        var need = (built !== cat);
        if (!need) {
            try { need = (ds.summaryUI.colorDD.items.length < 2); } catch (e3) { need = true; }
        }
        if (!need && current) {
            // Only scan the dropdown when the value changed (saves time while typing in other fields).
            var last = "";
            try { last = String(ds.summaryUI._colorLastVal || ""); } catch (eLV) { last = ""; }
            if (_safeLower(last) !== _safeLower(current)) {
                need = !dropdownHasTextCI(ds.summaryUI.colorDD, current);
                try { ds.summaryUI._colorLastVal = current; } catch (eSV) { }
            }
        }

        if (need) {
            rebuildColorDropdownForRow(ds);
            try { ds.summaryUI._colorBuiltCat = cat; } catch (e4) { }
        }
    }

    function ensureDescDropdownForRow(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.descDD) return;
        var cat = "";
        try { cat = _safeLower(String(ds.detectedCategory || "")); } catch (e0) { cat = ""; }
        var built = "";
        try { built = String(ds.summaryUI._descBuiltCat || ""); } catch (e1) { built = ""; }

        var current = "";
        try { current = String(getDocDescForSummary(ds) || ""); } catch (e2) { current = ""; }

        var need = (built !== cat);
        if (!need) {
            try { need = (ds.summaryUI.descDD.items.length < 2); } catch (e3) { need = true; }
        }
        if (!need && current) {
            // Only scan the dropdown when the value changed (saves time while typing in other fields).
            var last = "";
            try { last = String(ds.summaryUI._descLastVal || ""); } catch (eLV) { last = ""; }
            if (_safeLower(last) !== _safeLower(current)) {
                need = !dropdownHasTextCI(ds.summaryUI.descDD, current);
                try { ds.summaryUI._descLastVal = current; } catch (eSV) { }
            }
        }

        if (need) {
            rebuildDescDropdownForRow(ds);
            try { ds.summaryUI._descBuiltCat = cat; } catch (e4) { }
        }
    }

    function setDropdownSelectionByText(dd, textVal) {
        var v = String(textVal || "");
        if (!v) { try { dd.selection = 0; } catch (e0) { } return; }
        var tl = _safeLower(v);
        try {
            for (var i = 0; i < dd.items.length; i++) {
                if (_safeLower(dd.items[i].text) === tl) { dd.selection = i; return; }
            }
        } catch (e) { }
        try { dd.selection = 0; } catch (e2) { }
    }

    function setSummaryThumbnail(ds) {
        if (!ds || !ds.summaryUI || !ds.summaryUI.thumbImg) return;
        if (!ds.thumbFile || !ds.thumbFile.exists) return;

        try {
            if (!ds._thumbImage) {
                try { ds._thumbImage = ScriptUI.newImage(ds.thumbFile); } catch (e1) { ds._thumbImage = null; }
            }
            if (ds._thumbImage) ds.summaryUI.thumbImg.image = ds._thumbImage;
            else ds.summaryUI.thumbImg.image = ds.thumbFile;
        } catch (e) { }
    }

    function syncSummaryRow(ds) {
        // Called frequently from per-doc tab UI while the user edits.
        if (!ds || !ds.summaryUI) return;

        var ui = ds.summaryUI;
        ui._guard = true;

        try { ui.sizeTxt.text = docPxSizeString(ds.doc); } catch (e1) { }
        try { ui.fileTxt.text = getDocFileNameForSummary(ds); } catch (e2) { }

        // Preset dropdown
        try {
            var pk = getDocPresetKey(ds);
            ui.presetDD.selection = indexOfPreset(pk);
        } catch (e3) { }

        // # dropdown
        try {
            var n = digitsOnly(getDocNumberForSummary(ds));
            if (!n) ui.numDD.selection = 0;
            else setDropdownSelectionByText(ui.numDD, n);
        } catch (e4) { }

        // Color dropdown (only rebuild when needed; avoids UI lag)
        try {
            ensureColorDropdownForRow(ds);
            var c = getDocColorForSummary(ds);
            if (!c) ui.colorDD.selection = 0;
            else setDropdownSelectionByText(ui.colorDD, c);
        } catch (e5) { }

        // Desc dropdown (only rebuild when needed; avoids UI lag)
        try {
            ensureDescDropdownForRow(ds);
            var d = getDocDescForSummary(ds);
            if (!d) ui.descDD.selection = 0;
            else setDropdownSelectionByText(ui.descDD, d);
        } catch (e6) { }

        // Enable/disable # dropdown to mirror preset rules.
        // If a doc tab exists, mirror its actual numberInput enabled state.
        // Otherwise compute from preset key (keeps Summary usable even before opening a tab).
        try {
            if (ds.ui && ds.ui.numberInput) {
                ui.numDD.enabled = !!ds.ui.numberInput.enabled;
            } else {
                var pk = getDocPresetKey(ds);
                ui.numDD.enabled = (!isPresetNoNC(pk)) && (isPresetNumOnly(pk) || isPresetNumOrColor(pk));
            }
        } catch (e7) { }

        try { setSummaryThumbnail(ds); } catch (e8) { }
        try { setSummaryHelpTip(ds); } catch (e9) { }
        try { syncSummaryPreview(ds); } catch (e10) { }

        ui._guard = false;
    }

    function addDocToSummaryTable(ds) {
        // Row = X | Thumb | Size | Filename | Preset | # | Color | Description | Container Preview
        var row = sumRows.add("panel", undefined, "");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        row.alignment = ["fill", "top"];
        row.spacing = 6;
        // A little extra padding + panel border makes rows much easier to read/click (Excel-like)
        row.margins = [6, 4, 6, 4];
        try { row.minimumSize.height = SUMMARY_ROW_H; row.maximumSize.height = SUMMARY_ROW_H; } catch (eH) { }

        // X (close) button (first column)
        var btnX = row.add("button", undefined, "x");
        try { btnX.preferredSize = [__sumColW.x, 24]; } catch (eBX) { }

        // Thumbnail
        var thumb = row.add("image", [0, 0, SUMMARY_THUMB_PX, SUMMARY_THUMB_PX]);
        try {
            thumb.preferredSize = [SUMMARY_THUMB_PX, SUMMARY_THUMB_PX];
            thumb.minimumSize = thumb.preferredSize;
            thumb.maximumSize = thumb.preferredSize;
        } catch (eTS) { }

        // Size (use read-only edittext so the whole cell reliably receives clicks in ScriptUI)
        var stSize = row.add("edittext", undefined, docPxSizeString(ds.doc));
        try { stSize.readonly = true; } catch (eRO1) { }

        // Filename (export base file name)
        var stFile = row.add("edittext", undefined, getDocFileNameForSummary(ds));
        try { stFile.readonly = false; } catch (eRO2) { }

        // Preset dropdown
        var ddPreset = row.add("dropdownlist", undefined, PRESET_DROPDOWN_LABELS.slice(0));
        ddPreset.selection = indexOfPreset(getDocPresetKey(ds));

        // # dropdown
        var ddNum = row.add("dropdownlist", undefined, buildRowNumberItems());
        var numV = digitsOnly(getDocNumberForSummary(ds));
        if (numV) setDropdownSelectionByText(ddNum, numV);
        else ddNum.selection = 0;

        // Color dropdown
        var ddColor = row.add("dropdownlist", undefined, ["", "Custom..."]);
        // Desc dropdown
        var ddDesc = row.add("dropdownlist", undefined, ["", "Custom..."]);

        // Container preview (read-only). Statictext is lighter than edittext (faster UI).
        var stPrev = row.add("statictext", undefined, "", { multiline: true });
        try { stPrev.minimumSize.height = SUMMARY_ROW_H - 8; stPrev.maximumSize.height = SUMMARY_ROW_H - 8; } catch (ePH) { }
        try { stPrev.graphics.font = ScriptUI.newFont("dialog", "regular", 8); } catch (ePF) { }

        ds.summaryUI = {
            row: row,
            btnX: btnX,
            thumbImg: thumb,
            sizeTxt: stSize,
            fileTxt: stFile,
            presetDD: ddPreset,
            numDD: ddNum,
            colorDD: ddColor,
            descDD: ddDesc,
            previewTxt: stPrev,
            _guard: false
        };

        // Initial row state (preserve existing selection state when rebuilding rows)
        if (typeof ds._summarySelected !== "boolean") ds._summarySelected = true;

        // Populate color/desc lists (store built category so we don't keep rebuilding)
        rebuildColorDropdownForRow(ds);
        try { ds.summaryUI._colorBuiltCat = _safeLower(String(ds.detectedCategory || "")); } catch (eBC1) { }
        rebuildDescDropdownForRow(ds);
        try { ds.summaryUI._descBuiltCat = _safeLower(String(ds.detectedCategory || "")); } catch (eBC2) { }

        // Apply initial values + thumb (if present)
        syncSummaryRow(ds);
        updateRowVisual(ds);

        // ---- Row selection binding (ANY column click selects row) ----
        function bindSelect(ctrl) {
            if (!ctrl) return;
            try {
                ctrl.addEventListener("mousedown", function (ev) {
                    // ScriptUI can dispatch multiple nested mousedown handlers for a single click.
                    // Mark the event (when possible) so Ctrl-toggle does not cancel itself out.
                    try {
                        if (ev) {
                            if (ev._webpRowSelHandled) return;
                            ev._webpRowSelHandled = true;
                        }
                    } catch (eMark) { }

                    handleRowClick(ds, ev);
                });
            } catch (e) {
                try { ctrl.onClick = function () { handleRowClick(ds); }; } catch (ee) { }
            }
        }

        // Bind selection to every cell/control EXCEPT the close button
        bindSelect(row);
        bindSelect(thumb);
        bindSelect(stSize);
        bindSelect(stFile);
        bindSelect(ddPreset);
        bindSelect(ddNum);
        bindSelect(ddColor);
        bindSelect(ddDesc);
        bindSelect(stPrev);

        // Close action (does NOT affect selection logic)
        btnX.onClick = function () {
            try { removeDocTabAndState(ds); } catch (eC) { }
        };

        // Ensure row selection when controls are activated (keeps multi-select sane)
        ddPreset.onActivate = function () { ensureRowSelectedForControl(ds); };
        ddNum.onActivate = function () { ensureRowSelectedForControl(ds); };
        ddColor.onActivate = function () { ensureRowSelectedForControl(ds); };
        ddDesc.onActivate = function () { ensureRowSelectedForControl(ds); };
        stFile.onActivate = function () { ensureRowSelectedForControl(ds); };

        // Filename edits sync to the doc tab "Base File Name" (the exporter reads ds.ui.nameInput)
        stFile.onChanging = function () {
            if (ds.summaryUI._guard) return;
            ensureRowSelectedForControl(ds);

            var v = "";
            try { v = String(stFile.text || ""); } catch (e0) { v = ""; }

            try {
                if (ds.ui && ds.ui.nameInput) {
                    ds.ui.nameInput.text = v;
                } else {
                    ds.seed.baseName = v;
                }
            } catch (e1) { }

            try {
                if (ds.ui && ds.ui.runThisBtn) {
                    var hasName = !!String(v || "").replace(/^\s+|\s+$/g, "");
                    ds.ui.runThisBtn.enabled = (!__RUN_STATE.running && hasName);
                }
            } catch (e2) { }
        };

        stFile.onChange = function () {
            if (ds.summaryUI._guard) return;
            ensureRowSelectedForControl(ds);

            var v = "";
            try { v = String(stFile.text || ""); } catch (e0) { v = ""; }
            try { v = v.replace(/^\s+|\s+$/g, ""); } catch (eT) { }
            try { stFile.text = v; } catch (eST) { }

            try {
                if (ds.ui && ds.ui.nameInput) {
                    ds.ui.nameInput.text = v;
                    if (ds.ui.nameInput.onChanging) ds.ui.nameInput.onChanging();
                } else {
                    ds.seed.baseName = v;
                    syncSummaryRow(ds);
                }
            } catch (e1) { }
        };

        // Per-row dropdowns update instantly
        ddPreset.onChange = function () {
            if (ds.summaryUI._guard) return;
            ensureRowSelectedForControl(ds);

            var pKey = getSelectedPresetKeyFromDropdown(ddPreset);
            try {
                if (ds.ui && ds.ui.presetDropdown) {
                    ds.ui.presetDropdown.selection = indexOfPreset(pKey);
                    if (ds.ui.presetDropdown.onChange) ds.ui.presetDropdown.onChange();
                } else {
                    ds.seed.presetName = pKey;
                }
            } catch (e) { }

            try { syncSummaryRow(ds); } catch (e2) { }
        };

        ddNum.onChange = function () {
            if (ds.summaryUI._guard) return;
            ensureRowSelectedForControl(ds);

            var t = "";
            try { t = ddNum.selection ? String(ddNum.selection.text) : ""; } catch (e0) { t = ""; }

            if (t === "Custom...") {
                var inp = prompt("Enter a number suffix (#) for:\n" + ds.docName + "\n\nDigits only.", digitsOnly(getDocNumberForSummary(ds)));
                if (inp === null) { syncSummaryRow(ds); return; }
                t = digitsOnly(inp);
            }

            var digits = digitsOnly(t);
            try {
                if (ds.ui && ds.ui.numberInput) {
                    ds.ui.numberInput.text = digits;
                    if (ds.ui.numberInput.onChanging) ds.ui.numberInput.onChanging();
                }
            } catch (e1) { }

            try { syncSummaryRow(ds); } catch (e2) { }
        };

        ddColor.onChange = function () {
            if (ds.summaryUI._guard) return;
            ensureRowSelectedForControl(ds);

            var t = "";
            try { t = ddColor.selection ? String(ddColor.selection.text) : ""; } catch (e0) { t = ""; }

            if (t === "Custom...") {
                var inp = prompt("Enter a color value for:\n" + ds.docName + "\n\nExample: red, blue, 'matte-black', etc.", getDocColorForSummary(ds));
                if (inp === null) { syncSummaryRow(ds); return; }
                t = String(inp);
            }

            var v = normalizeColorValue(t);
            try {
                if (ds.ui && ds.ui.colorInput) {
                    ds.ui.colorInput.text = v;
                    if (ds.ui.colorInput.onChanging) ds.ui.colorInput.onChanging();
                }
            } catch (e1) { }

            try { syncSummaryRow(ds); } catch (e2) { }
        };

        ddDesc.onChange = function () {
            if (ds.summaryUI._guard) return;
            ensureRowSelectedForControl(ds);

            var t = "";
            try { t = ddDesc.selection ? String(ddDesc.selection.text) : ""; } catch (e0) { t = ""; }

            if (t === "Custom...") {
                var inp = prompt("Enter a description for:\n" + ds.docName, getDocDescForSummary(ds));
                if (inp === null) { syncSummaryRow(ds); return; }
                t = String(inp);
            }

            try {
                if (ds.ui && ds.ui.descQuick) {
                    if (!t) ds.ui.descQuick.selection = 0;
                    else {
                        var idx = ensureDropdownHasValue(ds.ui.descQuick, t);
                        ds.ui.descQuick.selection = idx;
                    }
                }
            } catch (e1) { }

            try { syncSummaryRow(ds); } catch (e2) { }
        };

        // Tooltips disabled
        setSummaryHelpTip(ds);
    }



    // Build the Summary rows (default: all selected)
    for (var si = 0; si < docStates.length; si++) {
        docStates[si]._summaryIndex = si;
        addDocToSummaryTable(docStates[si]);
    }

    function reindexSummaryRows() {
        for (var i = 0; i < docStates.length; i++) {
            if (docStates[i]) {
                docStates[i]._summaryIndex = i;
                // Maintain visual order without rebuilding the row UI
                try {
                    if (docStates[i].summaryUI && docStates[i].summaryUI.row) {
                        docStates[i].summaryUI.row.location = [0, i * SUMMARY_ROW_H];
                    }
                } catch (eLoc) { }
                try { updateRowVisual(docStates[i]); } catch (e) { }
            }
        }
    }

    // Faster partial reindex used by bulk close/removals (only rows at/after startIndex need updates)
    function reindexSummaryRowsFrom(startIndex) {
        try { startIndex = Number(startIndex); } catch (e) { startIndex = 0; }
        if (isNaN(startIndex) || startIndex < 0) startIndex = 0;
        if (startIndex > docStates.length) startIndex = docStates.length;

        for (var i = startIndex; i < docStates.length; i++) {
            if (docStates[i]) {
                docStates[i]._summaryIndex = i;
                // Maintain visual order without rebuilding the row UI
                try {
                    if (docStates[i].summaryUI && docStates[i].summaryUI.row) {
                        docStates[i].summaryUI.row.location = [0, i * SUMMARY_ROW_H];
                    }
                } catch (eLoc) { }
                try { updateRowVisual(docStates[i]); } catch (e) { }
            }
        }
    }


    function positionSummaryRows() {
        // Reposition existing row controls to match docStates order.
        // (Used after sorting/resizing to keep columns stable and avoid ScriptUI rebuild freezes.)
        try {
            for (var i = 0; i < docStates.length; i++) {
                var ds = docStates[i];
                if (!ds || !ds.summaryUI || !ds.summaryUI.row) continue;
                var idx = (typeof ds._summaryIndex === "number") ? ds._summaryIndex : i;
                try { ds.summaryUI.row.location = [0, idx * SUMMARY_ROW_H]; } catch (eLoc2) { }
            }
        } catch (e) { }
    }


    // Organize (sort) summary rows on demand
    // Sort order:
    //   1) Color (based on the row's color dropdown order)
    //   2) Description (based on the row's description dropdown order)
    //   3) Preset (based on preset dropdown order)
    //   4) Filename (natural sort: img2 < img10)
    function _findDropdownItemIndexCI(dd, valueText) {
        var v = String(valueText || "");
        if (!v) return 0;
        var tl = _safeLower(v);
        try {
            for (var i = 0; i < dd.items.length; i++) {
                if (_safeLower(dd.items[i].text) === tl) return i;
            }
        } catch (e) { }
        return 9999;
    }

    function _getColorSortIndex(ds) {
        var v = "";
        try { v = String(getDocColorForSummary(ds) || ""); } catch (e0) { v = ""; }
        if (!v) return 0;

        try {
            if (ds && ds.summaryUI && ds.summaryUI.colorDD) return _findDropdownItemIndexCI(ds.summaryUI.colorDD, v);
        } catch (e1) { }

        // Fallback: global list order (rare)
        try {
            var all = getAllColors();
            var tl = _safeLower(v);
            for (var i = 0; i < all.length; i++) if (_safeLower(all[i]) === tl) return i + 1;
        } catch (e2) { }
        return 9999;
    }

    function _getDescSortIndex(ds) {
        var v = "";
        try { v = String(getDocDescForSummary(ds) || ""); } catch (e0) { v = ""; }
        if (!v) return 0;

        try {
            if (ds && ds.summaryUI && ds.summaryUI.descDD) return _findDropdownItemIndexCI(ds.summaryUI.descDD, v);
        } catch (e1) { }

        // Fallback: global list order (rare)
        try {
            var all = getAllDescriptions();
            var tl = _safeLower(v);
            for (var i = 0; i < all.length; i++) if (_safeLower(all[i]) === tl) return i + 1;
        } catch (e2) { }
        return 9999;
    }

    function _getPresetSortIndex(ds) {
        try { return indexOfPreset(getDocPresetKey(ds)); } catch (e) { }
        return 0;
    }

    function _getFileSortName(ds) {
        var name = "";
        try {
            var cfg = collectDocConfig(ds);
            if (cfg && cfg.baseNameFinal) name = String(cfg.baseNameFinal);
        } catch (e0) { name = ""; }

        if (!name) {
            try {
                var root = getDocFileNameForSummary(ds);
                var num = digitsOnly(getDocNumberForSummary(ds));
                if (root && num) name = String(root) + String(num);
                else name = String(root || "");
            } catch (e1) { name = ""; }
        }

        if (!name) {
            try { name = String(stripExtension(ds.docName) || ds.docName || ""); } catch (e2) { name = ""; }
        }

        return name;
    }

    function _naturalCompare(a, b) {
        var as = String(a || "");
        var bs = String(b || "");
        if (as === bs) return 0;

        var re = /(\d+|\D+)/g;
        var ap = as.match(re) || [as];
        var bp = bs.match(re) || [bs];
        var len = Math.max(ap.length, bp.length);

        for (var i = 0; i < len; i++) {
            var ax = ap[i];
            var bx = bp[i];
            if (typeof ax === "undefined") return -1;
            if (typeof bx === "undefined") return 1;

            var aNum = (ax.match(/^\d+$/) !== null);
            var bNum = (bx.match(/^\d+$/) !== null);

            if (aNum && bNum) {
                var an = parseInt(ax, 10);
                var bn = parseInt(bx, 10);
                if (an < bn) return -1;
                if (an > bn) return 1;

                // If values equal, shorter token first (e.g., "2" before "02")
                if (ax.length < bx.length) return -1;
                if (ax.length > bx.length) return 1;
            } else {
                var al = _safeLower(ax);
                var bl = _safeLower(bx);
                if (al < bl) return -1;
                if (al > bl) return 1;

                // tie-break case-sensitive
                if (ax < bx) return -1;
                if (ax > bx) return 1;
            }
        }

        // Final fallback
        var asl = _safeLower(as);
        var bsl = _safeLower(bs);
        if (asl < bsl) return -1;
        if (asl > bsl) return 1;
        return (as < bs) ? -1 : 1;
    }

    function rebuildSummaryRowsUI() {
        // Remove current row controls and rebuild in docStates order.
        try { sumRows.visible = false; } catch (eV0) { }

        for (var i = 0; i < docStates.length; i++) {
            var ds = docStates[i];
            if (!ds) continue;
            try {
                if (ds.summaryUI && ds.summaryUI.row && ds.summaryUI.row.parent) {
                    ds.summaryUI.row.parent.remove(ds.summaryUI.row);
                }
            } catch (eR) { }
            try { ds.summaryUI = null; } catch (eS) { }
        }

        for (var j = 0; j < docStates.length; j++) {
            if (docStates[j]) docStates[j]._summaryIndex = j;
            addDocToSummaryTable(docStates[j]);
        }

        try { sumRows.visible = true; } catch (eV1) { }

        try { reindexSummaryRows(); } catch (eRe) { }
        try { resizeSummaryColumns(true); } catch (eRC) { }
        try { updateSummaryScroll(); } catch (eSc) { }
        try { refreshBulkControlsFromSelection(); } catch (eRB) { }

        try { dlgMain.layout.layout(true); } catch (eL1) { }
        try { dlgMain.layout.resize(); } catch (eL2) { }
    }

    function applySummarySort(sortKey, sortDir) {
        if (!docStates || docStates.length < 2) return;

        var key = _safeLower(String(sortKey || ""));
        var dir = (sortDir === -1) ? -1 : 1;

        var oldScroll = 0;
        try { oldScroll = Number(sumScroll.value) || 0; } catch (eS) { oldScroll = 0; }

        // Preserve Bulk Edit dropdown selections (sorting should not wipe in-progress bulk choices)
        var _bulkState = null;
        try {
            _bulkState = {
                presetIdx: (bulkPresetDD && bulkPresetDD.selection) ? bulkPresetDD.selection.index : 0,
                numText: (bulkNumDD && bulkNumDD.selection) ? String(bulkNumDD.selection.text) : "(no change)",
                colorText: (bulkColorDD && bulkColorDD.selection) ? String(bulkColorDD.selection.text) : "(no change)",
                descText: (bulkDescDD && bulkDescDD.selection) ? String(bulkDescDD.selection.text) : "(no change)"
            };
        } catch (eB0) { _bulkState = null; }

        function _cmpText(a, b) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        }

        function _cmpFile(ka, kb) {
            try { return _naturalCompare(String(ka.fileName || ""), String(kb.fileName || "")); } catch (e) { }
            return 0;
        }

        // Precompute sort keys (faster + avoids repeated ScriptUI reads during sort)
        for (var i = 0; i < docStates.length; i++) {
            var ds = docStates[i];
            if (!ds) continue;

            var cText = ""; var dText = "";
            try { cText = String(getDocColorForSummary(ds) || ""); } catch (e0) { cText = ""; }
            try { dText = String(getDocDescForSummary(ds) || ""); } catch (e1) { dText = ""; }

            var nText = "";
            var nVal = -1;
            try {
                nText = digitsOnly(String(getDocNumberForSummary(ds) || ""));
                if (nText) {
                    nVal = parseInt(nText, 10);
                    if (isNaN(nVal)) nVal = -1;
                }
            } catch (eN) { nVal = -1; }

            var wpx = 0, hpx = 0;
            try {
                if (ds.doc) {
                    wpx = Math.round(Number(ds.doc.width.as("px")));
                    hpx = Math.round(Number(ds.doc.height.as("px")));
                    if (isNaN(wpx)) wpx = 0;
                    if (isNaN(hpx)) hpx = 0;
                }
            } catch (eSz) { wpx = 0; hpx = 0; }

            ds._sortKey = {
                // For X header: selected first
                selectedRank: (ds._summarySelected ? 0 : 1),

                // Size
                w: wpx,
                h: hpx,

                // # (numeric)
                numVal: nVal,

                // Color / Description
                colorIdx: _getColorSortIndex(ds),
                colorText: _safeLower(cText),
                descIdx: _getDescSortIndex(ds),
                descText: _safeLower(dText),

                // Preset
                presetIdx: _getPresetSortIndex(ds),

                // Filename
                fileName: _getFileSortName(ds),

                // Stable tiebreak
                origIndex: i
            };
        }

        docStates.sort(function (a, b) {
            if (!a && !b) return 0;
            if (!a) return 1;
            if (!b) return -1;

            var ka = a._sortKey || { selectedRank: 0, w: 0, h: 0, numVal: -1, colorIdx: 0, colorText: "", descIdx: 0, descText: "", presetIdx: 0, fileName: "", origIndex: 0 };
            var kb = b._sortKey || { selectedRank: 0, w: 0, h: 0, numVal: -1, colorIdx: 0, colorText: "", descIdx: 0, descText: "", presetIdx: 0, fileName: "", origIndex: 0 };

            var c = 0;

            // Normalize aliases: thumb/prev behave like filename sort
            var k = key;
            if (k === "thumb" || k === "prev") k = "file";

            switch (k) {
                case "x":
                    // X header: sort by selection state (selected first)
                    c = ka.selectedRank - kb.selectedRank;
                    if (c) return dir * c;
                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;

                case "size":
                    c = ka.w - kb.w;
                    if (c) return dir * c;
                    c = ka.h - kb.h;
                    if (c) return dir * c;
                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;

                case "num":
                    c = ka.numVal - kb.numVal;
                    if (c) return dir * c;
                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;

                case "preset":
                    c = ka.presetIdx - kb.presetIdx;
                    if (c) return dir * c;

                    // Secondary grouping keeps rows stable + predictable
                    c = ka.colorIdx - kb.colorIdx;
                    if (c) return dir * c;
                    c = _cmpText(ka.colorText, kb.colorText);
                    if (c) return dir * c;

                    c = ka.descIdx - kb.descIdx;
                    if (c) return dir * c;
                    c = _cmpText(ka.descText, kb.descText);
                    if (c) return dir * c;

                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;

                case "desc":
                    c = ka.descIdx - kb.descIdx;
                    if (c) return dir * c;
                    c = _cmpText(ka.descText, kb.descText);
                    if (c) return dir * c;

                    // Secondary grouping
                    c = ka.colorIdx - kb.colorIdx;
                    if (c) return dir * c;
                    c = _cmpText(ka.colorText, kb.colorText);
                    if (c) return dir * c;

                    c = ka.presetIdx - kb.presetIdx;
                    if (c) return dir * c;

                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;

                case "color":
                    // Default "Organize": color → description → preset → filename
                    c = ka.colorIdx - kb.colorIdx;
                    if (c) return dir * c;
                    c = _cmpText(ka.colorText, kb.colorText);
                    if (c) return dir * c;

                    c = ka.descIdx - kb.descIdx;
                    if (c) return dir * c;
                    c = _cmpText(ka.descText, kb.descText);
                    if (c) return dir * c;

                    c = ka.presetIdx - kb.presetIdx;
                    if (c) return dir * c;

                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;

                case "file":
                default:
                    c = _cmpFile(ka, kb);
                    if (c) return dir * c;
                    break;
            }

            // Stable tie-breaker (never reverse this; keeps results predictable)
            return ka.origIndex - kb.origIndex;
        });

        // Cleanup temp keys (keep ds small)
        for (var j = 0; j < docStates.length; j++) {
            try { if (docStates[j]) delete docStates[j]._sortKey; } catch (eD) { }
        }

        // Fast re-order without rebuilding UI (rebuilding can freeze ScriptUI on larger lists)
        try { sumRows.visible = false; } catch (eV0) { }
        try { reindexSummaryRows(); } catch (eRe) { }
        try { sumRows.visible = true; } catch (eV1) { }
        try { positionSummaryRows(); } catch (ePosSort) { }

        // Restore Bulk selections (without triggering bulk apply)
        if (_bulkState) {
            try {
                __bulkGuard = true;

                // Preset by index
                if (bulkPresetDD) {
                    var pi = _bulkState.presetIdx;
                    if (pi < 0) pi = 0;
                    if (pi >= bulkPresetDD.items.length) pi = bulkPresetDD.items.length - 1;
                    bulkPresetDD.selection = pi;
                }

                // # / Color / Desc by text
                if (bulkNumDD) setDropdownSelectionByText(bulkNumDD, _bulkState.numText);
                if (bulkColorDD) setDropdownSelectionByText(bulkColorDD, _bulkState.colorText);
                if (bulkDescDD) setDropdownSelectionByText(bulkDescDD, _bulkState.descText);
            } catch (eBR) { } finally {
                __bulkGuard = false;
            }
        }

        // Restore scroll position (best-effort)
        try {
            sumScroll.value = oldScroll;
        } catch (eRS) { }
        try { updateSummaryScroll(); } catch (eUS) { }

        // Keep shift-range selection anchor sane after reindex
        __lastSelIndex = -1;
        for (var k2 = 0; k2 < docStates.length; k2++) {
            if (docStates[k2] && docStates[k2]._summarySelected) { __lastSelIndex = k2; break; }
        }
    }

    function organizeSummaryRows() {
        // Organize button: group by Color + Description, then Preset, then Filename (ascending)
        try { requestSummarySort("color", false); } catch (e) { }
    }

    function updateSummaryScroll() {
        try {
            // Content height is based on fixed row height (more reliable than sumRows.size in some ScriptUI builds)
            var contentH = (docStates.length * SUMMARY_ROW_H) + 8;
            var viewH = Number(sumViewport.size.height);
            if (isNaN(contentH) || contentH < 0) contentH = 0;
            if (isNaN(viewH) || viewH <= 0) viewH = 1;

            var max = Math.max(0, contentH - viewH);
            sumScroll.maxvalue = max;
            sumScroll.minvalue = 0;

            if (sumScroll.value > max) sumScroll.value = max;

            sumScroll.enabled = (max > 0);
            sumScroll.visible = true;

            // Move content up (negative y)
            // NOTE: In some ScriptUI builds, reading sumRows.location[0] returns undefined (Point vs. Array).
            // Always pin x=0 and only shift y.
            try { sumRows.location = [0, -Math.round(sumScroll.value)]; } catch (eLoc2) { }
        } catch (e) { }
    }

    sumScroll.onChanging = function () { updateSummaryScroll(); };
    sumScroll.onChange = function () { updateSummaryScroll(); };

    // Mouse-wheel scrolling for the Summary table (works even when the scrollbar is narrow).
    function scrollSummaryBy(deltaPx) {
        try {
            if (!sumScroll.enabled) return;
            var v = Number(sumScroll.value) || 0;
            var max = Number(sumScroll.maxvalue) || 0;
            var next = v + Number(deltaPx || 0);
            if (next < 0) next = 0;
            if (next > max) next = max;
            if (next === v) return;
            sumScroll.value = next;
            updateSummaryScroll();
        } catch (e) { }
    }

    function bindMouseWheelScrolling(ctrl) {
        if (!ctrl) return;
        try {
            ctrl.addEventListener("mousewheel", function (ev) {
                // Different hosts expose different wheel fields.
                var dir = 0;
                try {
                    if (typeof ev.wheelDelta !== "undefined") dir = (ev.wheelDelta > 0) ? -1 : 1;
                    else if (typeof ev.deltaY !== "undefined") dir = (ev.deltaY > 0) ? 1 : -1;
                    else if (typeof ev.delta !== "undefined") dir = (ev.delta > 0) ? 1 : -1;
                } catch (e0) { dir = 0; }

                if (dir !== 0) {
                    scrollSummaryBy(dir * SUMMARY_ROW_H);
                    try { if (ev.preventDefault) ev.preventDefault(); } catch (e1) { }
                }
            });
        } catch (e) { }
    }

    // Bind to viewport + body so scrolling works when the mouse is over rows OR blank space.
    bindMouseWheelScrolling(sumViewport);
    bindMouseWheelScrolling(sumRows);
    bindMouseWheelScrolling(sumBody);

    function enforceSummaryLayout() {
        // Goal:
        // - The document rows/table is the primary resizable area (fills available height/width).
        // - Footer panels stay compact and never clip (progress bar stays visible).

        try {
            // Make sure the Summary tab is in true "fill" mode.
            // (ScriptUI can be inconsistent inside tabbed panels across hosts/OS scaling.)
            try { tabSummary.alignment = ["fill", "fill"]; } catch (eA0) { }
            try { tabSummary.alignChildren = ["fill", "fill"]; } catch (eA1) { }

            try { summaryTop.alignment = ["fill", "fill"]; } catch (eB0) { }
            try { summaryTop.alignChildren = ["fill", "fill"]; } catch (eB1) { }

            try { listPanel.alignment = ["fill", "fill"]; } catch (eC0) { }
            try { listPanel.alignChildren = ["fill", "fill"]; } catch (eC1) { }

            try { sumTableWrap.alignment = ["fill", "fill"]; } catch (eD0) { }
            try { sumViewport.alignment = ["fill", "fill"]; } catch (eD1) { }

            // Footer groups should NOT stretch vertically.
            try { selRow.alignment = ["fill", "top"]; } catch (eF0) { }
            try { fixedKbRow.alignment = ["fill", "top"]; } catch (eF1) { }
            try { bulkPanel.alignment = ["fill", "top"]; } catch (eF2) { }
            try { if (sumProgressPanel) sumProgressPanel.alignment = ["fill", "top"]; } catch (eF3) { }
            try { tipRow.alignment = ["fill", "top"]; } catch (eF4) { }

            // Compute an explicit listPanel height so we don't end up with dead space below the footer
            // on hosts that report stale/zero tab sizes.
            function _h(ctrl, fallback) {
                var v = 0;
                if (!ctrl) return (fallback || 0);
                try { v = Number(ctrl.size.height); } catch (e0) { v = 0; }
                if (!v || v <= 0) {
                    try { v = Number(ctrl.preferredSize.height); } catch (e1) { v = 0; }
                }
                if (!v || v <= 0) v = (fallback || 0);
                return v;
            }

            var hTab = _h(tabSummary, 0);
            var hTabs = _h(tabsPanel, 0);
            var hDlg = _h(dlgMain, 0);

            // Use the largest estimate to avoid under-sizing (which creates wasted blank space).
            var h = Math.max(
                hTab,
                (hTabs > 0 ? (hTabs - 20) : 0),
                (hDlg > 0 ? (hDlg - 140) : 0)
            );
            if (!h || h <= 0) h = 560;

            // Reserve heights for everything except listPanel.
            var titleH = _h(summaryTitle, 26);

            // Preferred sizes adapt to UI scaling, which avoids progress bar clipping.
            var selH = _h(selRow, 32);
            var modeH = _h(fixedKbRow, 60);
            var bulkH = _h(bulkPanel, 48);
            var progH = _h(sumProgressPanel, 92);
            var tipH = _h(tipRow, 22);

            // Internal spacing between summaryTitle and listPanel (inside summaryTop).
            var topSpacing = 4;
            try { topSpacing = Number(summaryTop.spacing); } catch (eS0) { topSpacing = 4; }
            if (isNaN(topSpacing) || topSpacing < 0) topSpacing = 4;

            // Spacing between stacked groups in Summary tab.
            var tabSp = 4;
            try { tabSp = Number(tabSummary.spacing); } catch (eS1) { tabSp = 4; }
            if (isNaN(tabSp) || tabSp < 0) tabSp = 4;

            var reserved = titleH + topSpacing + selH + modeH + bulkH + progH + tipH + (tabSp * 5) + 28;

            var listH = Math.max(280, Math.floor(h - reserved));

            try {
                listPanel.minimumSize.height = 280;
                listPanel.preferredSize.height = listH;
                listPanel.maximumSize.height = 100000;
            } catch (e8) { }

        } catch (e) { }
    }


    function resizeSummaryColumns(force) {
        // Called from dlgMain.onResize
        try {
            var doForce = !!force;
            var total = Number(sumViewport.size.width);
            if (isNaN(total) || total <= 0) total = 980;

            // Responsive columns:
            // - Keep the essentials readable at smaller widths (without hard-cutting columns off).
            // - Let Filename + Description receive most of the extra width.
            var minW = { x: 28, thumb: 72, size: 90, file: 160, preset: 170, num: 70, color: 130, desc: 180, prev: 260 };
            var prefW = { x: 28, thumb: 72, size: 110, file: 260, preset: 230, num: 90, color: 200, desc: 300, prev: 420 };

            function sumObj(o) {
                var s = 0;
                for (var k in o) {
                    if (o.hasOwnProperty(k)) s += Number(o[k]) || 0;
                }
                return s;
            }

            var curW = {
                x: prefW.x,
                thumb: prefW.thumb,
                size: prefW.size,
                file: prefW.file,
                preset: prefW.preset,
                num: prefW.num,
                color: prefW.color,
                desc: prefW.desc,
                prev: prefW.prev
            };

            var sumPref = sumObj(prefW);
            var sumMin = sumObj(minW);

            if (total >= sumPref) {
                // Give extra space primarily to Filename + Description + Container Preview.
                var extra = total - sumPref;
                var addFile = Math.floor(extra * 0.28);
                var addDesc = Math.floor(extra * 0.34);
                var addPrev = extra - addFile - addDesc;
                curW.file += addFile;
                curW.desc += addDesc;
                curW.prev += addPrev;
            } else {
                // Shrink down towards minimums, preferring to shrink Description first.
                var shortage = sumPref - total;
                function shrink(key, amt) {
                    var can = Math.max(0, (curW[key] || 0) - (minW[key] || 0));
                    var d = Math.min(can, amt);
                    curW[key] -= d;
                    return amt - d;
                }
                var order = ["desc", "prev", "file", "preset", "color", "size", "num"]; // x/thumb stay fixed
                for (var oi = 0; oi < order.length && shortage > 0; oi++) shortage = shrink(order[oi], shortage);

                // If still short, we are below the hard minimum; clamp to minimums and accept overflow.
                // (In practice, dlgMain.minimumSize prevents this.)
                if (sumObj(curW) < sumMin) {
                    curW.x = minW.x;
                    curW.thumb = minW.thumb;
                    curW.size = minW.size;
                    curW.file = minW.file;
                    curW.preset = minW.preset;
                    curW.num = minW.num;
                    curW.color = minW.color;
                    curW.prev = minW.prev;
                    curW.desc = Math.max(60, total - (minW.x + minW.thumb + minW.size + minW.file + minW.preset + minW.num + minW.color + minW.prev));
                }
            }

            var wX = curW.x;
            var wThumb = curW.thumb;
            var wSize = curW.size;
            var wFile = curW.file;
            var wPreset = curW.preset;
            var wNum = curW.num;
            var wColor = curW.color;
            var wDesc = curW.desc;
            var wPrev = curW.prev;

            // If nothing actually changed width-wise, don't thrash ScriptUI with redundant resize passes.
            try {
                if (!doForce && __sumColsAppliedOnce && __sumColW &&
                    __sumColW.x === wX && __sumColW.thumb === wThumb && __sumColW.size === wSize &&
                    __sumColW.file === wFile && __sumColW.preset === wPreset && __sumColW.num === wNum &&
                    __sumColW.color === wColor && __sumColW.desc === wDesc && __sumColW.prev === wPrev) {
                    try { positionSummaryRows(); } catch (ePos0) { }
                    updateSummaryScroll();
                    return;
                }
            } catch (eSame) { }

            __sumColW = { x: wX, thumb: wThumb, size: wSize, file: wFile, preset: wPreset, num: wNum, color: wColor, desc: wDesc, prev: wPrev };
            __sumColsAppliedOnce = true;

            function _w(ctrl, w) {
                try {
                    ctrl.minimumSize.width = w;
                    ctrl.maximumSize.width = w;
                    ctrl.preferredSize.width = w;
                } catch (e) { }
            }

            _w(hdrX, wX);
            _w(hdrThumb, wThumb);
            _w(hdrSize, wSize);
            _w(hdrFile, wFile);
            _w(hdrPreset, wPreset);
            _w(hdrNum, wNum);
            _w(hdrColor, wColor);
            _w(hdrDesc, wDesc);
            _w(hdrPrev, wPrev);

            // NEW: keep header aligned with the scrollable body by reserving scrollbar width
            try { _w(hdrScrollSpacer, SUMMARY_SCROLL_W); } catch (eSp) { }

            // Apply widths to each row's controls
            var _rowsWasVisible = true;
            var _hdrWasVisible = true;
            try { _rowsWasVisible = sumRows.visible; sumRows.visible = false; } catch (eVis0) { }
            try { _hdrWasVisible = sumHdr.visible; sumHdr.visible = false; } catch (eVis1) { }
            for (var i = 0; i < docStates.length; i++) {
                var ds = docStates[i];
                if (!ds || !ds.summaryUI) continue;

                // Make the row itself fill the viewport so clicks on "empty" space still select the row.
                try {
                    ds.summaryUI.row.minimumSize.width = total;
                    ds.summaryUI.row.maximumSize.width = 10000;
                    ds.summaryUI.row.preferredSize.width = total;
                } catch (eRW) { }

                _w(ds.summaryUI.btnX, wX);
                _w(ds.summaryUI.thumbImg, wThumb);

                _w(ds.summaryUI.sizeTxt, wSize);
                _w(ds.summaryUI.fileTxt, wFile);
                _w(ds.summaryUI.presetDD, wPreset);
                _w(ds.summaryUI.numDD, wNum);
                _w(ds.summaryUI.colorDD, wColor);
                _w(ds.summaryUI.descDD, wDesc);
                _w(ds.summaryUI.previewTxt, wPrev);

                try { ds.summaryUI.row.minimumSize.height = SUMMARY_ROW_H; ds.summaryUI.row.maximumSize.height = SUMMARY_ROW_H; } catch (eH) { }
            }

            // Restore visibility after bulk resize
            try { sumHdr.visible = _hdrWasVisible; } catch (eVis2) { }
            try { sumRows.visible = _rowsWasVisible; } catch (eVis3) { }
            try { sumHdr.layout.layout(true); sumRows.layout.layout(true); } catch (eVis4) { }
            try { positionSummaryRows(); } catch (ePos1) { }

            updateSummaryScroll();
        } catch (e) { }
    }


    // Initial sizing pass (best-effort; will finalize once the dialog is shown/resized).
    resizeSummaryColumns();

    // --- Selection controls + bulk editor ---
    // IMPORTANT: These must NOT be inside summaryTop, otherwise listPanel cannot reliably expand.
    // They belong directly under tabSummary so the listPanel is the main resizable region.

    var selRow = tabSummary.add("group");
    selRow.orientation = "row";
    selRow.alignChildren = ["left", "center"];
    selRow.alignment = ["fill", "top"];
    selRow.spacing = 6;
    // Compact margins keeps the footer tight without cramping the controls.
    selRow.margins = [0, 2, 0, 0];

    var btnSelAll = selRow.add("button", undefined, "Select All");
    var btnSelNone = selRow.add("button", undefined, "Select None");
    var btnActivateSel = selRow.add("button", undefined, "Activate");
    var btnGoToTab = selRow.add("button", undefined, "Go To Tab");
    var btnCloseSel = selRow.add("button", undefined, "Close Selected");
    var btnOrganize = selRow.add("button", undefined, "Organize");

    // Spacer pushes Run buttons to the right (keeps this footer row compact/organized)
    var _selSpacer = selRow.add("statictext", undefined, "");
    _selSpacer.alignment = ["fill", "fill"];

    var chkFixedKB = selRow.add("checkbox", undefined, "Fixed KB");
    chkFixedKB.value = false;

    var btnRunSelected = selRow.add("button", undefined, "Run Selected");
    var btnRunAll = selRow.add("button", undefined, "Run All");

    // Tooltips disabled (you asked for none)
    try { btnRunAll.helpTip = ""; } catch (eHT1) { }
    try { btnRunSelected.helpTip = ""; } catch (eHT2) { }
    try { chkFixedKB.helpTip = ""; } catch (eHT3) { }

    // Fixed KB explanation (shown under the Run buttons)
    var fixedKbRow = tabSummary.add("group");
    fixedKbRow.orientation = "column";
    fixedKbRow.alignChildren = ["fill", "top"];
    fixedKbRow.alignment = ["fill", "top"];
    fixedKbRow.margins = [0, 0, 0, 0];
    fixedKbRow.spacing = 2;

    var fixedKbText = fixedKbRow.add("statictext", undefined, "", { multiline: true });
    fixedKbText.alignment = ["fill", "top"];
    try { fixedKbText.graphics.font = ScriptUI.newFont("dialog", "regular", 10); } catch (eFT) { }

    function updateFixedKBHelp() {
        var on = !!chkFixedKB.value;
        var t = "";
        t += "Biggest remaining cost (FYI):\n";
        t += "• W/H \"Target KB\" = binary search → multiple WebP encodes per version.\n";
        if (on) {
            t += "• Fixed KB ON = Speed Mode (fixed Quality per suffix) → much faster; sizes vary.\n";
        } else {
            t += "• Fixed KB OFF = strict KB caps (slow) → best quality under a KB cap.\n";
        }
        t += "Edit per-suffix values via Versions (W/H).";
        fixedKbText.text = t;
    }

    var __fixedKB_sync_guard = false;
    function setGlobalFixedKBValue(val) {
        if (__fixedKB_sync_guard) return;
        __fixedKB_sync_guard = true;
        try { chkFixedKB.value = !!val; } catch (e0) { }
        try { updateFixedKBHelp(); } catch (e1) { }
        try {
            for (var i = 0; i < docStates.length; i++) {
                var ds = docStates[i];
                if (ds && ds.ui && ds.ui.chkFixedKBDoc) ds.ui.chkFixedKBDoc.value = !!val;
            }
        } catch (e2) { }
        __fixedKB_sync_guard = false;
    }

    chkFixedKB.onClick = function () { setGlobalFixedKBValue(chkFixedKB.value); };
    updateFixedKBHelp();


    btnSelAll.onClick = function () {
        for (var i = 0; i < docStates.length; i++) {
            if (docStates[i]) { docStates[i]._summarySelected = true; updateRowVisual(docStates[i]); }
        }
        refreshBulkControlsFromSelection();
    };
    btnSelNone.onClick = function () { clearAllSelections(false); };

    btnActivateSel.onClick = function () {
        try {
            var states = getSelectedDocStatesFromSummary();
            if (!states.length) { alert("Select a document in the Summary list."); return; }
            var ds = states[0];
            if (ds && ds.doc && isDocAlive(ds.doc)) app.activeDocument = ds.doc;
        } catch (e) { }
    };

    btnGoToTab.onClick = function () {
        try {
            var states = getSelectedDocStatesFromSummary();
            if (!states.length) { alert("Select a document in the Summary list."); return; }
            var ds = states[0];
            if (ds && ds.tab) tabsPanel.selection = ds.tab;
        } catch (e) { }
    };

    btnCloseSel.onClick = function () {
        try {
            var states = getSelectedDocStatesFromSummary();
            if (!states.length) { alert("Select one or more documents to close."); return; }

            var msg = "Close " + states.length + " document" + (states.length === 1 ? "" : "s") + " in Photoshop?\n\nUnsaved changes will be lost.";
            if (!confirm(msg)) return;

            // Close from the end down so index-based removals stay valid during a batch (much faster)
            try {
                states.sort(function (a, b) {
                    var ia = -1, ib = -1;
                    try { ia = Number(a && a._summaryIndex); } catch (eA) { ia = -1; }
                    try { ib = Number(b && b._summaryIndex); } catch (eB) { ib = -1; }
                    if (isNaN(ia)) ia = -1;
                    if (isNaN(ib)) ib = -1;
                    return ib - ia;
                });
            } catch (eSort) { }

            _beginCloseBatch();
            try {
                for (var j = 0; j < states.length; j++) {
                    removeDocTabAndState(states[j], { skipConfirm: true });
                }
            } catch (eInner) { }
            _endCloseBatch();
        } catch (e) {
            // Ensure the UI isn't left in a hidden/batched state on error
            try { _endCloseBatch(); } catch (eEnd) { }
        }
    };

    btnOrganize.onClick = function () {
        try { organizeSummaryRows(); } catch (e) { }
    };

    // Bulk edit controls (LIVE - applies immediately when dropdowns change)
    var bulkPanel = tabSummary.add("panel", undefined, "Bulk Edit Selected");
    bulkPanel.orientation = "row";
    bulkPanel.alignChildren = ["left", "center"];
    bulkPanel.alignment = ["fill", "top"];
    // Tighter margins keep this panel compact and prevent large empty padding.
    bulkPanel.margins = [10, 6, 10, 6];

    bulkPanel.add("statictext", undefined, "Preset:");
    var bulkPresetDD = bulkPanel.add("dropdownlist", undefined, ["(no change)"].concat(PRESET_DROPDOWN_LABELS));
    bulkPresetDD.minimumSize.width = 220;
    bulkPresetDD.selection = 0;

    bulkPanel.add("statictext", undefined, "#:");
    var bulkNumDD = bulkPanel.add("dropdownlist", undefined, ["(no change)", "(clear)", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Custom..."]);
    bulkNumDD.minimumSize.width = 120;
    bulkNumDD.selection = 0;

    bulkPanel.add("statictext", undefined, "Color:");
    var bulkColorDD = bulkPanel.add("dropdownlist", undefined, ["(no change)", "(clear)"]);
    bulkColorDD.minimumSize.width = 200;
    bulkColorDD.selection = 0;

    bulkPanel.add("statictext", undefined, "Desc:");
    var bulkDescDD = bulkPanel.add("dropdownlist", undefined, ["(no change)", "(clear)"]);
    bulkDescDD.minimumSize.width = 360;
    bulkDescDD.selection = 0;

    var btnClearBulk = bulkPanel.add("button", undefined, "Reset");

    // Guard to prevent live-apply from firing while we are programmatically updating UI
    var __bulkGuard = false;

    // (everything below stays exactly as you already had it)


    function uniquePushCI(map, outArr, val) {
        var v = String(val || "");
        if (!v) return;
        var k = _safeLower(v);
        if (!k) return;
        if (map[k]) return;
        map[k] = true;
        outArr.push(v);
    }

    function buildUnionColorsForSelection(states) {
        var seen = {};
        var out = [];
        var catCache = {}; // key(lowercat) -> array

        for (var i = 0; i < states.length; i++) {
            var ds = states[i];
            if (!ds) continue;

            var cat = "";
            try { cat = String(ds.detectedCategory || ""); } catch (e) { cat = ""; }
            var ckey = _safeLower(cat);

            // Pull the category list once per unique category for this refresh
            var arr = catCache[ckey];
            if (arr === undefined) {
                try { arr = getColorsForCategory(cat); } catch (e1) { arr = []; }
                catCache[ckey] = arr;
            }

            try {
                for (var j = 0; j < arr.length; j++) uniquePushCI(seen, out, arr[j]);
            } catch (e2) { }

            // Ensure current doc value is always present (even if it's a custom value)
            try { uniquePushCI(seen, out, getDocColorForSummary(ds)); } catch (e3) { }
        }
        return out;
    }

    function buildUnionDescsForSelection(states) {
        var seen = {};
        var out = [];
        var catCache = {}; // key(lowercat) -> array

        for (var i = 0; i < states.length; i++) {
            var ds = states[i];
            if (!ds) continue;

            var cat = "";
            try { cat = String(ds.detectedCategory || ""); } catch (e) { cat = ""; }
            var ckey = _safeLower(cat);

            // Pull the category list once per unique category for this refresh
            var arr = catCache[ckey];
            if (arr === undefined) {
                try { arr = getDescriptionsForCategory(cat); } catch (e1) { arr = []; }
                catCache[ckey] = arr;
            }

            try {
                for (var j = 0; j < arr.length; j++) uniquePushCI(seen, out, arr[j]);
            } catch (e2) { }

            // Ensure current doc value is always present (even if it's a custom value)
            try { uniquePushCI(seen, out, getDocDescForSummary(ds)); } catch (e3) { }
        }
        return out;
    }

    function buildNumbersForSelection(states) {
        // Always include 1–10, plus any currently-used numbers (so single-select mirrors properly).
        var seen = {};
        var out = [];
        for (var i = 1; i <= 10; i++) {
            var s = String(i);
            seen[s] = true;
            out.push(s);
        }
        for (var j = 0; j < states.length; j++) {
            var ds = states[j];
            if (!ds) continue;
            var n = "";
            try { n = digitsOnly(getDocNumberForSummary(ds)); } catch (e) { n = ""; }
            if (!n) continue;
            if (seen[n]) continue;
            seen[n] = true;
            out.push(n);
        }
        return out;
    }

    function setBulkDropdownItems(dd, items, keepTopCount) {
        // keepTopCount preserves the top N items (usually "(no change)" and optionally "(clear)").
        try {
            var keep = Number(keepTopCount || 0);
            if (isNaN(keep) || keep < 0) keep = 0;
            while (dd.items.length > keep) dd.remove(dd.items[dd.items.length - 1]);
            if (items && items.length) {
                for (var i = 0; i < items.length; i++) dd.add("item", String(items[i]));
            }
        } catch (e) { }
        try { dd.selection = 0; } catch (e2) { }
    }

    function setBulkNumDropdownItems(dd, nums) {
        try { while (dd.items.length) dd.remove(dd.items[0]); } catch (e0) { }
        dd.add("item", "(no change)");
        dd.add("item", "(clear)");
        if (nums && nums.length) {
            for (var i = 0; i < nums.length; i++) dd.add("item", String(nums[i]));
        }
        dd.add("item", "Custom...");
        try { dd.selection = 0; } catch (e1) { }
    }

    function findDropdownIndexByText(dd, txtVal, startIdx) {
        var t = String(txtVal || "");
        if (!t) return 0;
        var tl = _safeLower(t);
        var start = (typeof startIdx === "number") ? startIdx : 0;
        if (start < 0) start = 0;
        try {
            for (var i = start; i < dd.items.length; i++) {
                if (_safeLower(dd.items[i].text) === tl) return i;
            }
        } catch (e) { }
        return 0;
    }

    function refreshBulkControlsFromSelection() {
        var states = getSelectedDocStatesFromSummary();

        __bulkGuard = true;

        // Refresh dropdown options (colors/descs/numbers) based on selected rows
        var colors = buildUnionColorsForSelection(states);
        var descs = buildUnionDescsForSelection(states);
        var nums = buildNumbersForSelection(states);

        setBulkNumDropdownItems(bulkNumDD, nums);
        setBulkDropdownItems(bulkColorDD, colors, 2);
        setBulkDropdownItems(bulkDescDD, descs, 2);

        // If exactly one row is selected, mirror its values to the bulk controls (handy for quick edits).
        if (states.length === 1) {
            var ds = states[0];

            // Preset
            var pk = getDocPresetKey(ds);
            try { bulkPresetDD.selection = indexOfPreset(pk) + 1; } catch (eP) { bulkPresetDD.selection = 0; }

            // Number
            var nv = "";
            try { nv = digitsOnly(getDocNumberForSummary(ds)); } catch (eN) { nv = ""; }
            try { bulkNumDD.selection = nv ? findDropdownIndexByText(bulkNumDD, nv, 2) : 0; } catch (eND) { bulkNumDD.selection = 0; }

            // Color
            var cv = "";
            try { cv = String(getDocColorForSummary(ds) || ""); } catch (eC) { cv = ""; }
            try { bulkColorDD.selection = cv ? findDropdownIndexByText(bulkColorDD, cv, 2) : 0; } catch (eCD) { bulkColorDD.selection = 0; }

            // Description
            var dv = "";
            try { dv = String(getDocDescForSummary(ds) || ""); } catch (eD) { dv = ""; }
            try { bulkDescDD.selection = dv ? findDropdownIndexByText(bulkDescDD, dv, 2) : 0; } catch (eDD) { bulkDescDD.selection = 0; }
        } else {
            // Multiple rows: default to no-change controls (predictable).
            try { bulkPresetDD.selection = 0; } catch (e1) { }
            try { bulkNumDD.selection = 0; } catch (e2) { }
            try { bulkColorDD.selection = 0; } catch (e4) { }
            try { bulkDescDD.selection = 0; } catch (e6) { }
        }

        __bulkGuard = false;
    }

    function ensureDropdownHasValue(dd, val) {
        var v = String(val || "");
        if (!v) return 0;
        try {
            for (var i = 0; i < dd.items.length; i++) {
                if (_safeLower(dd.items[i].text) === _safeLower(v)) return i;
            }
            dd.add("item", v);
            return dd.items.length - 1;
        } catch (e) { }
        return 0;
    }

    function applyBulkLiveFromControls() {
        if (__bulkGuard) return;

        var states = getSelectedDocStatesFromSummary();
        if (!states.length) return;

        // Determine bulk edits ("(no change)" = no change; "(clear)" = clear)
        var presetKey = "";
        try {
            if (bulkPresetDD.selection && bulkPresetDD.selection.index > 0) {
                presetKey = String(PRESET_BASENAMES[bulkPresetDD.selection.index - 1]);
            }
        } catch (eP) { presetKey = ""; }

        var numMode = "NOCHANGE";
        var numVal = "";
        try {
            if (bulkNumDD.selection) {
                var t = String(bulkNumDD.selection.text);
                if (t === "Custom...") {
                    var inp = prompt("Enter a number suffix (#) to apply to " + states.length + " selected item(s):", "");
                    if (inp === null) t = "(no change)";
                    else t = digitsOnly(inp);
                }
                if (t === "(clear)") numMode = "CLEAR";
                else if (t !== "(no change)") { numMode = "SET"; numVal = digitsOnly(t); }
            }
        } catch (eN) { }

        var colorMode = "NOCHANGE";
        var colorVal = "";
        try {
            if (bulkColorDD.selection) {
                var ct = String(bulkColorDD.selection.text);
                if (ct === "(clear)") colorMode = "CLEAR";
                else if (ct !== "(no change)") { colorMode = "SET"; colorVal = normalizeColorValue(ct); }
            }
        } catch (eC) { }

        var descMode = "NOCHANGE";
        var descVal = "";
        try {
            if (bulkDescDD.selection) {
                var dt = String(bulkDescDD.selection.text);
                if (dt === "(clear)") descMode = "CLEAR";
                else if (dt !== "(no change)") { descMode = "SET"; descVal = dt; }
            }
        } catch (eD) { }

        // Nothing to do
        if (!presetKey && numMode === "NOCHANGE" && colorMode === "NOCHANGE" && descMode === "NOCHANGE") return;

        __bulkGuard = true;

        // Apply to each selected doc state (update the actual per-doc UI so exports reflect it)
        for (var i = 0; i < states.length; i++) {
            var ds = states[i];
            if (!ds || !ds.ui) continue;

            // Preset
            if (presetKey) {
                try {
                    if (ds.ui.presetDropdown) {
                        ds.ui.presetDropdown.selection = indexOfPreset(presetKey);
                        if (ds.ui.presetDropdown.onChange) ds.ui.presetDropdown.onChange();
                    }
                } catch (e1) { }
            }

            // Number
            if (numMode !== "NOCHANGE") {
                try {
                    if (ds.ui.numberInput) {
                        ds.ui.numberInput.text = (numMode === "CLEAR") ? "" : String(numVal || "");
                        if (ds.ui.numberInput.onChanging) ds.ui.numberInput.onChanging();
                    }
                } catch (e2) { }
            }

            // Color
            if (colorMode !== "NOCHANGE") {
                try {
                    if (ds.ui.colorInput) {
                        ds.ui.colorInput.text = (colorMode === "CLEAR") ? "" : String(colorVal || "");
                        if (ds.ui.colorInput.onChanging) ds.ui.colorInput.onChanging();
                    }
                } catch (e3) { }
            }

            // Description
            if (descMode !== "NOCHANGE") {
                try {
                    if (ds.ui.descQuick) {
                        if (descMode === "CLEAR") {
                            ds.ui.descQuick.selection = 0;
                        } else {
                            var idx = ensureDropdownHasValue(ds.ui.descQuick, descVal);
                            ds.ui.descQuick.selection = idx;
                        }
                    }
                } catch (e4) { }
            }

            // Refresh summary row display (dropdowns + text + thumb)
            try { syncSummaryRow(ds); } catch (e5) { }
        }

        __bulkGuard = false;
    }

    // Live-apply when dropdowns change (no Apply button)
    bulkPresetDD.onChange = applyBulkLiveFromControls;
    bulkNumDD.onChange = applyBulkLiveFromControls;
    bulkColorDD.onChange = applyBulkLiveFromControls;
    bulkDescDD.onChange = applyBulkLiveFromControls;

    btnClearBulk.onClick = function () {
        __bulkGuard = true;
        try { bulkPresetDD.selection = 0; } catch (e1) { }
        try { bulkNumDD.selection = 0; } catch (e2) { }
        try { bulkColorDD.selection = 0; } catch (e4) { }
        try { bulkDescDD.selection = 0; } catch (e6) { }
        __bulkGuard = false;
    };

    // Prime bulk options based on initial selection (defaults to all rows selected).
    try { refreshBulkControlsFromSelection(); } catch (eInit) { }

    // Ensure scrollbar is correct after the UI lays out.
    try { updateSummaryScroll(); } catch (eSc) { }

    // ────────────────────────────────────────────────────────────
    // SUMMARY PROGRESS (window stays open; visible for Run All/Selected)
    // ────────────────────────────────────────────────────────────
    var sumProgressPanel = tabSummary.add("panel", undefined, "Progress");
    sumProgressPanel.orientation = "column";
    sumProgressPanel.alignChildren = ["fill", "top"];
    sumProgressPanel.alignment = ["fill", "top"];
    try { sumProgressPanel.margins = [10, 8, 10, 10]; } catch (ePM0) { }
    try { sumProgressPanel.spacing = 6; } catch (ePM1) { }

    // Status row (left) + percent (right)
    var sumProgHeader = sumProgressPanel.add("group");
    sumProgHeader.orientation = "row";
    sumProgHeader.alignChildren = ["fill", "center"];
    sumProgHeader.alignment = ["fill", "top"];
    sumProgHeader.margins = [0, 0, 0, 0];
    sumProgHeader.spacing = 8;

    var sumProgLine1 = sumProgHeader.add("statictext", undefined, "Idle — ready to run.");
    sumProgLine1.alignment = ["fill", "center"];
    try { sumProgLine1.graphics.font = ScriptUI.newFont("dialog", "bold", 11); } catch (ePF1) { }

    var sumProgPct = sumProgHeader.add("statictext", undefined, "0%");
    sumProgPct.alignment = ["right", "center"];
    try { sumProgPct.justification = "right"; } catch (ePF1b) { }
    try { sumProgPct.characters = 5; } catch (ePF1c) { } // keeps layout stable (e.g.,  9% vs 100%)
    try { sumProgPct.graphics.font = ScriptUI.newFont("dialog", "bold", 10); } catch (ePF1d) { }

    var sumProgBar = sumProgressPanel.add("progressbar", undefined, 0, 100);
    sumProgBar.alignment = ["fill", "center"];
    try { sumProgBar.value = 0; } catch (ePB2) { }

    var sumProgLine2 = sumProgressPanel.add("statictext", undefined, "Images: 0/0 (0 pending)");
    try { sumProgLine2.graphics.font = ScriptUI.newFont("dialog", "regular", 10); } catch (ePF2) { }

    // Compact inline tips (keeps the document list tall + avoids wasted footer space)
    var tipRow = tabSummary.add("group");
    tipRow.orientation = "row";
    tipRow.alignChildren = ["left", "center"];
    tipRow.alignment = ["fill", "top"];
    tipRow.margins = [0, 0, 0, 0];
    tipRow.spacing = 8;

    var tipText = tipRow.add("statictext", undefined, "Tip: Shift+Run saves in the parent folder • Fixed KB toggles Target-KB vs Fixed-Quality mode • After Run, you can edit Versions (W/H).");
    tipText.alignment = ["fill", "center"];
    try { tipText.graphics.font = ScriptUI.newFont("dialog", "regular", 10); } catch (eTF) { }



    function getShiftState() {
        try { return !!ScriptUI.environment.keyboardState.shiftKey; } catch (e) { }
        return false;
    }

    function buildRunItemsFromDocStates(list) {
        var items = [];
        var missing = [];
        for (var i = 0; i < list.length; i++) {
            var ds = list[i];
            if (!ds || !ds.doc || !isDocAlive(ds.doc)) continue;

            var cfg = collectDocConfig(ds);
            if (!cfg) {
                missing.push(ds.docName);
            } else {
                items.push({ docState: ds, docRef: ds.doc, docName: ds.docName, cfg: cfg });
            }
        }
        if (missing.length) {
            alert("These documents are missing a Base File Name:\n\n• " + missing.join("\n• "));
            return null;
        }
        return items;
    }

    function buildRunItemsFromSelectedSummary() {
        // Use the Summary table's custom selection model
        try { return getSelectedDocStatesFromSummary(); } catch (e) { }
        return [];
    }

    // ────────────────────────────────────────────────────────────
    // Progress helpers (Summary + per-doc tabs)
    // ────────────────────────────────────────────────────────────

    function _trimText(s) {
        try { return String(s || "").replace(/^\s+|\s+$/g, ""); } catch (e) { }
        return "";
    }

    function _pad2(n) {
        n = Number(n) || 0;
        return (n < 10 ? "0" : "") + String(n);
    }

    function formatDuration(ms) {
        var t = Number(ms) || 0;
        if (t < 0) t = 0;
        var s = Math.floor(t / 1000);
        var h = Math.floor(s / 3600);
        s = s - (h * 3600);
        var m = Math.floor(s / 60);
        s = s - (m * 60);
        if (h > 0) return h + ":" + _pad2(m) + ":" + _pad2(s);
        return m + ":" + _pad2(s);
    }

    function _safeSetText(ctrl, txt) {
        try {
            if (!ctrl) return;
            var s = String(txt);
            // Avoid redundant assignments (reduces ScriptUI redraw/flicker during long runs)
            try { if (ctrl.text === s) return; } catch (eCmp) { }
            ctrl.text = s;
        } catch (e) { }
    }

    function _safeSetProgress(pb, value, max) {
        try {
            if (!pb) return;
            if (typeof max === "number" && max > 0) {
                try { pb.maxvalue = max; } catch (eMax) { }
            }
            var v = Number(value) || 0;
            try {
                var mx = Number(pb.maxvalue);
                if (!isNaN(mx) && mx > 0 && v > mx) v = mx;
            } catch (eClamp) { }
            if (v < 0) v = 0;
            pb.value = v;
        } catch (e) { }
    }

    function uiPulse() {
        // Best-effort: repaint ScriptUI while processing.
        // (Photoshop/ExtendScript runs on a single thread, so the UI will still be blocked
        //  during heavy operations, but this keeps the progress display responsive between steps.)
        try { dlgMain.update(); } catch (e0) { }
        try { $.sleep(1); } catch (e1) { }
    }

    function _progressPercentText(value, max) {
        var v = Number(value);
        var m = Number(max);
        try { if (!isFinite(v) || isNaN(v)) v = 0; } catch (eV) { v = 0; }
        try { if (!isFinite(m) || isNaN(m) || m <= 0) return "—"; } catch (eM) { return "—"; }
        var pct = Math.round((v / m) * 100);
        if (pct < 0) pct = 0;
        if (pct > 100) pct = 100;
        return pct + "%";
    }

    function setSummaryProgress(line1, line2, value, max) {
        _safeSetText(sumProgLine1, line1);
        _safeSetText(sumProgLine2, line2);
        _safeSetProgress(sumProgBar, value, max);

        // Status percent label + hover tooltips (useful when the window is narrow)
        try {
            var mx = (typeof max === "number" && max > 0) ? max : (sumProgBar ? Number(sumProgBar.maxvalue) : 0);
            _safeSetText(sumProgPct, _progressPercentText(value, mx));
        } catch (ePct) { }
        try { if (sumProgLine1) sumProgLine1.helpTip = String(line1 || ""); } catch (eHT1) { }
        try { if (sumProgLine2) sumProgLine2.helpTip = String(line2 || ""); } catch (eHT2) { }
        try { if (sumProgPct) sumProgPct.helpTip = "Overall completion"; } catch (eHT3) { }
    }

    function setDocProgress(ds, line1, line2, value, max) {
        try {
            if (!ds || !ds.ui) return;
            _safeSetText(ds.ui.docProgLine1, line1);
            _safeSetText(ds.ui.docProgLine2, line2);
            _safeSetProgress(ds.ui.docProgBar, value, max);

            try {
                var mx = (typeof max === "number" && max > 0) ? max : (ds.ui.docProgBar ? Number(ds.ui.docProgBar.maxvalue) : 0);
                _safeSetText(ds.ui.docProgPct, _progressPercentText(value, mx));
            } catch (eDPct) { }

            try { if (ds.ui.docProgLine1) ds.ui.docProgLine1.helpTip = String(line1 || ""); } catch (eDHT1) { }
            try { if (ds.ui.docProgLine2) ds.ui.docProgLine2.helpTip = String(line2 || ""); } catch (eDHT2) { }
            try { if (ds.ui.docProgPct) ds.ui.docProgPct.helpTip = "Document completion"; } catch (eDHT3) { }
        } catch (e) { }
    }

    function setRunUiEnabled(enabled) {
        var on = !!enabled;
        try { btnRunAll.enabled = on; } catch (e0) { }
        try { btnRunSelected.enabled = on; } catch (e1) { }
        try { btnOrganize.enabled = on; } catch (e2) { }
        try { chkFixedKB.enabled = on; } catch (e3) { }

        // Per-doc Run buttons
        try {
            for (var i = 0; i < docStates.length; i++) {
                var ds = docStates[i];
                if (!ds || !ds.ui || !ds.ui.runThisBtn) continue;
                var hasName = false;
                try { hasName = !!_trimText(ds.ui.nameInput.text).length; } catch (eN) { hasName = false; }
                ds.ui.runThisBtn.enabled = (on && hasName);
                try { if (ds.ui.chkFixedKBDoc) ds.ui.chkFixedKBDoc.enabled = on; } catch (eFK) { }
            }
        } catch (e4) { }
    }

    // Main runner (keeps the window open, updates progress in Summary + the doc tab)
    function runBatch(runItems, shiftIsDown, useFixedKB, runLabel) {
        if (__RUN_STATE.running) {
            alert("A run is already in progress.");
            return;
        }
        if (!runItems || !runItems.length) {
            alert("No documents to run.");
            return;
        }

        // Guard: Native WebP saving requires Photoshop 23.2+.
        if (!supportsNativeWebP()) {
            var vInfo = getPhotoshopVersionInfo();
            alert("This script requires native WebP support (Photoshop 23.2+).\nDetected Photoshop version: " + vInfo.raw + "\n\nUpdate Photoshop to 23.2+ (Creative Cloud Desktop > Updates) or use the WebPShop plug-in on older versions.\n\nNo files were exported.");
            try { setSummaryProgress("Cannot run — WebP not supported.", "Update Photoshop to 23.2+.", 0, 1); } catch (eP) { }
            return;
        }

        // Determine which version set dialogs are needed
        var needW = false, needH = false;
        for (var ri = 0; ri < runItems.length; ri++) {
            var c = runItems[ri] ? runItems[ri].cfg : null;
            if (c && c.containerSetType === "W") needW = true;
            if (c && c.containerSetType === "H") needH = true;
        }

        var versW = null, versH = null;
        if (needW) {
            versW = promptVersionsDialog("W", versionsW, { useFixedQuality: !!useFixedKB });
            if (!versW) {
                setSummaryProgress("Run cancelled.", "(Versions dialog closed)", 0, 1);
                return;
            }
        }
        if (needH) {
            versH = promptVersionsDialog("H", versionsH, { useFixedQuality: !!useFixedKB });
            if (!versH) {
                setSummaryProgress("Run cancelled.", "(Versions dialog closed)", 0, 1);
                return;
            }
        }

        // Compute counts + pre-init progress bars
        var totalImages = 0;
        for (var ci = 0; ci < runItems.length; ci++) {
            var it0 = runItems[ci];
            var c0 = it0 ? it0.cfg : null;
            var vers0 = (c0 && c0.containerSetType === "W") ? versW : versH;
            var docTotal0 = 2 + ((vers0 && vers0.length) ? vers0.length : 0);
            it0.__vers = vers0;
            it0.__docTotal = docTotal0;
            totalImages += docTotal0;

            try {
                setDocProgress(it0.docState,
                    "Queued…",
                    "Images: 0/" + docTotal0 + " (" + docTotal0 + " pending)",
                    0,
                    docTotal0
                );
            } catch (eQ) { }
        }

        // Activate run state
        __RUN_STATE.running = true;
        __RUN_STATE.runSeq++;
        var runSeq = __RUN_STATE.runSeq;
        var log = [];
        __RUN_STATE.lastLog = log;

        setRunUiEnabled(false);

        var label = _trimText(runLabel) || "Run";
        var startedAt = new Date().getTime();
        var overallDone = 0;

        function updateSummary(docIndex, docName, currentFile) {
            var elapsed = (new Date().getTime() - startedAt);
            var pending = totalImages - overallDone;
            if (pending < 0) pending = 0;
            var etaMs = 0;
            if (overallDone > 0 && pending > 0) etaMs = Math.round((elapsed / overallDone) * pending);

            var line1 = label + " — Doc " + docIndex + "/" + runItems.length;
            if (docName) line1 += ": " + docName;
            if (currentFile) line1 += "  •  " + currentFile;

            var line2 = "Images: " + overallDone + "/" + totalImages + " (" + pending + " pending)";
            line2 += "  •  Elapsed " + formatDuration(elapsed);
            if (overallDone > 0 && pending > 0) line2 += "  •  ETA " + formatDuration(etaMs);

            setSummaryProgress(line1, line2, overallDone, totalImages);
        }

        try {
            setSummaryProgress(label + " — starting…", "Images: 0/" + totalImages + " (" + totalImages + " pending)", 0, totalImages);
            uiPulse();

            // Execute
            for (var rj = 0; rj < runItems.length; rj++) {
                // If a new run was started somehow, abort this one (safety).
                if (runSeq !== __RUN_STATE.runSeq) break;

                var it = runItems[rj];
                var docIndex = rj + 1;

                // If the source doc is gone, count its expected images as "done (skipped)" so the
                // progress bars still finish cleanly and pending counts go to zero.
                if (!it || !it.docRef || !isDocAlive(it.docRef)) {
                    var skipTotal = 0;
                    try { skipTotal = Number(it && it.__docTotal) || 0; } catch (eSk0) { skipTotal = 0; }
                    if (skipTotal > 0) overallDone += skipTotal;
                    log.push("SKIP (document closed/unavailable)");
                    try {
                        if (it && it.docState) {
                            setDocProgress(it.docState,
                                "Skipped.",
                                "Images: 0/" + skipTotal + " (skipped)",
                                skipTotal,
                                Math.max(1, skipTotal)
                            );
                        }
                    } catch (eSk1) { }
                    updateSummary(docIndex, it ? it.docName : "(unknown)", "Skipped");
                    uiPulse();
                    continue;
                }

                log.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                log.push("SOURCE: " + it.docName);

                if (it.cfg && it.cfg.containerSetType === "W") {
                    log.push("W-set mode: " + (useFixedKB ? "Fixed Quality (Speed Mode) — sizes vary" : "Target KB (binary search) — best quality under cap"));
                }

                var ds = it.docState;
                var docTotal = Number(it.__docTotal) || (2 + ((it.__vers && it.__vers.length) ? it.__vers.length : 0));

                setDocProgress(ds, "Running…", "Images: 0/" + docTotal + " (" + docTotal + " pending)", 0, docTotal);
                updateSummary(docIndex, it.docName, "");
                uiPulse();

                // Bind progress callbacks for this document
                (function (dsLocal, docNameLocal, docIndexLocal, docTotalLocal, docRefLocal, cfgLocal, versLocal) {
                    var docDoneLocal = 0;
                    var docStartedAt = new Date().getTime();
                    var progressCtx = {
                        onDocStart: function () {
                            docDoneLocal = 0;
                            docStartedAt = new Date().getTime();
                            setDocProgress(dsLocal,
                                "Running…",
                                "Images: 0/" + docTotalLocal + " (" + docTotalLocal + " pending)",
                                0,
                                docTotalLocal
                            );
                            updateSummary(docIndexLocal, docNameLocal, "");
                            uiPulse();
                        },
                        onVariantStart: function (outFileName) {
                            var docElapsed = (new Date().getTime() - docStartedAt);
                            var pendingDoc = docTotalLocal - docDoneLocal;
                            if (pendingDoc < 0) pendingDoc = 0;
                            var docEtaMs = 0;
                            if (docDoneLocal > 0 && pendingDoc > 0) docEtaMs = Math.round((docElapsed / docDoneLocal) * pendingDoc);
                            var timeInfo = "  •  Elapsed " + formatDuration(docElapsed);
                            if (docDoneLocal > 0 && pendingDoc > 0) timeInfo += "  •  ETA " + formatDuration(docEtaMs);
                            setDocProgress(dsLocal,
                                "Exporting…",
                                "Images: " + docDoneLocal + "/" + docTotalLocal + " (" + pendingDoc + " pending)" + timeInfo + "  •  " + outFileName,
                                docDoneLocal,
                                docTotalLocal
                            );
                            updateSummary(docIndexLocal, docNameLocal, outFileName);
                            uiPulse();
                        },
                        onVariantDone: function (outFileName, ok, meta) {
                            docDoneLocal++;
                            overallDone++;
                            var docElapsed = (new Date().getTime() - docStartedAt);
                            var pendingDoc = docTotalLocal - docDoneLocal;
                            if (pendingDoc < 0) pendingDoc = 0;
                            var docEtaMs = 0;
                            if (docDoneLocal > 0 && pendingDoc > 0) docEtaMs = Math.round((docElapsed / docDoneLocal) * pendingDoc);
                            var timeInfo = "  •  Elapsed " + formatDuration(docElapsed);
                            if (docDoneLocal > 0 && pendingDoc > 0) timeInfo += "  •  ETA " + formatDuration(docEtaMs);
                            var status = ok ? "Exported" : "Failed";
                            setDocProgress(dsLocal,
                                (docDoneLocal >= docTotalLocal) ? "Done." : "Running…",
                                "Images: " + docDoneLocal + "/" + docTotalLocal + " (" + pendingDoc + " pending)" + timeInfo + "  •  " + status + ": " + outFileName,
                                docDoneLocal,
                                docTotalLocal
                            );
                            updateSummary(docIndexLocal, docNameLocal, outFileName);
                            uiPulse();
                        },
                        onDocEnd: function () {
                            // If this document aborted early (unexpected error), count the remaining
                            // images as "done" so the progress bars complete cleanly.
                            try {
                                if (docDoneLocal < docTotalLocal) {
                                    var missing = docTotalLocal - docDoneLocal;
                                    if (missing > 0) overallDone += missing;
                                    docDoneLocal = docTotalLocal;
                                }
                            } catch (eM) { }
                            var docElapsed = (new Date().getTime() - docStartedAt);
                            var timeInfo = "  •  Elapsed " + formatDuration(docElapsed);
                            setDocProgress(dsLocal,
                                "Done.",
                                "Images: " + docDoneLocal + "/" + docTotalLocal + " (0 pending)" + timeInfo,
                                docDoneLocal,
                                docTotalLocal
                            );
                            updateSummary(docIndexLocal, docNameLocal, "");
                            uiPulse();
                        }
                    };

                    exportFromDoc(docRefLocal, cfgLocal, versLocal, !!shiftIsDown, log, !!useFixedKB, progressCtx);
                })(ds, it.docName, docIndex, docTotal, it.docRef, it.cfg, it.__vers);
            }

            // Done
            var elapsedDone = (new Date().getTime() - startedAt);
            var pendingDone = totalImages - overallDone;
            if (pendingDone < 0) pendingDone = 0;
            setSummaryProgress(label + " — complete.", "Images: " + overallDone + "/" + totalImages + " (" + pendingDone + " pending)  •  Elapsed " + formatDuration(elapsedDone), overallDone, Math.max(1, totalImages));
            uiPulse();

            if (log && log.length) alert("Export complete.\n\n" + log.join("\n"));
        } catch (eRun) {
            var errMsg = formatError(eRun);
            try { log.push("RUN ERROR: " + errMsg); } catch (eL) { }
            try { setSummaryProgress(label + " — failed.", errMsg, overallDone, Math.max(1, totalImages)); } catch (eP2) { }
            alert("Run failed:\n\n" + errMsg);
        } finally {
            __RUN_STATE.running = false;
            setRunUiEnabled(true);
            uiPulse();
        }
    }

    btnRunAll.onClick = function () {
        var shiftIsDown = getShiftState();
        var runItems = buildRunItemsFromDocStates(docStates);
        if (!runItems || !runItems.length) { alert("No documents to run."); return; }
        runBatch(runItems, shiftIsDown, !!chkFixedKB.value, "Run All");
    };

    btnRunSelected.onClick = function () {
        var shiftIsDown = getShiftState();
        var selectedStates = buildRunItemsFromSelectedSummary();
        if (!selectedStates || !selectedStates.length) { alert("Select one or more documents in the Summary list."); return; }
        var runItems = buildRunItemsFromDocStates(selectedStates);
        if (!runItems || !runItems.length) { alert("No documents to run."); return; }
        runBatch(runItems, shiftIsDown, !!chkFixedKB.value, "Run Selected");
    };

    // --- Doc tabs ---

    // ────────────────────────────────────────────────────────────
    // Fast close / removal batching
    // (Prevents ScriptUI from performing an expensive full relayout
    //  across every tab/row for each removal, which can feel like a
    //  "freeze" when many docs are open.)
    // ────────────────────────────────────────────────────────────

    var __CLOSE_BATCH_DEPTH = 0;
    var __CLOSE_BATCH_MIN_REINDEX = -1;

    function _inCloseBatch() { return (__CLOSE_BATCH_DEPTH > 0); }

    function _beginCloseBatch() {
        __CLOSE_BATCH_DEPTH++;
        if (__CLOSE_BATCH_DEPTH !== 1) return;

        __CLOSE_BATCH_MIN_REINDEX = -1;

        // Hide heavy UI regions while we mutate controls (removing tabs/rows).
        // This avoids ScriptUI repeatedly reflowing hundreds/thousands of controls.
        try { sumRows.visible = false; } catch (e0) { }
        try { sumHdr.visible = false; } catch (e1) { }
        try { tabsPanel.visible = false; } catch (e2) { }
    }

    function _markCloseBatchDirty(startIndex) {
        try {
            if (startIndex === undefined || startIndex === null) return;
            startIndex = Number(startIndex);
            if (isNaN(startIndex) || startIndex < 0) return;
            if (__CLOSE_BATCH_MIN_REINDEX < 0 || startIndex < __CLOSE_BATCH_MIN_REINDEX) __CLOSE_BATCH_MIN_REINDEX = startIndex;
        } catch (e) { }
    }

    function _safeRemoveControl(ctrl) {
        if (!ctrl) return;
        try { ctrl.visible = false; } catch (e0) { }
        try { ctrl.enabled = false; } catch (e1) { }
        try { if (ctrl.parent) ctrl.parent.remove(ctrl); } catch (e2) { }
    }

    function _endCloseBatch() {
        if (__CLOSE_BATCH_DEPTH <= 0) { __CLOSE_BATCH_DEPTH = 0; return; }
        __CLOSE_BATCH_DEPTH--;
        if (__CLOSE_BATCH_DEPTH !== 0) return;

        // Clamp shift-selection anchor after removals
        try {
            if (!docStates.length) __lastSelIndex = -1;
            else if (__lastSelIndex >= docStates.length) __lastSelIndex = docStates.length - 1;
        } catch (eA) { }

        // Keep selection sane (bulk controls expect at least one selected, when any docs remain)
        try {
            var anySel = false;
            for (var k = 0; k < docStates.length; k++) {
                if (docStates[k] && docStates[k]._summarySelected) { anySel = true; break; }
            }
            if (!anySel && docStates.length) {
                docStates[0]._summarySelected = true;
                try { updateRowVisual(docStates[0]); } catch (eV) { }
            }
        } catch (eSel) { }

        // Reindex only the rows impacted by the removal(s)
        try {
            if (__CLOSE_BATCH_MIN_REINDEX >= 0) reindexSummaryRowsFrom(__CLOSE_BATCH_MIN_REINDEX);
            else reindexSummaryRows();
        } catch (eRe) {
            try { reindexSummaryRows(); } catch (eRe2) { }
        }

        try { summaryTitle.text = "Open Documents: " + docStates.length; } catch (eT) { }
        try { listPanel.text = "Select documents to run (double-click to jump to a tab)"; } catch (eLP) { }

        // Scrollbar/content height update (fast; no full relayout)
        try { updateSummaryScroll(); } catch (eSc) { }

        // Bulk controls may depend on selection + available values
        try { refreshBulkControlsFromSelection(); } catch (eB) { }

        // Restore visibility and repaint (avoid layout(true) which is slow on many tabs)
        try { sumHdr.visible = true; } catch (eV1) { }
        try { sumRows.visible = true; } catch (eV2) { }
        try { tabsPanel.visible = true; } catch (eV3) { }

        try { dlgMain.update(); } catch (eUp) { }

        // Reset batch bookkeeping
        __CLOSE_BATCH_MIN_REINDEX = -1;

        if (!docStates.length) {
            try { alert("All document tabs were closed."); } catch (e9) { }
            try { dlgMain.close(0); } catch (e10) { }
        }
    }

    function removeDocTabAndState(ds, skipConfirm) {
        // Close the Photoshop document, remove its tab and summary row
        if (!ds) return;

        // Backwards compatible:
        // - removeDocTabAndState(ds)                      -> confirm
        // - removeDocTabAndState(ds, true)                -> skip confirm
        // - removeDocTabAndState(ds, {skipConfirm:true})  -> skip confirm (batch helpers use this)
        var opts = null;
        if (skipConfirm && (typeof skipConfirm === "object")) {
            opts = skipConfirm;
            skipConfirm = !!opts.skipConfirm;
        } else {
            opts = {};
            skipConfirm = !!skipConfirm;
        }

        var docRef = ds.doc;
        var docName = ds.docName;

        var okToClose = true;

        if (!skipConfirm) {
            try {
                okToClose = confirm("Close '" + docName + "' in Photoshop?\n\nUnsaved changes will be lost.");
            } catch (eC) { okToClose = true; }

            if (!okToClose) return;
        }

        // Use a batch to avoid expensive ScriptUI relayout work per close
        var localBatch = false;
        if (!_inCloseBatch()) { _beginCloseBatch(); localBatch = true; }

        try {
            // Fast index lookup (kept in sync by reindexSummaryRows*)
            var removedIndex = -1;
            try { removedIndex = Number(ds._summaryIndex); } catch (eIdx) { removedIndex = -1; }
            if (isNaN(removedIndex)) removedIndex = -1;

            // Close the Photoshop doc (avoid activating unless needed)
            try {
                if (docRef && isDocAlive(docRef)) {
                    try {
                        docRef.close(SaveOptions.DONOTSAVECHANGES);
                    } catch (eClose1) {
                        // Some PS builds can require the doc be active; try again as fallback
                        try { app.activeDocument = docRef; } catch (eAct) { }
                        try { docRef.close(SaveOptions.DONOTSAVECHANGES); } catch (eClose2) { }
                    }
                }
            } catch (e1) { }

            // If the closing tab is selected, hop to Summary first to keep ScriptUI stable
            try {
                if (ds.tab && tabsPanel && tabsPanel.selection === ds.tab) {
                    tabsPanel.selection = tabSummary;
                }
            } catch (eSelTab) { }

            // Remove summary row UI
            try {
                if (ds.summaryUI && ds.summaryUI.row) _safeRemoveControl(ds.summaryUI.row);
            } catch (e2) { }

            // Remove temp thumb file (best effort)
            try {
                if (ds.thumbFile && ds.thumbFile.exists) ds.thumbFile.remove();
            } catch (eThumb) { }

            // Remove doc tab UI
            try {
                if (ds.tab) _safeRemoveControl(ds.tab);
            } catch (e3) { }

            // Remove from docStates
            try {
                if (removedIndex >= 0 && removedIndex < docStates.length && docStates[removedIndex] === ds) {
                    docStates.splice(removedIndex, 1);
                } else {
                    for (var i = docStates.length - 1; i >= 0; i--) {
                        if (docStates[i] === ds) { removedIndex = i; docStates.splice(i, 1); break; }
                    }
                }
            } catch (e4) { }

            // Release references (helps GC in long sessions)
            try { ds.doc = null; } catch (eN1) { }
            try { ds.tab = null; } catch (eN2) { }
            try { ds.summaryUI = null; } catch (eN3) { }

            _markCloseBatchDirty((removedIndex >= 0) ? removedIndex : 0);
        } catch (eMain) {
            // swallow – keep UI alive
        } finally {
            if (localBatch) _endCloseBatch();
        }
    }

    function buildDocTabUI(parentTab, ds) {
        var docRef = ds.doc;

        parentTab.orientation = "column";
        parentTab.alignChildren = ["fill", "top"];

        // --- Header (thumbnail + name + actions) ---
        var header = parentTab.add("panel", undefined, "Document");
        header.orientation = "row";
        header.alignChildren = ["left", "top"];

        // Thumb used in the Summary table + header (avoid regenerating if it already exists)
        try {
            if (!ds.thumbFile || !ds.thumbFile.exists) ds.thumbFile = makeThumbnailForDoc(docRef, SUMMARY_THUMB_PX);
        } catch (eThumb) { ds.thumbFile = null; }

        if (ds.thumbFile && ds.thumbFile.exists) {
            try {
                var img = header.add("image", undefined, ds.thumbFile);
                img.margins = 6;
                try {
                    img.preferredSize = [SUMMARY_THUMB_PX, SUMMARY_THUMB_PX];
                    img.minimumSize = img.preferredSize;
                    img.maximumSize = img.preferredSize;
                } catch (eIS) { }
            } catch (eI) {
                // ignore thumbnail if ScriptUI can't load it
            }
        }

        // Also show the same thumbnail in the Summary table (first column).
        setSummaryThumbnail(ds);

        var metaCol = header.add("group");
        metaCol.orientation = "column";
        metaCol.alignChildren = ["left", "top"];

        var titleLine = metaCol.add("statictext", undefined, ds.docName);
        titleLine.graphics.font = ScriptUI.newFont("dialog", "bold", 12);

        try {
            var wpx = Math.round(Number(docRef.width.as("px")));
            var hpx = Math.round(Number(docRef.height.as("px")));
            metaCol.add("statictext", undefined, "Size: " + wpx + " × " + hpx + " px");
        } catch (eS) { }

        try {
            var p = getActiveDocFsPath(docRef);
            if (p) metaCol.add("statictext", undefined, "Path: " + p);
        } catch (eP) { }

        var metaBtns = metaCol.add("group");
        metaBtns.orientation = "row";
        var btnActivate = metaBtns.add("button", undefined, "Activate");
        btnActivate.helpTip = "Brings this document to the front in Photoshop.";
        btnActivate.onClick = function () { try { if (docRef && isDocAlive(docRef)) app.activeDocument = docRef; } catch (e) { } };

        var btnCloseDoc = metaBtns.add("button", undefined, "Close Doc");
        btnCloseDoc.helpTip = "Closes this document in Photoshop and removes its tab from this UI.";
        btnCloseDoc.onClick = function () { removeDocTabAndState(ds); };

        // --- Seed settings for this doc ---
        var settings = ds.seed;

        // --- Preset row ---
        var pRow = parentTab.add("group");
        pRow.add("statictext", undefined, "Preset:");
        var presetDropdown = pRow.add("dropdownlist", undefined, PRESET_DROPDOWN_LABELS.slice(0));
        presetDropdown.minimumSize.width = 260;
        presetDropdown.selection = indexOfPreset(settings.presetName);

        // --- Base name row ---
        var nRow = parentTab.add("group");
        nRow.add("statictext", undefined, "Base File Name:");
        var nameInput = nRow.add("edittext", undefined, settings.baseName);
        nameInput.characters = 28;

        // --- Number row ---
        var numRow = parentTab.add("group");
        numRow.add("statictext", undefined, "Number (#):");
        var numberInput = numRow.add("edittext", undefined, "");
        numberInput.characters = 6;
        var numberQuick = numRow.add("dropdownlist", undefined, ["", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
        numberQuick.selection = 0;
        numberQuick.onChange = function () {
            if (numberQuick.selection) numberInput.text = String(numberQuick.selection.text);
            try { if (numberInput.onChanging) numberInput.onChanging(); } catch (e) { }
        };
        var numberClear = numRow.add("button", undefined, "x");
        numberClear.size = [24, 24];

        // --- Color row ---
        var detectedCategory = ds.detectedCategory;
        var cRow = parentTab.add("group");
        var colorLabel = cRow.add("statictext", undefined, "Color (" + (detectedCategory || "category") + "):");
        var colorInput = cRow.add("edittext", undefined, "");
        colorInput.characters = 18;
        var colorQuick = cRow.add("dropdownlist", undefined, [""]);
        colorQuick.minimumSize.width = 200;
        colorQuick.selection = 0;
        colorQuick.onChange = function () {
            if (colorQuick.selection) colorInput.text = String(colorQuick.selection.text);
            try { if (colorInput.onChanging) colorInput.onChanging(); } catch (e) { }
        };
        var colorClear = cRow.add("button", undefined, "x");
        colorClear.size = [24, 24];

        // --- Description row ---
        var descRow = parentTab.add("group");
        var descLabel = descRow.add("statictext", undefined, "Description (" + (detectedCategory || "category") + "):");
        var descQuick = descRow.add("dropdownlist", undefined, [""]);
        descQuick.minimumSize.width = 260;
        descQuick.selection = 0;
        descQuick.onChange = function () { try { syncSummaryRow(ds); } catch (e) { } };
        var descClear = descRow.add("button", undefined, "x");
        descClear.size = [24, 24];

        // --- Preset note ---
        var notePanel = parentTab.add("panel", undefined, "Preset Note");
        notePanel.orientation = "column";
        notePanel.alignChildren = ["fill", "top"];
        var noteBox = notePanel.add("edittext", undefined, "", { multiline: true });
        noteBox.readonly = true;
        noteBox.preferredSize.width = 480;
        noteBox.preferredSize.height = 60;

        // --- Dimension mode ---
        var dRow = parentTab.add("group");
        dRow.add("statictext", undefined, "Dimension Mode:");
        var dimDropdown = dRow.add("dropdownlist", undefined, ["W", "H", "A"]);
        dimDropdown.selection = idxOf(["W", "H", "A"], settings.dimMode);

        // --- Padding panel ---
        var padPanel = parentTab.add("panel", undefined, "Padding");
        padPanel.orientation = "column";
        padPanel.alignChildren = ["fill", "top"];

        // ROW 1: Top/Bottom
        var padRow1 = padPanel.add("group");
        padRow1.orientation = "row";
        padRow1.add("statictext", undefined, "Top/Bottom %:");
        var padPctTBInput = padRow1.add("edittext", undefined, String(settings.paddingPctTB));
        padPctTBInput.characters = 6;
        var padQuickTB = padRow1.add("dropdownlist", undefined, ["", "0", "10", "20", "30", "40", "45", "50", "55", "60", "65", "70"]);
        padQuickTB.selection = 0;
        var chkForceTB = padRow1.add("checkbox", undefined, "Add to Output");
        chkForceTB.value = !!settings.forcePadTB;
        chkForceTB.helpTip = "Force this padding to be added to the image regardless of 16:9 calculations.";

        // ROW 2: Left/Right
        var padRow2 = padPanel.add("group");
        padRow2.orientation = "row";
        padRow2.add("statictext", undefined, "Left/Right %:");
        var padPctLRInput = padRow2.add("edittext", undefined, String(settings.paddingPctLR));
        padPctLRInput.characters = 6;
        var padQuickLR = padRow2.add("dropdownlist", undefined, ["", "0", "10", "20", "30", "40", "45", "50", "55", "60", "65", "70"]);
        padQuickLR.selection = 0;
        var chkForceLR = padRow2.add("checkbox", undefined, "Add to Output");
        chkForceLR.value = !!settings.forcePadLR;
        chkForceLR.helpTip = "Force this padding to be added to the image regardless of 16:9 calculations.";

        // ROW 3: Direction
        var padRow3 = padPanel.add("group");
        padRow3.orientation = "row";
        padRow3.add("statictext", undefined, "Direction:");
        var padDirDropdown = padRow3.add("dropdownlist", undefined, ["Auto", "Top & Bottom", "Left & Right", "Minimum Padding"]);
        padDirDropdown.selection = dirToPadDropdownIndex(settings.paddingDir);

        // Target 16:9 Efficiency
        var effGroup = padPanel.add("group");
        effGroup.orientation = "row";
        effGroup.alignChildren = ["left", "center"];
        var chkTargetEff = effGroup.add("checkbox", undefined, "Target 16:9 Container Efficiency:");
        chkTargetEff.helpTip = "Unlocks if exactly ONE 'Add to Output' is selected. LOCKS the non-forced input and auto-calculates padding to hit efficiency.";
        var ddTargetEff = effGroup.add("dropdownlist", undefined, []);
        for (var ie = 10; ie <= 90; ie += 5) ddTargetEff.add("item", ie + "%");

        var initialEff = (settings.targetEff > 0) ? settings.targetEff : 35;
        var initialEffIdx = (initialEff - 10) / 5;
        if (initialEffIdx < 0) initialEffIdx = 5;
        ddTargetEff.selection = initialEffIdx;

        chkTargetEff.value = (settings.targetEff > 0);
        ddTargetEff.enabled = chkTargetEff.value;

        var autoRow = parentTab.add("group");
        autoRow.orientation = "row";
        var autoLowerFillCheckbox = autoRow.add("checkbox", undefined, "AUTO chooses LOWER % fill in 16:9 (smaller product)");
        autoLowerFillCheckbox.value = !!settings.autoLowerFill;

        var previewPanel = parentTab.add("panel", undefined, "16:9 Container Preview");
        previewPanel.orientation = "column";
        previewPanel.alignChildren = ["fill", "top"];
        var previewBox = previewPanel.add("edittext", undefined, "", { multiline: true });
        previewBox.readonly = true;
        previewBox.preferredSize.width = 480;
        previewBox.preferredSize.height = 160;

        var padNote = parentTab.add("statictext", undefined, "Note: _t and _t_blur always ignore padding (canvasPct 0; no canvas expansion).");
        padNote.graphics.font = ScriptUI.newFont("dialog", "italic", 11);

        parentTab.add("statictext", undefined, "Tip: Hold Shift while clicking Run to save in the parent folder.");

        // Per-document progress (updates during Run This / Run Selected / Run All)
        var docProgressPanel = parentTab.add("panel", undefined, "Progress");
        docProgressPanel.orientation = "column";
        docProgressPanel.alignChildren = ["fill", "top"];
        docProgressPanel.alignment = ["fill", "top"];
        try { docProgressPanel.margins = [10, 8, 10, 10]; } catch (eDP0) { }
        try { docProgressPanel.spacing = 6; } catch (eDP1) { }

        // Status row (left) + percent (right)
        var docProgHeader = docProgressPanel.add("group");
        docProgHeader.orientation = "row";
        docProgHeader.alignChildren = ["fill", "center"];
        docProgHeader.alignment = ["fill", "top"];
        docProgHeader.margins = [0, 0, 0, 0];
        docProgHeader.spacing = 8;

        var docProgLine1 = docProgHeader.add("statictext", undefined, "Idle — ready to run.");
        docProgLine1.alignment = ["fill", "center"];
        try { docProgLine1.graphics.font = ScriptUI.newFont("dialog", "bold", 11); } catch (eDPF1) { }

        var docProgPct = docProgHeader.add("statictext", undefined, "0%");
        docProgPct.alignment = ["right", "center"];
        try { docProgPct.justification = "right"; } catch (eDPF1b) { }
        try { docProgPct.characters = 5; } catch (eDPF1c) { } // keeps layout stable
        try { docProgPct.graphics.font = ScriptUI.newFont("dialog", "bold", 10); } catch (eDPF1d) { }

        var docProgBar = docProgressPanel.add("progressbar", undefined, 0, 100);
        docProgBar.alignment = ["fill", "center"];
        try { docProgBar.value = 0; } catch (eDPB2) { }

        var docProgLine2 = docProgressPanel.add("statictext", undefined, "Images: 0/0 (0 pending)");
        try { docProgLine2.graphics.font = ScriptUI.newFont("dialog", "regular", 10); } catch (eDPF2) { }

        var runRow = parentTab.add("group");
        runRow.alignment = "center";
        runRow.orientation = "row";
        runRow.alignChildren = ["left", "center"];

        var chkFixedKBDoc = runRow.add("checkbox", undefined, "Fixed KB");
        chkFixedKBDoc.value = !!chkFixedKB.value;
        try { chkFixedKBDoc.helpTip = ""; } catch (eHTFK) { }
        chkFixedKBDoc.onClick = function () { try { setGlobalFixedKBValue(chkFixedKBDoc.value); } catch (e) { } };

        var runThisBtn = runRow.add("button", undefined, "Run This Document");
        runThisBtn.helpTip = "Runs export for ONLY this document.";
        // NOTE: Cancel is global (bottom of main dialog)

        // Store UI refs for execution
        ds.ui = {
            presetDropdown: presetDropdown,
            nameInput: nameInput,
            numberInput: numberInput,
            numberQuick: numberQuick,
            colorInput: colorInput,
            colorQuick: colorQuick,
            descQuick: descQuick,
            dimDropdown: dimDropdown,
            padPctTBInput: padPctTBInput,
            padPctLRInput: padPctLRInput,
            chkForceTB: chkForceTB,
            chkForceLR: chkForceLR,
            padDirDropdown: padDirDropdown,
            chkTargetEff: chkTargetEff,
            ddTargetEff: ddTargetEff,
            autoLowerFillCheckbox: autoLowerFillCheckbox,

            // Progress UI
            docProgressPanel: docProgressPanel,
            docProgLine1: docProgLine1,
            docProgLine2: docProgLine2,
            docProgPct: docProgPct,
            docProgBar: docProgBar,

            // Fixed KB (mirrors Summary; affects W/H Target-KB vs Fixed-Quality mode)
            chkFixedKBDoc: chkFixedKBDoc,

            // Run button (global enable/disable)
            runThisBtn: runThisBtn
        };

        // --- Per-tab helpers (from original single-doc UI) ---
        function refreshNote() {
            var pName = getSelectedPresetKeyFromDropdown(presetDropdown);
            var info = PRESET_INFO[pName];
            noteBox.text = info ? info.note : "";
        }

        function updateRunEnabled() {
            var hasName = !!nameInput.text.replace(/^\s+|\s+$/g, '').length;
            runThisBtn.enabled = hasName;
        }
        function refreshCategoryAndColorsUI() {
            detectedCategory = detectCategoryFromDocPath(getActiveDocFsPath(docRef));
            try { ds.detectedCategory = detectedCategory; } catch (e0) { }
            try { colorLabel.text = "Color (" + (detectedCategory || "category") + "):"; } catch (e1) { }
            try { descLabel.text = "Description (" + (detectedCategory || "category") + "):"; } catch (e2) { }

            // Preserve current selections (including custom values) so changing one dropdown
            // doesn't reset the others (applies to individual tabs, Summary, and Bulk Edit).
            var curColorText = "";
            var curDescText = "";
            try { curColorText = String(colorInput.text || ""); } catch (eC0) { curColorText = ""; }
            try { curDescText = (descQuick.selection ? String(descQuick.selection.text) : ""); } catch (eD0) { curDescText = ""; }

            // Rebuild color dropdown for this category
            var colors = getColorsForCategory(detectedCategory);
            setDropdownItems(colorQuick, colors);

            // Keep current color selected (even if it's custom / not in the category list)
            try {
                var normCurColor = normalizeColorValue(curColorText);
                if (normCurColor) {
                    var oldGuard = ncGuard;
                    ncGuard = true;
                    try { colorInput.text = normCurColor; } catch (eCtxt) { }
                    var ci = ensureDropdownHasValue(colorQuick, normCurColor);
                    try { colorQuick.selection = ci; } catch (eCsel) { }
                    ncGuard = oldGuard;
                } else {
                    syncColorQuickToInput();
                }
            } catch (eC1) {
                syncColorQuickToInput();
            }

            // Rebuild description dropdown for this category
            var descs = getDescriptionsForCategory(detectedCategory);
            setDropdownItems(descQuick, descs);

            // Keep current description selected (even if it's custom / not in the category list)
            try {
                if (curDescText) {
                    var di = ensureDropdownHasValue(descQuick, curDescText);
                    try { descQuick.selection = di; } catch (eDsel) { }
                }
            } catch (eD1) { }
        }


        var ncGuard = false;

        function setNumberControlsEnabled(on) { numberInput.enabled = !!on; numberQuick.enabled = !!on; numberClear.enabled = !!on; }
        function setColorControlsEnabled(on) { colorInput.enabled = !!on; colorQuick.enabled = !!on; colorClear.enabled = !!on; }
        function setDescriptionControlsEnabled(on) { descQuick.enabled = !!on; descClear.enabled = !!on; }

        function clearNumber() { if (ncGuard) return; ncGuard = true; numberInput.text = ""; try { numberQuick.selection = 0; } catch (e) { } ncGuard = false; }
        function clearColor() { if (ncGuard) return; ncGuard = true; colorInput.text = ""; try { colorQuick.selection = 0; } catch (e) { } ncGuard = false; }
        function clearDescription() { if (ncGuard) return; ncGuard = true; try { descQuick.selection = 0; } catch (e) { } ncGuard = false; }

        function syncNumberQuickToInput() {
            var v = digitsOnly(numberInput.text);
            if (v !== numberInput.text) { ncGuard = true; numberInput.text = v; ncGuard = false; }
            var sel = null;
            for (var i = 0; i < numberQuick.items.length; i++) {
                if (String(numberQuick.items[i].text) === String(v)) { sel = numberQuick.items[i]; break; }
            }
            try { numberQuick.selection = sel; } catch (e) { }
        }

        function syncColorQuickToInput() {
            var v = normalizeColorValue(colorInput.text);
            if (v !== colorInput.text) { ncGuard = true; colorInput.text = v; ncGuard = false; }
            var sel = 0;
            for (var i = 0; i < colorQuick.items.length; i++) {
                if (_safeLower(colorQuick.items[i].text) === _safeLower(v)) { sel = i; break; }
            }
            // If user typed/selected a custom value that isn't in the dropdown list yet,
            // keep it selectable so it doesn't reset other dropdowns.
            if (v && sel === 0) {
                try { sel = ensureDropdownHasValue(colorQuick, v); } catch (e0) { }
            }
            try { colorQuick.selection = sel; } catch (e) { }
        }

        function applyNcLocking(pName) {
            setColorControlsEnabled(true);
            setDescriptionControlsEnabled(true);
            syncColorQuickToInput();
            if (isPresetNoNC(pName)) { clearNumber(); setNumberControlsEnabled(false); return; }
            if (isPresetNumOnly(pName)) { setNumberControlsEnabled(true); syncNumberQuickToInput(); return; }
            if (isPresetNumOrColor(pName)) { setNumberControlsEnabled(true); syncNumberQuickToInput(); return; }
            clearNumber(); setNumberControlsEnabled(false);
        }

        var padGuard = false;
        function syncPadQuickToInputs() {
            if (padGuard) return;
            var tb = parseFloat(padPctTBInput.text); if (isNaN(tb)) tb = 0;
            var lr = parseFloat(padPctLRInput.text); if (isNaN(lr)) lr = 0;
            padGuard = true;
            var selIndexTB = 0;
            for (var i = 1; i < padQuickTB.items.length; i++) {
                var iv = parseFloat(padQuickTB.items[i].text);
                if (!isNaN(iv) && Math.abs(iv - tb) <= 0.0001) { selIndexTB = i; break; }
            }
            try { padQuickTB.selection = selIndexTB; } catch (e) { }
            var selIndexLR = 0;
            for (var j = 1; j < padQuickLR.items.length; j++) {
                var jv = parseFloat(padQuickLR.items[j].text);
                if (!isNaN(jv) && Math.abs(jv - lr) <= 0.0001) { selIndexLR = j; break; }
            }
            try { padQuickLR.selection = selIndexLR; } catch (e2) { }
            padGuard = false;
        }

        function updateAutoLowerFillLocking(pName) {
            var enabled = isAutoLowerFillUnlockedPreset(pName);
            autoLowerFillCheckbox.enabled = enabled;
            if (!enabled) autoLowerFillCheckbox.value = false;
        }

        function updateEfficiencyControls() {
            var forceTB = chkForceTB.value;
            var forceLR = chkForceLR.value;
            var canUseEff = (forceTB ? 1 : 0) + (forceLR ? 1 : 0) === 1;

            chkTargetEff.enabled = canUseEff;

            if (!canUseEff) {
                ddTargetEff.enabled = false;
                padPctTBInput.enabled = true;
                padPctLRInput.enabled = true;
            } else {
                ddTargetEff.enabled = chkTargetEff.value;

                if (chkTargetEff.value) {
                    if (forceTB) {
                        padPctTBInput.enabled = true;
                        padPctLRInput.enabled = false;
                    } else {
                        padPctTBInput.enabled = false;
                        padPctLRInput.enabled = true;
                    }
                    updateEfficiencyPaddingValues();
                } else {
                    padPctTBInput.enabled = true;
                    padPctLRInput.enabled = true;
                }
            }
        }

        function fmtNum(n, decimals) {
            var v = Number(n);
            if (isNaN(v)) v = 0;
            var d = (typeof decimals === "number") ? decimals : 0;
            var m = Math.pow(10, d);
            return String(Math.round(v * m) / m);
        }

        function getClosestAspectRatio(w, h) {
            var wInt = Math.round(w);
            var hInt = Math.round(h);
            var r = wInt / hInt;
            var common = [
                { n: 1, d: 1, s: "1:1 (Square)" }, { n: 5, d: 4, s: "~5:4" }, { n: 4, d: 3, s: "~4:3" },
                { n: 7, d: 5, s: "~7:5" }, { n: 3, d: 2, s: "~3:2" }, { n: 8, d: 5, s: "~8:5" },
                { n: 16, d: 10, s: "~16:10" }, { n: 5, d: 3, s: "~5:3" }, { n: 16, d: 9, s: "~16:9" },
                { n: 2, d: 1, s: "~2:1" }, { n: 21, d: 9, s: "~21:9" },
                { n: 4, d: 5, s: "~4:5" }, { n: 3, d: 4, s: "~3:4" }, { n: 5, d: 7, s: "~5:7" },
                { n: 2, d: 3, s: "~2:3" }, { n: 5, d: 8, s: "~5:8" }, { n: 10, d: 16, s: "~10:16" },
                { n: 3, d: 5, s: "~3:5" }, { n: 9, d: 16, s: "~9:16" }
            ];
            for (var i = 0; i < common.length; i++) {
                if (Math.abs(r - (common[i].n / common[i].d)) < 0.035) return common[i].s;
            }
            if (r >= 1) return fmtNum(r, 2) + ":1";
            return "1:" + fmtNum(1 / r, 2);
        }

        function refreshPreview() {
            try {
                var wpx = docRef.width.as("px");
                var hpx = docRef.height.as("px");

                var dimSel = (dimDropdown && dimDropdown.selection) ? String(dimDropdown.selection.text) : "W";
                var dimPick = dimSel;
                if (dimSel === "A") dimPick = (wpx >= hpx) ? "W" : "H";

                var tb = parseFloat(padPctTBInput.text); if (isNaN(tb)) tb = 0;
                var lr = parseFloat(padPctLRInput.text); if (isNaN(lr)) lr = 0;
                var forceTB = chkForceTB.value;
                var forceLR = chkForceLR.value;

                var useEff = chkTargetEff.value && chkTargetEff.enabled;
                var targetEffVal = 0;
                if (useEff && ddTargetEff.selection) {
                    targetEffVal = parseFloat(ddTargetEff.selection.text);
                }

                var padDirSel = (padDirDropdown.selection ? String(padDirDropdown.selection.text) : "");
                var selDir = "AUTO";
                if (padDirSel.indexOf("Top") === 0) selDir = "TB";
                else if (padDirSel.indexOf("Left") === 0) selDir = "LR";
                else if (padDirSel.indexOf("Minimum") === 0) selDir = "MIN";

                var info = analyzePaddingFor16x9(wpx, hpx, tb, lr, forceTB, forceLR, targetEffVal);
                var m = info.minPad;

                var lines = [];
                lines.push("Original: " + Math.round(wpx) + " x " + Math.round(hpx) + " px (Aspect " + fmtNum(info.aspect, 3) + " | " + getClosestAspectRatio(wpx, hpx) + ")");
                lines.push("Target Container: 16:9 (Aspect 1.778)");
                lines.push("------------------------------------------------");

                var finalW, finalH;

                var pT = 0, pB = 0, pL = 0, pR = 0;
                var isMinMode = (selDir === "MIN");

                if (isMinMode || useEff) {
                    pT = m.pt; pB = m.pb; pL = m.pl; pR = m.pr;
                } else {
                    var chosenDir = selDir;
                    if (selDir === "AUTO") {
                        chosenDir = info.autoDirOrientation;
                        if (autoLowerFillCheckbox.value) chosenDir = info.autoDirLowerFill;
                        lines.push("Auto-Select Logic: Picked " + chosenDir);
                    }
                    if (chosenDir === "TB" || forceTB) { pT = Math.round(hpx * (tb / 100) / 2); pB = pT; }
                    if (chosenDir === "LR" || forceLR) { pL = Math.round(wpx * (lr / 100) / 2); pR = pL; }
                }

                finalW = wpx + pL + pR;
                finalH = hpx + pT + pB;

                if (isMinMode) lines.push("MODE: MINIMUM PADDING");
                else lines.push("MODE: Standard (" + selDir + ")");

                if (useEff) {
                    var maxEff = 0;
                    var forcedProdPixels = wpx * hpx;
                    if (forceTB) {
                        var hFixed = hpx * (1 + tb / 100);
                        var cW = Math.max(wpx, hFixed * 1.777777);
                        var cH = cW / 1.777777;
                        var cArea = cW * cH;
                        maxEff = (forcedProdPixels / cArea) * 100;
                    } else if (forceLR) {
                        var wFixed = wpx * (1 + lr / 100);
                        var cW2 = wFixed;
                        var cH2 = Math.max(hpx, wFixed / 1.777777);
                        var cArea2 = (cH2 * 1.777777) * cH2;
                        maxEff = (forcedProdPixels / cArea2) * 100;
                    }

                    if (targetEffVal > maxEff + 0.1) {
                        lines.push("WARNING: Target " + targetEffVal + "% unreachable.");
                        lines.push("Capped at Max Possible: " + fmtNum(maxEff, 1) + "%");
                    } else {
                        lines.push("OVERRIDE: Efficiency Target " + targetEffVal + "% Active");
                    }
                }

                lines.push("Padding Added: TB: " + (pT + pB) + "px | LR: " + (pL + pR) + "px");
                lines.push("");
                lines.push("Final Size:   " + Math.round(finalW) + " x " + Math.round(finalH) + " px");
                lines.push("Final Aspect: " + fmtNum(finalW / finalH, 3) + " (" + getClosestAspectRatio(finalW, finalH) + ")");

                var rFinal = finalW / finalH;
                var containerArea;
                if (rFinal >= 1.777) {
                    containerArea = finalW * (finalW / 1.77777);
                } else {
                    containerArea = (finalH * 1.77777) * finalH;
                }
                var originalArea = wpx * hpx;
                var effPct = (originalArea / containerArea) * 100;
                lines.push("16:9 Container Efficiency: " + fmtNum(effPct, 1) + "% (Product vs. 16:9 Box)");

                previewBox.text = lines.join("\n");
                try { syncSummaryPreview(ds); } catch (eSync) { }
            } catch (e) {
                try { previewBox.text = "Error in preview: " + e.message; } catch (ee) { }
            }
        }

        function updateEfficiencyPaddingValues() {
            if (!chkTargetEff.value || !chkTargetEff.enabled) return;

            var wPx = Number(docRef.width.as("px"));
            var hPx = Number(docRef.height.as("px"));
            var tb = parseFloat(padPctTBInput.text) || 0;
            var lr = parseFloat(padPctLRInput.text) || 0;
            var forceTB = chkForceTB.value;
            var forceLR = chkForceLR.value;
            var targetEffVal = 0;
            if (ddTargetEff.selection) targetEffVal = parseFloat(ddTargetEff.selection.text);

            var info = analyzePaddingFor16x9(wPx, hPx, tb, lr, forceTB, forceLR, targetEffVal);
            var m = info.minPad;

            padGuard = true;
            if (forceTB && !forceLR) {
                var calcPx = m.effPl + m.effPr;
                var calcPct = (calcPx / wPx) * 100;
                padPctLRInput.text = fmtNum(calcPct, 1);
            } else if (forceLR && !forceTB) {
                var calcPx2 = m.effPt + m.effPb;
                var calcPct2 = (calcPx2 / hPx) * 100;
                padPctTBInput.text = fmtNum(calcPct2, 1);
            }
            padGuard = false;
            refreshPreview();
        }

        // --- Wire events (mirrors original) ---
        numberClear.onClick = function () { clearNumber(); try { syncSummaryRow(ds); } catch (e) { } };
        colorClear.onClick = function () { clearColor(); try { syncSummaryRow(ds); } catch (e) { } };
        descClear.onClick = function () { clearDescription(); try { syncSummaryRow(ds); } catch (e) { } };

        numberInput.onChanging = function () { syncNumberQuickToInput(); updateRunEnabled(); syncSummaryRow(ds); };
        colorInput.onChanging = function () { syncColorQuickToInput(); syncSummaryRow(ds); };
        nameInput.onChanging = function () { updateRunEnabled(); syncSummaryRow(ds); };

        padQuickTB.onChange = function () {
            if (!padGuard) {
                padPctTBInput.text = String(padQuickTB.selection.text);
                if (chkTargetEff.value && chkForceTB.value) updateEfficiencyPaddingValues();
                syncPadQuickToInputs(); refreshPreview();
            }
        };
        padQuickLR.onChange = function () {
            if (!padGuard) {
                padPctLRInput.text = String(padQuickLR.selection.text);
                if (chkTargetEff.value && chkForceLR.value) updateEfficiencyPaddingValues();
                syncPadQuickToInputs(); refreshPreview();
            }
        };

        padPctTBInput.onChanging = function () {
            if (!padGuard) {
                if (chkTargetEff.value && chkForceTB.value) updateEfficiencyPaddingValues();
                syncPadQuickToInputs(); refreshPreview();
            }
        };
        padPctLRInput.onChanging = function () {
            if (!padGuard) {
                if (chkTargetEff.value && chkForceLR.value) updateEfficiencyPaddingValues();
                syncPadQuickToInputs(); refreshPreview();
            }
        };

        chkForceTB.onClick = function () { updateEfficiencyControls(); refreshPreview(); };
        chkForceLR.onClick = function () { updateEfficiencyControls(); refreshPreview(); };
        chkTargetEff.onClick = function () { updateEfficiencyControls(); refreshPreview(); };
        ddTargetEff.onChange = function () { updateEfficiencyPaddingValues(); refreshPreview(); };

        padDirDropdown.onChange = function () { refreshPreview(); };
        dimDropdown.onChange = function () { refreshPreview(); };
        autoLowerFillCheckbox.onClick = function () { refreshPreview(); };

        presetDropdown.onChange = function () {
            var pName = getSelectedPresetKeyFromDropdown(presetDropdown);
            var info = PRESET_INFO[pName];
            if (info) {
                dimDropdown.selection = idxOf(["W", "H", "A"], info.mode || "W");
                var tb = (typeof info.paddingPctTB !== "undefined") ? info.paddingPctTB : (info.paddingPct || 0);
                var lr = (typeof info.paddingPctLR !== "undefined") ? info.paddingPctLR : (info.paddingPct || 0);

                padPctTBInput.text = String(tb || 0);
                padPctLRInput.text = String(lr || 0);

                padDirDropdown.selection = dirToPadDropdownIndex(info.paddingDir || "AUTO");
                nameInput.text = (typeof info.baseName !== "undefined") ? info.baseName : pName;
                autoLowerFillCheckbox.value = !!info.autoLowerFill;
                chkForceTB.value = !!info.forcePadTB;
                chkForceLR.value = !!info.forcePadLR;

                if (typeof info.targetEff !== "undefined" && info.targetEff > 0) {
                    var canUse = ((!!info.forcePadTB ? 1 : 0) + (!!info.forcePadLR ? 1 : 0) === 1);
                    if (canUse) {
                        chkTargetEff.value = true;
                        var effIdx = (info.targetEff - 10) / 5;
                        if (effIdx >= 0 && effIdx < ddTargetEff.items.length) ddTargetEff.selection = effIdx;
                    } else {
                        chkTargetEff.value = false;
                    }
                } else {
                    chkTargetEff.value = false;
                }

                refreshNote();
                refreshCategoryAndColorsUI();
                applyNcLocking(pName);
                updateAutoLowerFillLocking(pName);
                updateEfficiencyControls();
                syncPadQuickToInputs();
                refreshPreview();
                updateRunEnabled();
                syncSummaryRow(ds);
            }
        };

        // Init
        refreshNote();
        refreshCategoryAndColorsUI();
        applyNcLocking(getSelectedPresetKeyFromDropdown(presetDropdown));
        updateAutoLowerFillLocking(getSelectedPresetKeyFromDropdown(presetDropdown));
        updateEfficiencyControls();
        syncPadQuickToInputs();
        refreshPreview();
        updateRunEnabled();
        syncSummaryRow(ds);

        // Run This
        runThisBtn.onClick = function () {
            var shiftIsDown = getShiftState();
            var cfg = collectDocConfig(ds);
            if (!cfg) { alert("Please enter a Base File Name."); return; }

            var useFixedKB = (typeof chkFixedKB !== "undefined" && chkFixedKB) ? !!chkFixedKB.value : false;
            runBatch([{ docState: ds, docRef: docRef, docName: ds.docName, cfg: cfg }], shiftIsDown, useFixedKB, "Run This");
        };
    }

    // Build tabs for each open doc
    for (var ti = 0; ti < docStates.length; ti++) {
        var ds2 = docStates[ti];
        var tabTitle = stripExtension(ds2.docName);
        if (!tabTitle) tabTitle = "Doc " + (ti + 1);
        // Keep tab titles short-ish
        if (tabTitle.length > 18) tabTitle = tabTitle.substr(0, 18) + "...";

        var tDoc = tabsPanel.add("tab", undefined, tabTitle);
        ds2.tab = tDoc;
        buildDocTabUI(tDoc, ds2);
    }

    // Global bottom buttons (always visible)
    var bottomRow = dlgMain.add("group");
    bottomRow.alignment = "right";
    var btnCancel = bottomRow.add("button", undefined, "Cancel", { name: "cancel" });
    btnCancel.onClick = function () { dlgMain.close(0); };

    // Bottom-right resize hint (the window is resizable — drag the corner/edges)
    var resizeHint = bottomRow.add("statictext", undefined, "↘");
    resizeHint.helpTip = "Drag the window corner/edges to resize.";
    try { resizeHint.graphics.font = ScriptUI.newFont("dialog", "bold", 14); } catch (eRH) { }
    try { enforceSummaryLayout(); } catch (e0) { }
    try { resizeSummaryColumns(); } catch (e1) { }
    try { updateSummaryScroll(); } catch (e2) { }
    // Show UI
    // NOTE: The window now stays open after each run. Exports are executed
    // from the Run buttons' handlers (Run All / Run Selected / Run This).
    dlgMain.show();

    // Cleanup thumbnails after UI closes
    for (var ci = 0; ci < docStates.length; ci++) {
        try { if (docStates[ci].thumbFile && docStates[ci].thumbFile.exists) docStates[ci].thumbFile.remove(); } catch (eD) { }
    }

    return;
    function fitToContainerPct(imageAspect, containerAspect) {
        if (!imageAspect || !containerAspect) return { wPct: 0, hPct: 0, areaPct: 0 };
        var ratio = imageAspect / containerAspect;
        if (ratio >= 1) { return { wPct: 100, hPct: (100 / ratio), areaPct: (100 / ratio) }; }
        return { wPct: (100 * ratio), hPct: 100, areaPct: (100 * ratio) };
    }

    function analyzePaddingFor16x9(wPx, hPx, pctTB, pctLR, forceTB, forceLR, targetEffVal) {
        var w = Number(wPx); if (isNaN(w) || w <= 0) w = 1;
        var h = Number(hPx); if (isNaN(h) || h <= 0) h = 1;
        var tb = Number(pctTB); if (isNaN(tb) || tb < 0) tb = 0; if (tb > 49) tb = 49;
        var lr = Number(pctLR); if (isNaN(lr) || lr < 0) lr = 0; if (lr > 49) lr = 49;

        // 1. Calculate Force Padding (Manual Pixels)
        var forcePt = 0, forcePb = 0, forcePl = 0, forcePr = 0;
        if (forceTB) { var totalH = h * (tb / 100); forcePt = totalH / 2; forcePb = totalH / 2; }
        if (forceLR) { var totalW = w * (lr / 100); forcePl = totalW / 2; forcePr = totalW / 2; }

        var aspect = w / h;
        var tbAspect = aspect / (1 + (tb / 100));
        var lrAspect = aspect * (1 + (lr / 100));
        var tbFit = fitToContainerPct(tbAspect, WEB_CONTAINER_ASPECT);
        var lrFit = fitToContainerPct(lrAspect, WEB_CONTAINER_ASPECT);
        var autoDirOrientation = (w >= h) ? "LR" : "TB";
        var autoDirLowerFill;
        if (lrFit.areaPct < tbFit.areaPct - 0.0001) autoDirLowerFill = "LR";
        else if (tbFit.areaPct < lrFit.areaPct - 0.0001) autoDirLowerFill = "TB";
        else autoDirLowerFill = autoDirOrientation;
        var autoOrientation = (autoDirOrientation === "LR") ? { paddedAspect: lrAspect, fit: lrFit } : { paddedAspect: tbAspect, fit: tbFit };
        var autoLowerFill = (autoDirLowerFill === "LR") ? { paddedAspect: lrAspect, fit: lrFit } : { paddedAspect: tbAspect, fit: tbFit };

        // 2. Minimum Padding Calculation (Reverse Safe Area)
        var pv = tb / 100; var ph = lr / 100;
        var rSafe = (16 * (1 - 2 * ph)) / (9 * (1 - 2 * pv));
        var safePl = 0, safePr = 0, safePt = 0, safePb = 0;
        if (aspect >= rSafe) {
            safePl = (ph / (1 - 2 * ph)) * w; safePr = safePl;
            var wNew = w + safePl + safePr;
            safePt = pv * (9 / 16) * wNew; safePb = safePt;
        } else {
            safePt = (pv / (1 - 2 * pv)) * h; safePb = safePt;
            var hNew = h + safePt + safePb;
            safePl = ph * (16 / 9) * hNew; safePr = safePl;
        }

        // --- NEW TARGET EFFICIENCY LOGIC WITH LIMIT CHECK ---
        var effPl = 0, effPr = 0, effPt = 0, effPb = 0;
        var useTargetEff = (targetEffVal > 0) && ((forceTB ? 1 : 0) + (forceLR ? 1 : 0) === 1);

        if (useTargetEff) {
            // First check Max Possible Efficiency given the forced constraint
            var prodArea = w * h;
            var maxPossibleEff = 100;

            if (forceTB) {
                // Height constrained. Max Eff happens when width is minimal (just enough to cover product or match aspect)
                // Minimal container Height = h + forcePt + forcePb
                // Minimal container Width = Max(w, MinH * 1.777)
                var minH = h + forcePt + forcePb;
                var minW = Math.max(w, minH * 1.777777);
                var minContainerArea = minW * (minW / 1.777777);
                // wait, 16:9 container area is determined by its largest dimension.
                // if minW > minH * 1.777, then width constrains. Area = minW * (minW/1.777).
                // if minW == minH * 1.777, Area = minW * minH.

                // Simplified: 
                // If Aspect (w/h) > 1.777, container is width-constrained. Area = w * (w/1.777). Max Eff = ProdArea / Area.
                // If Aspect < 1.777, container is height-constrained. Area = (h*1.777) * h. Max Eff = ProdArea / Area.
                // Here 'h' includes forced padding. 'w' is raw.

                var currentAspect = w / minH;
                var effectiveContainerArea;
                if (currentAspect >= 1.777777) {
                    effectiveContainerArea = w * (w / 1.777777);
                } else {
                    effectiveContainerArea = (minH * 1.777777) * minH;
                }
                maxPossibleEff = (prodArea / effectiveContainerArea) * 100;
            } else if (forceLR) {
                var minW = w + forcePl + forcePr;
                var currentAspect = minW / h;
                var effectiveContainerArea;
                if (currentAspect >= 1.777777) {
                    effectiveContainerArea = minW * (minW / 1.777777);
                } else {
                    effectiveContainerArea = (h * 1.777777) * h;
                }
                maxPossibleEff = (prodArea / effectiveContainerArea) * 100;
            }

            // Logic: If Target > Max Possible, clamp to 0 padding (Max Eff).
            // Else, calculate needed padding.

            if (targetEffVal > maxPossibleEff) {
                // Target unreachable. Clamp to 0 padding.
                effPl = 0; effPr = 0; effPt = 0; effPb = 0;
            } else {
                // Target reachable. Calculate needed container area.
                var reqContainerArea = prodArea / (targetEffVal / 100);
                var reqW = Math.sqrt(reqContainerArea * 1.777777777);
                var reqH = reqW / 1.777777777;

                if (forceTB) {
                    var neededW = reqW;
                    var padW = Math.max(0, neededW - w);
                    effPl = padW / 2; effPr = padW / 2;
                } else if (forceLR) {
                    var neededH = reqH;
                    var padH = Math.max(0, neededH - h);
                    effPt = padH / 2; effPb = padH / 2;
                }
            }
        }

        // 3. Final Resolution
        var finalPt, finalPb, finalPl, finalPr;
        if (useTargetEff) {
            // If efficiency logic ran, it either gave us padding or 0.
            // We use that PLUS the forced values.
            // Note: effPt is only non-zero if LR was forced, etc.
            finalPt = forcePt + effPt;
            finalPb = forcePb + effPb;
            finalPl = forcePl + effPl;
            finalPr = forcePr + effPr;
        } else {
            // Standard Min Logic
            finalPt = Math.max(forcePt, safePt);
            finalPb = Math.max(forcePb, safePb);
            finalPl = Math.max(forcePl, safePl);
            finalPr = Math.max(forcePr, safePr);
        }

        var finalW = w + finalPl + finalPr;
        var finalH = h + finalPt + finalPb;
        var areaPct = ((w * h) / (finalW * finalH)) * 100;

        return {
            aspect: aspect,
            tb: { paddedAspect: tbAspect, fit: tbFit },
            lr: { paddedAspect: lrAspect, fit: lrFit },
            autoDirOrientation: autoDirOrientation,
            autoOrientation: autoOrientation,
            autoDirLowerFill: autoDirLowerFill,
            autoLowerFill: autoLowerFill,
            minPad: {
                forcePt: forcePt, forcePb: forcePb, forcePl: forcePl, forcePr: forcePr,
                safePt: safePt, safePb: safePb, safePl: safePl, safePr: safePr,
                effPt: effPt, effPb: effPb, effPl: effPl, effPr: effPr,
                pt: Math.ceil(finalPt),
                pb: Math.ceil(finalPb),
                pl: Math.ceil(finalPl),
                pr: Math.ceil(finalPr),
                finalW: finalW,
                finalH: finalH,
                areaPct: areaPct
            }
        };
    }

    function chooseAutoPaddingDirection16x9(wPx, hPx, pctTB, pctLR, preferLowerFill) {
        var info = analyzePaddingFor16x9(wPx, hPx, pctTB, pctLR, false, false, 0);
        return preferLowerFill ? info.autoDirLowerFill : info.autoDirOrientation;
    }

    function applyPadding(docRef, pctTB, pctLR, dir, preferLowerFill, forceTB, forceLR, targetEffVal) {
        var wPx = docRef.width.as("px");
        var hPx = docRef.height.as("px");
        var tb = Number(pctTB); if (isNaN(tb) || tb < 0) tb = 0; if (tb > 49) tb = 49;
        var lr = Number(pctLR); if (isNaN(lr) || lr < 0) lr = 0; if (lr > 49) lr = 49;

        var by = dir || "AUTO";
        if (by === "AUTO") by = chooseAutoPaddingDirection16x9(wPx, hPx, tb, lr, preferLowerFill);

        var useEff = (targetEffVal > 0) && ((forceTB ? 1 : 0) + (forceLR ? 1 : 0) === 1);

        if (by === "MIN" || useEff) {
            var info = analyzePaddingFor16x9(wPx, hPx, tb, lr, forceTB, forceLR, targetEffVal);
            var m = info.minPad;
            var finalW = wPx + m.pl + m.pr;
            var finalH = hPx + m.pt + m.pb;
            docRef.resizeCanvas(UnitValue(finalW, "px"), UnitValue(finalH, "px"), AnchorPosition.MIDDLECENTER);
        } else {
            var applyT = (by === "TB" || forceTB);
            var applyL = (by === "LR" || forceLR);

            var newW = wPx, newH = hPx;
            if (applyT && tb > 0) newH = Math.round(hPx * (1 + tb / 100));
            if (applyL && lr > 0) newW = Math.round(wPx * (1 + lr / 100));

            if (newW !== wPx || newH !== hPx) {
                docRef.resizeCanvas(UnitValue(newW, "px"), UnitValue(newH, "px"), AnchorPosition.MIDDLECENTER);
            }
        }
    }

    function ensure8bitSRGB(docRef) {
        if (!docRef) return;

        var prevDoc = null;
        try { prevDoc = app.activeDocument; } catch (e0) { prevDoc = null; }

        var prevDialogs = null;
        try { prevDialogs = app.displayDialogs; app.displayDialogs = DialogModes.NO; } catch (eD) { prevDialogs = null; }

        try {
            // Avoid extra activeDocument flips when possible.
            try { if (app.activeDocument !== docRef) app.activeDocument = docRef; } catch (eA) { }

            try { if (docRef.mode !== DocumentMode.RGB) docRef.changeMode(ChangeMode.RGB); } catch (eM) { }

            try {
                if (docRef.bitsPerChannel !== BitsPerChannelType.EIGHT) {
                    docRef.bitsPerChannel = BitsPerChannelType.EIGHT;
                }
            } catch (eB) { }

            // Convert profile only when needed (convertProfile is expensive and was being called per save).
            var prof = "";
            try { prof = String(docRef.colorProfileName || ""); } catch (eP) { prof = ""; }

            if (!prof || prof.indexOf("sRGB IEC61966-2.1") === -1) {
                try { docRef.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false); } catch (eC) { }
            }
        } catch (e) {
        } finally {
            try { if (prevDoc && isDocAlive(prevDoc) && prevDoc !== docRef) app.activeDocument = prevDoc; } catch (eR) { }
            try { if (prevDialogs !== null && prevDialogs !== undefined) app.displayDialogs = prevDialogs; } catch (eRD) { }
        }
    }

    function saveWithTargetSize(file, compType, minQ, maxQ, targetKB, opts) {
        opts = opts || {};

        function __fileKB(f) {
            try {
                var fp = (f && f.fsName) ? f.fsName : String(f);
                var ff = new File(fp);
                if (!ff.exists) return 0;

                // Some environments (network drives / OneDrive / delayed writes) can briefly report a stale length.
                // Read a few times until stable to avoid “double target” surprises.
                var last = ff.length;
                for (var i = 0; i < 3; i++) {
                    try { $.sleep(15); } catch (eS) { }
                    ff = new File(fp);
                    var cur = ff.length;
                    if (cur === last) break;
                    last = cur;
                }
                return last / 1024;
            } catch (e) {
                return 0;
            }
        }

        var tKB = Number(targetKB);
        if (isNaN(tKB) || tKB < 0) tKB = 0;

        var tolKB = (typeof opts.toleranceKB === "number" && !isNaN(opts.toleranceKB)) ? opts.toleranceKB : 0;
        if (tolKB < 0) tolKB = 0;

        var capKB = tKB + tolKB;

        var loBound = Math.max(0, minQ | 0);
        var hiBound = Math.min(100, maxQ | 0);
        if (hiBound < loBound) { var tmp = loBound; loBound = hiBound; hiBound = tmp; }

        var lo = loBound;
        var hi = hiBound;

        var best = lo;
        var lastSavedQ = -1;

        // Optional quality hint: used as the FIRST midpoint (no extra save).
        var hint = (typeof opts.qualityHint === "number" && !isNaN(opts.qualityHint)) ? (opts.qualityHint | 0) : -1;
        var first = true;

        while (lo <= hi) {
            var mid;
            if (first && hint >= lo && hint <= hi) mid = hint;
            else mid = Math.floor((lo + hi) / 2);
            first = false;

            saveAsWebP(file, compType, mid, false, false, false, true);
            lastSavedQ = mid;

            var kb = __fileKB(file);

            if (kb <= capKB) { best = mid; lo = mid + 1; } else { hi = mid - 1; }
        }

        // Avoid an extra save when the last saved file is already at the best quality.
        if (lastSavedQ !== best) {
            saveAsWebP(file, compType, best, false, false, false, true);
        }

        // Safety clamp: if for any reason the "best" result still exceeds the cap,
        // step quality down until it fits.
        var finalKB = __fileKB(file);
        if (finalKB > capKB) {
            var q2 = best - 1;
            while (q2 >= loBound) {
                saveAsWebP(file, compType, q2, false, false, false, true);
                finalKB = __fileKB(file);
                if (finalKB <= capKB) { best = q2; break; }
                q2--;
            }
        }

        return best;
    }

    // WebP save (Action Manager) — native support requires Photoshop 23.2+
    function saveAsWebP(file, compType, compValue, xmpData, exifData, psData, asCopy) {
        if (!supportsNativeWebP()) {
            var vInfo = getPhotoshopVersionInfo();
            throw new Error("Native WebP saving requires Photoshop 23.2+. Detected Photoshop version: " + vInfo.raw);
        }

        if (!file) throw new Error("Missing output file");
        try { if (!(file instanceof File)) file = new File(String(file)); } catch (eF) { file = new File(String(file)); }

        // Ensure the active document is in the format required by WebP save (8-bit RGB sRGB).
        // Optimized: a fast no-op when already compliant.
        ensure8bitSRGB(app.activeDocument);

        function s2t(s) { return app.stringIDToTypeID(s); }

        var d = new ActionDescriptor();
        var o = new ActionDescriptor();

        // Compression parameters = "compressionLossless" | "compressionLossy"
        o.putEnumerated(s2t("compression"), s2t("WebPCompression"), s2t(compType));

        var isLossless = (compType === "compressionLossless");
        if (!isLossless) {
            var q = compValue | 0;
            if (q < 0) q = 0;
            if (q > 100) q = 100;
            o.putInteger(s2t("quality"), q);
        }

        // Metadata options
        o.putBoolean(s2t("includeXMPData"), !!xmpData);
        o.putBoolean(s2t("includeEXIFData"), !!exifData);
        o.putBoolean(s2t("includePsExtras"), !!psData);

        // WebP format and save path
        d.putObject(s2t("as"), s2t("WebPFormat"), o);
        d.putPath(s2t("in"), file);

        // Save As = false | Save As a Copy = true
        d.putBoolean(s2t("copy"), !!asCopy);

        // Extension case
        d.putBoolean(s2t("lowerCase"), true);

        try {
            executeAction(s2t("save"), d, DialogModes.NO);
        } catch (e1) {
            // One retry after a "hard" convert in case the profile/mode check was inconclusive.
            try {
                var docRef = app.activeDocument;
                try { if (docRef.mode !== DocumentMode.RGB) docRef.changeMode(ChangeMode.RGB); } catch (eM) { }
                try { docRef.bitsPerChannel = BitsPerChannelType.EIGHT; } catch (eB) { }
                try { docRef.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false); } catch (eC) { }
            } catch (e2) { }
            executeAction(s2t("save"), d, DialogModes.NO);
        }
    }


})();
