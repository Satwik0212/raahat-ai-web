import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, MapPin, Navigation, Download, Wifi, WifiOff, AlertTriangle, LogOut, User } from 'lucide-react';
import { requestApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export const Navbar: React.FC = () => {
  const { user, signOut, isDevAuth } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [apiStatus, setApiStatus] = useState<'live' | 'degraded' | 'offline' | 'checking'>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await requestApi<any>('/health');
        if (res && res.status === 'degraded') {
          setApiStatus('degraded');
        } else {
          setApiStatus('live');
        }
      } catch {
        setApiStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { path: '/app', label: 'Emergency', icon: ShieldAlert },
    { path: '/nearby', label: 'Nearby Help', icon: MapPin },
    { path: '/route', label: 'Route Planner', icon: Navigation },
  ];

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      height: '64px',
      borderBottom: '1px solid #E2E8F0',
      backgroundColor: '#FFFFFF',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
    }}>
      {/* Brand Logo - Links to Landing page */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <img
          src="/image/logo.png"
          alt="RAAHAT"
          style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover' }}
        />
        <div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', letterSpacing: '0.3px' }}>RAAHAT</span>
          <span style={{ fontSize: '0.65rem', display: 'block', color: '#94A3B8', fontWeight: 500 }}>AI Emergency Navigator</span>
        </div>
      </Link>

      {/* Main Protected Nav Tabs (Visible when logged in or viewing app) */}
      {user && (
        <div style={{ display: 'flex', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                  color: isActive ? '#1F4FD8' : '#64748B',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.88rem'
                }}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}

      {/* Right Action Items & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* System Health Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: '9999px',
          border: '1px solid',
          borderColor: 
            apiStatus === 'live' ? '#BBF7D0' : 
            apiStatus === 'degraded' ? '#FDE68A' : 
            apiStatus === 'offline' ? '#FECACA' : '#E2E8F0',
          backgroundColor: 
            apiStatus === 'live' ? '#F0FDF4' : 
            apiStatus === 'degraded' ? '#FFFBEB' : 
            apiStatus === 'offline' ? '#FEF2F2' : '#F8FAFC',
          color: 
            apiStatus === 'live' ? '#16A34A' : 
            apiStatus === 'degraded' ? '#D97706' : 
            apiStatus === 'offline' ? '#EF4444' : '#94A3B8'
        }}>
          {apiStatus === 'live' ? <Wifi size={12} /> : 
           apiStatus === 'degraded' ? <AlertTriangle size={12} /> : 
           apiStatus === 'offline' ? <WifiOff size={12} /> : 
           <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#94A3B8' }} />}
          {apiStatus === 'live' ? 'LIVE' : 
           apiStatus === 'degraded' ? 'DEGRADED (DB DISCONNECTED)' : 
           apiStatus === 'offline' ? 'OFFLINE' : 'Checking...'}
        </div>

        {/* User Auth Info / Logout */}
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#F1F5F9',
              padding: '5px 10px',
              borderRadius: '6px'
            }}>
              <User size={14} />
              {user.displayName || user.email?.split('@')[0] || 'User'}
              {isDevAuth && <span style={{ fontSize: '10px', color: '#D97706', marginLeft: '4px' }}>(DEV)</span>}
            </span>
            <button
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: 'transparent',
                border: '1px solid #CBD5E1',
                color: '#64748B',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link
              to="/login"
              style={{
                color: '#1F4FD8',
                textDecoration: 'none',
                padding: '6px 12px',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              Sign in
            </Link>
            <Link
              to="/app"
              style={{
                backgroundColor: '#1F4FD8',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '14px'
              }}
            >
              Open App
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};
