from __future__ import annotations

from io import BytesIO
from typing import BinaryIO

import numpy as np
from PIL import Image


MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def _center_crop(img: Image.Image, size: int) -> Image.Image:
    width, height = img.size
    left = max(0, (width - size) // 2)
    top = max(0, (height - size) // 2)
    return img.crop((left, top, left + size, top + size))


def _resize_short_side(img: Image.Image, short_side: int) -> Image.Image:
    width, height = img.size
    if width == 0 or height == 0:
        raise ValueError("Image has invalid dimensions")

    if width < height:
        new_w = short_side
        new_h = int(height * (short_side / width))
    else:
        new_h = short_side
        new_w = int(width * (short_side / height))

    return img.resize((new_w, new_h), Image.Resampling.BICUBIC)


def _to_tensor(img: Image.Image) -> np.ndarray:
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - MEAN) / STD
    arr = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(arr, axis=0)


def preprocess_image_bytes(image_bytes: bytes, image_size: int = 224, resize_short: int = 256) -> np.ndarray:
    with Image.open(BytesIO(image_bytes)) as img:
        rgb = img.convert("RGB")
        resized = _resize_short_side(rgb, resize_short)
        cropped = _center_crop(resized, image_size)
        return _to_tensor(cropped)


def preprocess_image_stream(image_stream: BinaryIO, image_size: int = 224, resize_short: int = 256) -> np.ndarray:
    return preprocess_image_bytes(image_stream.read(), image_size=image_size, resize_short=resize_short)
