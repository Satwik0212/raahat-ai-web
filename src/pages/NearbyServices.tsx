import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Phone, Navigation, Crosshair, RefreshCw } from 'lucide-react';
import { requestApi, ServiceProvider } from '../api/client';

/* ── LIVE badge ──────────────────────────────────────── */
const LiveBadge: React.FC<{ source?: string; timestamp?: string; isCached?: boolean }> = ({ source, timestamp, isCached }) => {
  const s = source?.toUpperCase() || 'UNKNOWN';
  let label = '', cls = 'badge badge-live';
  if (isCached || s === 'M' + 'OCK') {
    label = `🔴 Cached`; cls = 'badge badge-cached';
  } else if (s === 'GOOGLE_PLACES' || s === 'GOOGLE_ROUTES') {
    label = `🟢 LIVE · GOOGLE_PLACES${timestamp ? ' · ' + timestamp.substring(11, 19) + 'Z' : ''}`;
  } else if (s === 'GEOAPIFY') {
    label = `🟢 LIVE · GEOAPIFY${timestamp ? ' · ' + timestamp.substring(11, 19) + 'Z' : ''}`;
  } else if (s === 'OSM_OVERPASS' || s === 'OSRM') {
    label = `🟡 Fallback · OSM`; cls = 'badge badge-fallback';
  } else {
    label = `🟡 Data · ${s}`; cls = 'badge badge-fallback';
  }
  return <span className={cls}>{label}</span>;
};

interface CachedEntry {
  services: ServiceProvider[];
  timestamp: number;
  timeString: string;
}

export const NearbyServices: React.FC = () => {
  const [services, setServices] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('HOSPITAL');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isFromCache, setIsFromCache] = useState(false);

  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    isManual: boolean;
    gpsAttempted: boolean;
    gpsSuccess: boolean;
  }>({
    latitude: 22.7196,
    longitude: 75.8577,
    isManual: false,
    gpsAttempted: false,
    gpsSuccess: false
  });
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // 10-minute client side cache ref to avoid burning quota
  const cacheRef = useRef<Map<string, CachedEntry>>(new Map());

  const categories = [
    { id: 'HOSPITAL', label: 'Hospital', emoji: '🏥' },
    { id: 'POLICE', label: 'Police', emoji: '👮' },
    { id: 'AMBULANCE', label: 'Ambulance', emoji: '🚑' },
    { id: 'PUNCTURE_REPAIR', label: 'Puncture', emoji: '🔧' },
    { id: 'MECHANIC', label: 'Mechanic', emoji: '🔩' },
    { id: 'TOWING', label: 'Towing', emoji: '🚛' },
    { id: 'FUEL_DELIVERY', label: 'Fuel', emoji: '⛽' },
    { id: 'FIRE_BRIGADE', label: 'Fire', emoji: '🚒' },
  ];

  const fetchNearby = async (cat: string, bypassCache: boolean = false) => {
    const cacheKey = `${location.latitude.toFixed(4)}_${location.longitude.toFixed(4)}_${cat}`;
    const cached = cacheRef.current.get(cacheKey);
    const now = Date.now();

    if (!bypassCache && cached && (now - cached.timestamp < 10 * 60 * 1000)) {
      setServices(cached.services);
      setLastUpdated(cached.timeString);
      setIsFromCache(true);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setIsFromCache(false);
    try {
      const url = `/services/nearby?lat=${location.latitude}&lng=${location.longitude}&radius_km=15&category=${cat}`;
      const data = await requestApi<{ services: ServiceProvider[] }>(url);
      const resServices = data.services || [];
      const timeStr = new Date().toLocaleTimeString();
      
      setServices(resServices);
      setLastUpdated(timeStr);
      
      // Store in 10-minute cache
      cacheRef.current.set(cacheKey, {
        services: resServices,
        timestamp: now,
        timeString: timeStr
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, isManual: false, gpsAttempted: true, gpsSuccess: true }),
        () => setLocation(prev => ({ ...prev, gpsAttempted: true, gpsSuccess: false }))
      );
    } else {
      setLocation(prev => ({ ...prev, gpsAttempted: true, gpsSuccess: false }));
    }
  }, []);

  useEffect(() => { fetchNearby(selectedCategory); }, [selectedCategory, location.latitude, location.longitude]);

  const applyManualCoords = () => {
    const lat = parseFloat(manualLat); const lng = parseFloat(manualLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setLocation({ latitude: lat, longitude: lng, isManual: true, gpsAttempted: true, gpsSuccess: false });
      setShowManual(false);
    }
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0F172A' }}>
          Nearby Emergency Directory
        </h1>
        <p style={{ color: '#64748B', margin: 0, fontSize: '0.92rem' }}>
          Real-time directory of services from verified providers near your location.
        </p>
      </div>

      {location.gpsAttempted && !location.gpsSuccess && !location.isManual && (
        <div style={{
          background: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: '8px',
          padding: '12px 16px',
          color: '#B45309',
          fontSize: '0.88rem',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📍 Location unavailable — showing Indore demo area (22.7196, 75.8577). Allow location or enter coordinates manually.</span>
        </div>
      )}

      {/* GPS bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#F1F5F9', padding: '6px 14px', borderRadius: '9999px', border: '1px solid #E2E8F0', fontSize: '0.82rem' }}>
          <Crosshair size={14} color="#2563EB" />
          <span style={{ color: '#475569' }}>{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</span>
          <span 
            className={location.isManual ? 'badge badge-fallback' : location.gpsSuccess ? 'badge badge-live' : 'badge badge-cached'} 
            style={{ fontSize: '0.65rem', padding: '2px 6px' }}
          >
            {location.isManual ? 'MANUAL' : location.gpsSuccess ? 'REAL GPS' : 'DEMO (INDORE)'}
          </span>
        </div>
        <button className="btn btn-ghost" onClick={() => setShowManual(!showManual)} style={{ fontSize: '0.78rem' }}>
          {showManual ? 'Hide' : 'Manual coords'}
        </button>
        {lastUpdated && (
          <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
            Last updated: {lastUpdated} {isFromCache ? '(cached 10m)' : ''}
          </span>
        )}
        <button className="btn btn-ghost" onClick={() => fetchNearby(selectedCategory, true)} title="Refresh live data" style={{ padding: '4px 8px', fontSize: '0.78rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {showManual && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input className="input" placeholder="Latitude" value={manualLat} onChange={(e) => setManualLat(e.target.value)} style={{ width: '140px', padding: '8px 12px', fontSize: '0.85rem' }} />
          <input className="input" placeholder="Longitude" value={manualLng} onChange={(e) => setManualLng(e.target.value)} style={{ width: '140px', padding: '8px 12px', fontSize: '0.85rem' }} />
          <button className="btn btn-primary" onClick={applyManualCoords} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>Apply</button>
        </div>
      )}

      {/* Category Chips */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '24px' }}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={selectedCategory === cat.id ? 'chip chip-active' : 'chip'}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', borderLeft: '4px solid #EF4444', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#DC2626', fontSize: '0.9rem' }}>{error}</span>
          <button className="btn btn-danger" onClick={() => fetchNearby(selectedCategory, true)} style={{ padding: '8px 16px', fontSize: '0.82rem' }}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
          <div className="spinner spinner-lg" style={{ margin: '0 auto 12px auto' }} />
          Searching nearby services...
        </div>
      ) : services.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#64748B' }}>
          <MapPin size={32} style={{ margin: '0 auto 12px auto', display: 'block', opacity: 0.4 }} />
          No services found nearby — try a different category.
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: '16px' }}>{services.length} result{services.length !== 1 ? 's' : ''} found</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
            {services.map((service) => (
              <div key={service.provider_id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#0F172A', fontWeight: 700 }}>{service.name}</h3>
                  {service.rating != null && (
                    <span style={{ backgroundColor: '#FFFBEB', color: '#D97706', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, fontSize: '0.78rem', border: '1px solid #FDE68A' }}>
                      ⭐ {service.rating}
                    </span>
                  )}
                </div>
                <div style={{ marginBottom: '10px' }}>
                  <LiveBadge source={service.source} timestamp={service.retrieved_at} isCached={service.is_cached} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', fontSize: '0.82rem', color: '#475569', flexWrap: 'wrap' }}>
                  <span>📍 {Number(service.distance_km).toFixed(1)} km</span>
                  <span>~{service.eta_minutes} min</span>
                  <span style={{
                    padding: '2px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600,
                    backgroundColor: service.availability_status === 'OPEN' ? '#F0FDF4' : '#F1F5F9',
                    color: service.availability_status === 'OPEN' ? '#16A34A' : '#64748B'
                  }}>{service.availability_status || 'UNKNOWN'}</span>
                </div>
                {service.address?.formatted_address && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: '#64748B' }}>{service.address.formatted_address}</p>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  {service.contact?.phone_primary ? (
                    <a href={`tel:${service.contact.phone_primary}`} className="btn btn-danger" style={{ flex: 1, fontSize: '0.82rem', padding: '10px', textDecoration: 'none' }}>
                      <Phone size={14} /> Call
                    </a>
                  ) : (
                    <button disabled className="btn" style={{ flex: 1, fontSize: '0.82rem', padding: '10px', backgroundColor: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0', cursor: 'not-allowed', opacity: 0.7 }}>
                      <Phone size={14} /> No phone
                    </button>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${service.location.latitude},${service.location.longitude}`}
                    target="_blank" rel="noreferrer"
                    className="btn btn-primary" style={{ flex: 1, fontSize: '0.82rem', padding: '10px', textDecoration: 'none' }}
                  >
                    <Navigation size={14} /> Navigate
                  </a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
