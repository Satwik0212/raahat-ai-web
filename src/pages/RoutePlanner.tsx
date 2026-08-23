import React, { useState, useEffect } from 'react';
import { Navigation, Crosshair, ArrowRight, Package, CheckCircle, Download } from 'lucide-react';
import { requestApi, RoutePlanResponse, ServiceProvider, GeocodeResponse } from '../api/client';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon path issues
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
});

// A helper component to auto-zoom the map when route changes
const MapBoundsAdjuster = ({ bounds }: { bounds: L.LatLngBounds | null }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [bounds, map]);
  return null;
};

const MEDICAL_CATEGORIES = [
  { id: 'HOSPITAL', label: '🏥 Hospitals' },
  { id: 'AMBULANCE', label: '🚑 Ambulances' },
  { id: 'POLICE', label: '👮 Police' },
  { id: 'FIRE_BRIGADE', label: '🚒 Fire Brigade' }
];

const ROADSIDE_CATEGORIES = [
  { id: 'MECHANIC', label: '🔧 Mechanics' },
  { id: 'PUNCTURE_REPAIR', label: '🛞 Puncture Repair' },
  { id: 'TOWING', label: '🚛 Towing' },
  { id: 'FUEL_DELIVERY', label: '⛽ Fuel Delivery' }
];

export const RoutePlanner: React.FC = () => {
  const [originInput, setOriginInput] = useState('');
  const [destInput, setDestInput] = useState('');
  
  const [route, setRoute] = useState<RoutePlanResponse | null>(null);
  const [resolvedOrigin, setResolvedOrigin] = useState<{name: string, lat: number, lng: number} | null>(null);
  const [resolvedDest, setResolvedDest] = useState<{name: string, lat: number, lng: number} | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Offline pack state
  const [packGenerated, setPackGenerated] = useState(false);
  const [packDate, setPackDate] = useState('');
  
  // Create an array of lat/lng pairs for Polyline
  const routePositions: [number, number][] = route && route.polyline_encoded
    ? polylineDecode(route.polyline_encoded)
    : [];
    
  // Compute bounds to fit the map
  let mapBounds: L.LatLngBounds | null = null;
  if (resolvedOrigin && resolvedDest) {
    mapBounds = L.latLngBounds(
      [resolvedOrigin.lat, resolvedOrigin.lng],
      [resolvedDest.lat, resolvedDest.lng]
    );
  }

  const handlePlanRoute = async () => {
    if (!originInput.trim() || !destInput.trim()) {
      setError("Please enter both origin and destination.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setRoute(null);
    setPackGenerated(false);
    
    try {
      // 1. Geocode Origin
      const originRes = await requestApi<GeocodeResponse>(`/routes/geocode?q=${encodeURIComponent(originInput)}`);
      // 2. Geocode Destination
      const destRes = await requestApi<GeocodeResponse>(`/routes/geocode?q=${encodeURIComponent(destInput)}`);
      
      setResolvedOrigin({ name: originRes.display_name, lat: originRes.latitude, lng: originRes.longitude });
      setResolvedDest({ name: destRes.display_name, lat: destRes.latitude, lng: destRes.longitude });
      
      // 3. Plan Route
      const routeData = await requestApi<RoutePlanResponse>('/routes/plan', 'POST', {
        origin: { latitude: originRes.latitude, longitude: originRes.longitude },
        destination: { latitude: destRes.latitude, longitude: destRes.longitude },
        prefer_safe_corridors: true
      });
      
      setRoute(routeData);
    } catch (err: any) {
      setError(err.message || 'Route planning failed.');
    } finally {
      setLoading(false);
    }
  };

  const generateOfflinePackTxt = () => {
    if (!route || !resolvedOrigin || !resolvedDest) return;
    
    const lines: string[] = [];
    lines.push('================================================');
    lines.push('       RAAHAT - OFFLINE EMERGENCY PACK');
    lines.push('================================================\n');
    
    lines.push('TRIP');
    lines.push('----');
    lines.push(`Origin: ${resolvedOrigin.name}`);
    lines.push(`Destination: ${resolvedDest.name}\n`);
    lines.push(`Distance: ${route.total_distance_km.toFixed(1)} km`);
    lines.push(`Estimated travel time: ${route.total_duration_minutes.toFixed(0)} min\n`);
    
    const ts = new Date().toISOString();
    lines.push(`Generated: ${ts}\n`);
    
    lines.push('ROUTE EMERGENCY SERVICES');
    lines.push('------------------------\n');
    
    const services = route.nearby_emergency_services || [];
    const grouped: Record<string, ServiceProvider[]> = {};
    services.forEach(s => {
      const cat = s.service_types[0] || 'GENERAL';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(s);
    });
    
    const renderCategory = (id: string, name: string) => {
      lines.push(`${name}`);
      const items = grouped[id] || [];
      if (items.length === 0) {
        lines.push(`No verified live ${name.toLowerCase()} found along the selected route.\n`);
      } else {
        items.forEach((item, idx) => {
          lines.push(`${idx + 1}. ${item.name || 'Unnamed Service'}`);
          const addr = [item.address.formatted_address, item.address.city, item.address.state]
            .filter(Boolean).join(', ');
          lines.push(`   Address: ${addr || 'Not available'}`);
          lines.push(`   Phone: ${item.contact?.phone_primary || 'Not available'}`);
          lines.push(`   Location: ${item.location.latitude}, ${item.location.longitude}`);
          lines.push(`   Distance: ${item.distance_km} km`);
          lines.push(`   Source: ${item.source}\n`);
        });
      }
    };
    
    lines.push('MEDICAL & PUBLIC SAFETY');
    lines.push('-----------------------\n');
    MEDICAL_CATEGORIES.forEach(c => renderCategory(c.id, c.id.replace('_', ' ')));
    
    lines.push('ROADSIDE ASSISTANCE');
    lines.push('--------------------\n');
    ROADSIDE_CATEGORIES.forEach(c => renderCategory(c.id, c.id.replace('_', ' ')));
    
    lines.push('IMPORTANT');
    lines.push('---------');
    lines.push('This emergency pack was generated for the selected route.');
    lines.push('Verify service availability before relying on non-emergency providers.\n');
    
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `RAAHAT_Offline_Pack_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setPackGenerated(true);
    setPackDate(new Date().toLocaleString());
  };

  return (
    <div className="container">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: '0 0 6px 0', color: '#0F172A' }}>
          RAAHAT AI Emergency Navigator
        </h1>
        <p style={{ color: '#64748B', margin: 0, fontSize: '0.92rem' }}>
          Plan your trip and prepare your offline emergency pack before you leave.
        </p>
      </div>

      {/* PLAN YOUR TRIP Section */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#0F172A', textTransform: 'uppercase' }}>Plan Your Trip</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: '16px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>
              From
            </label>
            <input 
              className="input" 
              value={originInput} 
              onChange={(e) => setOriginInput(e.target.value)} 
              placeholder="Indore, Madhya Pradesh" 
              style={{ padding: '10px 12px', width: '100%' }} 
            />
          </div>

          <ArrowRight size={20} color="#94A3B8" style={{ marginBottom: '12px' }} />

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', color: '#64748B', marginBottom: '6px', fontWeight: 600 }}>
              To
            </label>
            <input 
              className="input" 
              value={destInput} 
              onChange={(e) => setDestInput(e.target.value)} 
              placeholder="Bhopal, Madhya Pradesh" 
              style={{ padding: '10px 12px', width: '100%' }} 
            />
          </div>

          <button className="btn btn-primary" onClick={handlePlanRoute} disabled={loading} style={{ marginBottom: '1px' }}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, borderTopColor: 'white' }} /> Planning...</> : <><Navigation size={16} /> Plan Route</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: '20px', borderLeft: '4px solid #EF4444' }}>
          <span style={{ color: '#DC2626', fontSize: '0.88rem' }}>{error}</span>
        </div>
      )}

      {/* YOUR ROUTE Section */}
      {route && resolvedOrigin && resolvedDest && (
        <>
          <div className="card" style={{ padding: '0', overflow: 'hidden', marginBottom: '24px' }}>
            <div style={{ padding: '16px 24px', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: '#0F172A', textTransform: 'uppercase' }}>Your Route</h3>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155' }}>
                {resolvedOrigin.name.split(',')[0]} → {resolvedDest.name.split(',')[0]}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#64748B', marginTop: '4px' }}>
                {route.total_distance_km.toFixed(1)} km • {route.total_duration_minutes.toFixed(0)} min
              </div>
            </div>
            
            {/* Map */}
            <div style={{ height: '400px', width: '100%' }}>
              <MapContainer 
                center={[resolvedOrigin.lat, resolvedOrigin.lng]} 
                zoom={10} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <Marker position={[resolvedOrigin.lat, resolvedOrigin.lng]}>
                  <Popup><strong>Origin:</strong> {resolvedOrigin.name}</Popup>
                </Marker>
                
                <Marker position={[resolvedDest.lat, resolvedDest.lng]}>
                  <Popup><strong>Destination:</strong> {resolvedDest.name}</Popup>
                </Marker>
                
                {routePositions.length > 0 && (
                  <Polyline positions={routePositions} pathOptions={{ color: '#2563EB', weight: 4 }} />
                )}
                
                {/* Emergency Services Markers */}
                {route.nearby_emergency_services?.map((svc, idx) => (
                  <Marker key={idx} position={[svc.location.latitude, svc.location.longitude]}>
                    <Popup>
                      <strong>{svc.name}</strong><br/>
                      {svc.service_types.join(', ')}<br/>
                      {svc.contact?.phone_primary || 'No phone'}<br/>
                      {svc.distance_km} km away
                    </Popup>
                  </Marker>
                ))}
                
                <MapBoundsAdjuster bounds={mapBounds} />
              </MapContainer>
            </div>
          </div>

          {/* PREPARE BEFORE YOU LEAVE Section */}
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: '#0F172A', textTransform: 'uppercase' }}>Prepare Before You Leave</h3>
            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '20px' }}>
              Download emergency information for your route so you're prepared even without internet connectivity.
            </p>
            
            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '1rem', color: '#0F172A', textTransform: 'uppercase' }}>Emergency Services Found</h4>
              
              {(() => {
                const acc = (route.nearby_emergency_services || []).reduce((counts: Record<string, number>, s) => {
                  const t = s.service_types[0] || 'GENERAL';
                  counts[t] = (counts[t] || 0) + 1;
                  return counts;
                }, {});

                return (
                  <>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Medical & Safety</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                      {MEDICAL_CATEGORIES.map(c => (
                        <div key={c.id} style={{ fontSize: '0.9rem', color: '#334155' }}>
                          <span>{c.label}:</span> <strong style={{ color: '#0F172A' }}>{acc[c.id] || 0}</strong>
                        </div>
                      ))}
                    </div>

                    <h5 style={{ margin: '0 0 8px 0', fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase' }}>Roadside Assistance</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                      {ROADSIDE_CATEGORIES.map(c => (
                        <div key={c.id} style={{ fontSize: '0.9rem', color: '#334155' }}>
                          <span>{c.label}:</span> <strong style={{ color: '#0F172A' }}>{acc[c.id] || 0}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>

            <button className="btn btn-success" onClick={generateOfflinePackTxt} style={{ padding: '10px 20px', gap: '8px' }}>
              <Package size={18} /> Generate Offline Emergency Pack
            </button>
            
            {packGenerated && (
              <div style={{ marginTop: '20px', padding: '16px', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <CheckCircle size={24} color="#16A34A" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 4px 0', color: '#166534', fontSize: '1rem' }}>PACK READY ✓</h4>
                  <p style={{ margin: '0 0 12px 0', color: '#15803D', fontSize: '0.85rem' }}>Your emergency information is ready.</p>
                  <p style={{ margin: '0', color: '#16A34A', fontSize: '0.75rem' }}>Generated at: {packDate}</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Simple utility to decode standard Google Encoded Polylines (OSRM and Geoapify use this)
function polylineDecode(str: string, precision: number = 5): [number, number][] {
  let index = 0, lat = 0, lng = 0, coordinates: [number, number][] = [], shift = 0, result = 0, byte = null, latitude_change, longitude_change, factor = Math.pow(10, precision);
  while (index < str.length) {
      byte = null; shift = 0; result = 0;
      do {
          byte = str.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
      } while (byte >= 0x20);
      latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
      shift = result = 0;
      do {
          byte = str.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
      } while (byte >= 0x20);
      longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += latitude_change; lng += longitude_change;
      coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}
