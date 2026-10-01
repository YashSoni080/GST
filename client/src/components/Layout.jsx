import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { section: 'Overview' },
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/assistant', label: 'AI Tax Copilot', icon: '🤖' },
  { to: '/calculator', label: 'GST Calculator', icon: '🧮' },

  { section: 'Operations (Tiers 1 & 2)' },
  { to: '/invoices', label: 'E-Invoices', icon: '🧾' },
  { to: '/purchases', label: 'Purchases & IDP', icon: '🛒' },
  { to: '/returns', label: 'GSTR Filing', icon: '🗂️' },
  { to: '/parties', label: 'Parties & GSTIN', icon: '👥' },

  { section: 'Reconciliation & ITC' },
  { to: '/recon', label: 'GSTR-2B Recon', icon: '⚖️' },
  { to: '/ims', label: 'IMS Workspace', icon: '📥' },
  { to: '/ecommerce', label: 'E-Commerce Recon', icon: '🛍️' },
  { to: '/itc-optimizer', label: 'ITC Optimizer', icon: '⚡' },
  { to: '/itc', label: 'ITC Ledger', icon: '♻️' },

  { section: 'Governance & Next-Gen' },
  { to: '/audit-radar', label: 'Audit Radar & Risk', icon: '🎯' },
  { to: '/notices', label: 'Notices & DRC-03', icon: '📜' },
  { to: '/ctc-escrow', label: 'CTC & Smart Escrow', icon: '🛡️' },

  { section: 'Settings' },
  { to: '/company-settings', label: 'Company & ERP', icon: '⚙️' },
  { to: '/reports', label: 'Reports', icon: '📈' },
];

const PAGE_META = {
  '/': ['Executive Dashboard', 'Overview of enterprise GST compliance, revenue & filing status'],
  '/assistant': ['Conversational Compliance Copilot', 'Natural language intelligence for CFOs and tax managers (Section 5.2)'],
  '/calculator': ['GST Calculator', 'Add or extract GST with rate slabs, intra/inter-state split, round-off & keypad'],
  '/invoices': ['E-Invoicing & Billing Engine', 'Generate, validate, push to IRP, print Rule 46 invoices & dynamic QR (Section 2.2 & 3.1)'],
  '/purchases': ['Purchase Register & Intelligent Document Processing', 'Autonomous invoice OCR parsing, Section 17(5) blocking & payment tracking (Section 4.1)'],
  '/returns': ['Statutory Returns Filing & GSTR-9 Builder', 'Automated GSTR-1, GSTR-3B compilation, JSON payload export & EVC filing (Section 2.3 & 4.3)'],
  '/parties': ['Dynamic Vendor & Customer Master', 'Instant GSTIN lookup, verified taxpayer registry & compliance scoring (Section 2.1)'],
  '/recon': ['Automated GSTR-2B Reconciliation', '4-way rule-based matching, action triggers & supplier discrepancy alerts (Section 3.3 & 3.4)'],
  '/ims': ['Native IMS Workspace', 'Rule 36(4) inward supply management, bulk accept/reject & 14th-of-month GSTN sync'],
  '/ecommerce': ['Omnichannel E-Commerce Reconciler', 'Amazon, Flipkart, Blinkit MTR reports, Section 52 TCS & GSTR-8 matching'],
  '/itc-optimizer': ['Dynamic Rule-Based ITC Optimization', 'Credit utilization matrix set-off, Rule 37 180-day tracker & Section 17(5) (Section 4.2)'],
  '/itc': ['Input Tax Credit Ledger', 'Availed, utilized, refunds & provisional credit ledger balances'],
  '/audit-radar': ['Predictive Audit Radar & Risk Scoring', 'Simulated tax department risk radar, circular trading heuristics & supplier grading (Section 4.5)'],
  '/notices': ['Automated Notice Management & DRC Compliance', 'ASMT-10 / DRC-01 lifecycle, AI legal response drafting & DRC-03 voluntary ledger (Section 4.4)'],
  '/ctc-escrow': ['Continuous Transaction Control & Smart Escrow', 'Pre-procurement CTC clearance & GST split-payment protection rail (Section 5.1 & 5.3)'],
  '/company-settings': ['Multi-GSTIN & ERP Connectors', 'Multi-state branch management, Tally/Zoho/SAP integration & bulk import (Section 2.1 & 3.2)'],
  '/reports': ['HSN & Tax Collections Report', 'Turnover analytics, HSN sales breakdown & rate-wise distribution'],
};

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', onChange);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isMobile;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [title, sub] = PAGE_META[location.pathname] || ['GST Manager (2026 Edition)', ''];
  const initials =
    user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const companyGstins = user?.company?.gstins || [];
  const dynamicBranches =
    companyGstins.length > 0
      ? [
          ...companyGstins.map((g) => ({
            gstin: g.gstin,
            label: `${g.gstin} (${g.tradeName || g.state || 'Branch'})`,
            state: g.state,
          })),
          { gstin: 'ALL', label: '🌐 All Branches (Consolidated)', state: 'Pan-India' },
        ]
      : [{ gstin: 'DEFAULT', label: user?.company?.name || 'Primary Corporate Unit', state: 'Head Office' }];

  const [activeBranch, setActiveBranch] = useState(
    () => localStorage.getItem('gst_active_branch') || companyGstins[0]?.gstin || 'ALL',
  );
  const handleBranchChange = (e) => {
    setActiveBranch(e.target.value);
    localStorage.setItem('gst_active_branch', e.target.value);
  };

  // desktop: 'full' | 'rail' — mobile: drawer open/closed
  const [rail, setRail] = useState(() => {
    const savedMode = localStorage.getItem('gst_sidebar_mode');
    if (savedMode) return savedMode === 'rail';
    const savedOpen = localStorage.getItem('gst_sidebar_open');
    return savedOpen !== null ? savedOpen !== 'true' : false;
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const sidebarOpen = isMobile ? drawerOpen : !rail;

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerOpen((v) => !v);
      return;
    }
    setRail((prev) => {
      const next = !prev;
      localStorage.setItem('gst_sidebar_mode', next ? 'rail' : 'full');
      localStorage.setItem('gst_sidebar_open', String(!next));
      return next;
    });
  };

  // close drawer + menu on navigation
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  // keep the active nav item visible inside the sidebar list
  useEffect(() => {
    const nav = document.querySelector('.nav-scroll');
    const item = nav?.querySelector('.nav-item.active');
    if (!nav || !item) return;
    const nr = nav.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    if (ir.top < nr.top + 8) nav.scrollTop -= nr.top + 8 - ir.top;
    else if (ir.bottom > nr.bottom - 8) nav.scrollTop += ir.bottom - nr.bottom + 8;
  }, [location.pathname]);

  // close the user menu on outside click / Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const mainClass = isMobile
    ? 'main'
    : rail
      ? 'main rail-offset'
      : 'main';

  return (
    <div className="main-layout">
      {isMobile && drawerOpen && (
        <div className="sidebar-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />
      )}

      <aside
        className={[
          'sidebar',
          isMobile ? (drawerOpen ? '' : 'collapsed') : rail ? 'rail' : '',
        ].join(' ').trim()}
        aria-label="Primary"
      >
        <div className="brand">
          <div className="brand-lockup">
            <div className="logo" aria-hidden="true">G</div>
            <div>
              <div className="name">GST Manager</div>
              <div className="sub">2026 Enterprise Edition</div>
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={toggleSidebar}
            title={isMobile ? 'Close menu' : 'Collapse sidebar'}
            aria-label={isMobile ? 'Close menu' : 'Collapse sidebar'}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="nav-scroll" aria-label="Main navigation">
          {NAV_ITEMS.map((item, i) =>
            item.section ? (
              <div key={`s-${i}`} className="nav-label">{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={!sidebarOpen || rail ? item.label : undefined}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="icon" aria-hidden="true">{item.icon}</span>
                <span className="nav-text">{item.label}</span>
              </NavLink>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div className="who">
              <div className="n">{user?.name || 'User'}</div>
              <div className="r">
                {user?.role?.toUpperCase()} · {user?.company?.name || 'Enterprise'}
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className={mainClass} id="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={sidebarOpen}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="16" rx="2.5" />
                <line x1="9" y1="4" x2="9" y2="20" />
              </svg>
              <span className="hidden sm:inline">{sidebarOpen ? 'Collapse' : 'Menu'}</span>
            </button>
            <div style={{ minWidth: 0 }}>
              <h1>{title}</h1>
              <div className="sub">{sub}</div>
            </div>
          </div>

          <div className="topbar-right">
            <div className="branch-picker">
              <span className="bp-icon" aria-hidden="true" title="Multi-GSTIN branch switcher">🏢</span>
              <select
                className="branch-select"
                value={activeBranch}
                onChange={handleBranchChange}
                aria-label="Multi-GSTIN corporate portal switcher"
              >
                {dynamicBranches.map((b) => (
                  <option key={b.gstin} value={b.gstin}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>

            <span className="fy-chip" title="Current financial year">FY 2025-26</span>

            <div className={`user-menu${menuOpen ? ' open' : ''}`} ref={menuRef}>
              <button
                className="user-trigger"
                onClick={() => setMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
              >
                <span className="avatar" aria-hidden="true">{initials}</span>
                <span className="uname">{user?.name || 'User'}</span>
                <svg className="caret" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {menuOpen && (
                <div className="dropdown" role="menu">
                  <div className="dropdown-head">
                    <div className="dn">{user?.name || 'User'}</div>
                    <div className="de">{user?.email || ''}</div>
                  </div>
                  <div className="dropdown-item" role="menuitem" style={{ cursor: 'default' }}>
                    <span aria-hidden="true">🛡️</span>
                    <span>{user?.role === 'admin' ? 'Administrator' : user?.role || 'Member'}</span>
                  </div>
                  <button className="dropdown-item danger" role="menuitem" onClick={logout}>
                    <span aria-hidden="true">⏻</span>
                    <span>Sign out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content page-enter" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
