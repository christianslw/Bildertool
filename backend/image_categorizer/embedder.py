from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import onnxruntime as ort

from .config import AppConfig
from .preprocess import preprocess_image_bytes


@dataclass
class EmbeddingResult:
    vector: np.ndarray
    model_name: str


class DinoV3OnnxEmbedder:
    def __init__(self, config: AppConfig):
        self._config = config
        self._session: Optional[ort.InferenceSession] = None
        self._input_name: Optional[str] = None
        self._output_name: Optional[str] = None

    @property
    def model_path(self) -> Path:
        return self._config.model_path

    def is_model_available(self) -> bool:
        return self.model_path.exists()

    def _ensure_session(self) -> None:
        if self._session is not None:
            return

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"ONNX model not found: {self.model_path}. "
                "Place DINOv3 ONNX model at backend/image_categorizer/models/onnx/model.onnx"
            )

        providers = ["CPUExecutionProvider"]
        sess_options = ort.SessionOptions()
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self._session = ort.InferenceSession(
            str(self.model_path),
            sess_options=sess_options,
            providers=providers,
        )

        self._input_name = self._session.get_inputs()[0].name
        self._output_name = self._session.get_outputs()[0].name

    def _normalize_vector(self, vector: np.ndarray) -> np.ndarray:
        norm = np.linalg.norm(vector)
        if norm == 0.0:
            return vector
        return vector / norm

    def _extract_embedding(self, output_tensor: np.ndarray) -> np.ndarray:
        if output_tensor.ndim == 3:
            # ViT output: [batch, tokens, dim] -> CLS token
            vector = output_tensor[0, 0, :]
        elif output_tensor.ndim == 2:
            vector = output_tensor[0, :]
        else:
            vector = output_tensor.reshape(-1)

        vector = vector.astype(np.float32, copy=False)
        if self._config.embedding_dim and vector.shape[0] != self._config.embedding_dim:
            # Keep behavior robust for model variants by trimming or padding to configured dim.
            if vector.shape[0] > self._config.embedding_dim:
                vector = vector[: self._config.embedding_dim]
            else:
                padded = np.zeros((self._config.embedding_dim,), dtype=np.float32)
                padded[: vector.shape[0]] = vector
                vector = padded

        return self._normalize_vector(vector)

    def embed_image_bytes(self, image_bytes: bytes) -> EmbeddingResult:
        self._ensure_session()
        assert self._session is not None
        assert self._input_name is not None
        assert self._output_name is not None

        tensor = preprocess_image_bytes(
            image_bytes=image_bytes,
            image_size=self._config.image_size,
            resize_short=self._config.resize_short,
        )
        output = self._session.run([self._output_name], {self._input_name: tensor})[0]
        vector = self._extract_embedding(output)

        return EmbeddingResult(vector=vector, model_name=self.model_path.name)
