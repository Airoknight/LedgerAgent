import os
import hashlib
import shutil
from typing import BinaryIO, Optional
from app.core.config import settings

class ObjectStorage:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        # Subdirectories for separation of concerns
        os.makedirs(os.path.join(self.base_dir, "originals"), exist_ok=True)
        os.makedirs(os.path.join(self.base_dir, "derivatives"), exist_ok=True)
        os.makedirs(os.path.join(self.base_dir, "quarantine"), exist_ok=True)

    def _resolve_path(self, storage_key: str, category: str = "originals") -> str:
        # Sanitize storage key to prevent directory traversal
        clean_key = os.path.basename(storage_key)
        target_dir = os.path.join(self.base_dir, category)
        target_path = os.path.abspath(os.path.join(target_dir, clean_key))
        if not target_path.startswith(self.base_dir):
            raise ValueError(f"Illegal storage key path traversal attempt: {storage_key}")
        return target_path

    def save_bytes(self, data: bytes, storage_key: str, category: str = "originals") -> tuple[str, str, int]:
        target_path = self._resolve_path(storage_key, category)
        sha256 = hashlib.sha256(data).hexdigest()
        file_size = len(data)
        with open(target_path, "wb") as f:
            f.write(data)
        return target_path, sha256, file_size

    def save_stream(self, stream: BinaryIO, storage_key: str, category: str = "originals") -> tuple[str, str, int]:
        target_path = self._resolve_path(storage_key, category)
        hasher = hashlib.sha256()
        file_size = 0
        with open(target_path, "wb") as f:
            while chunk := stream.read(64 * 1024):
                hasher.update(chunk)
                file_size += len(chunk)
                f.write(chunk)
        return target_path, hasher.hexdigest(), file_size

    def get_path(self, storage_key: str, category: str = "originals") -> str:
        target_path = self._resolve_path(storage_key, category)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Object {storage_key} not found in {category}")
        return target_path

    def read_bytes(self, storage_key: str, category: str = "originals") -> bytes:
        path = self.get_path(storage_key, category)
        with open(path, "rb") as f:
            return f.read()

    def quarantine_file(self, storage_key: str) -> str:
        src = self.get_path(storage_key, "originals")
        dst = self._resolve_path(storage_key, "quarantine")
        shutil.move(src, dst)
        return dst

    def exists(self, storage_key: str, category: str = "originals") -> bool:
        try:
            path = self._resolve_path(storage_key, category)
            return os.path.exists(path)
        except ValueError:
            return False

    def delete_file(self, storage_key: str, category: str = "originals") -> bool:
        try:
            path = self._resolve_path(storage_key, category)
            if os.path.exists(path):
                os.remove(path)
                return True
            return False
        except Exception:
            return False

storage = ObjectStorage()

