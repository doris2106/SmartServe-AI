const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { loadConfigFromSSM } = require('../config/ssm');
const { logToCloudWatch } = require('../services/cloudWatchService');

async function register(req, res) {
  try {
    const { student_staff_id, name, email, password, phone } = req.body;

    if (!student_staff_id || !name || !email || !password) {
      return res.status(400).json({ success: false, message: 'All required fields must be provided.' });
    }

    // Check existing
    const existing = await query('SELECT id FROM users WHERE email = ? OR student_staff_id = ?', [email, student_staff_id]);
    if (existing && existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email or ID already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO users (student_staff_id, name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, "student", ?)',
      [student_staff_id, name, email, passwordHash, phone || null]
    );

    const userId = result.insertId;
    const config = await loadConfigFromSSM();
    const token = jwt.sign({ id: userId, role: 'student', email }, config.jwtSecret, { expiresIn: '24h' });

    logToCloudWatch(`New student registered: ${student_staff_id} (${email})`, 'INFO');

    return res.status(201).json({
      success: true,
      message: 'Registration successful.',
      token,
      user: {
        id: userId,
        student_staff_id,
        name,
        email,
        role: 'student'
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.', error: err.message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const users = await query('SELECT * FROM users WHERE email = ?', [email]);
    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const config = await loadConfigFromSSM();
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    logToCloudWatch(`User login: ${user.email} (${user.role})`, 'INFO');

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        student_staff_id: user.student_staff_id,
        name: user.name,
        email: user.email,
        role: user.role,
        department_id: user.department_id
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.', error: err.message });
  }
}

async function getProfile(req, res) {
  return res.json({
    success: true,
    user: req.user
  });
}

module.exports = {
  register,
  login,
  getProfile
};

