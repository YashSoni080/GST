import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

export default function Login() {
  const { login, register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (registerMode) => {
    setIsRegister(registerMode);
    setError('');
  };

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
        toast.success('Workspace created', 'Welcome aboard — your GST workspace is ready.');
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
      <section className="login-hero" aria-hidden="true">
        <div className="hero-brand">
          <div className="logo">G</div>
          <div>
            <div className="name">GST Manager</div>
            <div className="sub">2026 Enterprise Edition</div>
          </div>
        </div>

        <div>
          <h1 className="hero-headline">
            Compliance, credits and cash flow — <em>in one control room</em>.
          </h1>
          <p className="hero-copy">
            Rule 46 invoicing, 1-click GSTR-1/3B filing, e-Invoicing & e-Way bills, 4-way 2B
            reconciliation and a predictive audit radar built for the 2026 GST landscape.
          </p>

          <div className="hero-features">
            <div className="hero-feature">
              <span className="hf-icon">⚡</span>
              <span>Real-time IRN &amp; e-Way bill generation with signed QR stamping</span>
            </div>
            <div className="hero-feature">
              <span className="hf-icon">⚖️</span>
              <span>Automated GSTR-2B reconciliation with vendor discrepancy mailers</span>
            </div>
            <div className="hero-feature">
              <span className="hf-icon">🤖</span>
              <span>Conversational tax copilot that answers from your live ledgers</span>
            </div>
          </div>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hv">4</div>
            <div className="hl">Compliance tiers</div>
          </div>
          <div className="hero-stat">
            <div className="hv">30</div>
            <div className="hl">Automated checks</div>
          </div>
          <div className="hero-stat">
            <div className="hv">24×7</div>
            <div className="hl">Audit trail</div>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-mobile-brand">
            <div className="logo">G</div>
            <div>
              <div className="name">GST Manager</div>
              <div className="sub">2026 Enterprise Edition</div>
            </div>
          </div>

          <h2>{isRegister ? 'Create your workspace' : 'Welcome back'}</h2>
          <p className="sub">
            {isRegister
              ? 'Set up your company workspace and GSTIN profile'
              : 'Sign in to your GST compliance control room'}
          </p>

          <div className="login-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegister}
              className={!isRegister ? 'active' : ''}
              onClick={() => switchMode(false)}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegister}
              className={isRegister ? 'active' : ''}
              onClick={() => switchMode(true)}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="error-msg" role="alert">
              <span aria-hidden="true">⚠</span>
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate={false}>
            {isRegister && (
              <>
                <div className="form-group">
                  <label className="input-label" htmlFor="login-name">Your Name</label>
                  <input
                    id="login-name"
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    autoComplete="name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="input-label" htmlFor="login-company">Enterprise / Company Name</label>
                  <input
                    id="login-company"
                    className="input"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Industries Pvt. Ltd."
                    autoComplete="organization"
                    required
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label className="input-label" htmlFor="login-email">Work Email</label>
              <input
                id="login-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="form-group">
              <label className="input-label" htmlFor="login-password">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  className="input pr-11"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-8 grid place-items-center rounded-md text-[11px] font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {showPassword ? 'HIDE' : 'SHOW'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn login-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner sm" aria-hidden="true" />
                  {isRegister ? 'Creating workspace…' : 'Signing in…'}
                </>
              ) : isRegister ? (
                'Create Enterprise Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-foot">
            {isRegister ? (
              <>
                Already have an account?{' '}
                <button type="button" className="link" onClick={() => switchMode(false)}>
                  Sign in
                </button>
              </>
            ) : (
              <>
                New to GST Manager?{' '}
                <button type="button" className="link" onClick={() => switchMode(true)}>
                  Create an account
                </button>
              </>
            )}
          </div>

          {!isRegister && (
            <div className="login-hint">
              Demo credentials · <code>admin@greenshine.com</code> / <code>admin123</code>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
