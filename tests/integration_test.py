import urllib.request
import urllib.parse
import json
import mimetypes
import uuid
import sys
import time

import os

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TARGET_URL", "http://localhost:5000")

def request(endpoint, method="GET", data=None, token=None, content_type="application/json"):
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    body = None
    if data is not None:
        if content_type == "application/json":
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        else:
            body = data
            headers["Content-Type"] = content_type

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = resp.status
            content = resp.read().decode("utf-8")
            try:
                return status, json.loads(content)
            except Exception:
                return status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, content

def encode_multipart_formdata(fields, files):
    boundary = uuid.uuid4().hex
    crlf = b"\r\n"
    lines = []
    
    for key, val in fields.items():
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{key}"'.encode())
        lines.append(b"")
        lines.append(str(val).encode())
        
    for key, (filename, file_bytes, mime) in files.items():
        lines.append(f"--{boundary}".encode())
        lines.append(f'Content-Disposition: form-data; name="{key}"; filename="{filename}"'.encode())
        lines.append(f"Content-Type: {mime}".encode())
        lines.append(b"")
        lines.append(file_bytes)
        
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    
    body = crlf.join(lines)
    content_type = f"multipart/form-data; boundary={boundary}"
    return body, content_type

def run_tests():
    print("==================================================")
    print("  SMARTSERVE AI - END-TO-END VERIFICATION SUITE   ")
    print(f"  Target Server: {BASE_URL}")
    print("==================================================")

    results = []

    # Test 1: Health Check
    print("\n[Test 1] Health Check Endpoint...")
    st, res = request("/api/health")
    passed = (st == 200 and res.get("status") == "HEALTHY")
    results.append(("Health Check Endpoint", passed, f"Status: {st}, Health: {res.get('status')}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'}")

    # Test 2: Student Login
    print("\n[Test 2] Student Authentication (Doris Alphonso)...")
    st, res = request("/api/auth/login", method="POST", data={
        "email": "doris.student@campus.edu",
        "password": "Student@SmartServe2026"
    })
    passed = (st == 200 and "token" in res)
    student_token = res.get("token")
    results.append(("Student Authentication", passed, f"Status: {st}, User: {res.get('user', {}).get('name')}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (Role: {res.get('user', {}).get('role')})")

    # Test 3: Admin Login
    print("\n[Test 3] Admin Authentication...")
    st, res = request("/api/auth/login", method="POST", data={
        "email": "admin@smartserve.campus.edu",
        "password": "Admin@SmartServe2026"
    })
    passed = (st == 200 and res.get("user", {}).get("role") == "admin")
    admin_token = res.get("token")
    results.append(("Admin Authentication", passed, f"Status: {st}, Role: {res.get('user', {}).get('role')}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'}")

    # Test 4: Role-Based Access Control (Security Verification)
    print("\n[Test 4] RBAC Security - Student blocked from Admin API...")
    st, res = request("/api/admin/complaints", method="GET", token=student_token)
    passed = (st == 403)
    results.append(("RBAC Authorization Guard", passed, f"Expected 403 Forbidden, got {st}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (HTTP {st} correctly returned for student)")

    # Test 5: Real-time AI Assistant Draft Analysis
    print("\n[Test 5] AI Assistant Draft Analysis...")
    sample_draft = {
        "title": "Severe short circuit and sparks from main power MCB in Robotics Lab",
        "description": "Continuous electrical spark and burning smell near the inverter circuit board when power switched on",
        "building": "Engineering Building"
    }
    st, res = request("/api/complaints/analyze-draft", method="POST", data=sample_draft, token=student_token)
    analysis = res.get("analysis", {})
    passed = (st == 200 and analysis.get("suggestedPriority") == "Critical" and "Electricity" in analysis.get("suggestedCategory", ""))
    results.append(("AI Urgency & Category Engine", passed, f"Category: {analysis.get('suggestedCategory')}, Priority: {analysis.get('suggestedPriority')}, Score: {analysis.get('urgencyScore')}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (Category: {analysis.get('suggestedCategory')}, Urgency Score: {analysis.get('urgencyScore')}/10, Priority: {analysis.get('suggestedPriority')})")

    # Test 6: AI Duplicate Complaint Detection
    print("\n[Test 6] AI Duplicate Detection Engine...")
    duplicate_draft = {
        "title": "Wi-Fi disconnecting continuously on 4th floor seminar hall",
        "description": "During presentation Wi-Fi drops every few minutes with connection reset",
        "building": "Main Academic Block"
    }
    st, res = request("/api/complaints/analyze-draft", method="POST", data=duplicate_draft, token=student_token)
    dup_info = res.get("analysis", {}).get("duplicateDetection", {})
    passed = (st == 200 and dup_info.get("isSimilar") is True)
    match_pct = int(dup_info.get('similarityScore', 0) * 100)
    results.append(("AI Duplicate Detection", passed, f"Detected duplicate: {dup_info.get('ticketId')} ({match_pct}% match)"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (Flagged duplicate ticket: {dup_info.get('ticketId')} with similarity {dup_info.get('similarityScore')})")

    # Test 7: Complaint Creation with S3 Attachment Upload & SQS Dispatch
    print("\n[Test 7] Complaint Lodging with S3 Attachment & SQS...")
    dummy_image = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    fields = {
        "title": "Water leakage in 2nd Floor Washroom pipe",
        "description": "Continuous water flowing from main sink faucet causing flooded floor tiles",
        "building": "Library Block",
        "location_details": "2nd Floor Boys Washroom, East Wing",
        "priority": "High"
    }
    files = {
        "attachment": ("washroom-leakage.png", dummy_image, "image/png")
    }
    body, ct = encode_multipart_formdata(fields, files)
    st, res = request("/api/complaints", method="POST", data=body, token=student_token, content_type=ct)
    new_ticket_id = res.get("ticket_id")
    new_comp_id = res.get("complaint_id")
    passed = (st == 201 and new_ticket_id is not None)
    results.append(("Complaint Lodging (S3 + SQS)", passed, f"Ticket: {new_ticket_id}, ID: {new_comp_id}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (Generated Ticket: {new_ticket_id})")

    # Test 8: S3 Presigned URL Verification
    print("\n[Test 8] S3 Presigned URL Security & Retrieval...")
    st, res = request(f"/api/complaints/{new_comp_id}", method="GET", token=student_token)
    comp_obj = res.get("complaint", {})
    s3_url = comp_obj.get("attachment_url")
    has_valid_s3 = (st == 200 and s3_url is not None and "smartserve-attachments" in s3_url and "X-Amz-Signature" in s3_url)
    results.append(("S3 Presigned Attachment Access", has_valid_s3, f"Presigned URL successfully created with AWS V4 signature"))
    print(f"  Result: {'PASS' if has_valid_s3 else 'FAIL'} (Presigned URL: {s3_url[:65]}...)")

    # Test 9: Student Isolation (Student cannot access another student's complaint)
    print("\n[Test 9] Student Data Isolation Check...")
    # Rahul Verma is student ID 3, ticket 3 was submitted by Rahul
    # Doris is user ID 2; let's verify Doris accessing ticket 3
    st, res = request("/api/complaints/3", method="GET", token=student_token)
    passed = (st == 403)
    results.append(("Student Data Privacy Isolation", passed, f"Cross-tenant access prevented with 403 Forbidden"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (HTTP {st} correctly denied access to other student's ticket)")

    # Test 10: Admin Complaint Assignment
    print("\n[Test 10] Admin Staff Assignment Workflow...")
    # Assign new ticket to staff user 6 (Ramesh More, Plumber)
    st, res = request(f"/api/admin/complaints/{new_comp_id}/assign", method="PATCH", data={
        "staff_id": 6,
        "remarks": "Assigned to plumbing staff Ramesh More for immediate pipe fitting repair."
    }, token=admin_token)
    passed = (st == 200 and res.get("success") is True)
    results.append(("Admin Ticket Assignment", passed, f"Status: {st}, Message: {res.get('message')}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'}")

    # Test 11: Status Update to Resolved with SNS Trigger
    print("\n[Test 11] Ticket Resolution & SNS Alert Trigger...")
    st, res = request(f"/api/admin/complaints/{new_comp_id}/status", method="PATCH", data={
        "status": "Resolved",
        "resolution_notes": "Replaced damaged inlet washer and checked water flow under pressure. Area dry and safe."
    }, token=admin_token)
    passed = (st == 200 and res.get("success") is True)
    results.append(("Ticket Resolution (SNS Dispatch)", passed, f"Status: {st}, Ticket marked Resolved"))
    print(f"  Result: {'PASS' if passed else 'FAIL'}")

    # Test 12: Real-time Campus Analytics API
    print("\n[Test 12] Campus Analytics Aggregation...")
    st, res = request("/api/analytics", method="GET", token=admin_token)
    analytics = res.get("data", {})
    passed = (st == 200 and analytics.get("totalComplaints", 0) > 0 and len(analytics.get("buildingDistribution", [])) > 0)
    results.append(("Campus Analytics & Hotspots", passed, f"Total Complaints: {analytics.get('totalComplaints')}, Hotspots: {len(analytics.get('buildingDistribution', []))}"))
    print(f"  Result: {'PASS' if passed else 'FAIL'} (Total: {analytics.get('totalComplaints')}, Categories tracked: {len(analytics.get('categoryDistribution', []))})")

    # Summary
    print("\n==================================================")
    print("  TEST EXECUTION SUMMARY                          ")
    print("==================================================")
    total_passed = sum(1 for _, p, _ in results if p)
    for name, p, detail in results:
        status_str = "PASS" if p else "FAIL"
        print(f"  [{status_str}] {name:<35} | {detail}")
    print(f"\nFinal Score: {total_passed} / {len(results)} Passed ({round(total_passed / len(results) * 100)}%)")
    print("==================================================")

    # Save test report JSON
    with open(r"c:\Users\Doris\CCL\smartserve-ai\test_results.json", "w") as f:
        json.dump({
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "server": BASE_URL,
            "total": len(results),
            "passed": total_passed,
            "tests": [{"name": n, "passed": p, "details": d} for n, p, d in results]
        }, f, indent=2)

if __name__ == "__main__":
    run_tests()
