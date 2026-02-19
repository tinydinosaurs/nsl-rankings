const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { signToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Try again in a minute.' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

// POST /api/auth/users — admin creates new users
router.post('/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, and role required' });
  }
  if (!['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or user' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
  res.status(201).json({ id: result.lastInsertRowid, username, role });
});

// GET /api/auth/users — admin lists all users
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
  res.json(users);
});

// DELETE /api/auth/users/:id — admin deletes a user
router.delete('/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
