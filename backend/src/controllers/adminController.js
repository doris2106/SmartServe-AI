const { query } = require('../config/db');
const { publishNotification } = require('../services/snsService');
const { logToCloudWatch, recordMetric } = require('../services/cloudWatchService');
const { getAttachmentViewUrl } = require('../services/s3Service');

/**
 * Get all complaints (Admin/Staff) with filtering, search, and pagination
 */
async function getAllComplaints(req, res) {
  try {
    const { status, priority, category_id, department_id, search, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT c.*, cat.name as category_name, dept.name as department_name,
             u.name as student_name, u.student_staff_id,
             staff.name as assigned_staff_name
      FROM complaints c
      LEFT JOIN categories cat ON c.category_id = cat.id
      LEFT JOIN departments dept ON c.department_id = dept.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN users staff ON c.assigned_to_user_id = staff.id
      WHERE 1=1
    `;
    const params = [];

    // If staff, filter strictly to complaints assigned to their actual database user ID
    if (req.user.role === 'staff') {
      sql += ' AND c.assigned_to_user_id = ?';
      params.push(req.user.id);
    }

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (priority) {
      sql += ' AND c.priority = ?';
      params.push(priority);
    }
    if (category_id) {
      sql += ' AND c.category_id = ?';
      params.push(category_id);
    }
    if (department_id) {
      sql += ' AND c.department_id = ?';
      params.push(department_id);
    }
    if (search) {
      sql += ' AND (c.title LIKE ? OR c.description LIKE ? OR c.ticket_id LIKE ? OR c.building LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += ' ORDER BY c.id DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const complaints = await query(sql, params);

    for (const c of complaints) {
      if (c.attachment_s3_key) {
        c.attachment_url = await getAttachmentViewUrl(c.attachment_s3_key);
      }
    }

    return res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    console.error('Get all complaints error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch complaints.', error: err.message });
  }
}

/**
 * Assign complaint to a staff member
 */
async function assignComplaint(req, res) {
  try {
    const { id } = req.params;
    const { staff_id, remarks } = req.body;

    const complaints = await query('SELECT * FROM complaints WHERE id = ?', [id]);
    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    const complaint = complaints[0];

    const staffRows = await query('SELECT id, name, email FROM users WHERE id = ? AND role IN ("staff", "admin")', [staff_id]);
    if (!staffRows || staffRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Selected staff member does not exist.' });
    }
    const staff = staffRows[0];

    const newStatus = complaint.status === 'Submitted' ? 'Assigned' : complaint.status;

    await query(
      'UPDATE complaints SET assigned_to_user_id = ?, status = ? WHERE id = ?',
      [staff.id, newStatus, id]
    );

    // Audit log
    const auditRemark = remarks || `Assigned to maintenance staff: ${staff.name}`;
    await query(
      'INSERT INTO complaint_updates (complaint_id, updated_by_user_id, old_status, new_status, remarks) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, complaint.status, newStatus, auditRemark]
    );

    // Create notification for student
    await query(
      'INSERT INTO notifications (user_id, complaint_id, title, message) VALUES (?, ?, "Complaint Assigned", ?)',
      [complaint.user_id, id, `Your ticket ${complaint.ticket_id} has been assigned to ${staff.name}.`]
    );

    logToCloudWatch(`Complaint ${complaint.ticket_id} assigned to ${staff.name} by ${req.user.name}`, 'INFO');

    return res.json({ success: true, message: `Ticket ${complaint.ticket_id} assigned to ${staff.name}.` });
  } catch (err) {
    console.error('Assign complaint error:', err);
    return res.status(500).json({ success: false, message: 'Failed to assign complaint.', error: err.message });
  }
}

/**
 * Update complaint status & add resolution notes
 */
async function updateStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, resolution_notes, priority } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    const complaints = await query('SELECT * FROM complaints WHERE id = ?', [id]);
    if (!complaints || complaints.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }
    const complaint = complaints[0];

    // STAFF AUTHORIZATION GUARD: Staff can only update complaints assigned to their own user id
    if (req.user.role === 'staff') {
      if (complaint.assigned_to_user_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are only permitted to update complaints assigned to your account.'
        });
      }
    }

    const isResolved = status === 'Resolved';
    const resolvedAt = isResolved ? new Date() : null;

    let updateSql = 'UPDATE complaints SET status = ?';
    const updateParams = [status];

    if (resolution_notes !== undefined) {
      updateSql += ', resolution_notes = ?';
      updateParams.push(resolution_notes);
    }
    // Only administrators can change priority; staff can only update status and resolution_notes
    if (priority && req.user.role === 'admin') {
      updateSql += ', priority = ?';
      updateParams.push(priority);
    }
    if (isResolved) {
      updateSql += ', resolved_at = ?';
      updateParams.push(resolvedAt);
    }

    updateSql += ' WHERE id = ?';
    updateParams.push(id);

    await query(updateSql, updateParams);

    // Audit log
    const auditRemark = resolution_notes || `Status updated from ${complaint.status} to ${status}`;
    await query(
      'INSERT INTO complaint_updates (complaint_id, updated_by_user_id, old_status, new_status, remarks) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.id, complaint.status, status, auditRemark]
    );

    // Notify student
    await query(
      'INSERT INTO notifications (user_id, complaint_id, title, message) VALUES (?, ?, ?, ?)',
      [
        complaint.user_id,
        id,
        `Ticket Status: ${status}`,
        `Your complaint ${complaint.ticket_id} has been marked as "${status}".${resolution_notes ? ` Notes: ${resolution_notes}` : ''}`
      ]
    );

    // If resolved, dispatch SNS notification & CloudWatch metric
    if (isResolved) {
      await publishNotification(
        `[RESOLVED] Campus Complaint: ${complaint.ticket_id}`,
        `Complaint ${complaint.ticket_id} (${complaint.title}) at ${complaint.building} has been marked as RESOLVED.\n\nResolution Remarks:\n${resolution_notes || 'Issue addressed by maintenance team.'}`
      );
      recordMetric('ResolvedComplaints', 1);
    }

    logToCloudWatch(`Complaint ${complaint.ticket_id} status changed to ${status} by ${req.user.name}`, 'INFO');

    return res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (err) {
    console.error('Update status error:', err);
    return res.status(500).json({ success: false, message: 'Failed to update status.', error: err.message });
  }
}

/**
 * Get maintenance staff list
 */
async function getStaffList(req, res) {
  try {
    const staff = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, d.name as department_name, d.id as department_id
       FROM users u
       LEFT JOIN departments d ON u.department_id = d.id
       WHERE u.role IN ('staff', 'admin')
       ORDER BY u.name ASC`
    );
    return res.json({ success: true, staff });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch staff list.', error: err.message });
  }
}

/**
 * Export complaints report (CSV format)
 */
async function exportReport(req, res) {
  try {
    const complaints = await query(
      `SELECT c.ticket_id, c.title, c.building, c.location_details, c.priority, c.status,
              cat.name as category, dept.name as department, u.name as student_name,
              c.created_at, c.resolved_at, c.resolution_notes
       FROM complaints c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN departments dept ON c.department_id = dept.id
       LEFT JOIN users u ON c.user_id = u.id
       ORDER BY c.id DESC`
    );

    const headers = ['Ticket ID', 'Title', 'Building', 'Location', 'Priority', 'Status', 'Category', 'Department', 'Reported By', 'Created At', 'Resolved At', 'Resolution Notes'];
    const rows = complaints.map(c => [
      c.ticket_id,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.building || ''}"`,
      `"${c.location_details || ''}"`,
      c.priority,
      c.status,
      `"${c.category || ''}"`,
      `"${c.department || ''}"`,
      `"${c.student_name || ''}"`,
      c.created_at ? new Date(c.created_at).toISOString() : '',
      c.resolved_at ? new Date(c.resolved_at).toISOString() : '',
      `"${(c.resolution_notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="smartserve-complaints-report-${Date.now()}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to generate report.', error: err.message });
  }
}

module.exports = {
  getAllComplaints,
  assignComplaint,
  updateStatus,
  getStaffList,
  exportReport
};

