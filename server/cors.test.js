// CORS allowlist tests for the public leaderboard endpoint.
//
// server/index.js boots the server on import, so we re-create its
// CORS wiring here (same parsing rules) and assert it against a tiny
// Express app. If the parsing logic in index.js changes, mirror it here.

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';

function parseAllowedOrigins(clientUrl) {
	return (clientUrl || 'http://localhost:5173')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);
}

function buildApp(clientUrl) {
	const app = express();
	app.use(cors({ origin: parseAllowedOrigins(clientUrl) }));
	app.get('/api/rankings/public', (req, res) => res.json({ ok: true }));
	return app;
}

describe('CORS allowlist (CLIENT_URL parsing)', () => {
	it('parses a single origin', () => {
		expect(parseAllowedOrigins('https://app.example.com')).toEqual([
			'https://app.example.com',
		]);
	});

	it('parses a comma-separated list', () => {
		expect(
			parseAllowedOrigins('https://app.example.com,https://wp.example.com'),
		).toEqual(['https://app.example.com', 'https://wp.example.com']);
	});

	it('trims whitespace and drops empty entries', () => {
		expect(
			parseAllowedOrigins(' https://app.example.com , , https://wp.example.com '),
		).toEqual(['https://app.example.com', 'https://wp.example.com']);
	});

	it('falls back to the Vite dev origin when CLIENT_URL is unset', () => {
		expect(parseAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
		expect(parseAllowedOrigins('')).toEqual(['http://localhost:5173']);
	});
});

describe('CORS middleware end-to-end', () => {
	it('echoes the request origin when it is in the allowlist', async () => {
		const app = buildApp('https://app.example.com,https://wp.example.com');
		const response = await request(app)
			.get('/api/rankings/public')
			.set('Origin', 'https://wp.example.com');
		expect(response.status).toBe(200);
		expect(response.headers['access-control-allow-origin']).toBe(
			'https://wp.example.com',
		);
	});

	it('omits the Access-Control-Allow-Origin header when the origin is not in the allowlist', async () => {
		const app = buildApp('https://app.example.com');
		const response = await request(app)
			.get('/api/rankings/public')
			.set('Origin', 'https://attacker.example.com');
		// Request still succeeds (CORS is enforced by the browser, not the server),
		// but no allow-origin header is sent, so the browser will block the
		// response from reaching the page.
		expect(response.status).toBe(200);
		expect(response.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('supports a CORS preflight (OPTIONS) for an allowed origin', async () => {
		const app = buildApp('https://wp.example.com');
		const response = await request(app)
			.options('/api/rankings/public')
			.set('Origin', 'https://wp.example.com')
			.set('Access-Control-Request-Method', 'GET');
		expect(response.status).toBe(204);
		expect(response.headers['access-control-allow-origin']).toBe(
			'https://wp.example.com',
		);
	});
});
