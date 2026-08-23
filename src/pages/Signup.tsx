import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export const Signup: React.FC = () => {
  const { signUp, isDevAuth, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/app';

  React.useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '85vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E2E8F0',
        padding: '36px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <Link to="/">
            <img src="/image/logo.png" alt="RAAHAT Logo" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'cover' }} />
          </Link>
          <h2 style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '32px',
            fontWeight: 700,
            margin: '8px 0 4px',
            color: '#14171C'
          }}>Create RAAHAT Account</h2>
          <p style={{ color: '#64748B', fontSize: '14px', margin: 0 }}>
            Join the roadside emergency assistance network
          </p>
        </div>

        {isDevAuth && (
          <div style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            color: '#92400E',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '20px',
            lineHeight: 1.4
          }}>
            ⚡ <b>DEV AUTH MODE Active:</b> Firebase keys not configured in <code>.env</code>. Account creation is simulated automatically.
          </div>
        )}

        {error && (
          <div style={{
            backgroundColor: '#FEE2E2',
            border: '1px solid #EF4444',
            color: '#991B1B',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '6px',
                border: '1px solid #CBD5E1',
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: '#1F4FD8',
              color: '#FFFFFF',
              border: 'none',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Creating Account...' : 'Get Started →'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#64748B' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#1F4FD8', fontWeight: 600, textDecoration: 'none' }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
