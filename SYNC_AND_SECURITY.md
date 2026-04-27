# Bildertool Data Sync & Security Architecture

## Part 1: Sync Service Setup

### What Service Syncs?
**Answer: Your own Python FastAPI backend** (already running at `127.0.0.1:8765`)

The backend now has 3 new sync endpoints you'll add:

```
POST /v1/sync - Upload local learning events from client
  Request: client_version, learned_entries (batch of new labels)
  Response: server_version, new_entries (data to merge locally)

GET /v1/sync-status - Check sync health
  Response: server_version, last_sync_timestamp

POST /v1/export - Export user's complete data (GDPR)
  Response: JSON file with all learning history
```

### Setup Steps

**1. Install sync dependencies:**
```bash
cd backend/image_categorizer
pip install -r requirements.txt  # includes pyjwt, cryptography
```

**2. Initialize sync table (runs on first startup):**
The `SyncManager` class auto-creates tables on first connection.

**3. Add sync endpoints to api.py:**
```python
from .sync import SyncManager

# In ImageCategorizerApi.__init__:
self.sync_manager = SyncManager(config.db_path)

# In build_app():
@app.post("/v1/sync")
async def sync_data(payload: SyncRequest, user_id: str = Header(...)) -> SyncResponse:
    # Process client's learned entries
    # Return server updates
    ...
```

**4. Frontend sync loop (js/db.js):**
```javascript
const syncInterval = setInterval(async () => {
    const clientVersion = localStorage.getItem('syncVersion') || 0;
    const response = await fetch('http://127.0.0.1:8765/v1/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-ID': localStorage.getItem('userId'),  // Add user ID
        },
        body: JSON.stringify({
            client_version: clientVersion,
            learned_entries: pendingUpdates
        })
    });
    
    const data = await response.json();
    localStorage.setItem('syncVersion', data.server_version);
    
    // Merge new entries into local DB
    mergeRemoteEntries(data.updates);
}, 300000); // Sync every 5 minutes
```

---

## Part 2: Security Implementation

### Threat Model & Mitigations

| Threat | Impact | Mitigation |
|--------|--------|-----------|
| **Man-in-the-middle attacks** | Network intercept | ✅ TLS 1.3 (HTTPS required) |
| **Unauthorized data access** | Attacker sees embeddings | ✅ JWT tokens + user isolation |
| **Data at rest exposure** | Database theft | ✅ SQLCipher encryption (optional) |
| **Data breach disclosure** | Privacy violation | ✅ Hash embeddings in logs |
| **User data deletion** | Compliance fail | ✅ Soft delete + audit trail |

### Security Layer 1: Transport (TLS/HTTPS)

**For local development (HTTP):** Only acceptable because `127.0.0.1` is localhost

**For production deployment:** 
```python
# Use HTTPS with Let's Encrypt certificate (free)
# If deploying to Railway/Render: automatic HTTPS included
# If self-hosted: use Nginx reverse proxy with SSL
```

**Environment variable:**
```bash
export BILDERTOOL_AI_TLS_CERT=/path/to/cert.pem
export BILDERTOOL_AI_TLS_KEY=/path/to/key.pem
```

### Security Layer 2: Authentication (JWT Tokens)

```python
# Backend generates token on first login
# Token signed with secret key (never shared with frontend)
# Expires in 24 hours, requires refresh

# Example: Backend creates user session
token = sync_manager.generate_session_token(
    user_id="user@company.com",
    secret_key=os.getenv("JWT_SECRET_KEY"),
    expires_hours=24
)
```

**Frontend sends token with each request:**
```javascript
headers: {
    'Authorization': `Bearer ${token}`,
    'User-ID': userId
}
```

**Generate JWT secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Output: aBc1De2FgHiJkLmNoPqRsTuVwXyZ...
# Save to: .env or export as BILDERTOOL_AI_JWT_SECRET
```

### Security Layer 3: Data Encryption at Rest (Optional)

**Use SQLCipher for encrypted database:**
```bash
pip install sqlcipher3
```

**Enable in config.py:**
```python
# Generate encryption key (once)
def generate_encryption_key():
    from cryptography.fernet import Fernet
    key = Fernet.generate_key()
    print(key.decode())  # Save to .env
```

**Activate in vector_store.py:**
```python
import sqlcipher3
conn = sqlcipher3.connect(str(db_path))
conn.execute(f"PRAGMA key='ENC_KEY_HERE'")  # Load from .env
```

---

## Part 3: Embedding Safety & DLP Concerns

### ⚠️ Can Embeddings Reverse to Original Images?

**SHORT ANSWER: No, it's cryptographically infeasible** ✅

**Why?**
- Your model produces **384-dimensional vectors** (384 floats)
- Each original image is **224×224×3 = 150,528 values** (224×224 pixels × RGB)
- **Information lost:** 384 values → 150,528 values is a massive lossy compression
- **Mathematical property:** Embeddings are one-way (like password hashing)

**Analogy:** It's like trying to reconstruct a book from its 10-word summary

**Additional safeguards:**
```python
# Hash the embedding before storing in logs
def hash_embedding(embedding):
    import hashlib
    vec_bytes = embedding.astype(np.float32).tobytes()
    return hashlib.sha256(vec_bytes).hexdigest()[:16]

# Store only hash in audit logs (cannot reverse)
sync_manager.log_learning_event(
    embedding_hash=hash_embedding(embedding)  # Hashed
)
```

---

## Part 4: Corporate Data Safety (DLP Compliance)

### Recommended Policies

#### 1. DATA RESIDENCY (Location)
```yaml
Requirement: All data stays in company network
Implementation:
  - Deploy backend on company server (not cloud)
  - Use private VPN for client connections
  - Store database locally (not cloud storage)
  - Block export to public services
```

#### 2. ENCRYPTION & KEYS
```yaml
At-rest (database):
  - SQLCipher with 256-bit AES
  - Key stored in hardware security module (HSM) or .env (encrypted)

In-flight (network):
  - TLS 1.3 with strong ciphers
  - Mutual TLS (client certificate required)

Key Management:
  - Rotate JWT secret monthly
  - Store in environment variables (never in code)
  - Use secrets manager (Hashicorp Vault, AWS Secrets Manager)
```

#### 3. ACCESS CONTROL (Who Sees What)
```yaml
# Implement role-based access control (RBAC)
users:
  - role: "viewer"      # Can only view suggestions
    permissions: [read_embeddings]
  - role: "editor"      # Can label images
    permissions: [read_embeddings, write_labels]
  - role: "admin"       # Full access + export
    permissions: [read_embeddings, write_labels, export_data, delete_user]

# Query example:
def get_user_access_level(user_id):
    return db.query("SELECT role FROM users WHERE user_id = ?", user_id)

@app.post("/v1/learn")
async def learn(user_id: str = Header(...)):
    if get_user_access_level(user_id) != "editor":
        raise HTTPException(403, "Unauthorized")
    # ... proceed
```

#### 4. AUDIT LOGGING (Compliance & DLP)
```yaml
What to log:
  - ✅ WHO made the change (user_id)
  - ✅ WHEN it happened (timestamp)
  - ✅ WHAT changed (label, source, NOT embedding)
  - ✅ WHY (source: manual_edit, ai_confirmed, etc)
  - ❌ DON'T log sensitive data (actual image, full embeddings)

Implementation:
  Table: sync_log
  Columns: user_id, operation, timestamp, record_id, source
  
  # Query example:
  SELECT user_id, operation, timestamp 
  FROM sync_log 
  WHERE operation='learn' 
  ORDER BY timestamp DESC
  -- Use for compliance reports
```

#### 5. DATA RETENTION & DELETION
```yaml
Policies:
  - Auto-delete sync logs after 90 days (GDPR)
  - Allow users to export all personal data
  - Implement "right to be forgotten" -> delete user account
  - Use soft deletes (mark deleted_at, don't hard delete)

Implementation:
sync_manager.delete_all_user_data(user_id)
# Deletes: learning history, session tokens, personal entries
# Keeps: Anonymized embeddings (for model integrity)
```

#### 6. IMAGE DATA SAFETY
```yaml
Critical: IMAGE FILES are NOT stored by backend
  ✅ Backend only stores: labels, embeddings, metadata
  ✅ Images stay on user's local disk or company server
  ✅ Only filename + path are logged (not image content)

Example: When user learns an image
  Client sends:
    - file: image.jpg
    - label: "Antenna"
    - image_path: "//company-fileserver/photos/2026-04/antenna.jpg"
  
  Backend stores:
    - image_path: "//company-fileserver/photos/2026-04/antenna.jpg"  (just path!)
    - label: "Antenna"
    - embedding: [0.123, 0.456, ...]  (NOT reversible to image)
    - image_bytes: NEVER stored ✅

  Server never saves image files to disk
```

---

## Part 5: Implementation Roadmap

### Phase 1: Minimal Sync (Weeks 1-2)
```
✅ Add sync tables to database
✅ Implement /v1/sync endpoint
✅ Add JWT token generation
✅ Frontend periodic sync loop
```

### Phase 2: Security Hardening (Weeks 3-4)
```
- Enable TLS in production
- Add user authentication
- Implement role-based access control
- Setup audit logging
```

### Phase 3: Compliance (Weeks 5-6)
```
- Add data export (GDPR)
- Implement user deletion flow
- Add compliance reports
- Security audit & testing
```

---

## Security Checklist for Deployment

Before going live:

- [ ] TLS/SSL certificate installed (HTTPS)
- [ ] JWT secret key generated & stored in .env
- [ ] Database encryption enabled (SQLCipher)
- [ ] CORS properly restricted (not `"*"`)
- [ ] API rate limiting implemented
- [ ] User authentication required on all endpoints
- [ ] Audit logging active
- [ ] Data retention policy defined
- [ ] Security group rules configured (firewall)
- [ ] Regular backups encrypted
- [ ] Penetration testing completed
- [ ] Legal review for GDPR/DLP compliance

---

## Reference: Environment Variables

```bash
# Auth
BILDERTOOL_AI_JWT_SECRET=your-secret-key-here
BILDERTOOL_AI_JWT_EXPIRES_HOURS=24

# TLS (production only)
BILDERTOOL_AI_TLS_CERT=/path/to/cert.pem
BILDERTOOL_AI_TLS_KEY=/path/to/key.pem

# Database Encryption
BILDERTOOL_AI_DB_ENCRYPTION_KEY=encryption-key-here

# CORS (restrict in production!)
BILDERTOOL_AI_CORS_ORIGINS=https://company-domain.com,https://staging.company.com

# Data Retention
BILDERTOOL_AI_AUDIT_LOG_RETENTION_DAYS=90
BILDERTOOL_AI_AUTO_DELETE_USER_DATA=true

# Access Control
BILDERTOOL_AI_REQUIRE_AUTH=true
BILDERTOOL_AI_ADMIN_USERS=admin@company.com,manager@company.com
```
