require('dotenv').config();

// Fail fast in production if JWT_SECRET is insecure
if (process.env.NODE_ENV === 'production') {
  const secret = process.env.JWT_SECRET;
  const defaultSecret = 'dev-secret-change-in-production';
  if (!secret || secret === defaultSecret) {
    console.error('FATAL: JWT_SECRET must be set to a strong value in production');
    process.exit(1);
  }
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('./db/database'); // Initialize DB on startup

const authRoutes = require('./routes/auth');
const rankingsRoutes = require('./routes/rankings');
const uploadRoutes = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
