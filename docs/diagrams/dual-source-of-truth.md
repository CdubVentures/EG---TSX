# Dual Source of Truth — Data & Image Diagrams

> These diagrams show how ONE product object provides BOTH data and images to components,
> and how the system stays consistent when products or articles are renamed.

---

## Diagram 1: Product Card — One Object, Both Data and Images

Shows how a single product JSON entry feeds both display data AND image URLs to a component.

```mermaid
flowchart TB
  subgraph JSON["PRODUCT JSON (mouse.json)"]
    direction TB
    J1["ONE product object =\n100+ fields including:"]
    J2["DATA FIELDS\nbrand: Razer\nmodel: Viper V3 Pro\nweight: 54g\noverall: 9.6\nprice_range: $159.99\nconnection: wireless\npros: [Lightweight...]\nurl: /hubs/mouse/razer/viper-v3-pro"]
    J3["MEDIA OBJECT\nimagePath: /images/mouse/razer/viper-v3-pro\nmedia.images: [\n  { stem: top, view: top },\n  { stem: feature-image, view: feature-image },\n  ...\n]"]
    J1 --> J2
    J1 --> J3
  end

  subgraph COMPONENT["PRODUCT CARD COMPONENT"]
    direction TB
    C1["Receives complete\nproduct object"]
    C2["Reads DATA directly:\nproduct.brand → heading\nproduct.model → heading\nproduct.weight → spec pill\nproduct.overall → score badge\nproduct.url → link href"]
    C3["Reads IMAGES via media helpers:\nconst img = getImage(product.media, 'top');\ncontentImage(\n  product.imagePath,\n  img.stem,\n  'm'\n)\n→ /images/mouse/razer/\n   viper-v3-pro/top_m.webp"]
    C1 --> C2
    C1 --> C3
  end

  subgraph RENDER["RENDERED HTML"]
    direction TB
    R1["<h3>Razer Viper V3 Pro</h3>\n<span>54g</span>\n<span>9.6/10</span>\n<img src='...top---white+black_m.webp'>\n<a href='/hubs/mouse/razer/viper-v3-pro'>"]
  end

  JSON ==> COMPONENT
  COMPONENT ==> RENDER

  style JSON fill:#16213e,stroke:#0f3460,color:#eee
  style COMPONENT fill:#064e3b,stroke:#10b981,color:#eee
  style RENDER fill:#2d1b69,stroke:#8b5cf6,color:#eee
  style J1 fill:#16213e,stroke:#0f3460,color:#eee
  style J2 fill:#1a4731,stroke:#10b981,color:#eee
  style J3 fill:#92400e,stroke:#f59e0b,color:#eee
  style C1 fill:#064e3b,stroke:#10b981,color:#eee
  style C2 fill:#1a4731,stroke:#10b981,color:#eee
  style C3 fill:#92400e,stroke:#f59e0b,color:#eee
  style R1 fill:#2d1b69,stroke:#8b5cf6,color:#eee
```

---

## Diagram 2: Review Page — Two Sources Merge

Shows how a review page loads editorial content from frontmatter AND hardware data + images from the product JSON.

```mermaid
flowchart TB
  subgraph REVIEW["REVIEW FRONTMATTER"]
    direction TB
    RF1["alienware-aw610m-review/index.md"]
    RF2["EDITORIAL DATA\ntitle: Alienware AW610M Review...\nverdict: The AW610M's bold design...\npros: [Daring design, Well built...]\ncons: [Heavy, Awkward buttons...]\nauthor: Maze"]
    RF3["BRIDGE FIELD\nproductId: alienware-aw610m"]
    RF1 --> RF2
    RF1 --> RF3
  end

  subgraph LOOKUP["PRODUCT LOOKUP"]
    direction TB
    L1["products.find(\n  p => p.slug === 'alienware-aw610m'\n)"]
  end

  subgraph PRODUCT["PRODUCT OBJECT (from mouse.json)"]
    direction TB
    P1["ALL DATA\nbrand: Alienware\nmodel: AW610M\nweight: 120g\noverall: 7.4\nsensor: PMW3389\nclick_latency: 14ms"]
    P2["MEDIA OBJECT\nimagePath: /images/mouse/alienware/aw610m\nmedia.images: [\n  { stem: top, view: top },\n  { stem: feature-image, view: feature-image },\n  ...\n]"]
  end

  subgraph PAGE["REVIEW PAGE RENDERS"]
    direction TB
    PG1["EDITORIAL\n(from frontmatter)\nTitle, verdict,\npros, cons, body"]
    PG2["SPECS & SCORES\n(from product)\nWeight, sensor,\nclick latency, overall"]
    PG3["PRODUCT PHOTOS\n(from product.imagePath)\nTop view, angle view,\nfeature image"]
  end

  RF3 ==>|"productId"| LOOKUP
  LOOKUP ==>|"find by slug"| PRODUCT
  REVIEW --> PAGE
  PRODUCT --> PAGE

  style REVIEW fill:#7f1d1d,stroke:#ef4444,color:#eee
  style LOOKUP fill:#16213e,stroke:#0f3460,color:#eee
  style PRODUCT fill:#064e3b,stroke:#10b981,color:#eee
  style PAGE fill:#2d1b69,stroke:#8b5cf6,color:#eee
  style RF1 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style RF2 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style RF3 fill:#92400e,stroke:#f59e0b,color:#eee
  style L1 fill:#16213e,stroke:#0f3460,color:#eee
  style P1 fill:#1a4731,stroke:#10b981,color:#eee
  style P2 fill:#92400e,stroke:#f59e0b,color:#eee
  style PG1 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style PG2 fill:#1a4731,stroke:#10b981,color:#eee
  style PG3 fill:#92400e,stroke:#f59e0b,color:#eee
```

---

## Diagram 3: Rename — Both Data and Images Update Atomically

Shows what the sync script changes when a product is renamed. Both data fields AND image paths update in one atomic operation.

```mermaid
flowchart TB
  subgraph BEFORE["BEFORE RENAME"]
    direction TB
    B1["PRODUCT JSON\nslug: razer-viper-v3-pro\nbrand: Razer\nmodel: Viper V3 Pro\nurl: /hubs/mouse/razer/viper-v3-pro\nimagePath: /images/mouse/razer/viper-v3-pro"]
    B2["IMAGE FOLDER\npublic/images/mouse/razer/viper-v3-pro/\n  top---white+black_m.webp\n  angle---black_m.webp\n  feature-image_xxl.webp"]
    B3["REVIEW FRONTMATTER\nproductId: razer-viper-v3-pro"]
  end

  subgraph SYNC["SYNC SCRIPT (atomic)"]
    direction TB
    S1["1. Update slug\n2. Update model\n3. Update url\n4. Update imagePath\n5. Move image folder\n6. Update review productId\n7. Update recommender refs"]
  end

  subgraph AFTER["AFTER RENAME"]
    direction TB
    A1["PRODUCT JSON\nslug: razer-viper-v3-pro-max\nbrand: Razer\nmodel: Viper V3 Pro Max\nurl: /hubs/mouse/razer/viper-v3-pro-max\nimagePath: /images/mouse/razer/viper-v3-pro-max"]
    A2["IMAGE FOLDER\npublic/images/mouse/razer/viper-v3-pro-max/\n  top---white+black_m.webp\n  angle---black_m.webp\n  feature-image_xxl.webp"]
    A3["REVIEW FRONTMATTER\nproductId: razer-viper-v3-pro-max"]
  end

  subgraph COMPONENTS["COMPONENTS (zero changes)"]
    direction TB
    C1["product.brand → Razer\nproduct.model → Viper V3 Pro Max\nproduct.weight → 54g\ngetImage(media) + contentImage(...)\n→ now points to new folder\n\nCOMPONENT CODE UNCHANGED"]
  end

  BEFORE ==> SYNC
  SYNC ==> AFTER
  AFTER ==>|"components read\nupdated values"| COMPONENTS

  style BEFORE fill:#7f1d1d,stroke:#ef4444,color:#eee
  style SYNC fill:#16213e,stroke:#0f3460,color:#eee
  style AFTER fill:#064e3b,stroke:#10b981,color:#eee
  style COMPONENTS fill:#2d1b69,stroke:#8b5cf6,color:#eee
  style B1 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style B2 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style B3 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style S1 fill:#16213e,stroke:#0f3460,color:#eee
  style A1 fill:#064e3b,stroke:#10b981,color:#eee
  style A2 fill:#064e3b,stroke:#10b981,color:#eee
  style A3 fill:#064e3b,stroke:#10b981,color:#eee
  style C1 fill:#2d1b69,stroke:#8b5cf6,color:#eee
```

---

## Diagram 4: All Content Types — Where Data and Images Come From

Shows the data and image source for every content type in the system.

```mermaid
flowchart LR
  subgraph SOURCES["DATA + IMAGE SOURCES"]
    direction TB
    S1["Product JSON\n(mouse/keyboard/monitor.json)\n\n100+ fields per product\nimagePath field for images"]
    S2["Review Frontmatter\n(src/content/reviews/)\n\nEditorial: title, verdict,\npros, cons, body text"]
    S3["Guide/News Frontmatter\n(src/content/guides|news/)\n\nAll metadata + body text"]
    S4["Brand Collection\n(src/content/brands/)\n\nBrand name, description"]
    S5["Game Collection\n(src/content/games/)\n\nGame name, genres"]
  end

  subgraph PAGES["PAGE TYPES"]
    direction TB
    P1["Product Card\nDATA: Product JSON\nIMAGES: product.imagePath"]
    P2["Snapshot Page\nDATA: Product JSON\nIMAGES: product.imagePath"]
    P3["Review Page\nDATA: Frontmatter + Product JSON\nIMAGES: product.imagePath + article folder"]
    P4["Guide Page\nDATA: Frontmatter\nIMAGES: /images/guides/{cat}/{slug}/"]
    P5["News Page\nDATA: Frontmatter\nIMAGES: /images/news/{cat}/{slug}/"]
    P6["Brand Page\nDATA: Brand collection\nIMAGES: /images/brands/{slug}/"]
    P7["Game Page\nDATA: Game collection\nIMAGES: /images/games/{slug}/"]
  end

  S1 --> P1
  S1 --> P2
  S1 --> P3
  S2 --> P3
  S3 --> P4
  S3 --> P5
  S4 --> P6
  S5 --> P7

  style SOURCES fill:#16213e,stroke:#0f3460,color:#eee
  style PAGES fill:#064e3b,stroke:#10b981,color:#eee
  style S1 fill:#16213e,stroke:#0f3460,color:#eee
  style S2 fill:#7f1d1d,stroke:#ef4444,color:#eee
  style S3 fill:#92400e,stroke:#f59e0b,color:#eee
  style S4 fill:#2d1b69,stroke:#8b5cf6,color:#eee
  style S5 fill:#2d1b69,stroke:#8b5cf6,color:#eee
  style P1 fill:#064e3b,stroke:#10b981,color:#eee
  style P2 fill:#064e3b,stroke:#10b981,color:#eee
  style P3 fill:#064e3b,stroke:#10b981,color:#eee
  style P4 fill:#064e3b,stroke:#10b981,color:#eee
  style P5 fill:#064e3b,stroke:#10b981,color:#eee
  style P6 fill:#064e3b,stroke:#10b981,color:#eee
  style P7 fill:#064e3b,stroke:#10b981,color:#eee
```
