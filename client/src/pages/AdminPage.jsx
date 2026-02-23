import { useState, useEffect } from 'react';
import api from '../utils/api';
import { EVENTS, EVENT_LABELS } from '../constants/events';
import './AdminPage.css';

// ── Sub-components ──────────────────────────────────────────────────────────

function CompetitorManager() {
  const [competitors, setCompetitors] = useState([]);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const load = () => api.get('/rankings/competitors').then(r => setCompetitors(r.data));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/rankings/competitors', { name: newName });
      setNewName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add competitor');
    }
  };

  const save = async (id) => {
    setError('');
    try {
      await api.put(`/rankings/competitors/${id}`, { name: editName });
      setEditId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update');
    }
  };

  const remove = async (id, name) => {
    if (!confirm(`Delete "${name}" and all their results? This cannot be undone.`)) return;
    await api.delete(`/rankings/competitors/${id}`);
    load();
  };

  return (
    <div className="admin-section">
      <h2>Competitors</h2>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={add} className="inline-form">
        <input
          type="text"
          placeholder="Competitor name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          required
        />
        <button type="submit" className="btn-primary">Add</button>
      </form>
      <div className="list">
        {competitors.map(c => (
          <div className="list-row" key={c.id}>
            {editId === c.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} />
                <button className="btn-primary" onClick={() => save(c.id)}>Save</button>
                <button className="btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span className="list-name">{c.name}</span>
                <button className="btn-ghost" onClick={() => { setEditId(c.id); setEditName(c.name); }}>Rename</button>
                <button className="btn-danger" onClick={() => remove(c.id, c.name)}>Delete</button>
              </>
            )}
          </div>
        ))}
        {competitors.length === 0 && <p className="empty">No competitors yet.</p>}
      </div>
    </div>
  );
}

function ManualResultEntry() {
  const [competitors, setCompetitors] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState({
    competitor_id: '',
    tournament_id: '',
    knockdowns_earned: '',
    distance_earned: '',
    speed_earned: '',
    woods_earned: '',
  });
  const [activeTournamentEvents, setActiveTournamentEvents] = useState([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/rankings/competitors').then(r => setCompetitors(r.data));
    api.get('/rankings/tournaments').then(r => setTournaments(r.data));
  }, []);

  const selectTournament = (id) => {
    const t = tournaments.find(t => t.id === parseInt(id));
    if (t) {
      const active = EVENTS.filter(e => t[`has_${e}`]);
      setActiveTournamentEvents(active);
    } else {
      setActiveTournamentEvents([]);
    }
    setForm(f => ({ ...f, tournament_id: id }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setStatus('');
    const payload = {
      competitor_id: parseInt(form.competitor_id),
      tournament_id: parseInt(form.tournament_id),
    };
    for (const event of EVENTS) {
      payload[`${event}_earned`] = activeTournamentEvents.includes(event)
        ? (form[`${event}_earned`] !== '' ? parseFloat(form[`${event}_earned`]) : 0)
        : null;
    }
    try {
      await api.post('/rankings/results', payload);
      setStatus('Result saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  return (
    <div className="admin-section">
      <h2>Manual Result Entry</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}
      <form onSubmit={submit} className="manual-form">
        <div className="form-group">
          <label>Competitor</label>
          <select value={form.competitor_id} onChange={e => setForm(f => ({ ...f, competitor_id: e.target.value }))} required>
            <option value="">Select competitor…</option>
            {competitors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Tournament</label>
          <select value={form.tournament_id} onChange={e => selectTournament(e.target.value)} required>
            <option value="">Select tournament…</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name ? `${t.name} (${t.date})` : t.date}
              </option>
            ))}
          </select>
        </div>
        {activeTournamentEvents.length > 0 && (
          <div className="event-inputs">
            {activeTournamentEvents.map(event => (
              <div className="form-group" key={event}>
                <label>{EVENT_LABELS[event]} earned</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={form[`${event}_earned`]}
                  onChange={e => setForm(f => ({ ...f, [`${event}_earned`]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
        <button type="submit" className="btn-primary" disabled={!form.competitor_id || !form.tournament_id}>
          Save Result
        </button>
      </form>
    </div>
  );
}

function TournamentManager() {
  const [tournaments, setTournaments] = useState([]);
  const [form, setForm] = useState({
    name: '', date: '',
    has_knockdowns: true, has_distance: true, has_speed: true, has_woods: true,
    total_points_knockdowns: 120, total_points_distance: 120,
    total_points_speed: 120, total_points_woods: 120,
  });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = () => api.get('/rankings/tournaments').then(r => setTournaments(r.data));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      await api.post('/rankings/tournaments', form);
      setStatus('Tournament created.');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create tournament');
    }
  };

  const remove = async (id, label) => {
    if (!confirm(`Delete tournament "${label}" and ALL its results? This cannot be undone.`)) return;
    await api.delete(`/rankings/tournaments/${id}`);
    load();
  };

  return (
    <div className="admin-section">
      <h2>Tournaments</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}

      <form onSubmit={add} className="manual-form">
        <div className="form-row">
          <div className="form-group">
            <label>Name <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(optional)</span></label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Spring Regional 2025" />
          </div>
          <div className="form-group">
            <label>Date <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          </div>
        </div>
        <div className="events-mini">
          {EVENTS.map(event => (
            <label key={event} className="checkbox-label" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={form[`has_${event}`]}
                onChange={e => setForm(f => ({ ...f, [`has_${event}`]: e.target.checked }))}
                style={{ width: 'auto', marginRight: 6 }}
              />
              {EVENT_LABELS[event]}
              <input
                type="number"
                min="1"
                value={form[`total_points_${event}`]}
                onChange={e => setForm(f => ({ ...f, [`total_points_${event}`]: parseFloat(e.target.value) || 120 }))}
                disabled={!form[`has_${event}`]}
                style={{ width: 80, marginLeft: 8 }}
              />
              pts
            </label>
          ))}
        </div>
        <button type="submit" className="btn-primary">Create Tournament</button>
      </form>

      <div className="list" style={{ marginTop: 16 }}>
        {tournaments.map(t => {
          const label = t.name ? `${t.name} (${t.date})` : t.date;
          const eventList = EVENTS.filter(e => t[`has_${e}`]).map(e => EVENT_LABELS[e]).join(', ');
          return (
            <div className="list-row" key={t.id}>
              <div>
                <span className="list-name">{label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{eventList}</span>
              </div>
              <button className="btn-danger" onClick={() => remove(t.id, label)}>Delete</button>
            </div>
          );
        })}
        {tournaments.length === 0 && <p className="empty">No tournaments yet.</p>}
      </div>
    </div>
  );
}

function UserManager() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ username: '', password: '', role: 'user' });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const load = () => api.get('/auth/users').then(r => setUsers(r.data));
  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    setError(''); setStatus('');
    try {
      await api.post('/auth/users', form);
      setStatus(`User "${form.username}" created.`);
      setForm({ username: '', password: '', role: 'user' });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const remove = async (id, username) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    await api.delete(`/auth/users/${id}`);
    load();
  };

  return (
    <div className="admin-section">
      <h2>Users</h2>
      {error && <div className="alert alert-error">{error}</div>}
      {status && <div className="alert alert-success">{status}</div>}
      <form onSubmit={add} className="inline-form">
        <input placeholder="Username" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
        <input type="password" placeholder="Password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
        <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: 'auto' }}>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="btn-primary">Add</button>
      </form>
      <div className="list">
        {users.map(u => (
          <div className="list-row" key={u.id}>
            <span className="list-name">{u.username}</span>
            <span className={`badge badge-${u.role}`}>{u.role}</span>
            <button className="btn-danger" onClick={() => remove(u.id, u.username)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState('competitors');

  const tabs = [
    { id: 'competitors', label: 'Competitors' },
    { id: 'tournaments', label: 'Tournaments' },
    { id: 'results', label: 'Manual Entry' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <div className="admin-page">
      <h1>Admin</h1>
      <div className="tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="card">
        {tab === 'competitors' && <CompetitorManager />}
        {tab === 'tournaments' && <TournamentManager />}
        {tab === 'results' && <ManualResultEntry />}
        {tab === 'users' && <UserManager />}
      </div>
    </div>
  );
}
