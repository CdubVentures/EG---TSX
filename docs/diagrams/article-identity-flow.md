# Article Identity Flow

> How articles (reviews, guides, news) are created, how they link to products and images, and what happens when filenames or product references change.

## New Article Creation

```mermaid
flowchart TB
    TRIGGER(["Developer runs:<br/><code>node scripts/new-content.mjs<br/>--type review --category mouse<br/>--brand Razer --model 'Viper V3 Pro'</code>"])

    subgraph SCRIPT["Creation Script (Atomic)"]
        direction TB
        S1["Derive slug from brand + model:<br/><code>razer-viper-v3-pro-review</code>"]
        S2["Look up product in <code>mouse.json</code>:<br/><code>slug: razer-viper-v3-pro</code>"]

        subgraph CREATE["Created Together (Never Separate)"]
            direction TB
            C1["Create MDX file:<br/><code>src/content/reviews/mouse/<br/>razer-viper-v3-pro-review/index.md</code>"]
            C2["Create image folder:<br/><code>public/images/reviews/mouse/<br/>razer/viper-v3-pro/</code>"]
        end

        S1 --> S2 --> CREATE
    end

    subgraph MDX["Generated Frontmatter"]
        direction LR
        M1["<code>---</code><br/><code>category: mouse</code><br/><code>brand: Razer</code><br/><code>model: Viper V3 Pro</code><br/><code>title: 'Razer Viper V3 Pro Review'</code><br/><code>productId: razer-viper-v3-pro</code><br/><code>draft: true</code><br/><code>---</code>"]
    end

    subgraph IMGFOLDER["Article Image Folder"]
        direction TB
        IF1["<code>public/images/reviews/mouse/razer/viper-v3-pro/</code>"]
        IF2["Developer drops images here:<br/><code>hero_blur.webp</code><br/><code>hero_m.webp</code><br/><code>hero_xl.webp</code><br/><code>inline-1_m.webp</code><br/><code>...</code>"]
        IF1 --> IF2
    end

    TRIGGER --> SCRIPT
    SCRIPT --> MDX
    SCRIPT --> IMGFOLDER

    style TRIGGER fill:#e94560,stroke:#fff,color:#fff,stroke-width:2px
    style SCRIPT fill:#16213e,stroke:#0f3460,color:#eee
    style CREATE fill:#0f3460,stroke:#53a8b6,color:#eee
    style MDX fill:#1a1a2e,stroke:#53a8b6,color:#eee
    style IMGFOLDER fill:#1a1a2e,stroke:#53a8b6,color:#eee
```

## How Components Resolve Article + Product Images

```mermaid
flowchart TB
    subgraph ASTRO_PAGE["Astro Page: <code>[...slug].astro</code>"]
        direction TB
        AP1["<code>getStaticPaths()</code> generates<br/>one page per review entry"]
        AP2["Load review entry via<br/><code>getEntry('reviews', slug)</code>"]
        AP3["Look up linked product:<br/><code>products.find(p => p.slug === entry.data.productId)</code>"]
    end

    subgraph REVIEW_DATA["Review Entry Data"]
        direction LR
        RD1["<code>entry.id: mouse/razer-viper-v3-pro-review</code><br/><code>entry.data.brand: Razer</code><br/><code>entry.data.model: Viper V3 Pro</code><br/><code>entry.data.productId: razer-viper-v3-pro</code>"]
    end

    subgraph PRODUCT_DATA["Linked Product Data"]
        direction LR
        PD1["<code>product.slug: razer-viper-v3-pro</code><br/><code>product.imagePath: /images/mouse/razer/viper-v3-pro</code><br/><code>product.media: { images: [...], colors: [...] }</code><br/><i>... all specs, scores, affiliate links ...</i>"]
    end

    subgraph RESOLVER["<code>src/core/images.ts</code>"]
        direction TB
        R1["<b>Product images</b> (specs, carousel, metrics):<br/><code>getImage(product.media, 'top', color?)</code><br/><code>contentImage(product.imagePath, img.stem, 'm')</code><br/>Returns: <code>/images/mouse/razer/viper-v3-pro/top_m.webp</code>"]
        R2["<b>Article hero</b> (review-specific photos):<br/><code>contentImage(articleImagePath, stem, size)</code><br/>Returns: <code>/images/reviews/mouse/razer/viper-v3-pro/hero_xl.webp</code>"]
    end

    subgraph COMPONENTS["Page Sections"]
        direction TB
        CO1["Hero Section<br/><i>uses article hero image</i>"]
        CO2["Product Gallery / SmartSlider<br/><i>uses product.imagePath + img stems</i>"]
        CO3["MetricsPanel<br/><i>uses product specs, no images</i>"]
        CO4["Spec Table<br/><i>uses product specs</i>"]
        CO5["Recommended / Similar<br/><i>uses product.imagePath for each card</i>"]
        CO6["Deal Button<br/><i>uses product.affiliateLinks</i>"]
    end

    ASTRO_PAGE --> REVIEW_DATA
    ASTRO_PAGE --> PRODUCT_DATA
    REVIEW_DATA --> RESOLVER
    PRODUCT_DATA --> RESOLVER
    RESOLVER --> COMPONENTS

    style ASTRO_PAGE fill:#16213e,stroke:#0f3460,color:#eee
    style REVIEW_DATA fill:#0f3460,stroke:#53a8b6,color:#eee
    style PRODUCT_DATA fill:#0f3460,stroke:#53a8b6,color:#eee
    style RESOLVER fill:#e94560,stroke:#fff,color:#fff,stroke-width:3px
    style COMPONENTS fill:#1a1a2e,stroke:#53a8b6,color:#eee
```

## Two Separate Image Domains

```mermaid
flowchart LR
    subgraph PRODUCT_IMAGES["Product Images<br/><i>Owned by product slug</i>"]
        direction TB
        PI1["<code>public/images/mouse/razer/viper-v3-pro/</code>"]
        PI2["Product photos, angles, color variants<br/><code>top---black_m.webp</code><br/><code>feature-image---black_xl.webp</code><br/><code>angle---white_m.webp</code><br/><code>side_m.webp</code> (shape SVG)"]
        PI3["<b>Shared across:</b><br/>Snapshot page, Hub cards,<br/>Home page, Tagged cards,<br/>Any component that shows this product"]
        PI1 --> PI2 --> PI3
    end

    subgraph ARTICLE_IMAGES["Article Images<br/><i>Owned by review brand/model</i>"]
        direction TB
        AI1["<code>public/images/reviews/mouse/razer/viper-v3-pro/</code>"]
        AI2["Editorial photos, hands-on shots<br/><code>hero_xl.webp</code><br/><code>inline-sensor-closeup_m.webp</code><br/><code>inline-weight-test_m.webp</code>"]
        AI3["<b>Used only by:</b><br/>The specific review article page"]
        AI1 --> AI2 --> AI3
    end

    subgraph BRAND_IMAGES["Brand Images<br/><i>Owned by brand slug</i>"]
        direction TB
        BI1["<code>public/images/brands/razer/</code>"]
        BI2["Logos in multiple formats<br/><code>logo_black_xs.png</code><br/><code>logo_color_l.png</code><br/><code>hero_logo_xl.png</code>"]
        BI3["<b>Used by:</b><br/>Navbar mega menu, Brand page,<br/>Hub filter bar"]
        BI1 --> BI2 --> BI3
    end

    style PRODUCT_IMAGES fill:#0f3460,stroke:#53a8b6,color:#eee
    style ARTICLE_IMAGES fill:#16213e,stroke:#0f3460,color:#eee
    style BRAND_IMAGES fill:#1a1a2e,stroke:#e94560,color:#eee
```

## Article Filename Rename

```mermaid
flowchart TB
    TRIGGER(["Article slug-folder renamed:<br/><code>razer-viper-v3-pro-review/</code><br/>to <code>razer-viper-v3-pro-full-review/</code>"])

    subgraph WHAT_CHANGES["What Changes"]
        direction TB
        W1["Astro entry ID:<br/><code>mouse/razer-viper-v3-pro-review</code><br/>to <code>mouse/razer-viper-v3-pro-full-review</code>"]
        W2["Page URL:<br/><code>/reviews/mouse/razer-viper-v3-pro-review</code><br/>to <code>/reviews/mouse/razer-viper-v3-pro-full-review</code>"]
        W3["Internal links referencing<br/>the old URL need updating"]
    end

    subgraph NO_CHANGE["What Does NOT Change"]
        direction TB
        N1["Article image folder stays:<br/><code>public/images/reviews/mouse/razer/viper-v3-pro/</code><br/><i>Folder uses brand/model, NOT content slug</i>"]
        N2["Frontmatter <code>productId: razer-viper-v3-pro</code><br/><i>Links to product, not to slug-folder name</i>"]
        N3["Product images stay:<br/><code>public/images/mouse/razer/viper-v3-pro/</code><br/><i>Completely independent of article slug</i>"]
        N4["All components stay the same<br/><i>They never knew the slug-folder name</i>"]
    end

    TRIGGER --> WHAT_CHANGES
    TRIGGER --> NO_CHANGE

    style TRIGGER fill:#e94560,stroke:#fff,color:#fff,stroke-width:2px
    style WHAT_CHANGES fill:#16213e,stroke:#0f3460,color:#eee
    style NO_CHANGE fill:#0f3460,stroke:#53a8b6,color:#eee
```

## Product Rename Affecting Articles

```mermaid
flowchart TB
    TRIGGER(["Product renamed in Spec Factory:<br/><b>Viper V3 Pro</b> to <b>Viper V3 Pro Max</b>"])

    subgraph PRODUCT_CHANGES["Product-Side Changes (Sync Script)"]
        direction TB
        PC1["Product JSON updated:<br/><code>slug: razer-viper-v3-pro-max</code><br/><code>imagePath: /images/mouse/razer/viper-v3-pro-max</code>"]
        PC2["Product image folder moved:<br/><code>/images/mouse/razer/viper-v3-pro/</code><br/>to <code>/images/mouse/razer/viper-v3-pro-max/</code>"]
    end

    subgraph ARTICLE_CHANGES["Article-Side Changes (Sync Script)"]
        direction TB
        AC1["Review frontmatter updated:<br/><code>productId: razer-viper-v3-pro</code><br/>to <code>productId: razer-viper-v3-pro-max</code>"]
        AC2["Review frontmatter updated:<br/><code>model: Viper V3 Pro</code><br/>to <code>model: Viper V3 Pro Max</code>"]
        AC3["Article image folder moved:<br/><code>/images/reviews/mouse/razer/viper-v3-pro/</code><br/>to <code>/images/reviews/mouse/razer/viper-v3-pro-max/</code>"]
    end

    subgraph FILE_UNCHANGED["Stays the Same"]
        direction TB
        FU1["Article slug-folder unchanged:<br/><code>razer-viper-v3-pro-review/index.md</code><br/><i>Slug-folder name is editorial, not derived from product</i>"]
        FU2["Components unchanged:<br/><i>They read product.imagePath from JSON</i>"]
    end

    subgraph OPTIONAL["Optional (Manual Decision)"]
        direction TB
        OP1["Rename slug-folder to match?<br/><code>razer-viper-v3-pro-max-review/index.md</code><br/><i>Not required, but keeps naming consistent</i>"]
    end

    TRIGGER --> PRODUCT_CHANGES
    TRIGGER --> ARTICLE_CHANGES
    TRIGGER --> FILE_UNCHANGED
    FILE_UNCHANGED -.-> OPTIONAL

    style TRIGGER fill:#e94560,stroke:#fff,color:#fff,stroke-width:2px
    style PRODUCT_CHANGES fill:#0f3460,stroke:#53a8b6,color:#eee
    style ARTICLE_CHANGES fill:#16213e,stroke:#0f3460,color:#eee
    style FILE_UNCHANGED fill:#1a1a2e,stroke:#53a8b6,color:#eee
    style OPTIONAL fill:#1a1a2e,stroke:#e94560,color:#eee,stroke-dasharray: 5 5
```

## Content Type Image Folder Map

```mermaid
flowchart TB
    subgraph ROOT["<code>public/images/</code>"]
        direction TB

        subgraph PRODUCTS["Product Images (per category)"]
            direction LR
            PM["<code>mouse/{brand}/{model}/</code><br/><i>342 folders</i>"]
            PK["<code>keyboard/{brand}/{model}/</code><br/><i>12 folders</i>"]
            PN["<code>monitor/{brand}/{model}/</code><br/><i>12 folders</i>"]
        end

        subgraph ARTICLES["Article Images (per content type)"]
            direction LR
            AR["<code>reviews/{cat}/{brand}/{model}/</code><br/><i>36 folders (reviews with products)</i>"]
            AG["<code>guides/{cat}/{slug}/</code><br/><i>34 folders</i>"]
            AN["<code>news/{cat}/{slug}/</code><br/><i>23 folders</i>"]
        end

        subgraph ENTITIES["Entity Images"]
            direction LR
            EB["<code>brands/{slug}/</code><br/><i>30 folders</i>"]
            EG["<code>games/{slug}/</code><br/><i>11 folders</i>"]
        end

        subgraph STATIC["Static Assets"]
            direction LR
            SN["<code>navbar/</code>"]
            SF["<code>favicons/</code>"]
            SS["<code>shared/</code>"]
        end
    end

    style ROOT fill:#1a1a2e,stroke:#e94560,color:#eee
    style PRODUCTS fill:#0f3460,stroke:#53a8b6,color:#eee
    style ARTICLES fill:#16213e,stroke:#0f3460,color:#eee
    style ENTITIES fill:#1a1a2e,stroke:#53a8b6,color:#eee
    style STATIC fill:#16213e,stroke:#53a8b6,color:#eee
```
