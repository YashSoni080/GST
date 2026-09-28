import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import Returns from './pages/Returns';
import Purchases from './pages/Purchases';
import ITC from './pages/ITC';
import ITCOptimizer from './pages/ITCOptimizer';
import Parties from './pages/Parties';
import Reconciliation from './pages/Reconciliation';
import AuditRadar from './pages/AuditRadar';
import Notices from './pages/Notices';
import CTCAndEscrow from './pages/CTCAndEscrow';
import AIAssistant from './pages/AIAssistant';
import Calculator from './pages/Calculator';
import CompanySettings from './pages/CompanySettings';
import Reports from './pages/Reports';
import IMSWorkspace from './pages/IMSWorkspace';
import EcommerceRecon from './pages/EcommerceRecon';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="assistant" element={<AIAssistant />} />
            <Route path="calculator" element={<Calculator />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="returns" element={<Returns />} />
            <Route path="purchases" element={<Purchases />} />
            <Route path="recon" element={<Reconciliation />} />
            <Route path="ims" element={<IMSWorkspace />} />
            <Route path="ecommerce" element={<EcommerceRecon />} />
            <Route path="itc-optimizer" element={<ITCOptimizer />} />
            <Route path="itc" element={<ITC />} />
            <Route path="parties" element={<Parties />} />
            <Route path="audit-radar" element={<AuditRadar />} />
            <Route path="notices" element={<Notices />} />
            <Route path="ctc-escrow" element={<CTCAndEscrow />} />
            <Route path="company-settings" element={<CompanySettings />} />
            <Route path="reports" element={<Reports />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
