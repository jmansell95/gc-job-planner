import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import RouteGuard from '@/components/RouteGuard';
import AppLayout from '@/components/AppLayout';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import StaffProfile from './pages/StaffProfile';
import SubcontractorDashboard from './pages/SubcontractorDashboard';
import ClientPortal from './pages/ClientPortal';
import DeliveryDashboard from './pages/DeliveryDashboard';
import AdminDeliveryHub from './pages/AdminDeliveryHub';
import HelpGuide from './pages/HelpGuide';
import PresentationPack from './pages/PresentationPack';
import AssetHub from './pages/AssetHub';
import KeyLogBookDocs from './pages/KeyLogBookDocs';
import ImprovementRoadmap from './pages/ImprovementRoadmap';
import Microsoft365SetupGuide from './pages/Microsoft365SetupGuide';
import PATTestingConsole from './pages/PATTestingConsole';
import CompliancePage from './pages/CompliancePage';
import BillingPage from './pages/BillingPage';
import StaffPage from './pages/StaffPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthConsent from './pages/OAuthConsent';
import SubcontractorOnboarding from './pages/SubcontractorOnboarding';
import { StaffAssistantProvider } from '@/components/StaffAssistantChat';
import { SchedulingAssistantProvider } from '@/components/SchedulingAssistantChat';
import { DrillingIntelligenceProvider } from '@/components/DrillingIntelligenceChat';
import AppBaseUrlSync from '@/components/AppBaseUrlSync';
import AssetScannerPage from './pages/AssetScannerPage';
import KioskScannerRedirect from '@/components/KioskScannerRedirect';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  const isClientPortalRoute = window.location.pathname.includes('/client-portal/') || window.location.pathname.includes('/subcontractor-onboarding/');

  // Skip auth checks for public client portal routes
  if (!isClientPortalRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle "user not registered" error (skip for public client portal).
  // auth_required is handled by ProtectedRoute redirecting to /login, NOT by a
  // hard redirect during render (which caused the refresh loop on publish).
  if (!isClientPortalRoute && authError && authError.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Render the main app
  return (
    <StaffAssistantProvider>
      <SchedulingAssistantProvider>
        <DrillingIntelligenceProvider>
        <AppBaseUrlSync />
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/" element={<KioskScannerRedirect><Home /></KioskScannerRedirect>} />
          <Route path="/scanner" element={<RouteGuard><AssetScannerPage /></RouteGuard>} />
          <Route path="/admin" element={<RouteGuard><AdminDashboard /></RouteGuard>} />
          {/* Staff pages — full-screen, no admin header bar; they render their own mobile-first headers */}
          <Route path="/staff-schedule" element={<RouteGuard><StaffDashboard /></RouteGuard>} />
          <Route path="/staff-profile" element={<RouteGuard><StaffProfile /></RouteGuard>} />
          <Route path="/deliveries" element={<RouteGuard><DeliveryDashboard /></RouteGuard>} />
          <Route path="/help" element={<HelpGuide />} />
          <Route element={<AppLayout />}>
            <Route path="/subcontractor" element={<RouteGuard><SubcontractorDashboard /></RouteGuard>} />
            <Route path="/admin/logistics" element={<RouteGuard><AdminDeliveryHub /></RouteGuard>} />
            <Route path="/presentation-pack" element={<PresentationPack />} />

            <Route path="/pat-testing" element={<RouteGuard><PATTestingConsole /></RouteGuard>} />
            <Route path="/compliance" element={<RouteGuard><CompliancePage /></RouteGuard>} />
            <Route path="/billing" element={<RouteGuard><BillingPage /></RouteGuard>} />
            <Route path="/staff" element={<RouteGuard><StaffPage /></RouteGuard>} />
            <Route path="/safety" element={<Navigate to="/compliance" replace />} />
            <Route path="/assets" element={<RouteGuard><AssetHub /></RouteGuard>} />
            <Route path="/timesheets" element={<Navigate to="/staff" replace />} />
            <Route path="/contacts" element={<Navigate to="/staff" replace />} />
            <Route path="/audit" element={<Navigate to="/compliance" replace />} />
            <Route path="/price-list" element={<Navigate to="/billing" replace />} />
            <Route path="/reports" element={<Navigate to="/billing" replace />} />
            <Route path="/vehicles" element={<Navigate to="/assets" replace />} />
            <Route path="/import" element={<Navigate to="/admin" replace />} />
            <Route path="/automations" element={<Navigate to="/admin" replace />} />
            <Route path="/keylogbook-docs" element={<RouteGuard><KeyLogBookDocs /></RouteGuard>} />
            <Route path="/roadmap" element={<RouteGuard><ImprovementRoadmap /></RouteGuard>} />
            <Route path="/m365-setup-guide" element={<RouteGuard><Microsoft365SetupGuide /></RouteGuard>} />
          </Route>
          <Route path="/rig-hub" element={<Navigate to="/assets" replace />} />
          <Route path="/asset-inventory" element={<Navigate to="/assets" replace />} />
        </Route>
        <Route path="/client-portal/:token" element={<ClientPortal />} />
        <Route path="/subcontractor-onboarding/:token" element={<SubcontractorOnboarding />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
        </DrillingIntelligenceProvider>
      </SchedulingAssistantProvider>
    </StaffAssistantProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App