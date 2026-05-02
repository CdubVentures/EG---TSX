/***************************************************************
  Photoshop Script to Create Multiple PNG Versions
  with dialogs and per-version controls similar to
  "resize-w-filename-webp-LOW-QUAL_bysize", but exporting PNG.

  ─────────────────────────────────────────────────────────────────
  IMAGE SIZE BY SUFFIX (CONTAINER PIXELS → PNG OUTPUT)
  • “Container” = the dimension you are targeting.
  • PNG OUTPUT SIZE = container × 2  (this script doubles the container).
  • W-set targets WIDTH; H-set targets HEIGHT; A = auto-picks W/H by aspect.
  • Canvas expansion (if any) is applied AFTER resizing and expands height.

  Width set (W)  → WIDTH = container × 2
    _xxs   : 50  → 100 px wide
    _xs    : 75  → 150 px wide
    _s     : 100 → 200 px wide
    _m     : 125 → 250 px wide
    _l     : 150 → 300 px wide
    _xl    : 200 → 400 px wide
    _xxl   : 250 → 500 px wide

  Height set (H) → HEIGHT = container × 2
    _xxs   : 50  → 100 px tall
    _xs    : 75  → 150 px tall
    _s     : 100 → 200 px tall
    _m     : 125 → 250 px tall
    _l     : 150 → 300 px tall
    _xl    : 200 → 400 px tall
    _xxl   : 250 → 500 px tall

  Notes:
  • Auto (A) chooses W or H based on the document’s aspect ratio, then applies
    the corresponding list above (and doubles).
  • Vertical/rotated text presets (e.g., “_vertical”) use H-mode sizing, then rotate;
    the final height still follows the H-set table above.
  • Macro presets run multiple child presets; each child follows its own W/H table.
  • PNG-8 rows may quantize colors to hit target size (W-mode); PNG-24 rows are full color.
  • Index Color dropdown only affects “brand-logo-horizontal-index” (and when called via the macro).

  Additions in this version:
    • Updated preset list + live preset notes:
        - Presets (all canvas expansion locked to 0):
            brand-logo-horizontal-primary   → W, original color.
            brand-logo-horizontal-mono-white → W, force white.
            brand-logo-horizontal-mono-black → W, force black.
            brand-logo-horizontal-index      → W, uses “Index Color” menu (normal/white/black/#dddad5).
            brand-wordmark-horizontal-mono-black    → W, force black.
            brand-wordmark-horizontal-mono-white    → W, force white.
            brand-wordmark-horizontal-mono-warmgray → W, force #dddad5.
            brand-wordmark-vertical-mono-black      → H, rotate -90 deg, force black.
            brand-wordmark-vertical-mono-white      → H, rotate -90°, force white.
            brand-wordmark-vertical-mono-warmgray   → H, rotate -90°, force #dddad5.
        - Two macro presets at the top:
            all_main_logo_presets → runs all 4 main logo presets (index uses 'Index Color' menu).
            all_text_logo_presets → runs all 6 wordmark presets (horizontal + vertical).
    • NEW “Index Color” dropdown (normal / force white / force black / force #dddad5):
        - Only enabled when the selected preset is “brand-logo-horizontal-index” OR the macro “all_main_logo_presets”.
        - When enabled, it controls the recolor used for the index outputs.
    • Preset canvas expansion is enforced at runtime (locked to 0 for all listed presets).
    • New color mode "forceCustom" + Hex input (for #dddad5 where needed).
    • Optional per-preset rotation (e.g. -90° for the rotated vertical presets).
    • Robust preset notes:
        - Uses a read-only, multiline EditText that always refreshes when you type/select.

  Reliability improvements (preset UI + enum safety + exporter fallback):
    • Case-insensitive preset resolution + dropdown sync so typing or selecting a preset
      always applies its settings and refreshes the note.
    • Avoids "Error 1320: Invalid enumeration value" by:
        - Safely probing for available ResampleMethod values and picking the first valid one.
        - Logging resample method names via a safe lookup map (not a raw switch).
    • Fixes Save for Web "endian type" error on some source formats (e.g., certain WEBP/placed assets):
        - Before exporting, the script builds a temporary, 8-bit sRGB, single-layer,
          transparency-preserving "safe" document and exports from it.
        - Export function runs with dialogs suppressed and falls back to Save As PNG if
          Save for Web throws. (Save As cannot do PNG-8 quantization, but it prevents failures.)

  Features (kept from original and extended):
    • Preset base-name dropdown + editable File Name field
    • General Settings dialog:
        - File Name (defaults to current document’s base name)
        - Dimension Mode (W / H / A)
        - Canvas expansion % for W, H, and A modes
        - Color Mode: "normal" | "forceWhite" | "forceBlack" | "forceCustom"
        - Custom Hex input (for "forceCustom")
        - Index Color (only for logo_index / all_main_logo_presets)
        - Tip: Hold Shift on OK to save in the parent folder
    • Per-version dialog to adjust Target (KB) for W-mode, or Colors for H-mode
      (Container is doubled for output to match PNG workflow)
    • Auto container set selection in "A" mode based on doc aspect
    • SHIFT key moves output one folder up
    • PreserveDetails 2.0 resampling fallback; special handling for "_blur"
    • PNG-8/PNG-24 options; PNG-8 can binary-search color count to hit target KB (W-mode)
    • Canvas expansion uses height-only percentage
    • Logs final settings and sizes in a completion alert
***************************************************************/


(function () {

    var PRESET_BASENAMES = [
        "all_main_logo_presets",
        "all_text_logo_presets",
        "brand-logo-horizontal-primary",
        "brand-logo-horizontal-mono-white",
        "brand-logo-horizontal-mono-black",
        "brand-logo-horizontal-index",
        "brand-wordmark-horizontal-mono-black",
        "brand-wordmark-horizontal-mono-white",
        "brand-wordmark-horizontal-mono-warmgray",
        "brand-wordmark-vertical-mono-black",
        "brand-wordmark-vertical-mono-white",
        "brand-wordmark-vertical-mono-warmgray"
    ];

    var PRESET_INFO = {
        "brand-logo-horizontal-primary": {
            mode: "W",
            colorMode: "normal",
            customHex: "",
            rotate: 0,
            outputBaseName: "brand-logo-horizontal-primary",
            brand: true,
            note: "LIGHT-THEME logo. Brand color or black — must be visible on light/white backgrounds. Used on site index tiles in light themes."
        },
        "brand-logo-horizontal-mono-white": {
            mode: "W",
            colorMode: "forceWhite",
            customHex: "",
            rotate: 0,
            outputBaseName: "brand-logo-horizontal-mono-white",
            brand: true,
            note: "Width-based force white; canvas expansion locked to 0."
        },
        "brand-logo-horizontal-mono-black": {
            mode: "W",
            colorMode: "forceBlack",
            customHex: "",
            rotate: 0,
            outputBaseName: "brand-logo-horizontal-mono-black",
            brand: true,
            note: "Width-based force black; canvas expansion locked to 0."
        },
        "brand-logo-horizontal-index": {
            mode: "W",
            colorMode: "normal",
            customHex: "",
            rotate: 0,
            outputBaseName: "brand-logo-horizontal-index",
            brand: true,
            note: "DARK-THEME logo. Brand color or white — must be visible on dark backgrounds. Used on site index tiles in gaming theme. Recolor via 'Index Color' menu."
        },
        "brand-wordmark-horizontal-mono-black": {
            mode: "W",
            colorMode: "forceBlack",
            customHex: "",
            rotate: 0,
            outputBaseName: "brand-wordmark-horizontal-mono-black",
            brand: true,
            note: "Width-based force black; canvas expansion locked to 0."
        },
        "brand-wordmark-horizontal-mono-white": {
            mode: "W",
            colorMode: "forceWhite",
            customHex: "",
            rotate: 0,
            outputBaseName: "brand-wordmark-horizontal-mono-white",
            brand: true,
            note: "Width-based force white; canvas expansion locked to 0."
        },
        "brand-wordmark-horizontal-mono-warmgray": {
            mode: "W",
            colorMode: "forceCustom",
            customHex: "#dddad5",
            rotate: 0,
            outputBaseName: "brand-wordmark-horizontal-mono-warmgray",
            brand: true,
            note: "Width-based force color #dddad5; canvas expansion locked to 0."
        },
        "brand-wordmark-vertical-mono-black": {
            mode: "H",
            colorMode: "forceBlack",
            customHex: "",
            rotate: -90,
            outputBaseName: "brand-wordmark-vertical-mono-black",
            brand: true,
            note: "Height-based rotate -90 deg (upwards) and force black; canvas expansion locked to 0."
        },
        "brand-wordmark-vertical-mono-white": {
            mode: "H",
            colorMode: "forceWhite",
            customHex: "",
            rotate: -90,
            outputBaseName: "brand-wordmark-vertical-mono-white",
            brand: true,
            note: "Height-based rotate -90° (upwards) and force white; canvas expansion locked to 0."
        },
        "brand-wordmark-vertical-mono-warmgray": {
            mode: "H",
            colorMode: "forceCustom",
            customHex: "#dddad5",
            rotate: -90,
            outputBaseName: "brand-wordmark-vertical-mono-warmgray",
            brand: true,
            note: "Height-based rotate -90° (upwards) and force color #dddad5; canvas expansion locked to 0."
        },
        "all_main_logo_presets": {
            children: ["brand-logo-horizontal-primary", "brand-logo-horizontal-mono-white", "brand-logo-horizontal-mono-black", "brand-logo-horizontal-index"],
            note: "Runs all main-logo presets: primary, mono-white, mono-black, index (index uses the 'Index Color' menu)."
        },
        "all_text_logo_presets": {
            children: [
                "brand-wordmark-horizontal-mono-black",
                "brand-wordmark-horizontal-mono-white",
                "brand-wordmark-horizontal-mono-warmgray",
                "brand-wordmark-vertical-mono-black",
                "brand-wordmark-vertical-mono-white",
                "brand-wordmark-vertical-mono-warmgray"
            ],
            note: "Runs all text-logo presets (including the -90 deg rotated black, white, and #dddad5 verticals)."
        }
    };

    var mainName = "brand-logo-horizontal-mono-black";
    var dimensionMode = "W";
    var colorMode = "normal";
    var customHex = "";
    var wCanvasExp = 0, hCanvasExp = 0, aCanvasExp = 0;

    var versionsW = [
        { suffix: "_xxxs", container: 25,  canvasPct: 0, png8: true,  colors:  64, transparency: true,  interlaced: false, targetKB: 10 },
        { suffix: "_xxs",  container: 50,  canvasPct: 0, png8: true,  colors:  64, transparency: true,  interlaced: false, targetKB: 10 },
        { suffix: "_xs",   container: 75,  canvasPct: 0, png8: true,  colors: 128, transparency: true,  interlaced: false, targetKB: 20 },
        { suffix: "_s",    container: 100, canvasPct: 0, png8: true,  colors: 256, transparency: true,  interlaced: false, targetKB: 30 },
        { suffix: "_m",    container: 125, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false, targetKB: 40 },
        { suffix: "_l",    container: 150, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false, targetKB: 50 },
        { suffix: "_xl",   container: 200, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false, targetKB: 60 },
        { suffix: "_xxl",  container: 250, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false, targetKB: 70 }
    ];

    var versionsH = [
        { suffix: "_xxxs", container: 25,  canvasPct: 0, png8: true,  colors:  64, transparency: true,  interlaced: false },
        { suffix: "_xxs",  container: 50,  canvasPct: 0, png8: true,  colors:  64, transparency: true,  interlaced: false },
        { suffix: "_xs",   container: 75,  canvasPct: 0, png8: true,  colors: 128, transparency: true,  interlaced: false },
        { suffix: "_s",    container: 100, canvasPct: 0, png8: true,  colors: 256, transparency: true,  interlaced: false },
        { suffix: "_m",    container: 125, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false },
        { suffix: "_l",    container: 150, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false },
        { suffix: "_xl",   container: 200, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false },
        { suffix: "_xxl",  container: 250, canvasPct: 0, png8: false, colors: 256, transparency: true,  interlaced: false }
    ];


    var defaultBaseName = mainName;
    try {
        if (app.documents.length) {
            defaultBaseName = app.activeDocument.name.replace(/\.[^\.]+$/, '');
        }
    } catch (e) {}

    var shiftOverride = false;

    var settingsDlg = new Window("dialog", "General Settings");
    settingsDlg.orientation = "column";
    settingsDlg.alignChildren = ["fill", "top"];

    var presetGroup = settingsDlg.add("group");
    presetGroup.add("statictext", undefined, "Preset Name:");
    var presetDropdown = presetGroup.add("dropdownlist", undefined, PRESET_BASENAMES.slice(0));
    presetDropdown.minimumSize.width = 280;

    var nameGroup = settingsDlg.add("group");
    nameGroup.add("statictext", undefined, "File Name:");
    var baseNameInput = nameGroup.add("edittext", undefined, defaultBaseName);
    baseNameInput.characters = 32;
    settingsDlg.add("statictext", undefined, "Pick a preset to auto-apply options (and show its note), or type a custom base name. Suffixes and .png are added automatically.");

    var notePanel = settingsDlg.add("panel", undefined, "Preset Note");
    notePanel.orientation = "column";
    notePanel.alignChildren = ["fill", "top"];
    var presetNote = notePanel.add("edittext", undefined, "", {multiline: true});
    presetNote.readonly = true;
    presetNote.preferredSize.width = 420;
    presetNote.preferredSize.height = 60;

    (function seedPresetSelection() {
        for (var i = 0; i < PRESET_BASENAMES.length; i++) {
            if (PRESET_BASENAMES[i] === defaultBaseName) {
                presetDropdown.selection = i;
                break;
            }
        }
    })();

    var dimGroup = settingsDlg.add("group");
    dimGroup.add("statictext", undefined, "Dimension Mode:");
    var dimDropdown = dimGroup.add("dropdownlist", undefined, ["W", "H", "A"]);
    for (var d = 0; d < dimDropdown.items.length; d++) {
        if (dimDropdown.items[d].text === dimensionMode) {
            dimDropdown.selection = d;
            break;
        }
    }
    settingsDlg.add("statictext", undefined, "W = width-based, H = height-based, A = auto-choose by document aspect.");

    var canvasPanel = settingsDlg.add("panel", undefined, "Canvas Expansion % (height-only)");
    canvasPanel.orientation = "column";
    canvasPanel.alignChildren = ["fill", "top"];

    var wGrp = canvasPanel.add("group");
    wGrp.add("statictext", undefined, "W canvas expansion:");
    var wCanvasInput = wGrp.add("edittext", undefined, String(wCanvasExp || 0));
    wCanvasInput.characters = 8;
    canvasPanel.add("statictext", undefined, "Percent added to canvas height after resizing when Mode=W (0 keeps size).");

    var hGrp = canvasPanel.add("group");
    hGrp.add("statictext", undefined, "H canvas expansion:");
    var hCanvasInput = hGrp.add("edittext", undefined, String(hCanvasExp || 0));
    hCanvasInput.characters = 8;
    canvasPanel.add("statictext", undefined, "Percent added to canvas height after resizing when Mode=H (0 keeps size).");

    var aGrp = canvasPanel.add("group");
    aGrp.add("statictext", undefined, "A canvas expansion:");
    var aCanvasInput = aGrp.add("edittext", undefined, String(aCanvasExp || 0));
    aCanvasInput.characters = 8;
    canvasPanel.add("statictext", undefined, "Percent added to canvas height after resizing when Mode=A (0 keeps size).");

    var colorGrp = settingsDlg.add("group");
    colorGrp.add("statictext", undefined, "Color Mode:");
    var colorDropdown = colorGrp.add("dropdownlist", undefined, ["normal", "forceWhite", "forceBlack", "forceCustom"]);
    colorDropdown.selection = 0;

    var hexGrp = settingsDlg.add("group");
    hexGrp.add("statictext", undefined, "Custom Hex (#RRGGBB):");
    var hexInput = hexGrp.add("edittext", undefined, customHex || "#ffffff");
    hexInput.characters = 10;
    hexGrp.visible = false;

    // Index Color UI (controlled availability)
    var indexGrp = settingsDlg.add("group");
    indexGrp.add("statictext", undefined, "Index Color:");
    var indexColorDropdown = indexGrp.add("dropdownlist", undefined, ["normal", "forceWhite", "forceBlack", "force #dddad5"]);
    indexColorDropdown.selection = 0;
    indexGrp.enabled = false;

    settingsDlg.add("statictext", undefined, "normal = unchanged; forceWhite/forceBlack/forceCustom recolors non-transparent pixels (alpha preserved).");

    var tipText = settingsDlg.add("statictext", undefined, "Tip: Hold Shift while clicking OK to save in the parent folder.");
    tipText.alignment = "left";

    var btnGroup = settingsDlg.add("group");
    btnGroup.alignment = "center";
    var okBtn = btnGroup.add("button", undefined, "OK", { name: "ok" });
    btnGroup.add("button", undefined, "Cancel", { name: "cancel" });

    // --- Helpers to keep the preset UI reliable and in-sync ---
    function resolvePresetName(name) {
        if (!name && name !== 0) return "";
        var raw = String(name).replace(/^\s+|\s+$/g, '');
        var lower = raw.toLowerCase();
        for (var i = 0; i < PRESET_BASENAMES.length; i++) {
            if (PRESET_BASENAMES[i].toLowerCase() === lower) {
                return PRESET_BASENAMES[i];
            }
        }
        return raw;
    }

    function syncPresetDropdownSelection(name) {
        var idx = -1;
        for (var i = 0; i < PRESET_BASENAMES.length; i++) {
            if (PRESET_BASENAMES[i] === name) { idx = i; break; }
        }
        if (idx >= 0) {
            presetDropdown.selection = idx;
        } else {
            presetDropdown.selection = null;
        }
    }

    function getPresetInfo(name) {
        var key = resolvePresetName(name);
        return PRESET_INFO[key] || null;
    }

    function getOutputBaseName(name) {
        var p = getPresetInfo(name);
        return (p && p.outputBaseName) ? p.outputBaseName : name;
    }

    function setDimDropdownTo(val) {
        for (var i = 0; i < dimDropdown.items.length; i++) {
            if (dimDropdown.items[i].text === val) {
                dimDropdown.selection = i;
                break;
            }
        }
    }

    function setColorDropdownTo(val) {
        for (var i = 0; i < colorDropdown.items.length; i++) {
            if (colorDropdown.items[i].text === val) {
                colorDropdown.selection = i;
                break;
            }
        }
        hexGrp.visible = (val === "forceCustom");
    }

    function setCanvasInputsEnabled(enabled) {
        wCanvasInput.enabled = enabled;
        hCanvasInput.enabled = enabled;
        aCanvasInput.enabled = enabled;
    }

    function updatePresetNote(text) {
        presetNote.text = text || "";
        try { settingsDlg.layout.layout(true); } catch (e) {}
    }

    function applyPresetToUI(presetNameInput) {
        var resolvedName = resolvePresetName(presetNameInput);
        var p = PRESET_INFO[resolvedName] || null;
        var hasChildren = p && p.children && p.children.length > 0;

        baseNameInput.text = resolvedName;
        syncPresetDropdownSelection(resolvedName);

        // Unlock Index Color only for logo_index or all_main_logo_presets
        indexGrp.enabled = (resolvedName === "brand-logo-horizontal-index" || resolvedName === "all_main_logo_presets");

        if (!p) {
            updatePresetNote("");
            setCanvasInputsEnabled(true);
            setColorDropdownTo("normal");
            return;
        }

        if (!hasChildren) {
            setDimDropdownTo(p.mode || "W");
            setColorDropdownTo(p.colorMode || "normal");
            if (p.colorMode === "forceCustom" && p.customHex) {
                hexInput.text = p.customHex;
            }
        }

        setCanvasInputsEnabled(!(p.brand === true || hasChildren));
        if (p.brand === true || hasChildren) {
            wCanvasInput.text = "0";
            hCanvasInput.text = "0";
            aCanvasInput.text = "0";
        }
        updatePresetNote(p.note || "");
    }

    presetDropdown.onChange = function () {
        if (presetDropdown.selection) {
            var chosen = String(presetDropdown.selection.text);
            applyPresetToUI(chosen);
        }
    };

    baseNameInput.onChanging = function () {
        applyPresetToUI(baseNameInput.text);
    };

    colorDropdown.onChange = function () {
        var modeTxt = colorDropdown.selection ? colorDropdown.selection.text : "normal";
        hexGrp.visible = (modeTxt === "forceCustom");
        var info = getPresetInfo(baseNameInput.text);
        updatePresetNote(info ? info.note : "");
    };

    settingsDlg.onShow = function () {
        var seedName = baseNameInput.text || (presetDropdown.selection ? String(presetDropdown.selection.text) : "");
        if (seedName) applyPresetToUI(seedName);
    };

    okBtn.onClick = function () {
        try { shiftOverride = !!ScriptUI.environment.keyboardState.shiftKey; } catch (e) { shiftOverride = false; }
        settingsDlg.close(1);
    };

    if (settingsDlg.show() != 1) {
        return;
    }

    mainName = baseNameInput.text;
    var selectedPresetNameAfterUI = resolvePresetName(mainName);
    dimensionMode = dimDropdown.selection.text;
    colorMode = colorDropdown.selection.text;
    customHex = hexInput.text;
    var indexColorChoice = indexColorDropdown.selection ? String(indexColorDropdown.selection.text) : "normal";

    var wExpVal = parseFloat(wCanvasInput.text);
    var hExpVal = parseFloat(hCanvasInput.text);
    var aExpVal = parseFloat(aCanvasInput.text);
    wCanvasExp = isNaN(wExpVal) ? 0 : wExpVal;
    hCanvasExp = isNaN(hExpVal) ? 0 : hExpVal;
    aCanvasExp = isNaN(aExpVal) ? 0 : aExpVal;

    if (!app.documents.length) {
        alert("Error: No open document! Please open an image before running this script.");
        return;
    }
    var doc = app.activeDocument;
    if (!mainName) {
        mainName = doc.name.replace(/\.[^\.]+$/, '');
    }

    var selectedPreset = getPresetInfo(mainName);
    var isMacro = !!(selectedPreset && selectedPreset.children && selectedPreset.children.length);
    var enforcedRotateDeg = (selectedPreset && selectedPreset.rotate) ? selectedPreset.rotate : 0;
    var lockCanvas = !!(selectedPreset && (selectedPreset.brand === true || (selectedPreset.children && selectedPreset.children.length)));

    if (selectedPreset && !isMacro) {
        dimensionMode = selectedPreset.mode || dimensionMode;
        colorMode = selectedPreset.colorMode || colorMode;
        if (selectedPreset.colorMode === "forceCustom" && selectedPreset.customHex) {
            customHex = selectedPreset.customHex;
        }
    }

    function cloneVersions(arr) {
        var out = [];
        for (var i = 0; i < arr.length; i++) {
            var v = arr[i];
            out.push({
                suffix: v.suffix,
                container: v.container,
                canvasPct: v.canvasPct,
                png8: v.png8,
                colors: v.colors,
                transparency: v.transparency,
                interlaced: v.interlaced,
                targetKB: v.targetKB
            });
        }
        return out;
    }

    function showPerVersionDialogFor(setType, inputVersions) {
        var title = (setType === "W")
            ? "Set Target File Sizes (KB) and Container Sizes (W-mode)"
            : "Set Colors (PNG-8) and Container Sizes (H-mode)";

        var dlg = new Window("dialog", title);
        dlg.orientation = "column";
        dlg.alignChildren = ["fill", "top"];

        dlg.add("statictext", undefined, "Container is the base size; script outputs at container × 2.");
        if (setType === "W") {
            dlg.add("statictext", undefined, "Target (KB) aims at size by adjusting PNG-8 colors; PNG-24 rows save as full color.");
        } else {
            dlg.add("statictext", undefined, "Colors applies to PNG-8 rows (2–256); PNG-24 rows are full color.");
        }
        dlg.add("statictext", undefined, "Tip: Hold Shift while clicking OK to save in the parent folder.");

        var entries = [];
        for (var i = 0; i < inputVersions.length; i++) {
            var ver = inputVersions[i];
            var grp = dlg.add("group");
            grp.orientation = "row";
            grp.add("statictext", undefined, ver.suffix + ": ");

            var targetInp;
            if (setType === "W") {
                grp.add("statictext", undefined, "Target (KB):");
                targetInp = grp.add("edittext", undefined, (ver.targetKB || 20).toString());
                targetInp.characters = 6;
            } else {
                if (ver.png8) {
                    grp.add("statictext", undefined, "Colors:");
                    targetInp = grp.add("edittext", undefined, (ver.colors || 256).toString());
                    targetInp.characters = 6;
                } else {
                    targetInp = grp.add("statictext", undefined, "PNG-24");
                }
            }

            grp.add("statictext", undefined, "Container:");
            var contInp = grp.add("edittext", undefined, ver.container.toString());
            contInp.characters = 6;

            entries.push({ ver: ver, target: targetInp, container: contInp, isPNG8: ver.png8 });
        }

        var bgrp = dlg.add("group");
        bgrp.alignment = "center";
        var okB = bgrp.add("button", undefined, "OK", { name: "ok" });
        bgrp.add("button", undefined, "Cancel", { name: "cancel" });

        okB.onClick = function () {
            try { shiftOverride = shiftOverride || !!ScriptUI.environment.keyboardState.shiftKey; } catch (e) {}
            dlg.close(1);
        };

        if (dlg.show() != 1) return null;

        for (var j = 0; j < entries.length; j++) {
            var e = entries[j];
            var contVal = parseInt(e.container.text, 10);
            if (!isNaN(contVal)) {
                e.ver.container = contVal;
            }
            if (setType === "W") {
                var t = parseInt(e.target.text, 10);
                if (!isNaN(t)) e.ver.targetKB = t;
            } else {
                if (e.ver.png8 && e.isPNG8 && e.target && e.target.text !== "PNG-24") {
                    var c = parseInt(e.target.text, 10);
                    if (!isNaN(c)) e.ver.colors = c;
                }
            }
        }
        return inputVersions;
    }

    var versionsForW = cloneVersions(versionsW);
    var versionsForH = cloneVersions(versionsH);

    function mapIndexChoiceToColor(indexChoiceText) {
        var t = String(indexChoiceText || "normal");
        if (t === "forceWhite") return { mode: "forceWhite", hex: "" };
        if (t === "forceBlack") return { mode: "forceBlack", hex: "" };
        if (t === "force #dddad5") return { mode: "forceCustom", hex: "#dddad5" };
        return { mode: "normal", hex: "" };
    }

    if (!isMacro) {
        var containerSetType = "";
        if (dimensionMode === "W" || dimensionMode === "H") {
            containerSetType = dimensionMode;
        } else {
            var docW = doc.width.as("px");
            var docH = doc.height.as("px");
            containerSetType = (docW >= docH) ? "W" : "H";
        }

        var adjusted = (containerSetType === "W")
            ? showPerVersionDialogFor("W", versionsForW)
            : showPerVersionDialogFor("H", versionsForH);
        if (!adjusted) return;

        var methodLog = [];
        var baseCanvasPct = (dimensionMode === "W") ? wCanvasExp : ((dimensionMode === "H") ? hCanvasExp : aCanvasExp);
        var runtimeCanvasPct = lockCanvas ? 0 : baseCanvasPct;

        // Determine effective color selection for this run
        var effectiveColorMode = colorMode;
        var effectiveCustomHex = customHex;
        if (resolvePresetName(mainName) === "brand-logo-horizontal-index") {
            var idxSel = mapIndexChoiceToColor(indexColorChoice);
            effectiveColorMode = idxSel.mode;
            effectiveCustomHex = idxSel.hex;
        }

        var list = (containerSetType === "W") ? versionsForW : versionsForH;
        for (var k = 0; k < list.length; k++) {
            var v = list[k];
            processVersion(
                v.suffix,
                v.container,
                runtimeCanvasPct,
                v.png8,
                v.colors,
                v.transparency,
                v.interlaced,
                effectiveColorMode,
                effectiveCustomHex,
                enforcedRotateDeg,
                methodLog,
                (containerSetType === "W") ? v.targetKB : v.colors
            );
        }

        if (methodLog.length > 0) {
            alert("Export Complete. Settings and File Sizes:\n\n" + methodLog.join("\n"));
        }
        return;
    }

    if (isMacro) {
        var children = selectedPreset.children.slice(0);
        var needsW = false, needsH = false;
        for (var iC = 0; iC < children.length; iC++) {
            var cp = PRESET_INFO[children[iC]];
            if (cp && cp.mode === "W") needsW = true;
            if (cp && cp.mode === "H") needsH = true;
        }

        if (needsW) {
            var adjW = showPerVersionDialogFor("W", versionsForW);
            if (!adjW) return;
        }
        if (needsH) {
            var adjH = showPerVersionDialogFor("H", versionsForH);
            if (!adjH) return;
        }

        var originalMain = mainName;
        var originalDim = dimensionMode;
        var originalColor = colorMode;
        var originalHex = customHex;

        var methodLog2 = [];

        for (var ci = 0; ci < children.length; ci++) {
            var childName = children[ci];
            var pinfo = PRESET_INFO[childName];
            if (!pinfo) continue;

            mainName = childName;
            dimensionMode = pinfo.mode || "W";

            // Determine color per child; override for brand-logo-horizontal-index with Index Color selection
            var childColorMode = pinfo.colorMode || "normal";
            var childCustomHex = (pinfo.colorMode === "forceCustom") ? (pinfo.customHex || "#ffffff") : "";
            if (childName === "brand-logo-horizontal-index") {
                var ix = mapIndexChoiceToColor(indexColorChoice);
                childColorMode = ix.mode;
                childCustomHex = (ix.mode === "forceCustom") ? ix.hex : "";
            }

            var childRotate = pinfo.rotate || 0;
            var runtimeCanvasPctChild = 0;

            var listChild = (dimensionMode === "W") ? versionsForW : versionsForH;

            for (var vk = 0; vk < listChild.length; vk++) {
                var vv = listChild[vk];
                processVersion(
                    vv.suffix,
                    vv.container,
                    runtimeCanvasPctChild,
                    vv.png8,
                    vv.colors,
                    vv.transparency,
                    vv.interlaced,
                    childColorMode,
                    childCustomHex,
                    childRotate,
                    methodLog2,
                    (dimensionMode === "W") ? vv.targetKB : vv.colors
                );
            }
        }

        mainName = originalMain;
        dimensionMode = originalDim;
        colorMode = originalColor;
        customHex = originalHex;

        if (methodLog2.length > 0) {
            alert("Export Complete. Settings and File Sizes:\n\n" + methodLog2.join("\n"));
        }
        return;
    }

    // --- Resampling safety: pick the best available enum and log via map ---
    function getResampleFallback() {
        var candidates = [];
        try { if (ResampleMethod.PRESERVEDETAILS2) candidates.push(ResampleMethod.PRESERVEDETAILS2); } catch (e0) {}
        try { if (ResampleMethod.PRESERVEDETAILS)  candidates.push(ResampleMethod.PRESERVEDETAILS); }  catch (e1) {}
        try { if (ResampleMethod.BICUBICSHARPER)   candidates.push(ResampleMethod.BICUBICSHARPER); }   catch (e2) {}
        try { if (ResampleMethod.BICUBICAUTOMATIC) candidates.push(ResampleMethod.BICUBICAUTOMATIC); } catch (e3) {}
        try { if (ResampleMethod.AUTOMATIC)        candidates.push(ResampleMethod.AUTOMATIC); }        catch (e4) {}
        try { if (ResampleMethod.BICUBIC)          candidates.push(ResampleMethod.BICUBIC); }          catch (e5) {}
        try { if (ResampleMethod.BILINEAR)         candidates.push(ResampleMethod.BILINEAR); }         catch (e6) {}
        try { if (ResampleMethod.NEARESTNEIGHBOR)  candidates.push(ResampleMethod.NEARESTNEIGHBOR); }  catch (e7) {}
        return candidates.length ? candidates[0] : null;
    }
    var pd2Method = getResampleFallback();

    function getResampleMethodName(rm) {
        var map = {};
        try { map[ResampleMethod.BICUBIC] = "BICUBIC"; } catch (e) {}
        try { map[ResampleMethod.BICUBICSHARPER] = "BICUBICSHARPER"; } catch (e) {}
        try { map[ResampleMethod.BILINEAR] = "BILINEAR"; } catch (e) {}
        try { map[ResampleMethod.NEARESTNEIGHBOR] = "NEARESTNEIGHBOR"; } catch (e) {}
        try { map[ResampleMethod.PRESERVEDETAILS] = "PRESERVEDETAILS"; } catch (e) {}
        try { map[ResampleMethod.PRESERVEDETAILS2] = "PRESERVEDETAILS2"; } catch (e) {}
        try { map[ResampleMethod.BICUBICAUTOMATIC] = "BICUBICAUTOMATIC"; } catch (e) {}
        try { map[ResampleMethod.AUTOMATIC] = "AUTOMATIC"; } catch (e) {}
        return map[rm] || "UNKNOWN";
    }

    function parseHexToRGB(hex) {
        if (!hex) return null;
        var s = String(hex).replace(/\s+/g, '');
        if (s.charAt(0) === '#') s = s.substring(1);
        if (s.length !== 6) return null;
        var r = parseInt(s.substring(0, 2), 16);
        var g = parseInt(s.substring(2, 4), 16);
        var b = parseInt(s.substring(4, 6), 16);
        if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
        return { r: r, g: g, b: b };
    }

    // --- Build a single-layer, 8-bit, sRGB "safe" doc to avoid Save for Web endian errors ---
    function makeSafeDocForExport(srcDoc) {
        var prevDoc = app.activeDocument;
        var safeDoc = null;
        var prevDialogs = app.displayDialogs;
        app.displayDialogs = DialogModes.NO;
        try {
            app.activeDocument = srcDoc;
            if (srcDoc.mode !== DocumentMode.RGB) srcDoc.changeMode(ChangeMode.RGB);
            srcDoc.bitsPerChannel = BitsPerChannelType.EIGHT;

            // Copy-merged and paste into a fresh transparent doc of exact size
            srcDoc.selection.selectAll();
            srcDoc.selection.copy(true);
            safeDoc = app.documents.add(srcDoc.width, srcDoc.height, srcDoc.resolution, "SAFE_EXPORT", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
            safeDoc.paste();
            if (safeDoc.mode !== DocumentMode.RGB) safeDoc.changeMode(ChangeMode.RGB);
            safeDoc.bitsPerChannel = BitsPerChannelType.EIGHT;
            safeDoc.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false);
        } catch (e) {
            // If anything fails, fall back to using the source doc itself.
            safeDoc = srcDoc;
        } finally {
            try { app.activeDocument = prevDoc; } catch (e2) {}
            app.displayDialogs = prevDialogs;
        }
        return safeDoc;
    }

    function processVersion(suffix, containerSize, canvasPct, isPNG8, numColors, doTrans, doInterlace, colorModeValue, customHexValue, rotateDegrees, logArray, targetValue) {
        var newDoc = doc.duplicate(doc.name + suffix, true);

        if (rotateDegrees && rotateDegrees !== 0) {
            try { newDoc.rotateCanvas(rotateDegrees); } catch (e) {}
        }

        var origW = newDoc.width.as("px");
        var origH = newDoc.height.as("px");

        var finalDim = containerSize * 2;
        var targetW, targetH;

        if (dimensionMode === "H") {
            targetH = finalDim;
            var ratioW = origW / origH;
            targetW = finalDim * ratioW;
        } else if (dimensionMode === "W") {
            targetW = finalDim;
            var ratioH = origH / origW;
            targetH = finalDim * ratioH;
        } else {
            var docW = origW, docH = origH;
            var setType = (docW >= docH) ? "W" : "H";
            if (setType === "W") {
                targetW = finalDim;
                targetH = finalDim * (origH / origW);
            } else {
                targetH = finalDim;
                targetW = finalDim * (origW / origH);
            }
        }

        var sharpMethod = null;
        try { sharpMethod = ResampleMethod.BICUBICSHARPER; } catch (e) {}
        var chosenResampleMethod = (suffix.indexOf("_blur") !== -1 && sharpMethod) ? sharpMethod : pd2Method;
        if (!chosenResampleMethod) {
            try { chosenResampleMethod = ResampleMethod.BICUBIC; } catch (e) {}
        }

        newDoc.resizeImage(
            UnitValue(targetW, "px"),
            UnitValue(targetH, "px"),
            newDoc.resolution,
            chosenResampleMethod
        );

        if (canvasPct > 0) {
            var wVal = newDoc.width.value;
            var hVal = newDoc.height.value;
            var newHeightVal = hVal * (1 + canvasPct / 100);
            newDoc.resizeCanvas(
                UnitValue(wVal, newDoc.width.type),
                UnitValue(newHeightVal, newDoc.height.type),
                AnchorPosition.MIDDLECENTER
            );
        }

        applyColorMode(newDoc, colorModeValue, customHexValue);

        // Choose output folder, with fallback if source doc has never been saved
        var docFolder = (doc.path && doc.path.fsName) ? new Folder(doc.path) : Folder.myDocuments;
        var shiftIsDown = false;
        try {
            shiftIsDown = shiftOverride || !!ScriptUI.environment.keyboardState.shiftKey;
        } catch (e) {
            shiftIsDown = shiftOverride;
        }
        if (shiftIsDown && docFolder && docFolder.parent) {
            docFolder = docFolder.parent;
        }
        var saveBaseName = getOutputBaseName(mainName);
        var saveFile = new File(docFolder.fsName + "/" + saveBaseName + suffix + ".png");

        // Build a safe, single-layer, 8-bit sRGB doc for export to avoid Save-for-Web endian errors
        var safeDoc = makeSafeDocForExport(newDoc);
        var prevDoc = app.activeDocument;
        try {
            app.activeDocument = safeDoc;

            var finalColorsUsed = isPNG8 ? Math.min(Math.max(numColors || 256, 2), 256) : 256;

            var setTypeForExport = (dimensionMode === "W") ? "W" : ((dimensionMode === "H") ? "H" : "W");
            if (setTypeForExport === "W") {
                if (isPNG8) {
                    finalColorsUsed = savePNGWithTargetSize(saveFile, doTrans, doInterlace, targetValue, 2, 256);
                } else {
                    exportAsPNG(saveFile, false, 256, doTrans, doInterlace);
                }
            } else {
                if (isPNG8) {
                    exportAsPNG(saveFile, true, finalColorsUsed, doTrans, doInterlace);
                } else {
                    exportAsPNG(saveFile, false, 256, doTrans, doInterlace);
                }
            }

            var f = new File(saveFile.fsName);
            var finalSizeKB = f.exists ? Math.round(f.length / 1024) : 0;

            logArray.push(
                saveBaseName + suffix + ".png" +
                " | Resample: " + getResampleMethodName(chosenResampleMethod) +
                " | PNG: " + (isPNG8 ? ("8 (" + (isNaN(finalColorsUsed) ? "var" : finalColorsUsed) + " colors)") : "24") +
                " | Size: " + finalSizeKB + " KB"
            );
        } catch (e) {
            logArray.push(saveBaseName + suffix + ".png" + " | Export failed: " + e);
        } finally {
            try { app.activeDocument = prevDoc; } catch (e2) {}
            try {
                if (safeDoc && safeDoc !== newDoc) safeDoc.close(SaveOptions.DONOTSAVECHANGES);
            } catch (e3) {}
        }

        newDoc.close(SaveOptions.DONOTSAVECHANGES);
    }

    function applyColorMode(docRef, mode, customHexOpt) {
        if (mode === "normal") return;

        var prevDialogs = app.displayDialogs;
        var prevFG = app.foregroundColor;
        var prevDoc;
        try { prevDoc = app.activeDocument; } catch (e) {}

        app.displayDialogs = DialogModes.NO;

        try {
            try { app.activeDocument = docRef; } catch (e) {}

            if (docRef.mode !== DocumentMode.RGB) {
                docRef.changeMode(ChangeMode.RGB);
            }
            docRef.bitsPerChannel = BitsPerChannelType.EIGHT;

            docRef.selection.selectAll();
            docRef.selection.copy(true);
            var stamp = docRef.paste();
            stamp.name = "FORCED_COLOR";
            stamp.move(docRef, ElementPlacement.PLACEATBEGINNING);
            docRef.activeLayer = stamp;

            // recolor non‑transparent pixels only
            stamp.transparentPixelsLocked = true;

            var sc = new SolidColor();
            if (mode === "forceWhite") {
                sc.rgb.red = 255; sc.rgb.green = 255; sc.rgb.blue = 255;
            } else if (mode === "forceBlack") {
                sc.rgb.red = 0; sc.rgb.green = 0; sc.rgb.blue = 0;
            } else if (mode === "forceCustom") {
                var rgb = parseHexToRGB(customHexOpt);
                if (!rgb) { rgb = { r: 255, g: 255, b: 255 }; }
                sc.rgb.red = rgb.r; sc.rgb.green = rgb.g; sc.rgb.blue = rgb.b;
            } else {
                return;
            }
            app.foregroundColor = sc;

            docRef.selection.selectAll();
            docRef.selection.fill(app.foregroundColor, ColorBlendMode.NORMAL, 100, true);
            docRef.selection.deselect();
        } catch (e) {
        } finally {
            try { app.foregroundColor = prevFG; } catch (e) {}
            try { if (prevDoc) app.activeDocument = prevDoc; } catch (e) {}
            app.displayDialogs = prevDialogs;
        }
    }

    function savePNGWithTargetSize(file, transparency, interlaced, targetSizeKB, minColors, maxColors) {
        var low = Math.max(2, minColors | 0);
        var high = Math.min(256, maxColors | 0);
        var bestColors = high;

        while (low <= high) {
            var mid = Math.floor((low + high) / 2);
            exportAsPNG(file, true, mid, transparency, interlaced);
            var f = new File(file.fsName);
            var fileSizeKB = f.exists ? Math.round(f.length / 1024) : 0;

            if (fileSizeKB <= targetSizeKB) {
                bestColors = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        exportAsPNG(file, true, bestColors, transparency, interlaced);
        return bestColors;
    }

    // Export using Save for Web when possible; suppress dialogs; fall back to Save As PNG on failure.
    function exportAsPNG(file, png8, colors, transparency, interlaced) {
        var prevDialogs = app.displayDialogs;
        app.displayDialogs = DialogModes.NO;
        try {
            if (activeDocument.mode !== DocumentMode.RGB) {
                activeDocument.changeMode(ChangeMode.RGB);
            }
            activeDocument.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false);
            activeDocument.bitsPerChannel = BitsPerChannelType.EIGHT;

            var opts = new ExportOptionsSaveForWeb();
            opts.format = SaveDocumentType.PNG;
            opts.PNG8 = png8;
            opts.transparency = transparency;
            opts.interlaced = interlaced;

            if (png8) {
                var safeColors = Math.min(Math.max(colors, 2), 256);
                opts.colors = safeColors;
                opts.colorReduction = ColorReductionType.ADAPTIVE;
                opts.dither = Dither.NONE;
                opts.ditherAmount = 0;
            }

            activeDocument.exportDocument(file, ExportType.SAVEFORWEB, opts);
        } catch (e) {
            // Fallback: Save As PNG (PNG‑24). This bypasses SFW "endian type" issues (legacy feature).
            // Known: Save As PNG will not honor PNG‑8 color counts or targets.
            try {
                var pngOpts = new PNGSaveOptions();
                pngOpts.interlaced = interlaced === true;
                activeDocument.saveAs(file, pngOpts, true, Extension.LOWERCASE);
            } catch (ee) {
                throw ee;
            }
        } finally {
            app.displayDialogs = prevDialogs;
        }
    }

})();
