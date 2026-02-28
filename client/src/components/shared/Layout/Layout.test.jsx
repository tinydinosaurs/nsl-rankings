import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Layout from './Layout';

// Mock useAuth hook
vi.mock('../../../hooks/useAuth.jsx', () => ({
	useAuth: vi.fn(),
}));

import { useAuth } from '../../../hooks/useAuth.jsx';

function renderLayout(authState) {
	useAuth.mockReturnValue(authState);
	return render(
		<MemoryRouter>
			<Layout />
		</MemoryRouter>,
	);
}

const adminAuth = {
	user: { username: 'Dana', role: 'owner' },
	logout: vi.fn(),
	isAdmin: true,
};

const publicAuth = {
	user: null,
	logout: vi.fn(),
	isAdmin: false,
};

describe('Layout', () => {
	describe('branding', () => {
		it('renders the app brand name', () => {
			renderLayout(publicAuth);
			expect(screen.getByText('🏆 Sport Rankings')).toBeInTheDocument();
		});
	});

	describe('public navigation', () => {
		it('shows Rankings link when not logged in', () => {
			renderLayout(publicAuth);
			expect(
				screen.getByRole('link', { name: 'Rankings' }),
			).toBeInTheDocument();
		});

		it('shows Login link when not logged in', () => {
			renderLayout(publicAuth);
			expect(
				screen.getByRole('link', { name: 'Login' }),
			).toBeInTheDocument();
		});

		it('does not show admin links when not logged in', () => {
			renderLayout(publicAuth);
			expect(
				screen.queryByRole('link', { name: 'Dashboard' }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole('link', { name: 'Competitors' }),
			).not.toBeInTheDocument();
			expect(
				screen.queryByRole('link', { name: 'Upload CSV' }),
			).not.toBeInTheDocument();
		});
	});

	describe('admin navigation', () => {
		it('shows Dashboard link when logged in as admin', () => {
			renderLayout(adminAuth);
			expect(
				screen.getByRole('link', { name: 'Dashboard' }),
			).toBeInTheDocument();
		});

		it('shows Competitors link when logged in as admin', () => {
			renderLayout(adminAuth);
			expect(
				screen.getByRole('link', { name: 'Competitors' }),
			).toBeInTheDocument();
		});

		it('shows Upload CSV link when logged in as admin', () => {
			renderLayout(adminAuth);
			expect(
				screen.getByRole('link', { name: 'Upload CSV' }),
			).toBeInTheDocument();
		});

		it('shows Rankings link when logged in as admin', () => {
			renderLayout(adminAuth);
			expect(
				screen.getByRole('link', { name: 'Rankings' }),
			).toBeInTheDocument();
		});

		it('does not show Login link when logged in', () => {
			renderLayout(adminAuth);
			expect(
				screen.queryByRole('link', { name: 'Login' }),
			).not.toBeInTheDocument();
		});
	});

	describe('user info', () => {
		it('shows username when logged in', () => {
			renderLayout(adminAuth);
			expect(screen.getByText('Dana')).toBeInTheDocument();
		});

		it('shows role badge when logged in', () => {
			renderLayout(adminAuth);
			expect(screen.getByText('owner')).toBeInTheDocument();
		});

		it('shows Sign out button when logged in', () => {
			renderLayout(adminAuth);
			expect(
				screen.getByRole('button', { name: 'Sign out' }),
			).toBeInTheDocument();
		});

		it('calls logout when Sign out is clicked', async () => {
			const logout = vi.fn();
			renderLayout({ ...adminAuth, logout });
			screen.getByRole('button', { name: 'Sign out' }).click();
			expect(logout).toHaveBeenCalledOnce();
		});
	});
});
