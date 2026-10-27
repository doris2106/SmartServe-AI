const express = require('express');
const router = express.Router();
const {
  analyzeDraft,
  createComplaint,
  getMyComplaints,
  getComplaintById,
  getMetadata
} = require('../controllers/complaintController');
const { authenticateToken } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Public metadata
router.get('/metadata', getMetadata);

// Protected routes
router.post('/analyze-draft', authenticateToken, analyzeDraft);
router.post('/', authenticateToken, upload.single('attachment'), createComplaint);
router.get('/my', authenticateToken, getMyComplaints);
router.get('/:id', authenticateToken, getComplaintById);

module.exports = router;

