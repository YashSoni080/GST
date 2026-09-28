import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        if (!name.trim() || !companyName.trim()) {
          setError('Please provide your name and company name');
          setLoading(false);
          return;
        }
        await register({ name, email, password, companyName });
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || (isRegister ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="brand">
            <div className="logo">G</div>
            <div>
              <div className="name">GST Manager</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Next-Gen Enterprise Platform</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 0',
              fontWeight: 600,
              fontSize: 13,
              background: 'none',
              border: 'none',
              borderBottom: !isRegister ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
              color: !isRegister ? 'var(--primary, #2563eb)' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            style={{
              flex: 1,
              padding: '8px 0',
              fontWeight: 600,
              fontSize: 13,
              background: 'none',
              border: 'none',
              borderBottom: isRegister ? '2px solid var(--primary, #2563eb)' : '2px solid transparent',
              color: isRegister ? 'var(--primary, #2563eb)' : '#64748b',
              cursor: 'pointer',
            }}
          >
            Create Account
          </button>
        </div>

        <h2>{isRegister ? 'Register Enterprise' : 'Sign in'}</h2>
        <p className="sub">
          {isRegister
            ? 'Set up your company workspace and GSTIN profile'
            : 'Access your GST compliance and filing dashboard'}
        </p>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <>
              <div className="form-group">
                <label className="input-label">Your Name</label>
                <input
                  className="input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rajesh Sharma"
                  required
                />
              </div>
              <div className="form-group">
                <label className="input-label">Enterprise / Company Name</label>
                <input
                  className="input"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Industries Pvt. Ltd."
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label className="input-label">Work Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="input-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
              required
            />
          </div>

          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} disabled={loading}>
            {loading ? (isRegister ? 'Creating Workspace...' : 'Signing in...') : (isRegister ? 'Create Enterprise Account' : 'Sign In')}
          </button>

          <div style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: '#64748b' }}>
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(false); setError(''); }}
                  style={{ color: 'var(--primary, #2563eb)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign In
                </button>
              </>
            ) : (
              <>
                New to GST Manager?{' '}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(''); }}
                  style={{ color: 'var(--primary, #2563eb)', background: 'none', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                >
                  Create an account
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
