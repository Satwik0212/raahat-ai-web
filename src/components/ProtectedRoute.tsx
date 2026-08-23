import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
        fontFamily: 'Inter, sans-serif',
        color: '#64748B'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '2rem',
            marginBottom: '12px',
            animation: 'pulse 1.5s infinite'
          }}>🚑</div>
          <div>Loading RAAHAT Secure Session...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
