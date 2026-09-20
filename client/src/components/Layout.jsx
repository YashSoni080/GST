import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { section: 'Overview' },
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/invoices', label: 'E-Invoices', icon: '🧾' },
  { to: '/returns', label: 'GSTR Filing', icon: '🗂️' },
  { section: 'Manage' },
  { to: '/purchases', label: 'Purchases', icon: '🛒' },
  { to: '/itc', label: 'ITC Ledger', icon: '♻️' },
  { to: '/parties', label: 'Parties', icon: '👥' },
  { to: '/reports', label: 'Reports', icon: '📈' },
];

const PAGE_META = {
  '/': ['Dashboard', 'Overview of your GST compliance'],
  '/invoices': ['E-Invoices', 'Generate, validate & push invoices to the IRP'],
  '/returns': ['GSTR Filing', 'GSTR-1 & GSTR-3B management'],
  '/purchases': ['Purchases', 'Purchase register & ITC eligibility review'],
  '/itc': ['ITC Ledger', 'Input tax credit availed, utilized & refunds'],
  '/parties': ['Parties', 'GSTIN master & compliance verification'],
  '/reports': ['Reports', 'HSN-wise sales & GST collections'],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [title, sub] = PAGE_META[location.pathname] || ['GST Manager', ''];
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">G</div>
          <div>
            <div className="name">GST Manager</div>
            <div className="sub">FY {user?.company?.fiscalYear || '2025-26'}</div>
          </div>
        </div>

        {NAV_ITEMS.map((item, i) =>
          item.section ? (
            <div key={i} className="nav-label">{item.section}</div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="icon">{item.icon}</span> {item.label}
            </NavLink>
          )
        )}

        <div className="sidebar-footer">
          <div>{user?.name} · {user?.role}</div>
          <button className="link" onClick={logout} style={{ background: 'none', border: 'none', marginTop: 4 }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <h1>{title}</h1>
            <div className="sub">{sub}</div>
          </div>
          <div className="company">
            <div className="avatar">{initials}</div>
            <span>{user?.name || 'User'}</span>
          </div>
        </div>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
