import { useEffect, useState } from 'react';

const DURATION = 10000; // 10-second intro

const SLIDES = [
  { emoji: '🌊', title: 'When the streets flood…', sub: 'your map should know.' },
  { emoji: '🗺️', title: 'Real roads. Live risk.', sub: 'Every street scored for flood danger in real time.' },
  { emoji: '🛡️', title: 'Navigate Safer.', sub: 'FLUVORA picks the route that keeps you dry.' },
  { emoji: '🚑', title: 'Respond Faster.', sub: 'Hospitals, shelters and relief — one tap away.' },
];

export default function Intro({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const slideMs = DURATION / SLIDES.length;
    const slideTimer = setInterval(
      () => setSlide((s) => Math.min(s + 1, SLIDES.length - 1)),
      slideMs
    );
    const endTimer = setTimeout(() => finish(), DURATION);
    return () => {
      clearInterval(slideTimer);
      clearTimeout(endTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish() {
    setLeaving(true);
    setTimeout(onDone, 550);
  }

  return (
    <div className={`intro ${leaving ? 'intro-leaving' : ''}`}>
      <div className="intro-waves" aria-hidden="true">
        <div className="iw iw1" />
        <div className="iw iw2" />
        <div className="iw iw3" />
      </div>

      <div className="intro-core">
        <svg className="intro-logo" viewBox="0 0 40 40" aria-hidden="true">
          <defs>
            <linearGradient id="intro-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <path d="M3 15c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#intro-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" className="intro-path" />
          <path d="M3 24c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#intro-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" className="intro-path d2" />
          <path d="M3 33c4-5.5 8-5.5 12 0s8 5.5 12 0 8-5.5 10 0" stroke="url(#intro-g)" strokeWidth="3.6" fill="none" strokeLinecap="round" className="intro-path d3" />
        </svg>

        <h1 className="intro-title">FLUVORA</h1>
        <p className="intro-tag">Intelligent Flood-Aware Mobility</p>

        <div className="intro-slide" key={slide}>
          <span className="intro-slide-emoji">{SLIDES[slide].emoji}</span>
          <h2>{SLIDES[slide].title}</h2>
          <p>{SLIDES[slide].sub}</p>
        </div>
      </div>

      <div className="intro-foot">
        <div className="intro-progress">
          <div className="intro-progress-bar" style={{ animationDuration: `${DURATION}ms` }} />
        </div>
        <button className="intro-skip" onClick={finish}>
          Skip intro →
        </button>
      </div>
    </div>
  );
}
