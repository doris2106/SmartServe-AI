const jwt = require('jsonwebtoken');
const { loadConfigFromSSM } = require('../config/ssm');
const { query } = require('../config/db');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const config = await loadConfigFromSSM();
    const decoded = jwt.verify(token, config.jwtSecret);

    // Verify user exists in DB
    const users = await query('SELECT id, student_staff_id, name, email, role, department_id FROM users WHERE id = ?', [decoded.id]);
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid session or user no longer exists.' });
    }

    req.user = users[0];
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Session expired or invalid token.' });
  }
}

function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}] role(s).`
      });
    }
    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole
};

