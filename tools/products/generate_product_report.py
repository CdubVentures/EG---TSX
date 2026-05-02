#!/usr/bin/env python3
"""
Product Catalog Report Generator
Scans all JSON product files and generates a pretty HTML report.
Output: tools/products/product-report.html
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPT_DIR.parent.parent / "src" / "content" / "data-products"
OUTPUT_FILE = SCRIPT_DIR / "product-report.html"

CATEGORIES = ["mouse", "monitor", "keyboard"]


def load_products():
    products = []
    for cat in CATEGORIES:
        cat_dir = DATA_DIR / cat
        if not cat_dir.exists():
            continue
        for brand_folder in sorted(cat_dir.iterdir()):
            if not brand_folder.is_dir():
                continue
            for json_file in sorted(brand_folder.glob("*.json")):
                try:
                    with open(json_file, encoding="utf-8") as f:
                        d = json.load(f)
                    products.append({
                        "category": cat,
                        "brand": d.get("brand", ""),
                        "model": d.get("model", ""),
                        "baseModel": d.get("baseModel", ""),
                        "variant": d.get("variant", ""),
                        "slug": d.get("slug", ""),
                        "file": str(json_file.relative_to(DATA_DIR)),
                    })
                except (json.JSONDecodeError, UnicodeDecodeError) as e:
                    print(f"  WARN: skipped {json_file.name}: {e}")
    return products


def count_stats(products):
    stats = {}
    for p in products:
        cat = p["category"]
        brand = p["brand"]
        if cat not in stats:
            stats[cat] = {"total": 0, "brands": {}}
        stats[cat]["total"] += 1
        if brand not in stats[cat]["brands"]:
            stats[cat]["brands"][brand] = 0
        stats[cat]["brands"][brand] += 1
    return stats


def build_html(products, stats):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total = len(products)

    cat_totals = []
    for cat in CATEGORIES:
        if cat in stats:
            cat_totals.append(f'<span class="stat-chip {cat}">{cat.title()}: {stats[cat]["total"]}</span>')

    cat_chips_html = "\n            ".join(cat_totals)

    # Build table rows grouped by category then brand
    rows = []
    current_cat = None
    current_brand = None
    row_idx = 0

    for p in sorted(products, key=lambda x: (CATEGORIES.index(x["category"]), x["brand"].lower(), x["model"].lower())):
        cat = p["category"]
        brand = p["brand"]

        # Category separator
        if cat != current_cat:
            current_cat = cat
            current_brand = None
            cat_count = stats[cat]["total"]
            brand_count = len(stats[cat]["brands"])
            rows.append(
                f'<tr class="cat-header">'
                f'<td colspan="6">'
                f'<span class="cat-icon">{get_cat_icon(cat)}</span> '
                f'{cat.title()} '
                f'<span class="cat-meta">{cat_count} products &middot; {brand_count} brands</span>'
                f'</td></tr>'
            )

        # Brand separator
        if brand != current_brand:
            current_brand = brand
            brand_count = stats[cat]["brands"][brand]
            rows.append(
                f'<tr class="brand-header">'
                f'<td colspan="6">{brand} <span class="brand-count">({brand_count})</span></td>'
                f'</tr>'
            )

        row_idx += 1
        variant_display = p["variant"] if p["variant"] else '<span class="empty-variant">&mdash;</span>'
        base_display = p["baseModel"] if p["baseModel"] else '<span class="empty-variant">&mdash;</span>'

        rows.append(
            f'<tr class="product-row">'
            f'<td class="row-num">{row_idx}</td>'
            f'<td class="col-model">{esc(p["model"])}</td>'
            f'<td class="col-base">{esc(p["baseModel"]) if p["baseModel"] else "<span class=empty-variant>&mdash;</span>"}</td>'
            f'<td class="col-variant">{esc(p["variant"]) if p["variant"] else "<span class=empty-variant>&mdash;</span>"}</td>'
            f'<td class="col-slug">{esc(p["slug"])}</td>'
            f'<td class="col-file">{esc(p["file"])}</td>'
            f'</tr>'
        )

    table_rows = "\n          ".join(rows)

    # Build brand index for sidebar
    brand_index = []
    for cat in CATEGORIES:
        if cat not in stats:
            continue
        brand_index.append(f'<div class="sidebar-cat">{get_cat_icon(cat)} {cat.title()}</div>')
        for brand_name in sorted(stats[cat]["brands"].keys(), key=str.lower):
            count = stats[cat]["brands"][brand_name]
            brand_index.append(f'<div class="sidebar-brand">{brand_name} <span class="brand-count">({count})</span></div>')

    sidebar_html = "\n          ".join(brand_index)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Product Catalog Report</title>
  <style>
    :root {{
      --bg: #0d1117;
      --surface: #161b22;
      --surface2: #1c2333;
      --border: #30363d;
      --text: #e6edf3;
      --text-muted: #8b949e;
      --accent: #58a6ff;
      --accent2: #3fb950;
      --mouse: #da6b2b;
      --monitor: #8957e5;
      --keyboard: #d2a8ff;
      --cat-bg: #21262d;
      --brand-bg: #161b22;
      --hover: #1f2a3a;
      --radius: 8px;
    }}

    * {{ margin: 0; padding: 0; box-sizing: border-box; }}

    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }}

    .layout {{
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: 100vh;
    }}

    /* Sidebar */
    .sidebar {{
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 20px 16px;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
    }}
    .sidebar h2 {{
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: 12px;
    }}
    .sidebar-cat {{
      font-weight: 600;
      font-size: 13px;
      color: var(--accent);
      margin-top: 14px;
      margin-bottom: 4px;
    }}
    .sidebar-brand {{
      font-size: 12px;
      color: var(--text-muted);
      padding: 2px 0 2px 16px;
    }}

    /* Main */
    .main {{
      padding: 24px 32px;
      overflow-x: auto;
    }}

    /* Header */
    .header {{
      margin-bottom: 24px;
    }}
    .header h1 {{
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }}
    .header .meta {{
      color: var(--text-muted);
      font-size: 13px;
      margin-bottom: 16px;
    }}
    .stats-bar {{
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }}
    .stat-chip {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid var(--border);
    }}
    .stat-chip.mouse {{ color: var(--mouse); border-color: var(--mouse); }}
    .stat-chip.monitor {{ color: var(--monitor); border-color: var(--monitor); }}
    .stat-chip.keyboard {{ color: var(--keyboard); border-color: var(--keyboard); }}
    .stat-total {{
      font-size: 15px;
      font-weight: 700;
      color: var(--accent2);
    }}

    /* Search */
    .search-bar {{
      margin-bottom: 16px;
    }}
    .search-bar input {{
      width: 100%;
      max-width: 400px;
      padding: 8px 14px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font-size: 14px;
      outline: none;
    }}
    .search-bar input:focus {{
      border-color: var(--accent);
    }}
    .search-bar input::placeholder {{
      color: var(--text-muted);
    }}

    /* Table */
    table {{
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }}
    thead {{
      position: sticky;
      top: 0;
      z-index: 10;
    }}
    thead th {{
      background: var(--surface2);
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 11px;
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }}

    .cat-header td {{
      background: var(--cat-bg);
      font-weight: 700;
      font-size: 15px;
      padding: 14px 12px 10px;
      border-bottom: 2px solid var(--border);
      color: var(--accent);
    }}
    .cat-icon {{
      font-size: 18px;
      vertical-align: middle;
    }}
    .cat-meta {{
      font-size: 12px;
      font-weight: 400;
      color: var(--text-muted);
      margin-left: 8px;
    }}

    .brand-header td {{
      background: var(--brand-bg);
      font-weight: 600;
      font-size: 13px;
      padding: 8px 12px 6px 20px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }}
    .brand-count {{
      color: var(--text-muted);
      font-weight: 400;
      font-size: 12px;
    }}

    .product-row td {{
      padding: 6px 12px;
      border-bottom: 1px solid #1c2128;
      vertical-align: middle;
    }}
    .product-row:hover td {{
      background: var(--hover);
    }}

    .row-num {{
      color: var(--text-muted);
      font-size: 11px;
      width: 36px;
      text-align: right;
      padding-right: 14px !important;
    }}

    .col-model {{
      font-weight: 600;
      color: var(--text);
      white-space: nowrap;
    }}
    .col-base {{
      color: var(--accent);
      white-space: nowrap;
    }}
    .col-variant {{
      color: var(--accent2);
      white-space: nowrap;
    }}
    .col-slug {{
      color: var(--text-muted);
      font-size: 11px;
      font-family: 'SF Mono', Consolas, monospace;
    }}
    .col-file {{
      color: var(--text-muted);
      font-size: 11px;
      font-family: 'SF Mono', Consolas, monospace;
    }}

    .empty-variant {{
      color: #484f58;
    }}

    /* Hidden rows from search */
    .hidden {{ display: none; }}
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <h2>Brands</h2>
      {sidebar_html}
    </aside>
    <main class="main">
      <div class="header">
        <h1>Product Catalog Report</h1>
        <div class="meta">Generated: {now}</div>
        <div class="stats-bar">
          <span class="stat-total">{total} Total</span>
          {cat_chips_html}
        </div>
      </div>

      <div class="search-bar">
        <input type="text" id="search" placeholder="Filter by brand, model, base, variant..." autocomplete="off">
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Model</th>
            <th>Base Model</th>
            <th>Variant</th>
            <th>Slug</th>
            <th>File</th>
          </tr>
        </thead>
        <tbody id="tbody">
          {table_rows}
        </tbody>
      </table>
    </main>
  </div>

  <script>
    const input = document.getElementById('search');
    const tbody = document.getElementById('tbody');

    input.addEventListener('input', () => {{
      const q = input.value.toLowerCase().trim();
      const rows = tbody.querySelectorAll('tr');
      let lastCatVisible = false;
      let lastBrandVisible = false;
      let lastCatRow = null;
      let lastBrandRow = null;

      rows.forEach(row => {{
        if (row.classList.contains('cat-header')) {{
          lastCatRow = row;
          lastCatVisible = false;
          row.classList.add('hidden');
          return;
        }}
        if (row.classList.contains('brand-header')) {{
          lastBrandRow = row;
          lastBrandVisible = false;
          row.classList.add('hidden');
          return;
        }}

        if (!q) {{
          row.classList.remove('hidden');
          if (lastCatRow) lastCatRow.classList.remove('hidden');
          if (lastBrandRow) lastBrandRow.classList.remove('hidden');
          return;
        }}

        const text = row.textContent.toLowerCase();
        const match = text.includes(q);
        row.classList.toggle('hidden', !match);

        if (match) {{
          if (lastCatRow) {{ lastCatRow.classList.remove('hidden'); lastCatVisible = true; }}
          if (lastBrandRow) {{ lastBrandRow.classList.remove('hidden'); lastBrandVisible = true; }}
        }}
      }});
    }});
  </script>
</body>
</html>"""


def get_cat_icon(cat):
    icons = {"mouse": "&#x1F5B1;", "monitor": "&#x1F5A5;", "keyboard": "&#x2328;"}
    return icons.get(cat, "")


def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def main():
    print(f"Scanning: {DATA_DIR}")
    products = load_products()
    print(f"Found {len(products)} products")

    stats = count_stats(products)
    for cat in CATEGORIES:
        if cat in stats:
            print(f"  {cat}: {stats[cat]['total']} products, {len(stats[cat]['brands'])} brands")

    html = build_html(products, stats)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\nReport: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
