const express = require('express');
const router = express.Router();
const {
  getAllComplaints,
  assignComplaint,
  updateStatus,
  getStaffList,
  exportReport
} = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

// All admin routes require admin or staff role
router.use(authenticateToken);
router.use(requireRole(['admin', 'staff']));

router.get('/complaints', getAllComplaints);
router.patch('/complaints/:id/assign', requireRole(['admin']), assignComplaint);
router.patch('/complaints/:id/status', updateStatus);
router.get('/staff', requireRole(['admin', 'staff']), getStaffList);
router.get('/export', requireRole(['admin']), exportReport);

module.exports = router;

