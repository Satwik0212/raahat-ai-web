import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { requestApi, EmergencyResponse, GeoPoint } from '../api/client';

// ─── Motion helpers ────────────────────────────────────────────────────────────
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Count-up a number from 0 to target over ~350 ms */
function useCountUp(target: number, trigger: boolean): number {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    if (prefersReducedMotion()) { setVal(target); return; }
    let start: number | null = null;
    const dur = 350;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const prog = Math.min((ts - start) / dur, 1);
      setVal(Math.round(prog * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [trigger, target]);
  return val;
}

/** Digit-scramble that settles on the real coord string */
function useScrambledCoord(real: string, trigger: boolean): string {
  const [display, setDisplay] = useState('');
  useEffect(() => {
    if (!trigger || !real) return;
    if (prefersReducedMotion()) { setDisplay(real); return; }
    const chars = '0123456789';
    let frame = 0;
    const totalFrames = 18; // ~300ms @ 60fps
    const interval = setInterval(() => {
      frame++;
      if (frame >= totalFrames) { setDisplay(real); clearInterval(interval); return; }
      const scrambled = real.split('').map((ch) =>
        /\d/.test(ch) && frame < totalFrames * 0.7
          ? chars[Math.floor(Math.random() * 10)]
          : ch
      ).join('');
      setDisplay(scrambled);
    }, 16);
    return () => clearInterval(interval);
  }, [trigger, real]);
  return display || real;
}

// ─── Typewriter hook ───────────────────────────────────────────────────────────
function useTypewriter(text: string, trigger: boolean, speed = 28): string {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!trigger) return;
    if (prefersReducedMotion()) { setDisplayed(text); return; }
    let i = 0;
    setDisplayed('');
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(iv);
    }, speed);
    return () => clearInterval(iv);
  }, [trigger, text, speed]);
  return displayed;
}

// ─── Shared single IntersectionObserver ────────────────────────────────────────
type RevealEntry = { el: Element; onVisible: () => void; triggered: boolean };
const revealRegistry: RevealEntry[] = [];
let sharedObserver: IntersectionObserver | null = null;

function getSharedObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const rec = revealRegistry.find((r) => r.el === entry.target);
          if (rec && !rec.triggered) {
            rec.triggered = true;
            rec.onVisible();
            sharedObserver?.unobserve(entry.target); // one-way reveal
          }
        });
      },
      { threshold: 0.15, rootMargin: '-10% 0px -10% 0px' }
    );
  }
  return sharedObserver;
}

function useReveal(): [React.RefObject<any>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) { setVisible(true); return; }
    const obs = getSharedObserver();
    const entry: RevealEntry = { el, onVisible: () => setVisible(true), triggered: false };
    revealRegistry.push(entry);
    obs.observe(el);
    return () => {
      obs.unobserve(el);
      const idx = revealRegistry.indexOf(entry);
      if (idx !== -1) revealRegistry.splice(idx, 1);
    };
  }, []);

  return [ref, visible];
}

// ─── Animated distance counter ─────────────────────────────────────────────────
const AnimatedDistance: React.FC<{ km: number; trigger: boolean }> = ({ km, trigger }) => {
  const val = useCountUp(km * 10, trigger);
  return <>{(val / 10).toFixed(1)}</>;
};

// ─── Main component ────────────────────────────────────────────────────────────
export const Landing: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Location
  const [location, setLocation] = useState<GeoPoint>({ latitude: 22.7196, longitude: 75.8577 });
  const [locLabel, setLocLabel] = useState('22.7196, 75.8577 (DEMO AREA - INDORE)');
  const [coordStr, setCoordStr] = useState('22.7196, 75.8577');

  // Live Console
  const [queryInput, setQueryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<EmergencyResponse | null>(null);
  const [errorInfo, setErrorInfo] = useState<{ code: string; message: string } | null>(null);
  const [lastQuery, setLastQuery] = useState('');

  // Results 4-beat sequencing
  const [showBadge, setShowBadge] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [cardsTriggered, setCardsTriggered] = useState(false);
  const [shakeError, setShakeError] = useState(false);

  // Video
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoSectionRef = useRef<HTMLElement | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [coordScrambleTrigger, setCoordScrambleTrigger] = useState(false);
  const scrambledCoord = useScrambledCoord(coordStr, coordScrambleTrigger);

  // Nav scroll solidify
  const navRef = useRef<HTMLElement | null>(null);
  const [navSolid, setNavSolid] = useState(false);
  const rafRef = useRef<number>(0);

  // Hero line reveal (load-triggered)
  const [heroLine1, setHeroLine1] = useState(false);
  const [heroLine2, setHeroLine2] = useState(false);
  const [heroSub, setHeroSub] = useState(false);
  const [heroCta, setHeroCta] = useState(false);
  const [navReady, setNavReady] = useState(false);

  // Section reveal refs
  const [videoTitleRef, videoTitleVisible] = useReveal();
  const typewriterText = useTypewriter('01 // RAAHAT IN ACTION', videoTitleVisible);
  const [videoBadgeRef, videoBadgeVisible] = useReveal();
  const [problemRef, problemVisible] = useReveal();
  const [problemCardsRef, problemCardsVisible] = useReveal();
  const [demoRef, demoVisible] = useReveal();
  const [chipsRef, chipsVisible] = useReveal();
  const [capsRef, capsVisible] = useReveal();
  const [footerRef, footerVisible] = useReveal();

  // GPS
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(4);
          const lng = pos.coords.longitude.toFixed(4);
          setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy_meters: pos.coords.accuracy });
          setLocLabel(`${lat}, ${lng} (LIVE GPS)`);
          setCoordStr(`${lat}, ${lng}`);
        },
        () => {
          setLocLabel('22.7196, 75.8577 (DEMO AREA - INDORE)');
          setCoordStr('22.7196, 75.8577');
        },
        { timeout: 8000 }
      );
    }
  }, []);

  // Nav scroll listener
  useEffect(() => {
    const handle = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setNavSolid(window.scrollY > 40);
      });
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => { window.removeEventListener('scroll', handle); cancelAnimationFrame(rafRef.current); };
  }, []);

  // Hero load-triggered sequence
  useEffect(() => {
    if (prefersReducedMotion()) {
      setNavReady(true); setHeroLine1(true); setHeroLine2(true); setHeroSub(true); setHeroCta(true);
      return;
    }
    const t0 = setTimeout(() => setNavReady(true), 50);
    const t1 = setTimeout(() => setHeroLine1(true), 200);
    const t2 = setTimeout(() => setHeroLine2(true), 320);
    const t3 = setTimeout(() => setHeroSub(true), 700);
    const t4 = setTimeout(() => setHeroCta(true), 840);
    return () => [t0, t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  // Video IntersectionObserver (separate — needs play/pause side-effects)
  useEffect(() => {
    const el = videoSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          setIsVideoVisible(true);
          setCoordScrambleTrigger(true);
          videoRef.current?.play().catch(() => {});
        } else {
          setIsVideoVisible(false);
          videoRef.current?.pause();
        }
      });
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [videoError]);

  const handleOpenApp = () => navigate(user ? '/app' : '/login');

  const executeEmergencySearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setErrorInfo(null);
    setLastQuery(q);
    setResponse(null);
    setShowBadge(false); setShowSteps(false); setShowCards(false); setCardsTriggered(false);
    try {
      const data = await requestApi<EmergencyResponse>('/emergency-assistance', 'POST', {
        user_query: q.trim(),
        location,
      });
      setResponse(data);
      // 4-beat sequence (visual only, single API call already done)
      if (!prefersReducedMotion()) {
        setTimeout(() => setShowBadge(true), 60);
        setTimeout(() => setShowSteps(true), 280);
        setTimeout(() => { setShowCards(true); setTimeout(() => setCardsTriggered(true), 200); }, 560);
      } else {
        setShowBadge(true); setShowSteps(true); setShowCards(true); setCardsTriggered(true);
      }
    } catch (err: any) {
      setErrorInfo({ code: err.code || 'ERR_SERVICE_FAIL', message: err.message || 'Unable to reach RAAHAT backend. Check connection and try again.' });
      setShakeError(true);
      setTimeout(() => setShakeError(false), 400);
    } finally {
      setLoading(false);
    }
  }, [location]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); executeEmergencySearch(queryInput); };
  const handleChip = (t: string) => { setQueryInput(t); executeEmergencySearch(t); };

  // ─── Reveal style helpers ──────────────────────────────────────────────────
  const rm = prefersReducedMotion();

  const revealStyle = (visible: boolean, delay = 0, fromX = 0): React.CSSProperties => rm
    ? { opacity: visible ? 1 : 0, transition: `opacity 200ms ease` }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) translateX(0)' : `translateY(28px) translateX(${fromX}px)`,
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      };

  const popStyle = (visible: boolean, delay = 0): React.CSSProperties => rm
    ? { opacity: visible ? 1 : 0, transition: `opacity 200ms ease` }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.92)',
        transition: `opacity 400ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms, transform 400ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
      };

  const heroLineStyle = (visible: boolean, delay = 0): React.CSSProperties => rm
    ? { opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }
    : {
        opacity: visible ? 1 : 0,
        clipPath: visible ? 'inset(0 0 0 0)' : 'inset(100% 0 0 0)',
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 900ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, clip-path 900ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 900ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
        display: 'block',
      };

  const navItemStyle = (visible: boolean, delay = 0): React.CSSProperties => rm
    ? { opacity: visible ? 1 : 0, transition: 'opacity 200ms ease' }
    : {
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: `opacity 200ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms, transform 200ms cubic-bezier(0.34,1.56,0.64,1) ${delay}ms`,
      };

  const STAGGER = 70;

  // ─── Hover / press handlers ────────────────────────────────────────────────
  const ctaHover = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, entering: boolean) => {
    if (rm) return;
    (e.currentTarget as HTMLElement).style.transform = entering ? 'scale(1.03)' : 'scale(1)';
  };
  const ctaPress = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, down: boolean) => {
    if (rm) return;
    (e.currentTarget as HTMLElement).style.transform = down ? 'scale(0.97)' : 'scale(1)';
  };

  const capHover = (e: React.MouseEvent<HTMLDivElement>, entering: boolean) => {
    if (rm) return;
    (e.currentTarget as HTMLDivElement).style.transform = entering ? 'translateY(-4px)' : 'translateY(0)';
    (e.currentTarget as HTMLDivElement).style.boxShadow = entering
      ? '0 8px 24px rgba(15,23,42,0.12)' : '';
  };

  const problemHover = (e: React.MouseEvent<HTMLDivElement>, entering: boolean, color: string) => {
    if (rm) return;
    (e.currentTarget as HTMLDivElement).style.backgroundColor = entering ? `${color}08` : '#FFFFFF';
  };

  return (
    <>
      {/* ── Motion tokens + keyframes injected once ── */}
      <style>{`
        :root {
          --dur-instant: 120ms;
          --dur-fast: 200ms;
          --dur-base: 400ms;
          --dur-slow: 700ms;
          --dur-hero: 900ms;
          --ease-standard: cubic-bezier(0.4,0,0.2,1);
          --ease-out-soft: cubic-bezier(0.16,1,0.3,1);
          --ease-pop: cubic-bezier(0.34,1.56,0.64,1);
          --ease-in-out: cubic-bezier(0.65,0,0.35,1);
        }
        @keyframes statusPulse {
          0%,100% { opacity:1; } 50% { opacity:0.45; }
        }
        @keyframes errShake {
          0%,100% { transform:translateX(0); }
          20% { transform:translateX(-4px); }
          40% { transform:translateX(4px); }
          60% { transform:translateX(-3px); }
          80% { transform:translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 1ms !important;
            transition-duration: 1ms !important;
            clip-path: none !important;
          }
        }
      `}</style>

      <div style={{ backgroundColor: 'transparent', color: '#14171C', fontFamily: 'Inter, sans-serif', minHeight: '100vh' }}>

        {/* ── NAV ── */}
        <nav
          ref={navRef}
          style={{
            position: 'sticky', top: 0, zIndex: 100,
            backgroundColor: navSolid ? 'rgba(251,250,247,0.97)' : 'rgba(251,250,247,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: navSolid ? '1px solid #CBD5E1' : '1px solid transparent',
            padding: '0 24px', height: '64px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: `background-color 400ms var(--ease-standard), border-color 400ms var(--ease-standard)`,
          }}
        >
          {/* Logo — pops in first */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            fontWeight: 700, fontSize: '20px', fontFamily: "'Barlow Condensed', sans-serif",
            ...navItemStyle(navReady, 0),
          }}>
            <img src="/image/logo.png" alt="RAAHAT Logo" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} /> RAAHAT
          </div>

          {/* Nav links — stagger */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {[
              { href: '#video-demo', label: 'Overview' },
              { href: '#problem', label: 'Problem' },
              { href: '#demo', label: 'Live Demo' },
              { href: '#features', label: 'Capabilities' },
            ].map(({ href, label }, i) => (
              <a key={href} href={href} style={{
                color: '#475569', textDecoration: 'none', fontSize: '14px', fontWeight: 500,
                ...navItemStyle(navReady, 60 + i * 20),
              }}>{label}</a>
            ))}

            {/* Single auth action in nav */}
            <span style={navItemStyle(navReady, 140)}>
              {user ? (
                <button
                  onClick={() => navigate('/app')}
                  style={{
                    backgroundColor: '#1F4FD8', color: '#FFF', border: 'none',
                    padding: '8px 16px', borderRadius: '6px', fontWeight: 600, fontSize: '14px',
                    cursor: 'pointer', transition: 'transform var(--dur-fast) var(--ease-pop)',
                  }}
                >Go to Dashboard →</button>
              ) : (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Link to="/login" style={{ color: '#1F4FD8', textDecoration: 'none', padding: '8px 14px', fontWeight: 600, fontSize: '14px' }}>
                    Sign In
                  </Link>
                  <button
                    onClick={handleOpenApp}
                    style={{
                      backgroundColor: '#1F4FD8', color: '#FFF', border: 'none',
                      padding: '8px 16px', borderRadius: '6px', fontWeight: 600, fontSize: '14px',
                      cursor: 'pointer', transition: `transform var(--dur-fast) var(--ease-pop)`,
                    }}
                    onMouseEnter={(e) => ctaHover(e, true)}
                    onMouseLeave={(e) => ctaHover(e, false)}
                    onMouseDown={(e) => ctaPress(e, true)}
                    onMouseUp={(e) => ctaPress(e, false)}
                  >Open App →</button>
                </div>
              )}
            </span>
          </div>
        </nav>

        {/* ── HERO ── */}
        <header style={{ padding: '80px 24px 60px', maxWidth: '1200px', margin: '0 auto', position: 'relative' }}>

          <div style={{
            display: 'inline-block',
            backgroundColor: '#F1F5F9', color: '#475569',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '12px', fontWeight: 600,
            padding: '4px 10px', borderRadius: '4px',
            marginBottom: '20px', letterSpacing: '0.05em',
            ...revealStyle(heroLine1),
          }}>
            SquidHack 2026 · Problem SW-17
          </div>

          {/* Headline — line by line clip-path reveal */}
          <h1 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 'clamp(42px, 6vw, 76px)',
            fontWeight: 700, lineHeight: 1.05,
            color: '#14171C', marginBottom: '24px',
            letterSpacing: '-0.02em', overflow: 'hidden',
          }}>
            <span style={heroLineStyle(heroLine1, 0)}>
              Google Maps tells you what's nearby.
            </span>
            <span style={heroLineStyle(heroLine2, 120)}>
              <span style={{ color: '#1F4FD8' }}>RAAHAT tells you what to do next.</span>
            </span>
          </h1>

          <p style={{
            fontSize: '19px', color: '#475569',
            maxWidth: '680px', lineHeight: 1.6, marginBottom: '32px',
            ...revealStyle(heroSub, 0),
          }}>
            RAAHAT understands what happened on the road, decides what help you need, and guides you step-by-step — online and offline.
          </p>

          {/* CTAs — primary only, secondary demoted */}
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center', ...revealStyle(heroCta, 0) }}>
            <a
              href="#demo"
              style={{
                backgroundColor: '#E8432E', color: '#FFFFFF',
                textDecoration: 'none', padding: '14px 28px',
                borderRadius: '6px', fontWeight: 700, fontSize: '16px',
                display: 'inline-block',
                transition: `transform var(--dur-fast) var(--ease-pop), box-shadow var(--dur-fast) var(--ease-standard)`,
              }}
              onMouseEnter={(e) => ctaHover(e, true)}
              onMouseLeave={(e) => ctaHover(e, false)}
              onMouseDown={(e) => ctaPress(e, true)}
              onMouseUp={(e) => ctaPress(e, false)}
            >
              Try Live Demo ↓
            </a>
            {/* Demoted secondary CTA */}
            <button
              onClick={() => navigate('/signup')}
              style={{
                background: 'none', color: '#475569',
                border: 'none', padding: '0', fontSize: '14px',
                fontWeight: 500, cursor: 'pointer', textDecoration: 'underline',
                textUnderlineOffset: '3px',
              }}
            >
              or get started free →
            </button>
          </div>
        </header>

        {/* ── VIDEO SECTION ── */}
        <section
          id="video-demo"
          ref={videoSectionRef}
          style={{ padding: '40px 24px 80px', maxWidth: '1200px', margin: '0 auto' }}
        >
          {/* Eyebrow — typewriter */}
          <div
            ref={videoTitleRef}
            style={{ textAlign: 'center', marginBottom: '24px' }}
          >
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#1F4FD8', fontSize: '13px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px',
              minHeight: '1.4em',
            }}>
              {videoTitleVisible ? typewriterText : '\u00a0'}
            </div>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(32px, 4vw, 52px)',
              fontWeight: 700, margin: '0 0 10px', color: '#14171C',
              ...revealStyle(videoTitleVisible, 500),
            }}>
              Watch how RAAHAT turns crisis into clarity.
            </h2>
          </div>

          {/* Video wrapper — pop-in */}
          <div
            ref={videoBadgeRef}
            style={{
              position: 'relative', borderRadius: '20px', overflow: 'hidden',
              backgroundColor: '#0F172A',
              boxShadow: '0 25px 50px -12px rgba(15,23,42,0.22), 0 4px 20px rgba(0,0,0,0.08)',
              border: '1.5px solid #CBD5E1',
              maxWidth: '1200px', margin: '0 auto',
              ...popStyle(videoBadgeVisible, 0),
            }}
          >
            {!videoError ? (
              <>
                <video
                  ref={videoRef}
                  src="/video/raahat-ad.mp4"
                  autoPlay muted={isMuted} loop playsInline
                  preload="metadata"
                  onError={() => { console.warn('[RAAHAT] Video not found at /video/raahat-ad.mp4'); setVideoError(true); }}
                  style={{ width: '100%', maxHeight: '82vh', objectFit: 'cover', display: 'block' }}
                />
                <button
                  onClick={() => {
                    setIsMuted(!isMuted);
                    if (videoRef.current) videoRef.current.muted = !isMuted;
                  }}
                  aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                  style={{
                    position: 'absolute', bottom: '16px', right: '16px',
                    width: '40px', height: '40px', borderRadius: '50%',
                    backgroundColor: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.2)',
                    color: '#FFFFFF', fontSize: '18px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(8px)',
                    transition: 'background-color 200ms ease',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(15,23,42,0.9)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(15,23,42,0.7)'; }}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
              </>
            ) : (
              <div style={{ padding: '60px 24px', textAlign: 'center', backgroundColor: '#F8FAFC', color: '#64748B' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎬</div>
                <div style={{ fontWeight: 600, fontSize: '18px', color: '#1E293B', marginBottom: '8px' }}>
                  Video unavailable — try the live demo below
                </div>
              </div>
            )}
          </div>

          {/* Caption + coord scramble */}
          <p style={{
            textAlign: 'center', fontSize: '14px', color: '#64748B',
            marginTop: '16px', fontFamily: "'IBM Plex Mono', monospace",
            ...revealStyle(videoBadgeVisible, 180),
          }}>
            COORDS: <b>{scrambledCoord}</b> &nbsp;·&nbsp; Watch how RAAHAT guides drivers on Indian highways in real-time.
          </p>
        </section>

        {/* ── STATUS BAR ── */}
        <div style={{ backgroundColor: '#232629', color: '#F4F2EC', padding: '14px 24px', borderTop: '1px solid #3A4047', borderBottom: '1px solid #3A4047' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace" }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                height: '8px', width: '8px', borderRadius: '50%',
                backgroundColor: '#22C55E', display: 'inline-block',
                animation: rm ? 'none' : 'statusPulse 2.4s ease-in-out infinite',
              }} />
              <span>SYSTEM STATUS: <b>OPERATIONAL (100% NO-CARD FREE STACK)</b></span>
            </div>
            <div>COORDS: <b>{locLabel}</b></div>
          </div>
        </div>

        {/* ── PROBLEM SECTION ── */}
        <section id="problem" style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
          <div
            ref={problemRef}
            style={{ marginBottom: '40px' }}
          >
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", color: '#E8432E',
              fontSize: '13px', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: '12px',
              ...revealStyle(problemVisible, 0),
            }}>
              02 // THE REAL PROBLEM
            </div>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(36px, 4vw, 48px)',
              fontWeight: 700, margin: '0 0 20px', color: '#14171C',
              ...revealStyle(problemVisible, 80),
            }}>
              Not "where's the mechanic" — but "I don't know what to do."
            </h2>
            <p style={{
              fontSize: '17px', color: '#64748B', maxWidth: '720px', lineHeight: 1.6,
              ...revealStyle(problemVisible, 160),
            }}>
              Maps find pins. They cannot triage emergency severity, give first-aid SOPs, or maintain resilience when connectivity drops on Indian highways.
            </p>
          </div>

          {/* 6 scenario cards — diagonal stagger */}
          <div
            ref={problemCardsRef}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}
          >
            {[
              { title: 'Road Accident + Injury', desc: 'Needs immediate medical triage, ambulance, and police — fast.', sev: 'CRITICAL', color: '#E8432E' },
              { title: 'Vehicle Breakdown', desc: 'Engine dead on flyover or highway corridor. Which mechanic is active?', sev: 'MEDIUM', color: '#F59E0B' },
              { title: 'Tyre Puncture', desc: 'High-speed traffic, no shoulder. Safety steps matter more than a pin.', sev: 'MEDIUM', color: '#F59E0B' },
              { title: 'Fuel Emergency', desc: 'Tank dry kilometres from next pump. Nearest verified petrol pump ranked.', sev: 'MEDIUM', color: '#F59E0B' },
              { title: 'Stranded at Night', desc: 'Unfamiliar area, rising fear. Trusted help and calm next action.', sev: 'HIGH', color: '#D97706' },
              { title: 'No Connectivity', desc: 'Zero signal on expressway. Guidance must survive offline on-device.', sev: 'RESILIENCE', color: '#10B981' },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  transition: `background-color var(--dur-fast) var(--ease-standard)`,
                  ...revealStyle(problemCardsVisible, Math.min(idx, 5) * STAGGER, -16),
                }}
                onMouseEnter={(e) => problemHover(e, true, item.color)}
                onMouseLeave={(e) => problemHover(e, false, item.color)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>
                    0{idx + 1}
                  </span>
                  {/* Severity badge — pop, delayed after card */}
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: item.color,
                    backgroundColor: `${item.color}15`,
                    padding: '2px 8px', borderRadius: '4px',
                    fontFamily: "'IBM Plex Mono', monospace",
                    ...popStyle(problemCardsVisible, Math.min(idx, 5) * STAGGER + 100),
                  }}>{item.sev}</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px', color: '#14171C' }}>{item.title}</h3>
                <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── LIVE DEMO CONSOLE ── */}
        <section id="demo" style={{ backgroundColor: '#232629', color: '#F4F2EC', padding: '80px 24px' }}>
          <div
            ref={demoRef}
            style={{
              maxWidth: '1200px', margin: '0 auto',
              ...popStyle(demoVisible, 0),
            }}
          >
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#D9A61C', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
              04 // LIVE DEMO CONSOLE — /api/v1/emergency-assistance
            </div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 'clamp(38px, 4vw, 52px)', fontWeight: 700, margin: '0 0 16px', color: '#F4F2EC' }}>
              See it work — right now.
            </h2>
            <p style={{ fontSize: '17px', color: '#9AA0A8', maxWidth: '640px', marginBottom: '32px', lineHeight: 1.6 }}>
              Describe what happened. RAAHAT classifies the incident, assesses severity, retrieves real verified services, and outputs step-by-step guidance.
            </p>

            <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="DESCRIBE WHAT HAPPENED (e.g. tyre puncture on highway, accident hua hai)..."
                  disabled={loading}
                  style={{
                    flex: 1, minWidth: '280px',
                    backgroundColor: '#14171C', border: '1px solid #3A4047',
                    color: '#F4F2EC', padding: '16px 20px', borderRadius: '6px',
                    fontSize: '16px', fontFamily: "'IBM Plex Mono', monospace", outline: 'none',
                    opacity: loading ? 0.7 : 1,
                    transition: `opacity var(--dur-base) var(--ease-standard)`,
                  }}
                />
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    backgroundColor: '#E8432E', color: '#FFFFFF', border: 'none',
                    padding: '16px 28px', borderRadius: '6px',
                    fontWeight: 700, fontSize: '15px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.7 : 1,
                    transition: `transform var(--dur-instant) var(--ease-pop), opacity var(--dur-fast) var(--ease-standard)`,
                  }}
                  onMouseEnter={(e) => !loading && ctaHover(e, true)}
                  onMouseLeave={(e) => ctaHover(e, false)}
                  onMouseDown={(e) => !loading && ctaPress(e, true)}
                  onMouseUp={(e) => ctaPress(e, false)}
                >
                  {loading ? 'ANALYZING...' : 'GET HELP →'}
                </button>
              </div>
            </form>

            {/* Chips — stagger pop */}
            <div
              ref={chipsRef}
              style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '32px' }}
            >
              <span style={{ fontSize: '13px', color: '#9AA0A8', alignSelf: 'center', fontFamily: "'IBM Plex Mono', monospace" }}>Presets:</span>
              {[
                'tyre puncture on highway',
                'accident hua hai, khoon nikal raha hai',
                'my car broke down',
                'I am out of fuel',
              ].map((chipText, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleChip(chipText)}
                  disabled={loading}
                  style={{
                    backgroundColor: '#2C3137', color: '#D9A61C',
                    border: '1px solid #3A4047', padding: '8px 14px',
                    borderRadius: '4px', fontSize: '13px', cursor: 'pointer',
                    fontFamily: "'IBM Plex Mono', monospace",
                    ...popStyle(chipsVisible, i * 50),
                  }}
                >+ {chipText}</button>
              ))}
            </div>

            {/* Error — shake animation */}
            {errorInfo && (
              <div style={{
                backgroundColor: '#451A1A', border: '1px solid #E8432E',
                borderRadius: '8px', padding: '20px', color: '#F87171',
                animation: shakeError && !rm ? 'errShake 240ms var(--ease-in-out)' : 'none',
              }}>
                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px' }}>[{errorInfo.code}] Request Failed</div>
                <div style={{ fontSize: '14px', marginBottom: '16px' }}>{errorInfo.message}</div>
                <button
                  onClick={() => executeEmergencySearch(lastQuery)}
                  style={{
                    backgroundColor: '#E8432E', color: '#FFF', border: 'none',
                    padding: '8px 16px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer',
                    transition: `transform var(--dur-instant) var(--ease-pop)`,
                  }}
                  onMouseEnter={(e) => ctaHover(e, true)}
                  onMouseLeave={(e) => ctaHover(e, false)}
                >Retry Request ↻</button>
              </div>
            )}

            {/* Results — 4-beat choreography */}
            {response && (
              <div style={{ backgroundColor: '#14171C', border: '1px solid #3A4047', borderRadius: '8px', padding: '28px' }}>

                {/* Beat 1 — Incident badge */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: '20px', borderBottom: '1px solid #2C3137', paddingBottom: '14px',
                  ...popStyle(showBadge, 0),
                }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#9AA0A8', fontFamily: "'IBM Plex Mono', monospace" }}>INCIDENT TRIAGE</span>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#F4F2EC', fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {response.incident.category} ({response.incident.severity} SEVERITY)
                    </div>
                  </div>
                  <div style={{
                    backgroundColor: response.incident.is_life_threatening ? '#E8432E' : '#1F4FD8',
                    color: '#FFF', padding: '6px 14px', borderRadius: '4px',
                    fontWeight: 700, fontSize: '13px', fontFamily: "'IBM Plex Mono', monospace",
                    ...popStyle(showBadge, 80),
                  }}>
                    CONFIDENCE: {Math.round((response.ai?.confidence_score || 0.95) * 100)}%
                  </div>
                </div>

                {/* Beat 2 — Guidance steps */}
                <div style={{ marginBottom: '24px' }}>
                  <h4 style={{
                    color: '#D9A61C', margin: '0 0 12px', fontSize: '15px',
                    fontFamily: "'IBM Plex Mono', monospace",
                    ...revealStyle(showSteps, 0),
                  }}>SOP GUIDANCE STEPS:</h4>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {response.guidance.steps.map((step, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#232629', padding: '12px 16px', borderRadius: '6px',
                          borderLeft: step.is_critical ? '4px solid #E8432E' : '4px solid #1F4FD8',
                          ...revealStyle(showSteps, idx * 40),
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#F4F2EC', fontSize: '14px' }}>Step {step.step_number}: {step.title}</div>
                        <div style={{ color: '#9AA0A8', fontSize: '13px', marginTop: '4px' }}>{step.instruction}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Beat 3+4 — Service cards */}
                <div>
                  <h4 style={{
                    color: '#D9A61C', margin: '0 0 12px', fontSize: '15px',
                    fontFamily: "'IBM Plex Mono', monospace",
                    ...revealStyle(showCards, 0),
                  }}>
                    RECOMMENDED LIVE SERVICES ({response.services.length}):
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                    {response.services.map((svc, idx) => (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#232629', padding: '16px', borderRadius: '6px',
                          border: '1px solid #3A4047',
                          ...popStyle(showCards, idx * 90),
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          {/* LIVE badge — micro-pop after card body */}
                          <span style={{
                            backgroundColor: '#166534', color: '#4ADE80',
                            fontSize: '11px', fontWeight: 700,
                            padding: '2px 8px', borderRadius: '4px',
                            fontFamily: "'IBM Plex Mono', monospace",
                            ...popStyle(cardsTriggered, idx * 90 + 80),
                          }}>
                            LIVE · {svc.source}
                          </span>
                          <span style={{ fontSize: '13px', color: '#F4F2EC', fontWeight: 600 }}>
                            {/* Beat 4 — distance count-up */}
                            <AnimatedDistance km={typeof svc.distance_km === 'number' ? svc.distance_km : parseFloat(String(svc.distance_km)) || 0} trigger={cardsTriggered} /> km
                          </span>
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#F4F2EC', marginBottom: '4px' }}>{svc.name}</div>
                        <div style={{ fontSize: '12px', color: '#9AA0A8', marginBottom: '10px' }}>
                          {svc.address?.formatted_address || 'Verified Corridor Provider'}
                        </div>
                        {svc.contact?.phone_primary ? (
                          <a
                            href={`tel:${svc.contact.phone_primary}`}
                            style={{
                              display: 'inline-block', backgroundColor: '#1F4FD8', color: '#FFF',
                              padding: '6px 12px', borderRadius: '4px', fontSize: '12px',
                              fontWeight: 600, textDecoration: 'none',
                            }}
                          >
                            📞 Call {svc.contact.phone_primary}
                          </a>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block', backgroundColor: '#2C3137', color: '#64748B',
                              padding: '6px 12px', borderRadius: '4px', fontSize: '12px',
                              fontWeight: 600, border: '1px solid #3A4047',
                            }}
                          >
                            📞 No phone listed
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </section>

        {/* ── CAPABILITIES ── */}
        <section id="features" style={{ padding: '80px 24px', maxWidth: '1200px', margin: '0 auto' }}>
          <div
            ref={capsRef}
          >
            <div style={{
              fontFamily: "'IBM Plex Mono', monospace", color: '#1F4FD8',
              fontSize: '13px', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: '12px',
              ...revealStyle(capsVisible, 0),
            }}>
              05 // CAPABILITIES
            </div>
            <h2 style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 'clamp(36px, 4vw, 48px)',
              fontWeight: 700, margin: '0 0 40px', color: '#14171C',
              ...revealStyle(capsVisible, 80),
            }}>
              What RAAHAT adds on top of standard maps.
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {[
                { icon: '🧠', title: 'Situation-aware Triage', desc: 'Classifies what happened and how serious it is before recommending anything.' },
                { icon: '🎙️', title: 'Voice-first Multilingual', desc: 'English, Hindi, and Hinglish handled naturally with instant emergency response.' },
                { icon: '📴', title: 'Offline Safety Pack', desc: 'Works with no internet: cached GPS-local services, offline RAG, and on-device AI.' },
                { icon: '🤝', title: 'Agentic Dispatch', desc: 'With explicit permission, RAAHAT can contact a service provider on your behalf.' },
                { icon: '✅', title: '100% Verified Providers', desc: 'Every recommendation shows its source — Geoapify, OSM Overpass, or seed database.' },
                { icon: '🛡️', title: 'Zero Credit Card Dependency', desc: 'Operates 100% on free-tier APIs and open geospatial data pipelines.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#F4F2EC', padding: '24px', borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    transition: `transform var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard)`,
                    ...revealStyle(capsVisible, Math.min(idx, 5) * STAGGER + 80),
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => capHover(e, true)}
                  onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => capHover(e, false)}
                >
                  {/* Icon — pop a beat after card */}
                  <div style={{
                    fontSize: '28px', marginBottom: '12px',
                    display: 'inline-block',
                    ...popStyle(capsVisible, Math.min(idx, 5) * STAGGER + 200),
                  }}>{item.icon}</div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#14171C' }}>{item.title}</h3>
                  <p style={{ fontSize: '14px', color: '#64748B', margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER — calm reveal, no pop ── */}
        <footer
          ref={footerRef}
          style={{
            backgroundColor: '#14171C', color: '#94A3B8', padding: '40px 24px',
            borderTop: '1px solid #232629', textAlign: 'center', fontSize: '14px',
            ...revealStyle(footerVisible, 0),
          }}
        >
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#F4F2EC', fontSize: '18px', fontFamily: "'Barlow Condensed', sans-serif" }}>
              <img src="/image/logo.png" alt="RAAHAT" style={{ width: '24px', height: '24px', borderRadius: '5px', objectFit: 'cover' }} /> RAAHAT — AI Emergency Navigator
            </div>
            <div>SquidHack 2026 · Team Solution Savvy · SW-17</div>
          </div>
        </footer>

      </div>
    </>
  );
};
