"""
Bildertool AI Diagnostic Tool
Helps debug suggestion quality issues
"""
import sqlite3
import numpy as np
from pathlib import Path

DB_PATH = Path(__file__).parent / "data" / "image_vectors.db"

def diagnose():
    print("=" * 60)
    print("BILDERTOOL AI DIAGNOSTIC REPORT")
    print("=" * 60)
    
    if not DB_PATH.exists():
        print(f"❌ Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(str(DB_PATH))
    
    # Check 1: Total records
    count = conn.execute("SELECT COUNT(*) FROM image_metadata").fetchone()[0]
    print(f"\n✓ Total trained records: {count}")
    
    # Check 2: Category distribution
    print("\n✓ Category distribution:")
    categories = conn.execute("""
        SELECT label, COUNT(*) as cnt FROM image_metadata 
        GROUP BY label 
        ORDER BY cnt DESC
    """).fetchall()
    
    for label, cnt in categories[:15]:
        bar = "█" * (cnt // 2)
        print(f"  {label:30} {cnt:3} {bar}")
    
    if len(categories) > 15:
        rest_count = sum(c for _, c in categories[15:])
        print(f"  {'... and ' + str(len(categories)-15) + ' more':30} {rest_count:3}")
    
    # Check 3: Vector quality
    print("\n✓ Vector quality check:")
    try:
        import sqlite_vec
        embeddings = conn.execute("""
            SELECT COUNT(*) FROM image_embeddings
        """).fetchone()
        print(f"  Embeddings in vector table: {embeddings[0]}")
        
        # Check for corrupted/zero vectors
        from image_categorizer.embedder import DinoV3OnnxEmbedder
        from image_categorizer.config import get_config
        config = get_config()
        
        if config.embedding_dim == 384:
            print(f"  Embedding dimension: {config.embedding_dim} ✓")
        else:
            print(f"  WARNING: Embedding dimension mismatch! Expected 384, got {config.embedding_dim}")
    except Exception as e:
        print(f"  Embedding check skipped: {e}")
    
    # Check 4: Source distribution (tracking what type of learning)
    print("\n✓ Learning source distribution:")
    sources = conn.execute("""
        SELECT source, COUNT(*) as cnt FROM image_metadata 
        GROUP BY source
    """).fetchall()
    
    for source, cnt in sources:
        print(f"  {source:25} {cnt:3} images")
    
    # Check 5: Data freshness
    print("\n✓ Timeline:")
    created_dates = conn.execute("""
        SELECT DATE(created_at) as date, COUNT(*) as cnt 
        FROM image_metadata 
        GROUP BY date
        ORDER BY date DESC
        LIMIT 5
    """).fetchall()
    
    for date, cnt in created_dates:
        print(f"  {date}: {cnt:3} images")
    
    # Check 6: File size vs content
    db_size_mb = DB_PATH.stat().st_size / (1024 * 1024)
    print(f"\n✓ Database size: {db_size_mb:.1f} MB")
    expected_size = count * 0.008  # ~8KB per vector + metadata
    if db_size_mb > expected_size * 5:
        print(f"  ⚠ WARNING: Database seems large ({db_size_mb:.1f}MB) for {count} records")
    
    print("\n" + "=" * 60)
    print("RECOMMENDATIONS:")
    print("=" * 60)
    
    if count == 0:
        print("\n🔴 NO TRAINING DATA FOUND!")
        print("   - Model needs to be retrained")
        print("   - Try: Drop 5-10 test images and check if they learn")
    
    elif count < 20:
        print("\n🟡 LOW TRAINING DATA")
        print(f"   - Only {count} vectors (need 50+ for good suggestions)")
        print("   - Add more diverse images in each category")
    
    else:
        print(f"\n✅ TRAINING DATA LOOKS GOOD ({count} vectors)")
        
        # Check if suggestions are actually using this data
        print("\n   To debug suggestions:")
        print("   1. Open browser DevTools (F12)")
        print("   2. Go to Console tab")
        print("   3. Drag a new test image")
        print("   4. Check: console.log(state.files[0].aiSuggestion)")
        print("   5. Look for: confidence value")
        
        if count > 200:
            print(f"\n   ℹ Dense model ({count} vectors)")
            print("     - Suggestions should be very accurate")
            print("     - If wrong, check: embedding model integrity")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("\nTo run this again:")
    print("cd backend/image_categorizer && python diagnostic.py")
    print("=" * 60)

if __name__ == "__main__":
    diagnose()
