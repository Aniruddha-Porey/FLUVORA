import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import Intro from './components/Intro.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import HomePage from './pages/HomePage.jsx';
import MapPage from './pages/MapPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { api } from './api.js';

export default function App() {
  const [view, setView] = useState('home'); // home | map | admin
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('fluvora_theme') || 'dark');
  const [showIntro, setShowIntro] = useState(() => !localStorage.getItem('fluvora_intro_seen'));
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('fluvora_user') || 'null');
    } catch {
      return null;
    }
  });
  const timer = useRef(null);
  const sinceRef = useRef(null);
  const isAdmin = user?.role === 'admin';

  // -------- boot loading animation (every open) --------
  const [minDone, setMinDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [booted, setBooted] = useState(false); // ready → start fade
  const [loaderGone, setLoaderGone] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => setMinDone(true), 1800); // min display time
    const b = setTimeout(() => setTimedOut(true), 6000); // safety: never hang
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const ready = minDone && (!!data || timedOut);

  useEffect(() => {
    if (!ready || booted) return;
    setBooted(true);
    const t = setTimeout(() => setLoaderGone(true), 650);
    return () => clearTimeout(t);
  }, [ready, booted]);

  // Apply theme to <html> so CSS + Leaflet can react.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('fluvora_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const finishIntro = useCallback(() => {
    localStorage.setItem('fluvora_intro_seen', '1');
    setShowIntro(false);
  }, []);

  const notify = useCallback((message, kind = 'ok') => {
    clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), 3400);
  }, []);

  const navigate = useCallback(
    (v) => {
      if (v === 'admin' && user?.role !== 'admin') {
        notify('🔒 Admin sign-in required — log out and sign in as Admin', 'err');
        return;
      }
      setView(v);
      window.scrollTo({ top: 0 });
    },
    [user, notify]
  );

  const handleLogin = useCallback(
    (u) => {
      localStorage.setItem('fluvora_user', JSON.stringify(u));
      setUser(u);
      setView('home');
      notify(u.role === 'admin' ? '🛡️ Welcome, Admin — Command Center unlocked' : `👋 Welcome, ${u.name}`);
    },
    [notify]
  );

  const handleLogout = useCallback(() => {
    localStorage.removeItem('fluvora_user');
    setUser(null);
    setView('home');
    notify('👋 Logged out');
  }, [notify]);

  // First load: full snapshot. Then poll the lightweight /api/live.
  const refresh = useCallback(async (full = false) => {
    try {
      if (full || !sinceRef.current) {
        const snap = await api.overview();
        setData(snap);
        sinceRef.current = snap.generatedAt;
      } else {
        const live = await api.live(sinceRef.current);
        sinceRef.current = live.serverTime;
        setData((prev) => mergeLive(prev, live));
      }
    } catch {
      /* keep last snapshot */
    }
  }, []);

  useEffect(() => {
    refresh(true);
    const id = setInterval(() => refresh(false), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const page = !data ? (
    <div className="loading">
      <div className="spinner" />
      <p>Connecting to FLUVORA network…</p>
    </div>
  ) : view === 'map' ? (
    <MapPage data={data} notify={notify} refresh={refresh} theme={theme} onHome={() => navigate('home')} />
  ) : view === 'admin' ? (
    <AdminPage data={data} notify={notify} refresh={refresh} theme={theme} onHome={() => navigate('home')} />
  ) : (
    <HomePage data={data} navigate={navigate} user={user} />
  );

  return (
    <div className="app">
      {!loaderGone && <LoadingScreen leaving={booted} />}
      {showIntro && <Intro onDone={finishIntro} />}
      {!user ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <Header
            view={view}
            setView={navigate}
            weather={data?.weather}
            theme={theme}
            toggleTheme={toggleTheme}
            user={user}
            onLogout={handleLogout}
          />
          <main className="main">{page}</main>
        </>
      )}
      {toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}
    </div>
  );
}

// Merge a compact /api/live update into the cached full snapshot.
function mergeLive(prev, live) {
  if (!prev) return prev;
  const roadIndex = new Map(prev.roads.map((r) => [r.id, r]));
  for (const u of live.roads) {
    const r = roadIndex.get(u.id);
    if (r) Object.assign(r, u);
  }
  return {
    ...prev,
    roads: [...prev.roads],
    reports: live.reports,
    weather: live.weather,
    stats: live.stats,
  };
}
