import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Phone, Navigation, ShieldAlert, RefreshCw, Crosshair, ChevronRight, Send, ArrowUp } from 'lucide-react';
import { requestApi, EmergencyResponse, ServiceProvider, ProviderStatus, DiagnosticEntry } from '../api/client';

/* ── Severity color map ──────────────────────────────── */
const sevColor: Record<string, string> = {
  CRITICAL: '#DC2626', HIGH: '#EA580C', MEDIUM: '#D97706', LOW: '#16A34A', UNKNOWN: '#64748B',
};

/* ── Service card ────────────────────────────────────── */
const ServiceCard: React.FC<{ service: ServiceProvider }> = ({ service }) => (
  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0F172A' }}>{service.name}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
          {service.source} · {service.distance_km != null ? `${Number(service.distance_km).toFixed(1)} km` : '—'}
          {service.eta_minutes != null && ` · ~${service.eta_minutes} min`}
        </div>
      </div>
      {service.rating != null && (
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#D97706', background: '#FFFBEB', padding: '2px 6px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
          ⭐ {service.rating}
        </span>
      )}
    </div>
    {service.address?.formatted_address && (
      <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '8px' }}>{service.address.formatted_address}</div>
    )}
    <div style={{ display: 'flex', gap: '6px' }}>
      {service.contact?.phone_primary ? (
        <a href={`tel:${service.contact.phone_primary}`} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#DC2626', color: '#FFF', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
          <Phone size={13} /> Call
        </a>
      ) : (
        <button disabled style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#F1F5F9', color: '#94A3B8', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #E2E8F0', cursor: 'not-allowed' }}>
          <Phone size={13} /> No phone
        </button>
      )}
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${service.location.latitude},${service.location.longitude}`}
        target="_blank" rel="noreferrer"
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', background: '#0F172A', color: '#FFF', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}
      >
        <Navigation size={13} /> Navigate
      </a>
    </div>
  </div>
);

/* ── Chat Types ────────────────────────────────────────── */
type MessageType = 'welcome' | 'user' | 'ai' | 'system' | 'error';

interface Turn {
  id: string;
  type: MessageType;
  text?: string;
  result?: EmergencyResponse;
  loading?: boolean;
  timestamp: Date;
  onRetry?: () => void;
  errorStr?: string;
}

/* ── AI Message Body ───────────────────────────────────── */
const AIMessage: React.FC<{ turn: Turn }> = ({ turn }) => {
  if (turn.loading) {
    return (
      <div className="msg-ai fade-in">
        <div className="msg-ai-avatar">
          <img src="/image/logo.png" alt="RAAHAT" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
        </div>
        <div className="msg-ai-body">
          <div className="typing-dots">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (turn.type === 'error') {
    return (
      <div className="msg-ai fade-in">
        <div className="msg-ai-avatar">⚠️</div>
        <div className="msg-ai-body">
          <div style={{ color: '#DC2626', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={15} /> Analysis Error
          </div>
          <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#64748B' }}>{turn.errorStr}</p>
          {turn.onRetry && (
            <button onClick={turn.onRetry} style={{ background: '#DC2626', color: '#FFF', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} /> Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const result = turn.result;
  if (!result) return null;

  const sColor = sevColor[result.incident.severity] || sevColor.UNKNOWN;

  return (
    <div className="msg-ai fade-in">
      <div className="msg-ai-avatar">
        <img src="/image/logo.png" alt="RAAHAT" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      </div>
      <div className="msg-ai-body">

        {/* Classification */}
        <div className="stagger-1" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.85rem', color: sColor, background: `${sColor}12`, padding: '3px 10px', borderRadius: '6px' }}>
            {result.incident.severity}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#0F172A' }}>{result.incident.category}</span>
          <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
            · {result.ai.classifier_used} ({(result.ai.confidence_score * 100).toFixed(0)}%)
            {result.conversation_id && ` · ID: ${result.conversation_id}`}
          </span>
        </div>

        {/* Guidance */}
        <div className="ai-section stagger-2">
          <div className="ai-section-title"><ShieldAlert size={16} color="#2563EB" /> What to do now</div>
          <p style={{ margin: '0 0 14px', color: '#475569', fontSize: '0.9rem', lineHeight: 1.6 }}>{result.guidance.summary}</p>
          {result.guidance.steps.map(step => (
            <div key={step.step_number} style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: step.is_critical ? '#EF4444' : '#2563EB', color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, flexShrink: 0 }}>
                {step.step_number}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0F172A' }}>{step.title}</div>
                <div style={{ color: '#64748B', fontSize: '0.8rem', lineHeight: 1.4 }}>{step.instruction}</div>
              </div>
            </div>
          ))}
          {result.guidance.immediate_do_not_do?.length > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px', marginTop: '8px' }}>
              <strong style={{ color: '#D97706', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>⚠️ Do NOT:</strong>
              <ul style={{ margin: 0, paddingLeft: '16px', color: '#92400E', fontSize: '0.78rem', lineHeight: 1.4 }}>
                {result.guidance.immediate_do_not_do.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>

        {/* Services */}
        <div className="ai-section stagger-3">
          <div className="ai-section-title">📍 Nearby Services ({result.services.length})</div>
          {result.services.length === 0 ? (
            <div style={{ color: '#64748B', fontSize: '0.85rem' }}>No services found nearby.</div>
          ) : (
            result.services.slice(0, 3).map(svc => <ServiceCard key={svc.provider_id} service={svc} />)
          )}
          {result.services.length > 3 && (
            <button className="stagger-4" style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px', borderRadius: '8px', fontSize: '0.82rem', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
              Show {result.services.length - 3} more
            </button>
          )}
        </div>

        {/* Actions */}
        {result.recommended_actions?.length > 0 && (
          <div className="stagger-4" style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {result.recommended_actions.map(action => {
              const isCall = action.action_type?.includes('CALL');
              return (
                <button key={action.action_id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 600, border: isCall ? 'none' : '1px solid #E2E8F0', background: isCall ? '#DC2626' : '#FFFFFF', color: isCall ? '#FFF' : '#475569', cursor: 'pointer' }}>
                  {isCall ? <Phone size={12} /> : <ChevronRight size={12} />} {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════
   DASHBOARD — ChatGPT / Claude style
   ══════════════════════════════════════════════════════════ */
export const Dashboard: React.FC = () => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy_meters?: number; isManual: boolean; gpsAttempted: boolean; gpsSuccess: boolean }>({
    latitude: 22.7196, longitude: 75.8577, isManual: false, gpsAttempted: false, gpsSuccess: false
  });
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManual, setShowManual] = useState(false);

  const [turns, setTurns] = useState<Turn[]>([{ id: 'welcome-0', type: 'welcome', timestamp: new Date() }]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* GPS */
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy_meters: pos.coords.accuracy, isManual: false, gpsAttempted: true, gpsSuccess: true }),
        () => setLocation(prev => ({ ...prev, gpsAttempted: true, gpsSuccess: false }))
      );
    } else {
      setLocation(prev => ({ ...prev, gpsAttempted: true, gpsSuccess: false }));
    }
  }, []);

  const applyManualCoords = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setLocation({ latitude: lat, longitude: lng, isManual: true, gpsAttempted: true, gpsSuccess: false });
      setShowManual(false);
    }
  };

  /* Auto-grow textarea */
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > 120 ? 'auto' : 'hidden';
    }
  };

  /* Scroll */
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  };
  useEffect(() => { setTimeout(scrollToBottom, 100); }, [turns]);

  const suggestions = [
    "Tyre puncture on highway, need mobile repair",
    "Accident with bleeding victim, need ambulance",
    "Engine breakdown with smoke, need towing",
    "Out of fuel late night on highway",
    "Stranded on isolated road, need police help",
  ];

  /* Send */
  const handleSend = async (queryText?: string) => {
    const q = (queryText || query).trim();
    if (!q || loading) return;

    setQuery('');
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const locTag = location.isManual ? 'MANUAL' : location.gpsSuccess ? 'GPS' : 'DEMO';
    const sysTurnId = Date.now().toString() + '-sys';
    const userTurnId = Date.now().toString() + '-user';
    const aiTurnId = Date.now().toString() + '-ai';

    setTurns(prev => [
      ...prev,
      { id: sysTurnId, type: 'system', text: `${locTag} · ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`, timestamp: new Date() },
      { id: userTurnId, type: 'user', text: q, timestamp: new Date() },
      { id: aiTurnId, type: 'ai', loading: true, timestamp: new Date() }
    ]);

    try {
      const data = await requestApi<EmergencyResponse>('/emergency-assistance', 'POST', {
        user_query: q,
        location: { latitude: location.latitude, longitude: location.longitude, accuracy_meters: location.accuracy_meters },
        language: 'hi'
      });
      setTurns(prev => prev.map(t => t.id === aiTurnId ? { ...t, loading: false, result: data } : t));
    } catch (err: any) {
      setTurns(prev => prev.map(t =>
        t.id === aiTurnId ? { ...t, type: 'error', loading: false, errorStr: err.message || 'Request failed', onRetry: () => handleSend(q) } : t
      ));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-page">

      {/* Scrollable message area */}
      <div className="chat-scroll-area" ref={scrollRef}>
        <div className="chat-center">
          {turns.map(turn => {
            if (turn.type === 'welcome') {
              return (
                <div key={turn.id} className="chat-welcome fade-in">
                  <div className="chat-welcome-logo">
                    <img src="/image/logo.png" alt="RAAHAT" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  </div>
                  <h2>RAAHAT Emergency AI</h2>
                  <p>Describe what happened on the road — in English, Hindi, or Hinglish. I'll assess severity, give you step-by-step guidance, and find verified help nearby.</p>
                  <div className="chat-suggestions">
                    {suggestions.map((chip, idx) => (
                      <button key={idx} onClick={() => handleSend(chip)} disabled={loading}>{chip}</button>
                    ))}
                  </div>
                </div>
              );
            }

            if (turn.type === 'system') {
              return <div key={turn.id} className="msg-system fade-in">📍 {turn.text}</div>;
            }

            if (turn.type === 'user') {
              return (
                <div key={turn.id} className="msg-row-user fade-in">
                  <div className="msg-user">{turn.text}</div>
                </div>
              );
            }

            if (turn.type === 'ai' || turn.type === 'error') {
              return <AIMessage key={turn.id} turn={turn} />;
            }

            return null;
          })}
        </div>
      </div>

      {/* Bottom input area */}
      <div className="chat-input-area">
        <div className="chat-input-center">
          
          {/* Location chip */}
          <div className="chat-location-chip">
            <Crosshair size={11} color="#2563EB" />
            <code>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</code>
            <span style={{ color: location.gpsSuccess ? '#16A34A' : '#D97706', fontWeight: 600 }}>
              {location.isManual ? 'MANUAL' : location.gpsSuccess ? 'GPS' : 'DEMO'}
            </span>
            <button onClick={() => setShowManual(!showManual)} style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: '0.72rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
              {showManual ? 'Close' : 'Edit'}
            </button>
          </div>

          {showManual && (
            <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
              <input placeholder="Lat" value={manualLat} onChange={e => setManualLat(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.8rem' }} />
              <input placeholder="Lng" value={manualLng} onChange={e => setManualLng(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '0.8rem' }} />
              <button onClick={applyManualCoords} style={{ padding: '6px 12px', borderRadius: '8px', background: '#0F172A', color: '#FFF', border: 'none', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Set</button>
            </div>
          )}

          {/* Input bar */}
          <div className="chat-input-bar">
            <textarea
              ref={textareaRef}
              placeholder="Describe what happened..."
              value={query}
              onChange={handleInput}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              rows={1}
              disabled={loading}
            />
            <button className="chat-send-btn" onClick={() => handleSend()} disabled={loading || !query.trim()} aria-label="Send">
              {loading ? <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : <ArrowUp size={18} />}
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
