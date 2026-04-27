# PyInstaller spec for Bildertool – portable --onedir build.
# Bundles: Python runtime, FastAPI, ONNX model, SQLite-vec, AND the entire frontend.
#
# Build command (run from backend/image_categorizer/):
#   pyinstaller --clean --noconfirm pyinstaller.spec
#
# Output: dist/bildertool/bildertool.exe
# Distribute the entire dist/bildertool/ folder – just zip it.

from pathlib import Path

root       = Path(__file__).resolve().parent          # backend/image_categorizer/
workspace  = root.parents[1]                          # project root (has index.html)

block_cipher = None

hiddenimports = [
    "onnxruntime",
    "onnxruntime.capi._pybind_state",
    "sqlite_vec",
    "fastapi",
    "fastapi.staticfiles",
    "fastapi.responses",
    "uvicorn",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "aiofiles",
    "python_multipart",
    "multipart",
    "starlette.staticfiles",
    "starlette.responses",
]

# Bundle: backend data + entire frontend
datas = [
    # AI model (backend copy used by Python embedder)
    (str(root / "models" / "onnx"), "models/onnx"),
    # Comment whitelist
    (str(root / "data" / "comment-whitelist.txt"), "data"),
    # ── Frontend (served as static files by FastAPI) ──
    (str(workspace / "index.html"),            "frontend"),
    (str(workspace / "styles.css"),            "frontend"),
    (str(workspace / "bildertool-config.json"),"frontend"),
    (str(workspace / "js"),                    "frontend/js"),
    (str(workspace / "themes"),                "frontend/themes"),
    # ONNX model copy for browser ONNX.js (served as /models/onnx/...)
    (str(workspace / "models"),                "frontend/models"),
]

# Include app.js if it exists at root (legacy)
_root_app_js = workspace / "app.js"
if _root_app_js.exists():
    datas.append((str(_root_app_js), "frontend"))

a = Analysis(
    [str(root / "main.py")],
    pathex=[str(root.parent)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "scipy", "pandas", "jupyter"],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,   # --onedir mode
    name="bildertool",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,           # no console window for end users
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="bildertool",       # output folder: dist/bildertool/
)
