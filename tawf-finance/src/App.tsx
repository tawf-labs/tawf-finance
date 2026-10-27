import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { Web3Provider } from '@/components/web3/Web3Provider';
import { Navigation, Footer, DashboardLayout } from './components/layout';
import {
  Home,
  Contact,
  Earn,
  About,
  HowItWorks,
  Glossary,
  Instruments,
  ProofOfReserve,
  Login,
  Register,
  Onboarding,
  InvestorDashboard,
  InvestorPools,
  Portfolio,
  Transactions,
  Impact,
  InvestorSettings,
  InvestorDeposito,
  InvestorScf,
  AdminDashboard,
  AdminUsers,
  AdminInvestments,
  AdminPools,
  AdminCompliance,
  AdminSettings,
  AdminTokenization,
  AdminScfOnboarding,
  OwnerOps,
} from './components/pages';
import { RouteErrorBoundary } from '@/components/ErrorBoundary';
import { ComingSoon } from '@/components/ComingSoon';
import { FINANCING_POOL_ENABLED, FINANCING_POOL_SOON } from '@/config/features';
import { useAuth } from '@/hooks/useAuth';

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-tawf-sand flex items-center justify-center">
        <div className="text-tawf-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const location = useLocation();
  const isAppHost = window.location.hostname === 'app.tawf.finance';
  const isDashboardPage = location.pathname.includes('/investor') ||
                          location.pathname.includes('/issuer') ||
                          location.pathname.includes('/admin');

  return (
    <>
      {!isAppHost && <Navigation />}

      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/instruments" element={<Instruments />} />
          <Route path="/proof-of-reserve" element={<ProofOfReserve />} />
          <Route path="/glossary" element={<Glossary />} />

          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <Onboarding />
              </ProtectedRoute>
            }
          />

          {/* Investor Dashboard Routes */}
          <Route
            path="/investor/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<InvestorDashboard />} />
            <Route path="pools" element={FINANCING_POOL_ENABLED ? <InvestorPools /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="deposito" element={<InvestorDeposito />} />
            <Route path="sukuk" element={<Navigate to="/investor/deposito" replace />} />
            <Route path="scf" element={<InvestorScf />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="impact" element={FINANCING_POOL_ENABLED ? <Impact /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="settings" element={<InvestorSettings />} />
            <Route index element={<Navigate to="/investor/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/investor/dashboard" replace />} />
          </Route>

          {/* Issuer (Licensed Sekuritas) Routes */}
          <Route
            path="/issuer/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="ops" element={FINANCING_POOL_ENABLED ? <OwnerOps /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route index element={<Navigate to="/issuer/ops" replace />} />
            <Route path="*" element={<Navigate to="/issuer/ops" replace />} />
          </Route>

          {/* Admin Dashboard Routes */}
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="investments" element={FINANCING_POOL_ENABLED ? <AdminInvestments /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="pools" element={FINANCING_POOL_ENABLED ? <AdminPools /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="tokenization" element={<AdminTokenization />} />
            <Route path="scf" element={<AdminScfOnboarding />} />
            <Route path="compliance" element={<AdminCompliance />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="ops" element={FINANCING_POOL_ENABLED ? <OwnerOps /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="protocol-ops" element={<Navigate to="/admin/ops" replace />} />
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
          </Route>

          {/* Default redirect for unmatched dashboard routes */}
          <Route
            path="/dashboard"
            element={<Navigate to="/investor/dashboard" replace />}
          />
        </Routes>
      </main>

      {/* Footer, only shown on non-dashboard pages */}
      {!isDashboardPage && <Footer />}
    </>
  );
}

function App() {
  return (
    <Web3Provider>
      <AuthProvider>
        <RouteErrorBoundary>
          <AppContent />
        </RouteErrorBoundary>
      </AuthProvider>
    </Web3Provider>
  );
}

export default App;
