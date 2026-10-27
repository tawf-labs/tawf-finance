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
  CooperativeDashboard,
  Verification,
  Businesses,
  Deals,
  Members,
  CooperativeSettings as CooperativeSettings,
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
                          location.pathname.includes('/cooperative') ||
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
          </Route>

          {/* Cooperative Dashboard Routes */}
          <Route
            path="/cooperative/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={FINANCING_POOL_ENABLED ? <CooperativeDashboard /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="verification" element={FINANCING_POOL_ENABLED ? <Verification /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="businesses" element={FINANCING_POOL_ENABLED ? <Businesses /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="deals" element={FINANCING_POOL_ENABLED ? <Deals /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="members" element={FINANCING_POOL_ENABLED ? <Members /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="settings" element={FINANCING_POOL_ENABLED ? <CooperativeSettings /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
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
            <Route path="investments" element={<AdminInvestments />} />
            <Route path="pools" element={FINANCING_POOL_ENABLED ? <AdminPools /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
            <Route path="tokenization" element={<AdminTokenization />} />
            <Route path="scf" element={<AdminScfOnboarding />} />
            <Route path="compliance" element={<AdminCompliance />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="ops" element={FINANCING_POOL_ENABLED ? <OwnerOps /> : <ComingSoon {...FINANCING_POOL_SOON} />} />
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
