import { useState, useRef } from 'react';
import api from '../utils/api';
import { EVENTS, EVENT_LABELS } from '../constants/events';
import './UploadPage.css';

const defaultSettings = () => ({
  activeEvents: EVENTS,
  totalPoints: { knockdowns: 120, distance: 120, speed: 120, woods: 120 },
  tournamentName: '',
  tournamentDate: '',
});

export default function UploadPage() {
  const [settings, setSettings] = useState(defaultSettings());
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState('configure'); // configure | preview | success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const fileRef = useRef();

  const toggleEvent = (event) => {
    setSettings(s => ({
      ...s,
      activeEvents: s.activeEvents.includes(event)
        ? s.activeEvents.filter(e => e !== event)
        : [...s.activeEvents, event],
    }));
  };

  const setTotalPoints = (event, val) => {
    setSettings(s => ({ ...s, totalPoints: { ...s.totalPoints, [event]: val } }));
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    setError('');
    const file = fileRef.current?.files[0];
    if (!file) { setError('Please select a CSV file'); return; }
    if (!settings.tournamentDate) { setError('Tournament date is required'); return; }
    if (settings.tournamentName && !settings.tournamentDate) {
      setError('A named tournament must also have a date'); return;
    }
    if (settings.activeEvents.length === 0) { setError('Select at least one event'); return; }

    const formData = new FormData();
    formData.append('csv', file);
    formData.append('tournament_name', settings.tournamentName);
    formData.append('tournament_date', settings.tournamentDate);
    settings.activeEvents.forEach(e => formData.append(`has_${e}`, 'true'));
    EVENTS.forEach(e => formData.append(`total_points_${e}`, settings.totalPoints[e]));

    setLoading(true);
    try {
      const { data } = await api.post('/upload/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(data);
      setStep('preview');
    } catch (err) {
      const d = err.response?.data;
      setError(d?.errors?.join(' • ') || 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/upload/commit', {
        tournament_name: settings.tournamentName || null,
        tournament_date: settings.tournamentDate,
        activeEvents: settings.activeEvents,
        totalPoints: settings.totalPoints,
        competitors: preview.competitors,
      });
      setSuccessInfo(data);
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.error || 'Commit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('configure');
    setSettings(defaultSettings());
    setPreview(null);
    setError('');
    setSuccessInfo(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  if (step === 'success') return (
    <div className="upload-page">
      <h1>Upload Complete</h1>
      <div className="alert alert-success">
        Tournament saved successfully.
        {successInfo?.new_competitors?.length > 0 && (
          <> {successInfo.new_competitors.length} new competitor(s) added.</>
        )}
        {successInfo?.updated_competitors?.length > 0 && (
          <> {successInfo.updated_competitors.length} competitor(s) updated.</>
        )}
      </div>
      <div className="button-row">
        <button className="btn-primary" onClick={handleReset}>Upload Another</button>
        <a href="/" className="btn-ghost" style={{ padding: '8px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>View Rankings</a>
      </div>
    </div>
  );

  return (
    <div className="upload-page">
      <h1>Upload Tournament Results</h1>

      {step === 'configure' && (
        <form onSubmit={handlePreview} className="upload-form">
          {error && <div className="alert alert-error">{error}</div>}

          <div className="card">
            <h2>Tournament Details</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Tournament Name <span className="optional">(recommended)</span></label>
                <input
                  type="text"
                  placeholder="e.g. Spring Regional 2025"
                  value={settings.tournamentName}
                  onChange={e => setSettings(s => ({ ...s, tournamentName: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Date <span className="required">*</span></label>
                <input
                  type="date"
                  value={settings.tournamentDate}
                  onChange={e => setSettings(s => ({ ...s, tournamentDate: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Events</h2>
            <p className="hint">Select which events were included in this tournament and set the total possible points for each.</p>
            <div className="events-grid">
              {EVENTS.map(event => (
                <div key={event} className={`event-row ${!settings.activeEvents.includes(event) ? 'inactive' : ''}`}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.activeEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      style={{ width: 'auto', marginRight: 8 }}
                    />
                    {EVENT_LABELS[event]}
                  </label>
                  <div className="form-group" style={{ margin: 0, flex: 1, maxWidth: 160 }}>
                    <input
                      type="number"
                      min="1"
                      value={settings.totalPoints[event]}
                      onChange={e => setTotalPoints(event, parseFloat(e.target.value) || 120)}
                      disabled={!settings.activeEvents.includes(event)}
                      placeholder="Total pts"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>CSV File</h2>
            <p className="hint">
              The parser is flexible — columns can be in any order and various spellings are recognized.
              Blank cells in active events will be treated as 0. Missing columns will be flagged.
            </p>
            <input type="file" accept=".csv,.tsv,.txt" ref={fileRef} style={{ marginTop: 8 }} />
          </div>

          <div className="button-row">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Parsing…' : 'Preview Import'}
            </button>
          </div>
        </form>
      )}

      {step === 'preview' && preview && (
        <div className="preview-section">
          {error && <div className="alert alert-error">{error}</div>}

          {preview.warnings?.length > 0 && (
            <div className="alert alert-warn">
              <strong>Warnings ({preview.warnings.length})</strong>
              <ul style={{ marginTop: 8, paddingLeft: 16 }}>
                {preview.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          <div className="card">
            <div className="preview-header">
              <div>
                <h2>Preview: {preview.competitors.length} competitors found</h2>
                <p className="hint">
                  {settings.tournamentName || settings.tournamentDate} •{' '}
                  {settings.activeEvents.map(e => EVENT_LABELS[e]).join(', ')}
                </p>
              </div>
              <button className="btn-ghost" onClick={() => setStep('configure')}>← Edit</button>
            </div>

            <div className="table-wrapper" style={{ marginTop: 16 }}>
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Name</th>
                    {settings.activeEvents.map(e => <th key={e}>{EVENT_LABELS[e]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.competitors.map((c, i) => (
                    <tr key={i}>
                      <td>
                        <span className={`badge ${c.is_new ? 'badge-new' : 'badge-update'}`}>
                          {c.is_new ? 'New' : 'Update'}
                        </span>
                      </td>
                      <td>{c.name}</td>
                      {settings.activeEvents.map(e => (
                        <td key={e}>{c[`${e}_earned`] ?? '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="button-row">
            <button className="btn-primary" onClick={handleCommit} disabled={loading}>
              {loading ? 'Saving…' : `Confirm & Save ${preview.competitors.length} Results`}
            </button>
            <button className="btn-ghost" onClick={handleReset}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
