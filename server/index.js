require('dotenv').config();

// Fail fast in production if JWT_SECRET is insecure
if (process.env.NODE_ENV === 'production') {
	const secret = process.env.JWT_SECRET;
	const defaultSecret = 'dev-secret-change-in-production';
	if (!secret || secret === defaultSecret) {
		console.error(
			'FATAL: JWT_SECRET must be set to a strong value in production',
		);
		process.exit(1);
	}
}

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db/database'); // Initialize and get DB instance

const createAuthRoutes = require('./routes/auth');
const createRankingsRoutes = require('./routes/rankings');
const createUploadRoutes = require('./routes/upload');
const { errorHandler, notFoundHandler } = require('./middleware/errors');

const app = express();
const PORT = process.env.PORT || 3001;

const clientUrl = process.env.CLIENT_URL;
if (!clientUrl && process.env.NODE_ENV === 'production') {
	console.error('FATAL: CLIENT_URL must be set in production');
	process.exit(1);
}

// CLIENT_URL accepts a comma-separated list of allowed origins so the public
// leaderboard can be embedded on additional sites (e.g. the WordPress page).
// In dev we fall back to the Vite default. Empty entries from a trailing comma
// or extra whitespace are filtered out.
const allowedOrigins = (clientUrl || 'http://localhost:5173')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Create route instances with database dependency injection
app.use('/api/auth', createAuthRoutes(db));
app.use('/api/rankings', createRankingsRoutes(db));
app.use('/api/upload', createUploadRoutes(db));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Return 404 for unmatched API routes before falling through to SPA
app.use('/api', notFoundHandler);

// Serve React frontend (no-op in dev if client/dist doesn't exist)
app.use(express.static(path.join(__dirname, '../client/dist')));
app.get('*', (req, res, next) => {
	const distIndex = path.join(__dirname, '../client/dist/index.html');
	res.sendFile(distIndex, (err) => {
		if (err) next(); // fall through to 404 handler in dev
	});
});

// Handle 404 for unknown routes
app.use('*', notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () =>
	console.log(`Server running on http://localhost:${PORT}`),
);
