import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { WalletProvider } from '@/components/solana/WalletProvider';
import { Navigation, Footer, DashboardLayout } from './components/layout';
import {
  Home,
  Contact,
  Earn,
  About,
  HowItWorks,
  Glossary,
  Login,
  Register,
  Onboarding,
  InvestorDashboard,
  InvestorPools,
  Portfolio,
  Transactions,
  Impact,
  InvestorSettings,
  VendorDashboard,
  Services,
  Partnerships,
  Compliance,
  VendorSettings,
  CooperativeDashboard,
  Verification,
  Businesses,
  Deals,
  Members,
  CooperativeSettings as CooperativeSettings,
  BusinessDashboard,
  PurchaseOrders,
  Funding,
  Fulfillment,
  Performance,
  BusinessSettings,
  AdminDashboard,
  AdminUsers,
  AdminInvestments,
  AdminPools,
  AdminCompliance,
  AdminSettings,
} from './components/pages';
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
  const isDashboardPage = location.pathname.includes('/investor') ||
                          location.pathname.includes('/vendor') ||
                          location.pathname.includes('/cooperative') ||
                          location.pathname.includes('/business') ||
                          location.pathname.includes('/admin');

  return (
    <>
      <Navigation />

      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/earn" element={<Earn />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/about" element={<About />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
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
            <Route path="pools" element={<InvestorPools />} />
            <Route path="portfolio" element={<Portfolio />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="impact" element={<Impact />} />
            <Route path="settings" element={<InvestorSettings />} />
          </Route>

          {/* Vendor Dashboard Routes */}
          <Route
            path="/vendor/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<VendorDashboard />} />
            <Route path="services" element={<Services />} />
            <Route path="partnerships" element={<Partnerships />} />
            <Route path="compliance" element={<Compliance />} />
            <Route path="settings" element={<VendorSettings />} />
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
            <Route path="dashboard" element={<CooperativeDashboard />} />
            <Route path="verification" element={<Verification />} />
            <Route path="businesses" element={<Businesses />} />
            <Route path="deals" element={<Deals />} />
            <Route path="members" element={<Members />} />
            <Route path="settings" element={<CooperativeSettings />} />
          </Route>

          {/* Business Dashboard Routes */}
          <Route
            path="/business/*"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route path="dashboard" element={<BusinessDashboard />} />
            <Route path="purchase-orders" element={<PurchaseOrders />} />
            <Route path="funding" element={<Funding />} />
            <Route path="fulfillment" element={<Fulfillment />} />
            <Route path="performance" element={<Performance />} />
            <Route path="settings" element={<BusinessSettings />} />
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
            <Route path="pools" element={<AdminPools />} />
            <Route path="compliance" element={<AdminCompliance />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Default redirect for unmatched dashboard routes */}
          <Route
            path="/dashboard"
            element={<Navigate to="/investor/dashboard" replace />}
          />
        </Routes>
      </main>

      {/* Footer - only show on non-dashboard pages */}
      {!isDashboardPage && <Footer />}
    </>
  );
}

function App() {
  return (
    <WalletProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </WalletProvider>
  );
}

export default App;
