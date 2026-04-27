from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .config import AppConfig
from .embedder import DinoV3OnnxEmbedder
from .vector_store import VectorStore


class HealthResponse(BaseModel):
    status: str
    model_available: bool
    vector_count: int


class EmbedResponse(BaseModel):
    model: str
    embedding_dim: int
    embedding: list[float]


class SearchMatchDto(BaseModel):
    id: int
    image_path: str
    label: str
    source: str
    comment: str
    distance: float


class SuggestResponse(BaseModel):
    label: str | None
    confidence: float | None
    suggested_comment: str | None
    suggested_comment_confidence: float | None
    matches: list[SearchMatchDto]


class LearnResponse(BaseModel):
    stored_id: int
    label: str
    image_path: str


class CommentWhitelistResponse(BaseModel):
    comments: list[str]


class SearchByEmbeddingRequest(BaseModel):
    embedding: list[float] = Field(min_length=8)
    top_k: int = Field(default=5, ge=1, le=50)


class ImageCategorizerApi:
    def __init__(self, config: AppConfig):
        self.config = config
        self.embedder = DinoV3OnnxEmbedder(config)
        self.store = VectorStore(db_path=config.db_path, embedding_dim=config.embedding_dim)
        self._comment_whitelist_map = self._load_comment_whitelist(config.comment_whitelist_path)

    def build_app(self) -> FastAPI:
        app = FastAPI(title="Bildertool Image Categorizer", version="0.1.0")
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Serve the frontend from the workspace root (or PyInstaller bundle root)
        frontend_root = self._resolve_frontend_root()
        if frontend_root and frontend_root.exists():
            # Serve model files, JS, CSS, themes etc.
            for subdir in ("js", "themes", "models"):
                p = frontend_root / subdir
                if p.exists():
                    app.mount(f"/{subdir}", StaticFiles(directory=str(p)), name=subdir)

            @app.get("/", include_in_schema=False)
            @app.get("/index.html", include_in_schema=False)
            def serve_index():
                return FileResponse(str(frontend_root / "index.html"))

            for static_file in ("styles.css", "app.js", "bildertool-config.json"):
                fp = frontend_root / static_file
                if fp.exists():
                    def _handler(path=fp):
                        return FileResponse(str(path))
                    app.add_api_route(f"/{static_file}", _handler, include_in_schema=False)

        @app.get("/health", response_model=HealthResponse)
        def health() -> HealthResponse:
            return HealthResponse(
                status="ok",
                model_available=self.embedder.is_model_available(),
                vector_count=self.store.count_items(),
            )

        @app.get("/v1/comment-whitelist", response_model=CommentWhitelistResponse)
        def comment_whitelist() -> CommentWhitelistResponse:
            self._reload_comment_whitelist()
            return CommentWhitelistResponse(
                comments=sorted(self._comment_whitelist_map.values(), key=lambda s: s.lower())
            )

        @app.post("/v1/embed", response_model=EmbedResponse)
        async def embed(file: UploadFile = File(...)) -> EmbedResponse:
            image_bytes = await file.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="Empty file")

            try:
                embedding = self.embedder.embed_image_bytes(image_bytes)
            except FileNotFoundError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            return EmbedResponse(
                model=embedding.model_name,
                embedding_dim=int(embedding.vector.shape[0]),
                embedding=embedding.vector.tolist(),
            )

        @app.post("/v1/search", response_model=SuggestResponse)
        async def search_by_embedding(payload: SearchByEmbeddingRequest) -> SuggestResponse:
            import numpy as np

            vector = np.asarray(payload.embedding, dtype=np.float32)
            if vector.shape[0] != self.config.embedding_dim:
                raise HTTPException(
                    status_code=400,
                    detail=f"Embedding dimension must be {self.config.embedding_dim}",
                )

            matches = self.store.knn_search(vector=vector, top_k=payload.top_k)
            return self._build_suggest_response(matches, use_comments=True)

        @app.post("/v1/suggest", response_model=SuggestResponse)
        async def suggest(
            file: UploadFile = File(...),
            top_k: int = Form(default=0),
            use_comments: bool = Form(default=True),
        ) -> SuggestResponse:
            self._reload_comment_whitelist()
            image_bytes = await file.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="Empty file")

            try:
                embedding = self.embedder.embed_image_bytes(image_bytes)
            except FileNotFoundError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            k = top_k if top_k > 0 else self.config.default_top_k
            matches = self.store.knn_search(vector=embedding.vector, top_k=k)
            return self._build_suggest_response(matches, use_comments=bool(use_comments))

        @app.post("/v1/learn", response_model=LearnResponse)
        async def learn(
            file: UploadFile = File(...),
            label: str = Form(...),
            image_path: str = Form(default=""),
            source: str = Form(default="manual"),
            comment: str = Form(default=""),
        ) -> LearnResponse:
            self._reload_comment_whitelist()
            clean_label = label.strip()
            if not clean_label:
                raise HTTPException(status_code=400, detail="Label must not be empty")

            image_bytes = await file.read()
            if not image_bytes:
                raise HTTPException(status_code=400, detail="Empty file")

            try:
                embedding = self.embedder.embed_image_bytes(image_bytes)
            except FileNotFoundError as exc:
                raise HTTPException(status_code=503, detail=str(exc)) from exc
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            stored_id = self.store.add_embedding(
                image_path=image_path.strip() or file.filename or "unknown.jpg",
                label=clean_label,
                vector=embedding.vector,
                source=source.strip() or "manual",
                comment=self._normalize_comment(comment),
            )
            return LearnResponse(
                stored_id=stored_id,
                label=clean_label,
                image_path=image_path.strip() or file.filename or "unknown.jpg",
            )

        @app.get("/v1/export-embeddings")
        def export_embeddings():
            """Export all stored vectors as JSON for migration to browser IndexedDB."""
            import sqlite3
            conn = sqlite3.connect(str(self.store._db_path))
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT id, image_path, label, source, comment, created_at FROM image_metadata ORDER BY id"
            ).fetchall()
            result = []
            for row in rows:
                vec = self.store.get_embedding_by_id(row["id"])
                if vec is not None:
                    result.append({
                        "id": row["id"],
                        "image_path": row["image_path"],
                        "label": row["label"],
                        "source": row["source"],
                        "comment": row["comment"] or "",
                        "created_at": row["created_at"],
                        "embedding": vec.tolist(),
                    })
            conn.close()
            return result

        return app

    @staticmethod
    def _resolve_frontend_root() -> Path | None:
        """Find the frontend root whether running as source or PyInstaller bundle."""
        import sys
        # PyInstaller unpacks to sys._MEIPASS
        if getattr(sys, 'frozen', False):
            return Path(sys._MEIPASS) / "frontend"
        # Dev mode: workspace root is 2 levels up from this file
        candidate = Path(__file__).resolve().parents[2]
        if (candidate / "index.html").exists():
            return candidate
        return None

    @staticmethod
    def _source_weight(source: str) -> float:
        key = str(source or "").strip().lower()
        if key in {"manual", "manual-recategory"}:
            return 1.0
        if key == "ingest-labeled":
            return 0.8
        if key == "ai-confirmed":
            return 0.4
        return 0.6

    @staticmethod
    def _sim_from_distance(distance: float) -> float:
        return max(0.0, min(1.0, 1.0 - float(distance)))

    def _build_suggest_response(self, matches, use_comments: bool):
        serialized = [
            SearchMatchDto(
                id=match.id,
                image_path=match.image_path,
                label=match.label,
                source=match.source,
                comment=match.comment,
                distance=match.distance,
            )
            for match in matches
        ]

        if not matches:
            return SuggestResponse(
                label=None,
                confidence=None,
                suggested_comment=None,
                suggested_comment_confidence=None,
                matches=serialized,
            )

        label_scores: dict[str, float] = {}
        label_total = 0.0
        for match in matches:
            sim = self._sim_from_distance(match.distance)
            if sim <= 0:
                continue
            score = sim * self._source_weight(match.source)
            label_scores[match.label] = label_scores.get(match.label, 0.0) + score
            label_total += score

        if label_scores and label_total > 0:
            best_label = max(label_scores, key=label_scores.get)
            label_confidence = max(0.0, min(1.0, label_scores[best_label] / label_total))
        else:
            best = matches[0]
            best_label = best.label
            label_confidence = self._sim_from_distance(best.distance)

        suggested_comment: str | None = None
        suggested_comment_confidence: float | None = None
        if use_comments:
            comment_scores: dict[str, float] = {}
            comment_total = 0.0
            for match in matches:
                candidate_comment = self._normalize_comment(match.comment)
                if not candidate_comment:
                    continue
                sim = self._sim_from_distance(match.distance)
                if sim <= 0:
                    continue
                score = sim * self._source_weight(match.source)
                comment_scores[candidate_comment] = comment_scores.get(candidate_comment, 0.0) + score
                comment_total += score
            if comment_scores and comment_total > 0:
                suggested_comment = max(comment_scores, key=comment_scores.get)
                suggested_comment_confidence = max(
                    0.0,
                    min(1.0, comment_scores[suggested_comment] / comment_total),
                )

        return SuggestResponse(
            label=best_label,
            confidence=label_confidence,
            suggested_comment=suggested_comment,
            suggested_comment_confidence=suggested_comment_confidence,
            matches=serialized,
        )

    @staticmethod
    def _load_comment_whitelist(path: Path) -> dict[str, str]:
        if not path.exists():
            return {}
        mapping: dict[str, str] = {}
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            mapping[line.lower()] = line
        return mapping

    def _reload_comment_whitelist(self) -> None:
        self._comment_whitelist_map = self._load_comment_whitelist(
            self.config.comment_whitelist_path
        )

    def _normalize_comment(self, comment: str | None) -> str:
        value = str(comment or "").strip()
        if not value:
            return ""
        if not self._comment_whitelist_map:
            return ""
        return self._comment_whitelist_map.get(value.lower(), "")
