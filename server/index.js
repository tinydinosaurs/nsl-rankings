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

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

// Create route instances with database dependency injection
app.use('/api/auth', createAuthRoutes(db));
app.use('/api/rankings', createRankingsRoutes(db));
app.use('/api/upload', createUploadRoutes(db));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Handle 404 for unknown routes
app.use('*', notFoundHandler);

// Global error handling middleware (must be last)
app.use(errorHandler);

app.listen(PORT, () =>
	console.log(`Server running on http://localhost:${PORT}`),
);
