const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const { signToken, authenticate, requireOwner } = require('../middleware/auth');
const { validateBody } = require('../middleware/validation');
const {
	AuthenticationError,
	AuthorizationError,
	ValidationError,
	ConflictError,
	NotFoundError,
	asyncHandler,
} = require('../middleware/errors');

function createAuthRouter(db) {
	const router = express.Router();

	const loginLimiter = rateLimit({
		windowMs: 60 * 1000, // 1 minute
		max: 5,
		message: { error: 'Too many login attempts. Try again in a minute.' },
	});

	// POST /api/auth/login
	router.post(
		'/login',
		loginLimiter,
		validateBody({
			username: ['required', 'string', 'username'],
			password: ['required', 'string'],
		}),
		asyncHandler((req, res) => {
			const { username, password } = req.body;

			const user = db
				.prepare('SELECT * FROM users WHERE username = ?')
				.get(username);
			if (!user || !bcrypt.compareSync(password, user.password_hash)) {
				throw new AuthenticationError('Invalid credentials');
			}

			const token = signToken(user);
			res.json({
				token,
				user: { id: user.id, username: user.username, role: user.role },
			});
		}),
	);

	// POST /api/auth/users — owner creates new users
	router.post(
		'/users',
		authenticate,
		requireOwner,
		validateBody({
			username: ['required', 'string', 'username'],
			password: ['required', 'string', 'password'],
			role: ['required', 'string', 'role'],
		}),
		asyncHandler((req, res) => {
			const { username, password, role } = req.body;

			const existing = db
				.prepare('SELECT id FROM users WHERE username = ?')
				.get(username);
			if (existing) {
				throw new ConflictError('Username already exists');
			}

			const hash = bcrypt.hashSync(password, 10);
			const result = db
				.prepare(
					'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
				)
				.run(username, hash, role);
			res.status(201).json({
				id: result.lastInsertRowid,
				username,
				role,
			});
		}),
	);

	// GET /api/auth/users — owner lists all users
	router.get('/users', authenticate, requireOwner, asyncHandler((req, res) => {
		const users = db
			.prepare('SELECT id, username, role, created_at FROM users')
			.all();
		res.json(users);
	}));

	// PUT /api/auth/users/:id — owner updates an existing user
	router.put(
		'/users/:id',
		authenticate,
		requireOwner,
		asyncHandler((req, res) => {
			const { id } = req.params;
			const { username, password, role } = req.body;

			const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id);
			if (!user) throw new NotFoundError('User');

			if (role !== undefined && parseInt(id) === req.user.id) {
				throw new AuthorizationError('Cannot change your own role');
			}

			if (role !== undefined && !['admin', 'owner'].includes(role)) {
				throw new ValidationError('Role must be admin or owner');
			}

			if (username !== undefined) {
				const conflict = db
					.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
					.get(username, id);
				if (conflict) throw new ConflictError('Username already exists');
			}

			const newUsername = username ?? user.username;
			const newRole = role ?? user.role;
			const newHash = password ? bcrypt.hashSync(password, 10) : null;

			if (newHash) {
				db.prepare('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?')
					.run(newUsername, newRole, newHash, id);
			} else {
				db.prepare('UPDATE users SET username = ?, role = ? WHERE id = ?')
					.run(newUsername, newRole, id);
			}

			res.json({ id: parseInt(id), username: newUsername, role: newRole });
		}),
	);

	// DELETE /api/auth/users/:id — owner deletes a user
	router.delete(
		'/users/:id',
		authenticate,
		requireOwner,
		asyncHandler((req, res) => {
			const { id } = req.params;
			if (parseInt(id) === req.user.id) {
				throw new AuthorizationError('Cannot delete your own account');
			}
			const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
			if (!user) throw new NotFoundError('User');
			db.prepare('DELETE FROM users WHERE id = ?').run(id);
			res.json({ success: true });
		}),
	);

	return router;
}

module.exports = createAuthRouter;
