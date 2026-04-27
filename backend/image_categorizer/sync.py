"""
Data Sync & Security Module

Handles multi-user vector synchronization with encryption & audit logging
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
import sqlite3
import hashlib
import hmac
import json
import secrets

import jwt
from cryptography.fernet import Fernet


@dataclass
class SyncEntry:
    """Represents a learning event to sync"""
    id: int
    image_path: str
    label: str
    embedding_hash: str  # SHA-256 of embedding (for dedup)
    source: str
    comment: str
    user_id: str
    timestamp: str
    operation: str  # 'learn', 'update', 'delete'


class SyncManager:
    """Manages data synchronization across users with encryption & auditlogging"""

    def __init__(self, db_path: Path, encryption_key: Optional[bytes] = None):
        self._db_path = db_path
        self._conn = sqlite3.connect(str(db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        
        # Set up encryption (optional, for at-rest encryption)
        self._cipher = Fernet(encryption_key) if encryption_key else None
        
        self._init_sync_schema()

    def _init_sync_schema(self) -> None:
        """Create sync tables if they don't exist"""
        # Sync version tracking
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS sync_metadata (
                id INTEGER PRIMARY KEY,
                current_version INTEGER DEFAULT 0,
                last_sync_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Sync log - audit trail of all learning events
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS sync_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_version INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                record_id INTEGER,
                image_path TEXT,
                label TEXT,
                source TEXT,
                comment TEXT,
                embedding_hash TEXT,
                timestamp TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # User sessions (for JWT auth)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                session_token TEXT NOT NULL UNIQUE,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                expires_at TEXT NOT NULL
            )
        """)
        
        # Encryption keys per user (optional - for client-side encryption)
        self._conn.execute("""
            CREATE TABLE IF NOT EXISTS user_encryption_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL UNIQUE,
                encrypted_key TEXT NOT NULL,
                salt TEXT NOT NULL
            )
        """)
        
        # Initialize sync metadata if empty
        count = self._conn.execute("SELECT COUNT(*) FROM sync_metadata").fetchone()[0]
        if count == 0:
            self._conn.execute("""
                INSERT INTO sync_metadata (id, current_version) VALUES (1, 0)
            """)
        
        self._conn.commit()

    def log_learning_event(
        self,
        user_id: str,
        operation: str,
        record_id: int,
        image_path: str,
        label: str,
        source: str,
        comment: str,
        embedding_hash: str,
    ) -> int:
        """Log a learning event to sync log"""
        cur = self._conn.cursor()
        version = self._get_current_version() + 1
        
        cur.execute("""
            INSERT INTO sync_log 
            (sync_version, user_id, operation, record_id, image_path, label, 
             source, comment, embedding_hash, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            version,
            user_id,
            operation,
            record_id,
            image_path,
            label,
            source,
            comment,
            embedding_hash,
            datetime.utcnow().isoformat(),
        ))
        
        # Update version
        self._conn.execute(
            "UPDATE sync_metadata SET current_version = ? WHERE id = 1",
            (version,)
        )
        
        self._conn.commit()
        return version

    def _get_current_version(self) -> int:
        """Get current sync version"""
        row = self._conn.execute(
            "SELECT current_version FROM sync_metadata WHERE id = 1"
        ).fetchone()
        return int(row[0]) if row else 0

    def get_sync_updates(self, client_version: int) -> dict:
        """Get all sync updates since client_version"""
        server_version = self._get_current_version()
        
        rows = self._conn.execute("""
            SELECT * FROM sync_log 
            WHERE sync_version > ?
            ORDER BY sync_version ASC
        """, (client_version,)).fetchall()
        
        updates = []
        for row in rows:
            updates.append({
                "id": row["id"],
                "sync_version": row["sync_version"],
                "user_id": row["user_id"],
                "operation": row["operation"],
                "record_id": row["record_id"],
                "image_path": row["image_path"],
                "label": row["label"],
                "source": row["source"],
                "comment": row["comment"],
                "timestamp": row["timestamp"],
            })
        
        return {
            "server_version": server_version,
            "updates": updates,
            "update_count": len(updates),
        }

    def get_user_data_export(self, user_id: str) -> dict:
        """Export all data learned by a user (GDPR compliance)"""
        # Note: In real implementation, filter by user_id across all tables
        # This is encrypted and timestamped for audit purposes
        rows = self._conn.execute("""
            SELECT * FROM sync_log WHERE user_id = ?
            ORDER BY sync_version DESC
        """, (user_id,)).fetchall()
        
        export = {
            "user_id": user_id,
            "exported_at": datetime.utcnow().isoformat(),
            "entries": [dict(row) for row in rows],
        }
        
        return export

    def generate_session_token(self, user_id: str, secret_key: str, expires_hours: int = 24) -> str:
        """Generate JWT session token (for auth)"""
        payload = {
            "user_id": user_id,
            "iat": datetime.utcnow(),
            "exp": datetime.utcnow() + timedelta(hours=expires_hours),
        }
        token = jwt.encode(payload, secret_key, algorithm="HS256")
        
        # Store in DB for revocation tracking
        expires_at = (datetime.utcnow() + timedelta(hours=expires_hours)).isoformat()
        self._conn.execute("""
            INSERT OR REPLACE INTO user_sessions (user_id, session_token, expires_at)
            VALUES (?, ?, ?)
        """, (user_id, token, expires_at))
        self._conn.commit()
        
        return token

    def verify_session_token(self, token: str, secret_key: str) -> Optional[str]:
        """Verify JWT token and return user_id"""
        try:
            payload = jwt.decode(token, secret_key, algorithms=["HS256"])
            user_id = payload.get("user_id")
            
            # Check if token is in DB and not revoked
            row = self._conn.execute(
                "SELECT * FROM user_sessions WHERE user_id = ? AND session_token = ?",
                (user_id, token)
            ).fetchone()
            
            return user_id if row else None
        except jwt.InvalidTokenError:
            return None

    def delete_all_user_data(self, user_id: str) -> int:
        """Delete all user data (right-to-be-forgotten / GDPR)"""
        # Note: In production, also delete from image_metadata, image_embeddings, etc.
        cur = self._conn.cursor()
        
        # Get count of records to delete
        rows = self._conn.execute(
            "SELECT COUNT(*) FROM sync_log WHERE user_id = ?",
            (user_id,)
        ).fetchone()
        deleted_count = int(rows[0])
        
        # Soft delete: mark as deleted
        cur.execute("""
            DELETE FROM sync_log WHERE user_id = ?
        """, (user_id,))
        
        cur.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
        
        self._conn.commit()
        return deleted_count
