import { LEVEL_META } from '../constants.js';

const MENU = [
  {
    key: 'map',
    emoji: '🗺️',
    title: 'Live Flood Map',
    desc: 'See every road scored for flood risk and find the safer route to your destination.',
    cta: 'Open map',
    accent: 'cyan',
  },
  {
    key: 'map-report',
    emoji: '📢',
    title: 'Report Flooding',
    desc: 'Water on the road? Report water level and conditions in seconds — every report helps.',
    cta: 'Report now',
    accent: 'amber',
  },
  {
    key: 'map-emergency',
    emoji: '🚨',
    title: 'Emergency Mode',
    desc: 'One tap routes you to the nearest hospital, shelter, fire station or relief camp.',
    cta: 'Get help',
    accent: 'red',
  },
  {
    key: 'admin',
    emoji: '🖥️',
    title: 'Command Center',
    desc: 'Admin dashboard: verify reports, block roads, simulate floods and monitor the city.',
    cta: 'Admin only',
    accent: 'violet',
    adminOnly: true,
  },
];

const STEPS = [
  { emoji: '🌧️', title: 'Collect', text: 'Citizen reports, rainfall and water-level signals stream in from across the city.' },
  { emoji: '🧮', title: 'Analyze', text: 'The Flood Risk Engine scores every road: 45% reports · 25% water · 20% rain · 10% confirmations.' },
  { emoji: '🧭', title: 'Route', text: 'FLUVORA compares the shortest route against flood risk and recommends the safer corridor.' },
  { emoji: '🛡️', title: 'Respond', text: 'Emergency mode guides people to hospitals and shelters while avoiding blocked roads.' },
];

export default function HomePage({ data, navigate, user }) {
  const stats = data?.stats;
  const weather = data?.weather;
  const isAdmin = user?.role === 'admin';

  function openMenu(key) {
    if (key === 'admin') return navigate('admin'); // guarded: admins only
    navigate('map'); // MapPage reads the intent from sessionStorage
    sessionStorage.setItem('fluvora_intent', key === 'map-report' ? 'report' : key === 'map-emergency' ? 'emergency' : '');
  }

  return (
    <div className="home">
      {/* ---------------- Hero ---------------- */}
      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <p className="hero-kicker">🌊 Intelligent Flood-Aware Mobility</p>
        <h1 className="hero-title">
          Navigate <span className="grad">Safer</span>.<br />
          Respond <span className="grad">Faster</span>.
        </h1>
        <p className="hero-sub">
          FLUVORA layers live flood risk onto real city roads — so the fastest route is
          never the dangerous one. Built on OpenStreetMap data for Salt Lake, Kolkata.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => openMenu('map')}>
            🗺️ Open Live Map
          </button>
          <button className="btn btn-danger btn-lg" onClick={() => openMenu('map-emergency')}>
            🚨 Emergency Mode
          </button>
        </div>

        {stats && (
          <div className="hero-stats">
            <div className="hs">
              <b>{stats.totalRoads.toLocaleString('en-IN')}</b>
              <span>roads monitored</span>
            </div>
            <div className="hs">
              <b className="text-red">{stats.byLevel.high + stats.byLevel.blocked}</b>
              <span>critical / blocked</span>
            </div>
            <div className="hs">
              <b className="text-amber">{stats.totalReports}</b>
              <span>flood reports</span>
            </div>
            <div className="hs">
              <b className="text-cyan">{stats.centers}</b>
              <span>emergency centers</span>
            </div>
            <div className="hs">
              <b>{weather?.rainfallMmHr} mm/h</b>
              <span>rainfall · {weather?.condition}</span>
            </div>
          </div>
        )}
      </section>

      {/* ---------------- Menu grid ---------------- */}
      <section className="home-section">
        <h2 className="section-title">Explore FLUVORA</h2>
        <p className="section-sub">Choose where to begin</p>
        <div className="menu-grid">
          {MENU.map((m) => (
            <button
              key={m.key}
              className={`menu-card accent-${m.accent} ${m.adminOnly && !isAdmin ? 'locked' : ''}`}
              onClick={() => openMenu(m.key)}
            >
              <span className="mc-emoji">
                {m.adminOnly && !isAdmin ? '🔒' : m.emoji}
              </span>
              <span className="mc-title">{m.title}</span>
              <span className="mc-desc">{m.desc}</span>
              <span className="mc-cta">
                {m.adminOnly && !isAdmin ? 'Sign in as Admin →' : `${m.cta} →`}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="home-section">
        <h2 className="section-title">How it works</h2>
        <p className="section-sub">From a raindrop to a safer route</p>
        <div className="steps-grid">
          {STEPS.map((s, i) => (
            <div className="step-card" key={s.title}>
              <div className="step-num">{i + 1}</div>
              <span className="step-emoji">{s.emoji}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Risk legend ---------------- */}
      <section className="home-section">
        <h2 className="section-title">Road risk levels</h2>
        <div className="risk-strip">
          {Object.entries(LEVEL_META).map(([k, m]) => (
            <div className="risk-chip" key={k}>
              <span className="rc-dot" style={{ background: m.color }} />
              {m.emoji} {m.label}
            </div>
          ))}
        </div>
        <p className="section-sub" style={{ marginTop: 10 }}>
          Confidence bands: 0–25 🟢 · 26–50 🟡 · 51–75 🟠 · 76–100 🔴 — prototype rules, not official thresholds.
        </p>
      </section>

      <footer className="home-footer">
        <p>
          <b>FLUVORA</b> · Built for <b>HackDevengers 2.0</b> — Open Innovation Hackathon
        </p>
        <p className="muted">
          Disaster Management · Smart Mobility · Civic Technology · Hackathon Prototype (simulated flood data)
        </p>
      </footer>
    </div>
  );
}
