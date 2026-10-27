import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

import os
import sys

BASE_URL = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("TARGET_URL", "http://localhost:5000")

def api_post(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'})
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"error": body}

def api_get(endpoint, token=None):
    url = f"{BASE_URL}{endpoint}"
    req = urllib.request.Request(url)
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"error": body}

def api_patch(endpoint, data, token=None):
    url = f"{BASE_URL}{endpoint}"
    payload = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=payload, headers={'Content-Type': 'application/json'}, method='PATCH')
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            return res.status, json.loads(res.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"error": body}

print("=== STARTING SMART SERVE AI STAFF DASHBOARD TESTS ===")

# 1. Login as Sunil Pawar
status, res = api_post('/api/auth/login', {
    "email": "sunil.elec@campus.edu",
    "password": "Staff@SmartServe2026"
})
assert status == 200, f"Sunil login failed: {res}"
sunil_token = res['token']
sunil_user = res['user']
print(f"[PASS] Sunil Pawar Login successful: ID={sunil_user['id']}, StaffID={sunil_user['student_staff_id']}, Role={sunil_user['role']}")

# 2. Unauthenticated check
unauth_status, unauth_res = api_get('/api/admin/complaints')
assert unauth_status == 401, f"Expected 401 for unauthenticated request, got {unauth_status}"
print("[PASS] Unauthenticated request correctly rejected with 401")

# 3. Fetch complaints for Sunil
status, comp_res = api_get('/api/admin/complaints', token=sunil_token)
assert status == 200, f"Fetch complaints failed: {comp_res}"
complaints = comp_res.get('complaints', [])
count = comp_res.get('count', 0)
print(f"[PASS] Sunil dashboard complaints returned: {count} complaints")
assert count > 0, "Expected at least 1 complaint assigned to Sunil Pawar"

# 4. Verify all returned complaints are assigned to Sunil (user ID = 4)
for c in complaints:
    assert c['assigned_to_user_id'] == sunil_user['id'], f"Complaint {c['ticket_id']} assigned to {c['assigned_to_user_id']}, not Sunil ({sunil_user['id']})"
    print(f"       -> Ticket: {c['ticket_id']} | Title: {c['title']} | Priority: {c['priority']} | Status: {c['status']} | AI Urgency: {c['ai_urgency_score']}")
print(f"[PASS] All {len(complaints)} complaints strictly match assigned_to_user_id == {sunil_user['id']}")

# 5. Verify Sunil can update status and resolution remarks of his own assigned complaint
my_complaint = complaints[0]
update_status, update_res = api_patch(f"/api/admin/complaints/{my_complaint['id']}/status", {
    "status": "In Progress",
    "resolution_notes": "Inspected electrical panel on 2nd floor, tested voltage and ordered replacement breaker.",
    "priority": "Low" # Sunil tries to alter priority - backend should ignore priority alteration for staff
}, token=sunil_token)
assert update_status == 200, f"Sunil status update failed: {update_res}"
print(f"[PASS] Sunil successfully updated status on assigned ticket {my_complaint['ticket_id']}")

# 6. Verify priority was NOT changed by staff update
_, verify_res = api_get('/api/admin/complaints', token=sunil_token)
updated_ticket = next(c for c in verify_res['complaints'] if c['id'] == my_complaint['id'])
assert updated_ticket['status'] == "In Progress", f"Status did not persist: {updated_ticket['status']}"
assert updated_ticket['priority'] == my_complaint['priority'], f"Staff modified priority! Expected {my_complaint['priority']}, got {updated_ticket['priority']}"
print(f"[PASS] Staff update preserved priority integrity ({updated_ticket['priority']} unchanged)")

# 7. Login as Admin to check all complaints & test staff RBAC restriction on another ticket
admin_status, admin_auth = api_post('/api/auth/login', {
    "email": "admin@smartserve.campus.edu",
    "password": "Admin@SmartServe2026"
})
admin_token = admin_auth['token']
_, all_comps = api_get('/api/admin/complaints', token=admin_token)
other_complaint = next((c for c in all_comps['complaints'] if c['assigned_to_user_id'] != sunil_user['id']), None)

if other_complaint:
    print(f"Testing unauthorized update on ticket {other_complaint['ticket_id']} (assigned to user {other_complaint['assigned_to_user_id']})...")
    forbidden_status, forbidden_res = api_patch(f"/api/admin/complaints/{other_complaint['id']}/status", {
        "status": "Resolved",
        "resolution_notes": "Attempting unauthorized update"
    }, token=sunil_token)
    assert forbidden_status == 403, f"Expected 403 Forbidden for unauthorized update, got {forbidden_status}: {forbidden_res}"
    print(f"[PASS] Sunil prevented from updating complaint assigned to another user: {forbidden_res.get('message')}")

# 8. Re-login as Sunil to verify persistence across sessions
status, res2 = api_post('/api/auth/login', {
    "email": "sunil.elec@campus.edu",
    "password": "Staff@SmartServe2026"
})
sunil_token2 = res2['token']
_, comp_res2 = api_get('/api/admin/complaints', token=sunil_token2)
assert comp_res2.get('count') == count, "Complaint count differed after re-login"
print(f"[PASS] Persistence verified across re-login: {comp_res2.get('count')} assigned complaints active")

print("=== ALL STAFF DASHBOARD VERIFICATION TESTS PASSED SUCCESSFULLY! ===")
