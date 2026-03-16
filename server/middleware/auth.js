// === server/middleware/auth.js ===
const jwt = require('jsonwebtoken');
const { AuthenticationError, AuthorizationError } = require('./errors');

// Production guard in server/index.js ensures JWT_SECRET is set before startup;
// the fallback here is only reachable in local development.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authenticate(req, res, next) {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		return next(new AuthenticationError('No token provided'));
	}
	const token = authHeader.slice(7);
	try {
		req.user = jwt.verify(token, JWT_SECRET);
		next();
	} catch {
		return next(new AuthenticationError('Invalid or expired token'));
	}
}

// Pure role checks — compose with authenticate in route definitions:
//   router.get('/protected', authenticate, requireAdmin, handler)
function requireAdmin(req, res, next) {
	if (!['owner', 'admin'].includes(req.user?.role)) {
		return next(new AuthorizationError('Admin access required'));
	}
	next();
}

function requireOwner(req, res, next) {
	if (req.user?.role !== 'owner') {
		return next(new AuthorizationError('Owner access required'));
	}
	next();
}

function signToken(user) {
	return jwt.sign(
		{ id: user.id, username: user.username, role: user.role },
		JWT_SECRET,
		{ expiresIn: '24h' },
	);
}

module.exports = { authenticate, requireAdmin, requireOwner, signToken };
