import { useState, useEffect } from 'react';
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

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [title, sub] = PAGE_META[location.pathname] || ['GST Manager (2026 Edition)', ''];
  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';

  const companyGstins = user?.company?.gstins || [];
  const dynamicBranches = companyGstins.length > 0
    ? [
        ...companyGstins.map(g => ({
          gstin: g.gstin,
          label: `${g.gstin} (${g.tradeName || g.state || 'Branch'})`,
          state: g.state,
        })),
        { gstin: 'ALL', label: '🌐 All Branches (Consolidated)', state: 'Pan-India' },
      ]
    : [
        { gstin: 'DEFAULT', label: user?.company?.name || 'Primary Corporate Unit', state: 'Head Office' }
      ];

  const [activeBranch, setActiveBranch] = useState(() => {
    return localStorage.getItem('gst_active_branch') || (companyGstins[0]?.gstin || 'ALL');
  });

  const handleBranchChange = (e) => {
    const val = e.target.value;
    setActiveBranch(val);
    localStorage.setItem('gst_active_branch', val);
  };

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return false;
    }
    const saved = localStorage.getItem('gst_sidebar_open');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      const next = !prev;
      localStorage.setItem('gst_sidebar_open', String(next));
      return next;
    });
  };

  // Close sidebar on mobile navigation
  useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="main-layout">
      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
        <div className="brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="logo">G</div>
            <div>
              <div className="name">GST Manager</div>
              <div className="sub">2026 Enterprise Edition</div>
            </div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={toggleSidebar}
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
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
        </div>

        <div className="sidebar-footer">
          <div><strong>{user?.name}</strong></div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{user?.role?.toUpperCase()} · {user?.company?.name || 'Enterprise'}</div>
          <button className="link" onClick={logout} style={{ background: 'none', border: 'none', marginTop: 6, color: '#f87171' }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className={`main ${!sidebarOpen ? 'expanded' : ''}`}>
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
              aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
              <span>{sidebarOpen ? 'Hide' : 'Menu'}</span>
            </button>
            <div>
              <h1>{title}</h1>
              <div className="sub">{sub}</div>
            </div>
          </div>
          <div className="company" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13 }} title="Multi-GSTIN Branch Switcher">🏢</span>
              <select
                value={activeBranch}
                onChange={handleBranchChange}
                aria-label="Multi-GSTIN Corporate Portal Switcher"
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#1e293b',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {dynamicBranches.map(b => (
                  <option key={b.gstin} value={b.gstin}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="avatar">{initials}</div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>FY 2025-26</div>
            </div>
          </div>
        </div>

        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
