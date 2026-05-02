from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response

_THIS_DIR = Path(__file__).resolve().parent
_CONFIG_ROOT = _THIS_DIR.parent
_UI_DIR = _CONFIG_ROOT / "ui"

if str(_THIS_DIR) not in sys.path:
    sys.path.insert(0, str(_THIS_DIR))

from runtime import runtime


logger = logging.getLogger("eg-config-desktop")

_BUNDLE_PATH = _UI_DIR / "app.bundle.js"
_CSS_PATH = _UI_DIR / "app.css"

def _html_page() -> str:
    from lib.config_store import ConfigStore
    settings = runtime.store.get(ConfigStore.SETTINGS)
    theme_id = settings.get("theme", "legacy-clone")
    return f"""\
<!DOCTYPE html>
<html lang="en" data-theme="{theme_id}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EG Config Manager</title>
  <link rel="stylesheet" href="/app.css">
</head>
<body>
  <div id="root"></div>
  <script src="/app.bundle.js"></script>
</body>
</html>
"""


def _validate_environment() -> None:
    if not _BUNDLE_PATH.is_file():
        raise RuntimeError(
            "app.bundle.js not found. Run: "
            "npx esbuild config/ui/_entry.tsx --bundle --format=iife "
            "--jsx=automatic --charset=utf8 --outfile=config/ui/app.bundle.js"
        )
    if not _CSS_PATH.is_file():
        raise RuntimeError("app.css not found in config/ui")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(name)s  %(levelname)s  %(message)s",
        datefmt="%H:%M:%S",
    )
    _validate_environment()
    logger.info("EG Config desktop starting")
    yield
    logger.info("EG Config desktop stopped")


app = FastAPI(title="EG Config Manager API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def serve_shell() -> str:
    return _html_page()


@app.get("/app.bundle.js")
async def serve_bundle() -> Response:
    return Response(
        content=_BUNDLE_PATH.read_text(encoding="utf-8"),
        media_type="application/javascript",
    )


@app.get("/app.css")
async def serve_css() -> Response:
    return Response(
        content=_CSS_PATH.read_text(encoding="utf-8"),
        media_type="text/css",
    )


@app.get("/api/bootstrap")
async def get_bootstrap() -> JSONResponse:
    return JSONResponse({
        "shell": runtime.get_shell_payload(),
        "panels": {
            "categories": runtime.get_categories_payload(),
            "content": runtime.get_content_payload(),
            "indexHeroes": runtime.get_index_heroes_payload(),
            "hubTools": runtime.get_hub_tools_payload(),
            "navbar": runtime.get_navbar_payload(),
            "slideshow": runtime.get_slideshow_payload(),
            "imageDefaults": runtime.get_image_defaults_payload(),
            "cacheCdn": runtime.get_cache_cdn_payload(),
            "ads": runtime.get_ads_payload(),
        },
    })


@app.get("/api/watch")
async def watch() -> JSONResponse:
    return JSONResponse(runtime.get_watch_payload())


@app.get("/api/panels/categories")
async def get_categories_panel() -> JSONResponse:
    return JSONResponse(runtime.get_categories_payload())


@app.put("/api/panels/categories/preview")
async def preview_categories(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_categories(payload))


@app.put("/api/panels/categories/save")
async def save_categories(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_categories(payload))


@app.get("/api/panels/content")
async def get_content_panel() -> JSONResponse:
    return JSONResponse(runtime.get_content_payload())


@app.put("/api/panels/content/preview")
async def preview_content(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_content(payload))


@app.put("/api/panels/content/save")
async def save_content(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_content(payload))


@app.get("/api/panels/index-heroes")
async def get_index_heroes_panel() -> JSONResponse:
    return JSONResponse(runtime.get_index_heroes_payload())


@app.put("/api/panels/index-heroes/preview")
async def preview_index_heroes(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_index_heroes(payload))


@app.put("/api/panels/index-heroes/save")
async def save_index_heroes(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_index_heroes(payload))


@app.get("/api/panels/hub-tools")
async def get_hub_tools_panel() -> JSONResponse:
    return JSONResponse(runtime.get_hub_tools_payload())


@app.put("/api/panels/hub-tools/preview")
async def preview_hub_tools(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_hub_tools(payload))


@app.put("/api/panels/hub-tools/save")
async def save_hub_tools(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_hub_tools(payload))


@app.get("/api/panels/navbar")
async def get_navbar_panel() -> JSONResponse:
    return JSONResponse(runtime.get_navbar_payload())


@app.put("/api/panels/navbar/preview")
async def preview_navbar(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_navbar(payload))


@app.put("/api/panels/navbar/save")
async def save_navbar(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_navbar(payload))


@app.get("/api/panels/slideshow")
async def get_slideshow_panel() -> JSONResponse:
    return JSONResponse(runtime.get_slideshow_payload())


@app.put("/api/panels/slideshow/preview")
async def preview_slideshow(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_slideshow(payload))


@app.put("/api/panels/slideshow/save")
async def save_slideshow(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_slideshow(payload))


@app.get("/api/panels/image-defaults")
async def get_image_defaults_panel() -> JSONResponse:
    return JSONResponse(runtime.get_image_defaults_payload())


@app.put("/api/panels/image-defaults/preview")
async def preview_image_defaults(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_image_defaults(payload))


@app.put("/api/panels/image-defaults/save")
async def save_image_defaults(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_image_defaults(payload))


@app.get("/api/panels/cache-cdn")
async def get_cache_cdn_panel() -> JSONResponse:
    return JSONResponse(runtime.get_cache_cdn_payload())


@app.put("/api/panels/cache-cdn/preview")
async def preview_cache_cdn(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_cache_cdn(payload))


@app.put("/api/panels/cache-cdn/save")
async def save_cache_cdn(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_cache_cdn(payload))


@app.get("/api/panels/ads")
async def get_ads_panel() -> JSONResponse:
    return JSONResponse(runtime.get_ads_payload())


@app.put("/api/panels/ads/preview")
async def preview_ads(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.preview_ads(payload))


@app.post("/api/panels/ads/scan")
async def scan_ads() -> JSONResponse:
    return JSONResponse(runtime.scan_ads_positions())


@app.put("/api/panels/ads/save")
async def save_ads(request: Request) -> JSONResponse:
    payload = await request.json()
    return JSONResponse(runtime.save_ads(payload))


@app.put("/api/shell/theme")
async def save_theme(request: Request) -> JSONResponse:
    body = await request.json()
    theme_id = body.get("id", "legacy-clone")
    shell = runtime.save_theme(theme_id)
    return JSONResponse({"shell": shell})


@app.get("/api/health")
async def health() -> JSONResponse:
    from lib.config_store import ConfigStore
    settings = runtime.store.get(ConfigStore.SETTINGS)
    theme_id = settings.get("theme", "legacy-clone")
    return JSONResponse({
        "status": "ok",
        "projectRoot": str(runtime.project_root),
        "theme": theme_id,
    })
