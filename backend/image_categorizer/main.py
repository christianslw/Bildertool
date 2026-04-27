from __future__ import annotations

import threading
import time
import webbrowser

import uvicorn

from .api import ImageCategorizerApi
from .config import get_config


def create_app():
    config = get_config()
    return ImageCategorizerApi(config).build_app()


app = create_app()


def _open_browser(url: str, delay: float = 1.5) -> None:
    """Open the browser after a short delay so the server is ready."""
    def _open():
        time.sleep(delay)
        webbrowser.open(url)
    threading.Thread(target=_open, daemon=True).start()


if __name__ == "__main__":
    cfg = get_config()
    url = f"http://{cfg.host}:{cfg.port}"
    _open_browser(url)
    uvicorn.run(
        "image_categorizer.main:app",
        host=cfg.host,
        port=cfg.port,
        reload=False,
    )
