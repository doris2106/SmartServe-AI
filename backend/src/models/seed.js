const bcrypt = require('bcryptjs');

async function getSeedSQL() {
  const adminPass = await bcrypt.hash('Admin@SmartServe2026', 10);
  const studentPass = await bcrypt.hash('Student@SmartServe2026', 10);
  const staffPass = await bcrypt.hash('Staff@SmartServe2026', 10);

  return `
-- Clean up existing seed data if needed
DELETE FROM complaint_updates;
DELETE FROM notifications;
DELETE FROM complaints;
DELETE FROM users;
DELETE FROM categories;
DELETE FROM departments;

-- 1. Seed Departments
INSERT INTO departments (id, name, code, contact_email, head_name) VALUES
(1, 'Electrical & Power Systems', 'DEPT_ELEC', 'electrical@campus.edu', 'Prof. R. Sharma'),
(2, 'Network & IT Infrastructure', 'DEPT_IT', 'it.support@campus.edu', 'Dr. S. Kulkarni'),
(3, 'Plumbing & Water Supply', 'DEPT_PLUMB', 'plumbing@campus.edu', 'Mr. V. Patil'),
(4, 'Laboratory Maintenance & Equipment', 'DEPT_LAB', 'lab.maintenance@campus.edu', 'Prof. A. Fernandes'),
(5, 'Housekeeping & Campus Cleanliness', 'DEPT_HOUSE', 'cleanliness@campus.edu', 'Mrs. M. Dsouza'),
(6, 'Classroom & Civil Maintenance', 'DEPT_CIVIL', 'estate.office@campus.edu', 'Eng. K. Nair');

-- 2. Seed Categories
INSERT INTO categories (id, name, description, default_department_id, icon) VALUES
(1, 'Wi-Fi & Internet Connectivity', 'Issues with Wi-Fi APs, lab ethernet, slow speed, login portal', 2, 'wifi'),
(2, 'Classroom Projector & Audio-Visual', 'Smart board, projector display, HDMI cables, audio mic issues', 2, 'projector'),
(3, 'Electricity & Lighting', 'Power failure, tube lights, switchboard spark, AC conditioning', 1, 'zap'),
(4, 'Plumbing & Water Coolers', 'Water purifier leakage, tap broken, washroom supply, pipeline issue', 3, 'droplets'),
(5, 'Lab Equipment & PCs', 'Computer not booting, oscilloscope, multimeter, microcontrollers', 4, 'cpu'),
(6, 'Cleanliness & Waste Disposal', 'Classroom floor cleaning, trash overflow, washroom hygiene', 5, 'sparkles'),
(7, 'Benches, Doors & Furniture', 'Broken desk bench, door latch jammed, whiteboard damage', 6, 'archive');

-- 3. Seed Users
INSERT INTO users (id, student_staff_id, name, email, password_hash, role, department_id, phone) VALUES
(1, 'ADM-001', 'Prof. Campus Administrator', 'admin@smartserve.campus.edu', '${adminPass}', 'admin', 2, '+91-9820011223'),
(2, 'STU-10642', 'Doris Alphonso', 'doris.student@campus.edu', '${studentPass}', 'student', NULL, '+91-9876543210'),
(3, 'STU-10643', 'Rahul Verma', 'rahul.student@campus.edu', '${studentPass}', 'student', NULL, '+91-9811122334'),
(4, 'STF-010', 'Sunil Pawar (Electrician)', 'sunil.elec@campus.edu', '${staffPass}', 'staff', 1, '+91-9833344556'),
(5, 'STF-011', 'Aniket Shinde (Network Admin)', 'aniket.net@campus.edu', '${staffPass}', 'staff', 2, '+91-9844455667'),
(6, 'STF-012', 'Ramesh More (Plumber)', 'ramesh.plumb@campus.edu', '${staffPass}', 'staff', 3, '+91-9855566778');

-- 4. Seed Complaints
INSERT INTO complaints (
  id, ticket_id, user_id, category_id, department_id, title, description,
  building, location_details, priority, status, assigned_to_user_id,
  ai_suggested_category, ai_suggested_priority, ai_urgency_score, ai_confidence, resolution_notes, created_at
) VALUES
(
  1, 'SSC-2026-1001', 2, 1, 2, 'Wi-Fi disconnects frequently in 4th Floor Seminar Hall',
  'During seminars and project presentations on the 4th floor, the Wi-Fi AP drops connections every 5 minutes with DNS probe error.',
  'Main Academic Block', '4th Floor, Seminar Hall A-402', 'High', 'In Progress', 5,
  'Wi-Fi & Internet Connectivity', 'High', 8.50, 0.95, 'Replaced POE injector on access point AP-402. Currently running soak tests.',
  NOW() - INTERVAL 3 DAY
),
(
  2, 'SSC-2026-1002', 2, 3, 1, 'AC tripping circuit breaker in Computer Lab 3',
  'When both split ACs are turned on simultaneously in Lab 3, the main MCB switchboard sparks and trips the whole row power.',
  'Engineering Building', 'Ground Floor, Comp Lab 3', 'Critical', 'Assigned', 4,
  'Electricity & Lighting', 'Critical', 9.80, 0.98, NULL,
  NOW() - INTERVAL 2 DAY
),
(
  3, 'SSC-2026-1003', 3, 4, 3, 'Water cooler leaking and floor slippery near Library',
  'The cold water dispenser outside the central library is leaking continuously, creating a slipping hazard on the corridor tiles.',
  'Library Block', '2nd Floor, Near Library Entrance', 'High', 'Resolved', 6,
  'Plumbing & Water Coolers', 'High', 8.20, 0.92, 'Replaced faulty drainage washer and tightened inlet valve. Area cleaned and dried.',
  NOW() - INTERVAL 1 DAY
),
(
  4, 'SSC-2026-1004', 3, 2, 2, 'Overhead projector lamp blinking in Room 304',
  'The ceiling projector flashes yellow lamp warning and turns off after 10 minutes of lecture slides.',
  'Main Academic Block', '3rd Floor, Room 304', 'Medium', 'Submitted', NULL,
  'Classroom Projector & Audio-Visual', 'Medium', 6.00, 0.88, NULL,
  NOW() - INTERVAL 4 HOUR
);

-- 5. Seed Complaint Updates
INSERT INTO complaint_updates (complaint_id, updated_by_user_id, old_status, new_status, remarks, created_at) VALUES
(1, 1, 'Submitted', 'Assigned', 'Assigned to Network Admin Aniket Shinde for AP diagnosis.', NOW() - INTERVAL 3 DAY),
(1, 5, 'Assigned', 'In Progress', 'Tested AP signal strength; suspected faulty POE adapter.', NOW() - INTERVAL 2 DAY),
(2, 1, 'Submitted', 'Assigned', 'High urgency electrical hazard. Assigned to Sunil Pawar with immediate priority.', NOW() - INTERVAL 2 DAY),
(3, 1, 'Submitted', 'Assigned', 'Assigned to Ramesh More.', NOW() - INTERVAL 1 DAY),
(3, 6, 'Assigned', 'Resolved', 'Replaced valve and verified no leaks.', NOW() - INTERVAL 12 HOUR);

-- 6. Seed Notifications
INSERT INTO notifications (user_id, complaint_id, title, message, is_read, channel, created_at) VALUES
(2, 1, 'Complaint Update', 'Your ticket SSC-2026-1001 status changed to In Progress.', FALSE, 'in_app', NOW() - INTERVAL 2 DAY),
(3, 3, 'Complaint Resolved', 'Your ticket SSC-2026-1003 has been marked as Resolved.', TRUE, 'in_app', NOW() - INTERVAL 12 HOUR);
`;
}

module.exports = { getSeedSQL };

