from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional
import sqlite3

import numpy as np


try:
    import sqlite_vec
except ImportError:  # pragma: no cover
    sqlite_vec = None


@dataclass
class SearchMatch:
    id: int
    image_path: str
    label: str
    source: str
    comment: str
    distance: float


class VectorStore:
    def __init__(self, db_path: Path, embedding_dim: int):
        self._db_path = db_path
        self._embedding_dim = embedding_dim
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_extensions()
        self._init_schema()

    def _init_extensions(self) -> None:
        if sqlite_vec is None:
            raise RuntimeError(
                "sqlite-vec is required but not installed. Install dependency: sqlite-vec"
            )
        self._conn.enable_load_extension(True)
        sqlite_vec.load(self._conn)
        self._conn.enable_load_extension(False)

    def _init_schema(self) -> None:
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS image_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_path TEXT NOT NULL,
                label TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'manual',
                comment TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        self._conn.execute(
            f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS image_embeddings
            USING vec0(embedding float[{self._embedding_dim}])
            """
        )
        self._conn.commit()
        self._ensure_schema_compat()

    def _ensure_schema_compat(self) -> None:
        cols = {
            str(row["name"]): str(row["type"])
            for row in self._conn.execute("PRAGMA table_info(image_metadata)").fetchall()
        }
        if "comment" not in cols:
            self._conn.execute(
                "ALTER TABLE image_metadata ADD COLUMN comment TEXT NOT NULL DEFAULT ''"
            )
        self._conn.commit()

    @staticmethod
    def _serialize(vector: np.ndarray) -> bytes:
        if sqlite_vec is None:
            raise RuntimeError("sqlite-vec unavailable")
        return sqlite_vec.serialize_float32(vector.astype(np.float32).tolist())

    def count_items(self) -> int:
        row = self._conn.execute("SELECT COUNT(*) AS count FROM image_metadata").fetchone()
        return int(row["count"])

    def get_embedding_by_id(self, record_id: int) -> Optional[np.ndarray]:
        try:
            row = self._conn.execute(
                "SELECT embedding FROM image_embeddings WHERE rowid = ?", (record_id,)
            ).fetchone()
            if row is None:
                return None
            raw = row[0]
            if isinstance(raw, (bytes, bytearray)):
                return np.frombuffer(raw, dtype=np.float32).copy()
            return None
        except Exception:
            return None

    def add_embedding(
        self,
        image_path: str,
        label: str,
        vector: np.ndarray,
        source: str = "manual",
        comment: str = "",
    ) -> int:
        cur = self._conn.cursor()
        cur.execute(
            "INSERT INTO image_metadata(image_path, label, source, comment) VALUES(?, ?, ?, ?)",
            (image_path, label, source, comment),
        )
        row_id = int(cur.lastrowid)
        cur.execute(
            "INSERT INTO image_embeddings(rowid, embedding) VALUES(?, ?)",
            (row_id, self._serialize(vector)),
        )
        self._conn.commit()
        return row_id

    def knn_search(self, vector: np.ndarray, top_k: int = 5, label_filter: Optional[str] = None) -> List[SearchMatch]:
        sql = """
                        SELECT m.id, m.image_path, m.label, m.source, m.comment, e.distance
            FROM image_embeddings e
            JOIN image_metadata m ON m.id = e.rowid
            WHERE e.embedding MATCH ?
              AND k = ?
        """
        params: list[object] = [self._serialize(vector), int(top_k)]

        if label_filter:
            sql += " AND m.label = ?"
            params.append(label_filter)

        sql += " ORDER BY e.distance ASC"

        rows = self._conn.execute(sql, params).fetchall()
        return [
            SearchMatch(
                id=int(row["id"]),
                image_path=str(row["image_path"]),
                label=str(row["label"]),
                source=str(row["source"]),
                comment=str(row["comment"] or ""),
                distance=float(row["distance"]),
            )
            for row in rows
        ]
