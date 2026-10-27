import urllib.request
import json
import sys

import os
import sys

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TARGET_URL", "http://localhost:5000")

def login(email, password):
    url = f"{BASE_URL}/api/auth/login"
    data = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode("utf-8"))
        return res["token"]

def main():
    print("=== Testing CSV Export Security and Functionality ===")
    
    # 1. Test unauthenticated request
    print("\n[1] Testing Unauthenticated Request (No Token)...")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/export", method="GET")
    try:
        urllib.request.urlopen(req)
        print("FAIL: Expected 401 Unauthorized, but request succeeded!")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"PASS: Correctly rejected with HTTP {e.code}: {body}")

    # 2. Test Student Token (Should be Forbidden 403)
    print("\n[2] Testing Student Role Request (Doris Alphonso)...")
    student_token = login("doris.student@campus.edu", "Student@SmartServe2026")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/export", headers={"Authorization": f"Bearer {student_token}"}, method="GET")
    try:
        urllib.request.urlopen(req)
        print("FAIL: Expected 403 Forbidden for student, but request succeeded!")
        sys.exit(1)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        print(f"PASS: Correctly rejected with HTTP {e.code}: {body}")

    # 3. Test Admin Token with Authorization Header
    print("\n[3] Testing Administrator Request (Authorization: Bearer <admin_token>)...")
    admin_token = login("admin@smartserve.campus.edu", "Admin@SmartServe2026")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/export", headers={"Authorization": f"Bearer {admin_token}"}, method="GET")
    with urllib.request.urlopen(req) as resp:
        code = resp.status
        content_type = resp.headers.get("Content-Type")
        content_disp = resp.headers.get("Content-Disposition")
        csv_text = resp.read().decode("utf-8")
        
        print(f"HTTP Status: {code}")
        print(f"Content-Type: {content_type}")
        print(f"Content-Disposition: {content_disp}")
        lines = csv_text.strip().split("\n")
        print(f"Header row: {lines[0]}")
        print(f"Total rows exported: {len(lines)}")
        print(f"Sample row 1: {lines[1] if len(lines) > 1 else 'N/A'}")
        
        assert code == 200, "Expected HTTP 200"
        assert "text/csv" in content_type, "Expected text/csv content type"
        assert "attachment" in content_disp, "Expected attachment header"
        assert len(lines) >= 2, "Expected header + data rows"
        print("PASS: Admin CSV Export successful!")

    # 4. Test Admin Token with Query Parameter fallback (?token=...)
    print("\n[4] Testing Administrator Request with Query Token (?token=...)...")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/export?token={admin_token}", method="GET")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200
        print(f"PASS: Query parameter token fallback also verified with HTTP {resp.status}!")

    print("\n=== ALL CSV EXPORT TESTS PASSED SUCCESSFULLY! ===")

if __name__ == "__main__":
    main()

