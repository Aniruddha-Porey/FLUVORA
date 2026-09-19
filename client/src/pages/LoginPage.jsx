import { useState } from 'react';

const DEMO_ADMIN = { username: 'admin', password: 'fluvora123' };

export default function LoginPage({ onLogin }) {
  const [role, setRole] = useState('user'); // 'user' | 'admin'
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    setError('');
    if (role === 'admin') {
      if (name.trim().toLowerCase() !== DEMO_ADMIN.username || password !== DEMO_ADMIN.password) {
        setError('Invalid admin credentials. Demo: admin / fluvora123');
        return;
      }
      onLogin({ role: 'admin', name: 'Administrator' });
    } else {
      onLogin({ role: 'user', name: name.trim() || 'Citizen' });
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-glow" aria-hidden="true" />
      <form className="login-card" onSubmit={submit}>
        <svg className="logo login-logo" viewBox="0 0 40 40" aria-hidden="true">
          <defs>
            <linearGradient id="login-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path d="M3 15c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#login-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" />
          <path d="M3 24c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#login-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" opacity="0.75" />
          <path d="M3 33c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#login-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" opacity="0.45" />
        </svg>
        <h1 className="login-title">FLUVORA</h1>
        <p className="login-tag">Navigate Safer. Respond Faster.</p>

        <p className="login-choose">Sign in to continue</p>
        <div className="role-grid">
          <button
            type="button"
            className={`role-card ${role === 'user' ? 'active' : ''}`}
            onClick={() => { setRole('user'); setError(''); }}
          >
            👤 Normal User
            <span>Report floods, find safe routes & emergency help</span>
          </button>
          <button
            type="button"
            className={`role-card ${role === 'admin' ? 'active' : ''}`}
            onClick={() => { setRole('admin'); setError(''); }}
          >
            🛡️ Admin
            <span>Command Center, verify reports, road control & simulation</span>
          </button>
        </div>

        {role === 'admin' ? (
          <>
            <label className="field">
              <span>Username</span>
              <input
                type="text"
                value={name}
                autoComplete="username"
                onChange={(e) => setName(e.target.value)}
                placeholder="admin"
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          </>
        ) : (
          <label className="field">
            <span>Your name (optional)</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riya"
            />
          </label>
        )}

        {error && <p className="login-err">⚠️ {error}</p>}

        <button type="submit" className="btn btn-primary wide btn-lg">
          {role === 'admin' ? '🔐 Sign in as Admin' : '➡️ Continue as Citizen'}
        </button>

        <p className="hint center" style={{ marginTop: 12 }}>
          Demo admin credentials: <b>admin</b> / <b>fluvora123</b>
          <br />
          Normal users cannot open the Command Center.
        </p>
        <p className="hint center muted" style={{ marginTop: 8 }}>
          HackDevengers 2.0 · Disaster Management / Smart Mobility
        </p>
      </form>
    </div>
  );
}
