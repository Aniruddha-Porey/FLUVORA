export default function LoadingScreen({ leaving }) {
  return (
    <div className={`loader ${leaving ? 'loader-leaving' : ''}`} aria-busy="true">
      <div className="loader-core">
        <div className="loader-ripple" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <svg className="loader-logo" viewBox="0 0 40 40" aria-hidden="true">
          <defs>
            <linearGradient id="loader-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path d="M3 15c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#loader-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" className="intro-path" />
          <path d="M3 24c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#loader-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" className="intro-path d2" />
          <path d="M3 33c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#loader-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" className="intro-path d3" />
        </svg>
      </div>

      <h1 className="loader-title">FLUVORA</h1>
      <p className="loader-tag">Intelligent Flood-Aware Mobility</p>

      <div className="loader-bar">
        <div className="loader-bar-slide" />
      </div>
      <p className="loader-status">Loading flood intelligence…</p>
    </div>
  );
}
