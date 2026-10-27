const { query } = require('../config/db');
const { uploadAttachment, getAttachmentViewUrl } = require('../services/s3Service');
const { analyzeComplaint } = require('../services/aiService');
const { sendComplaintToQueue } = require('../services/sqsService');
const { publishNotification } = require('../services/snsService');
const { logToCloudWatch, recordMetric } = require('../services/cloudWatchService');

/**
 * Real-time AI Assistant draft analyzer for frontend form
 */
async function analyzeDraft(req, res) {
  try {
    const { title, description, building } = req.body;
    if (!title && !description) {
      return res.status(400).json({ success: false, message: 'Title or description required for analysis.' });
    }

    // Fetch existing recent complaints for duplicate detection
    const existing = await query(
      'SELECT ticket_id, title, description, building, status FROM complaints ORDER BY id DESC LIMIT 50'
    );

    const analysis = analyzeComplaint(title || '', description || '', building || '', existing);
    return res.json({ success: true, analysis });
  } catch (err) {
    console.error('Draft analysis error:', err);
    return res.status(500).json({ success: false, message: 'AI analysis failed.', error: err.message });
  }
}

/**
 * Create a new complaint (Student)
 */
async function createComplaint(req, res) {
  try {
    const { title, description, building, location_details, priority, category_id } = req.body;
    const userId = req.user.id;

    if (!title || !description || !building || !location_details) {
      return res.status(400).json({ success: false, message: 'Title, description, building, and location details are mandatory.' });
    }

    // 1. Fetch recent complaints for AI duplicate detection
    const existing = await query(
      'SELECT ticket_id, title, description, building, status FROM complaints ORDER BY id DESC LIMIT 50'
    );

    // 2. Run AI Engine Analysis
    const aiResult = analyzeComplaint(title, description, building, existing);

    // 3. Resolve category and department
    let chosenCategoryId = category_id ? parseInt(category_id) : null;
    let chosenDepartmentId = 6; // Default Estate/Civil

    if (chosenCategoryId) {
      const catRows = await query('SELECT default_department_id FROM categories WHERE id = ?', [chosenCategoryId]);
      if (catRows && catRows.length > 0) {
        chosenDepartmentId = catRows[0].default_department_id || 6;
      }
    } else {
      // Find category by AI suggestion
      const catRows = await query('SELECT id, default_department_id FROM categories WHERE name = ?', [aiResult.suggestedCategory]);
      if (catRows && catRows.length > 0) {
        chosenCategoryId = catRows[0].id;
        chosenDepartmentId = catRows[0].default_department_id || 6;
      } else {
        chosenCategoryId = 1;
      }
    }

    const finalPriority = priority || aiResult.suggestedPriority || 'Medium';

    // 4. Handle S3 attachment upload if provided
    let s3Key = null;
    let originalFilename = null;
    if (req.file) {
      const uploadRes = await uploadAttachment(req.file);
      s3Key = uploadRes.s3Key;
      originalFilename = uploadRes.filename;
    }

    // 5. Generate unique Ticket ID: SSC-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRows = await query('SELECT COUNT(*) as total FROM complaints');
    const seq = (countRows[0].total + 1001);
    const ticketId = `SSC-${year}-${seq}`;

    // 6. Insert complaint into DB
    const insertSql = `
      INSERT INTO complaints (
        ticket_id, user_id, category_id, department_id, title, description,
        building, location_details, priority, status,
        attachment_s3_key, attachment_filename,
        ai_suggested_category, ai_suggested_priority, ai_urgency_score, ai_confidence,
        ai_similar_ticket_id, ai_similarity_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const insertParams = [
      ticketId, userId, chosenCategoryId, chosenDepartmentId, title, description,
      building, location_details, finalPriority,
      s3Key, originalFilename,
      aiResult.suggestedCategory, aiResult.suggestedPriority, aiResult.urgencyScore, aiResult.confidence,
      aiResult.duplicateDetection.ticketId, aiResult.duplicateDetection.similarityScore
    ];

    const result = await query(insertSql, insertParams);
    const complaintId = result.insertId;

    // 7. Audit log initial record
    await query(
      'INSERT INTO complaint_updates (complaint_id, updated_by_user_id, old_status, new_status, remarks) VALUES (?, ?, NULL, "Submitted", "Complaint registered via SmartServe AI portal")',
      [complaintId, userId]
    );

    // 8. Dispatch to SQS for background async processing
    await sendComplaintToQueue({
      id: complaintId,
      ticket_id: ticketId,
      user_id: userId,
      title,
      priority: finalPriority,
      building,
      ai_urgency: aiResult.urgencyScore
    });

    // 9. If Critical Priority or high urgency, publish immediate notification to SNS
    if (finalPriority === 'Critical' || aiResult.urgencyScore >= 9.0) {
      await publishNotification(
        `[CRITICAL ALERT] Campus Incident Ticket: ${ticketId}`,
        `A high-urgency complaint has been reported at ${building} (${location_details}):\n\nTitle: ${title}\nDescription: ${description}\nAI Urgency Score: ${aiResult.urgencyScore}/10.0\nReported by: ${req.user.name} (${req.user.student_staff_id})`
      );
    }

    // 10. Record CloudWatch Log & Metric
    logToCloudWatch(`New Complaint Created: ${ticketId} [${finalPriority}] at ${building} by ${req.user.student_staff_id}`, 'INFO');
    recordMetric('NewComplaints', 1);

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      ticket_id: ticketId,
      complaint_id: complaintId,
      ai_insights: {
        suggestedCategory: aiResult.suggestedCategory,
        suggestedPriority: aiResult.suggestedPriority,
        urgencyScore: aiResult.urgencyScore,
        confidence: aiResult.confidence,
        duplicateWarning: aiResult.duplicateDetection.isSimilar ? aiResult.duplicateDetection.message : null
      }
    });
  } catch (err) {
    console.error('Create complaint error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create complaint.', error: err.message });
  }
}

/**
 * Get complaints submitted by logged-in student
 */
async function getMyComplaints(req, res) {
  try {
    const userId = req.user.id;
    const complaints = await query(
      `SELECT c.*, cat.name as category_name, dept.name as department_name,
              staff.name as assigned_staff_name
       FROM complaints c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN departments dept ON c.department_id = dept.id
       LEFT JOIN users staff ON c.assigned_to_user_id = staff.id
       WHERE c.user_id = ?
       ORDER BY c.id DESC`,
      [userId]
    );

    // Attach signed view URL for attachments
    for (const c of complaints) {
      if (c.attachment_s3_key) {
        c.attachment_url = await getAttachmentViewUrl(c.attachment_s3_key);
      }
    }

    return res.json({ success: true, count: complaints.length, complaints });
  } catch (err) {
    console.error('Get my complaints error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch complaints.', error: err.message });
  }
}

/**
 * Get complaint details by ID (Student owner or Admin/Staff)
 */
async function getComplaintById(req, res) {
  try {
    const id = req.params.id;
    const rows = await query(
      `SELECT c.*, cat.name as category_name, dept.name as department_name,
              u.name as student_name, u.student_staff_id as student_id, u.email as student_email,
              staff.name as assigned_staff_name
       FROM complaints c
       LEFT JOIN categories cat ON c.category_id = cat.id
       LEFT JOIN departments dept ON c.department_id = dept.id
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users staff ON c.assigned_to_user_id = staff.id
       WHERE c.id = ? OR c.ticket_id = ?`,
      [id, id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Complaint not found.' });
    }

    const complaint = rows[0];

    // Authorization check: students can only see their own complaints
    if (req.user.role === 'student' && complaint.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to view this complaint.' });
    }

    // Fetch update timeline
    const updates = await query(
      `SELECT cu.*, u.name as updated_by_name, u.role as updated_by_role
       FROM complaint_updates cu
       JOIN users u ON cu.updated_by_user_id = u.id
       WHERE cu.complaint_id = ?
       ORDER BY cu.id ASC`,
      [complaint.id]
    );

    if (complaint.attachment_s3_key) {
      complaint.attachment_url = await getAttachmentViewUrl(complaint.attachment_s3_key);
    }

    return res.json({
      success: true,
      complaint,
      timeline: updates
    });
  } catch (err) {
    console.error('Get complaint by ID error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch complaint details.', error: err.message });
  }
}

/**
 * Get all categories & departments
 */
async function getMetadata(req, res) {
  try {
    const categories = await query('SELECT * FROM categories ORDER BY name ASC');
    const departments = await query('SELECT * FROM departments ORDER BY name ASC');
    return res.json({ success: true, categories, departments });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch metadata.', error: err.message });
  }
}

module.exports = {
  analyzeDraft,
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getMetadata
};

