import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { NearbyServices } from './pages/NearbyServices';
import { RoutePlanner } from './pages/RoutePlanner';
/**
 * Inner layout that conditionally renders the app Navbar.
 * Landing, Login, and Signup manage their own nav — the app
 * Navbar only appears on protected routes.
 */
const AppLayout: React.FC = () => {
  const location = useLocation();
  const protectedPrefixes = ['/app', '/nearby', '/route'];
  const showAppNav = protectedPrefixes.some(p => location.pathname.startsWith(p));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#FFFFFF', color: '#0F172A', display: 'flex', flexDirection: 'column' }}>
      {showAppNav && <Navbar />}
      <main style={{ flex: 1, overflow: location.pathname === '/app' ? 'hidden' : 'auto', minHeight: 0 }}>
        <Routes>
          {/* Public Marketing Landing Page */}
          <Route path="/" element={<Landing />} />
          
          {/* Public Authentication Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected App Routes */}
          <Route path="/app" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/nearby" element={
            <ProtectedRoute>
              <NearbyServices />
            </ProtectedRoute>
          } />
          <Route path="/route" element={
            <ProtectedRoute>
              <RoutePlanner />
            </ProtectedRoute>
          } />

          {/* Catch-all redirect to Landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
