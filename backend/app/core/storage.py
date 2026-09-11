import os
import hashlib
import shutil
from typing import BinaryIO, Optional
from app.core.config import settings
from app.core.security import encrypt_bytes, decrypt_bytes

class ObjectStorage:
    def __init__(self, base_dir: str = settings.STORAGE_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)
        # Standard partitions
        os.makedirs(os.path.join(self.base_dir, "originals"), exist_ok=True)
        os.makedirs(os.path.join(self.base_dir, "derivatives"), exist_ok=True)
        os.makedirs(os.path.join(self.base_dir, "quarantine"), exist_ok=True)

    def _resolve_dir(self, category: str = "originals", org_id: Optional[str] = None, client_id: Optional[str] = None) -> str:
        """Resolves directory with tenant partitioning if org/client provided."""
        target_dir = os.path.join(self.base_dir, category)
        if org_id and client_id:
            safe_org = os.path.basename(org_id)
            safe_client = os.path.basename(client_id)
            target_dir = os.path.join(target_dir, safe_org, safe_client)
        os.makedirs(target_dir, exist_ok=True)
        return target_dir

    def _resolve_path(self, storage_key: str, category: str = "originals", org_id: Optional[str] = None, client_id: Optional[str] = None) -> str:
        # Sanitize storage key to prevent directory traversal
        clean_key = os.path.basename(storage_key)
        target_dir = self._resolve_dir(category, org_id, client_id)
        target_path = os.path.abspath(os.path.join(target_dir, clean_key))
        if not target_path.startswith(self.base_dir):
            raise ValueError(f"Illegal storage key path traversal attempt: {storage_key}")
        return target_path

    def save_bytes(
        self,
        data: bytes,
        storage_key: str,
        category: str = "originals",
        org_id: Optional[str] = None,
        client_id: Optional[str] = None,
        encrypt: bool = False
    ) -> tuple[str, str, int]:
        target_path = self._resolve_path(storage_key, category, org_id, client_id)
        raw_sha256 = hashlib.sha256(data).hexdigest()
        file_size = len(data)

        payload = data
        if encrypt or settings.ENCRYPT_FILES_AT_REST:
            try:
                payload = encrypt_bytes(data)
            except Exception:
                payload = data

        with open(target_path, "wb") as f:
            f.write(payload)
        return target_path, raw_sha256, file_size

    def save_stream(
        self,
        stream: BinaryIO,
        storage_key: str,
        category: str = "originals",
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> tuple[str, str, int]:
        data = stream.read()
        return self.save_bytes(data, storage_key, category, org_id, client_id)

    def get_path(
        self,
        storage_key: str,
        category: str = "originals",
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> str:
        # Check tenant-partitioned location first
        target_path = self._resolve_path(storage_key, category, org_id, client_id)
        if os.path.exists(target_path):
            return target_path

        # Fallback to root category directory for backwards compatibility with legacy uploads
        legacy_path = self._resolve_path(storage_key, category, None, None)
        if os.path.exists(legacy_path):
            return legacy_path

        raise FileNotFoundError(f"Object {storage_key} not found in {category}")

    def read_bytes(
        self,
        storage_key: str,
        category: str = "originals",
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> bytes:
        path = self.get_path(storage_key, category, org_id, client_id)
        with open(path, "rb") as f:
            raw = f.read()

        # Transparently decrypt if encrypted with Fernet
        if settings.ENCRYPT_FILES_AT_REST or raw.startswith(b"gAAAAA"):
            try:
                return decrypt_bytes(raw)
            except Exception:
                return raw
        return raw

    def quarantine_file(
        self,
        storage_key: str,
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> str:
        src = self.get_path(storage_key, "originals", org_id, client_id)
        dst = self._resolve_path(storage_key, "quarantine", org_id, client_id)
        shutil.move(src, dst)
        return dst

    def release_from_quarantine(
        self,
        storage_key: str,
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> str:
        src = self.get_path(storage_key, "quarantine", org_id, client_id)
        dst = self._resolve_path(storage_key, "originals", org_id, client_id)
        shutil.move(src, dst)
        return dst

    def exists(
        self,
        storage_key: str,
        category: str = "originals",
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> bool:
        try:
            self.get_path(storage_key, category, org_id, client_id)
            return True
        except (FileNotFoundError, ValueError):
            return False

    def delete_file(
        self,
        storage_key: str,
        category: str = "originals",
        org_id: Optional[str] = None,
        client_id: Optional[str] = None
    ) -> bool:
        try:
            path = self.get_path(storage_key, category, org_id, client_id)
            if os.path.exists(path):
                os.remove(path)
                return True
            return False
        except Exception:
            return False

storage = ObjectStorage()
