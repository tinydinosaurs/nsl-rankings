const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { signToken, requireAdmin, requireOwner } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Try again in a minute.' },
});

// POST /api/auth/login
router.post('/login', 
  loginLimiter, 
  validateBody({
    username: ['required', 'string', 'username'],
    password: ['required', 'string']
  }),
  (req, res) => {
    const { username, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signToken(user);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  }
);

// POST /api/auth/users — owner creates new users
router.post('/users', 
  requireOwner,
  validateBody({
    username: ['required', 'string', 'username'],
    password: ['required', 'string', 'password'], 
    role: ['required', 'string', 'role']
  }),
  (req, res) => {
    const { username, password, role } = req.body;

    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)').run(username, hash, role);
    res.status(201).json({ id: result.lastInsertRowid, username, role });
  }
);

// GET /api/auth/users — owner lists all users
router.get('/users', requireOwner, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users').all();
  res.json(users);
});

// DELETE /api/auth/users/:id — owner deletes a user
router.delete('/users/:id', requireOwner, (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
