from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class AppConfig:
    host: str
    port: int
    db_path: Path
    model_path: Path
    comment_whitelist_path: Path
    image_size: int
    resize_short: int
    embedding_dim: int
    default_top_k: int
    auto_learn_on_labeled_ingest: bool


def _workspace_root() -> Path:
    return Path(__file__).resolve().parents[2]


def get_config() -> AppConfig:
    root = _workspace_root()
    data_dir = root / "backend" / "image_categorizer" / "data"
    model_dir = root / "backend" / "image_categorizer" / "models"
    data_dir.mkdir(parents=True, exist_ok=True)
    model_dir.mkdir(parents=True, exist_ok=True)

    return AppConfig(
        host=os.getenv("BILDERTOOL_AI_HOST", "127.0.0.1"),
        port=int(os.getenv("BILDERTOOL_AI_PORT", "8765")),
        db_path=Path(os.getenv("BILDERTOOL_AI_DB_PATH", str(data_dir / "image_vectors.db"))),
        model_path=Path(os.getenv("BILDERTOOL_AI_MODEL_PATH", str(model_dir / "onnx" / "model.onnx"))),
        comment_whitelist_path=Path(
            os.getenv(
                "BILDERTOOL_AI_COMMENT_WHITELIST_PATH",
                str(data_dir / "comment-whitelist.txt"),
            )
        ),
        image_size=int(os.getenv("BILDERTOOL_AI_IMAGE_SIZE", "224")),
        resize_short=int(os.getenv("BILDERTOOL_AI_RESIZE_SHORT", "256")),
        embedding_dim=int(os.getenv("BILDERTOOL_AI_EMBEDDING_DIM", "384")),
        default_top_k=int(os.getenv("BILDERTOOL_AI_TOP_K", "5")),
        auto_learn_on_labeled_ingest=os.getenv("BILDERTOOL_AI_AUTO_LEARN", "true").lower() == "true",
    )
