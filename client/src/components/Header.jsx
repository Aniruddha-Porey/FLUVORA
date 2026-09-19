function WaveLogo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="fluvora-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <path d="M3 15c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#fluvora-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" />
      <path d="M3 24c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#fluvora-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" opacity="0.75" />
      <path d="M3 33c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#fluvora-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

export default function Header({ view, setView, weather, theme, toggleTheme, user, onLogout }) {
  const isAdmin = user?.role === 'admin';
  return (
    <header className="header">
      <button className="brand brand-btn" onClick={() => setView('home')} title="Go to home page">
        <WaveLogo />
        <span className="brand-text">
          <span className="brand-name">FLUVORA</span>
          <span className="brand-tag">Navigate Safer. Respond Faster.</span>
        </span>
      </button>

      <nav className="tabs">
        <button
          className={view === 'home' ? 'tab active' : 'tab'}
          onClick={() => setView('home')}
          title="Home"
        >
          <span className="tab-ico">⌂</span>
          <span className="tab-lbl">Home</span>
        </button>
        <button
          className={view === 'map' ? 'tab active' : 'tab'}
          onClick={() => setView('map')}
          title="Live Map"
        >
          <span className="tab-ico">🗺️</span>
          <span className="tab-lbl">Live Map</span>
        </button>
        {isAdmin && (
          <button
            className={view === 'admin' ? 'tab active' : 'tab'}
            onClick={() => setView('admin')}
            title="Command Center (admin)"
          >
            <span className="tab-ico">🖥️</span>
            <span className="tab-lbl">Command Center</span>
          </button>
        )}
      </nav>

      <div className="header-right">
        {weather && (
          <div className="weather-chip" title="Current (simulated) rainfall intensity">
            🌧️ <b>{weather.rainfallMmHr}</b>&nbsp;mm/h
          </div>
        )}
        <button
          className="theme-btn"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
          <span className="theme-lbl">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        {user && (
          <div className="user-chip" title={isAdmin ? 'Administrator' : 'Normal user'}>
            <span className="user-ico">{isAdmin ? '🛡️' : '👤'}</span>
            <span className="user-name">{user.name}</span>
            <em className={isAdmin ? 'role-admin' : 'role-user'}>{isAdmin ? 'ADMIN' : 'USER'}</em>
            <button className="logout-btn" onClick={onLogout} title="Log out">
              🚪
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
