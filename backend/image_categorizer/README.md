# Bildertool Local Image Categorizer

Local Python service for image embeddings and nearest-neighbor label suggestion.

## Features

- ONNX inference for image embeddings (default expected model: DINOv3 ViT-Small)
- SQLite vector index with sqlite-vec for k-NN similarity search
- Instant learning endpoint that stores image path, label and vector immediately
- Weighted source trust for suggestions (manual feedback > passive AI-confirmed feedback)
- Optional comment suggestion based on nearest neighbors
- Comment learning/suggestion is restricted to a hard-set whitelist text file
- Portable folder structure friendly to PyInstaller --onedir

## Folder layout

- `backend/image_categorizer/main.py`: FastAPI entrypoint
- `backend/image_categorizer/embedder.py`: ONNX embedder (CPU)
- `backend/image_categorizer/vector_store.py`: sqlite-vec storage + search
- `backend/image_categorizer/models/`: place your ONNX model file here
- `backend/image_categorizer/data/`: local SQLite database

## Model placement

Place your ONNX model at:

- `backend/image_categorizer/models/onnx/model.onnx`

Comment whitelist file:

- `backend/image_categorizer/data/comment-whitelist.txt`

Default embedding dimension is set to 384.

## Install

```powershell
cd backend/image_categorizer
pip install -r requirements.txt
```

## Run

```powershell
cd backend
python -m image_categorizer.main
```

Server defaults to `127.0.0.1:8765`.

Alternative (PowerShell helper):

```powershell
cd backend/image_categorizer
.\run_service.ps1
```

Development mode with auto-reload:

```powershell
cd backend/image_categorizer
.\run_service.ps1 -Reload
```

## API

- `GET /health`
- `POST /v1/embed` (multipart file)
- `POST /v1/suggest` (multipart file, optional form field `top_k`)
- `POST /v1/learn` (multipart file + `label` + optional `image_path` + optional `source` + optional `comment`)
- `POST /v1/search` (JSON: embedding + top_k)

## Environment overrides

- `BILDERTOOL_AI_HOST`
- `BILDERTOOL_AI_PORT`
- `BILDERTOOL_AI_DB_PATH`
- `BILDERTOOL_AI_MODEL_PATH`
- `BILDERTOOL_AI_IMAGE_SIZE`
- `BILDERTOOL_AI_RESIZE_SHORT`
- `BILDERTOOL_AI_EMBEDDING_DIM`
- `BILDERTOOL_AI_TOP_K`
- `BILDERTOOL_AI_COMMENT_WHITELIST_PATH`

## PyInstaller --onedir preparation

- Spec template: `backend/image_categorizer/pyinstaller.spec`
- Build (inside backend/image_categorizer):

```powershell
pyinstaller --clean --noconfirm --distpath dist pyinstaller.spec
```

The spec is intentionally minimal and can be adjusted once the model file and final startup flow are fixed.
