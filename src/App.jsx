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
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import StaffProfile from './pages/StaffProfile';
import SubcontractorDashboard from './pages/SubcontractorDashboard';
import ClientPortal from './pages/ClientPortal';
import DeliveryDashboard from './pages/DeliveryDashboard';
import HelpGuide from './pages/HelpGuide';
import PresentationPack from './pages/PresentationPack';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { StaffAssistantProvider } from '@/components/StaffAssistantChat';
import { SchedulingAssistantProvider } from '@/components/SchedulingAssistantChat';
import AppBaseUrlSync from '@/components/AppBaseUrlSync';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  const isClientPortalRoute = window.location.pathname.includes('/client-portal/');

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
        <AppBaseUrlSync />
        <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<RouteGuard><AdminDashboard /></RouteGuard>} />
          <Route path="/staff-schedule" element={<RouteGuard><StaffDashboard /></RouteGuard>} />
          <Route path="/staff-profile" element={<RouteGuard><StaffProfile /></RouteGuard>} />
          <Route path="/subcontractor" element={<RouteGuard><SubcontractorDashboard /></RouteGuard>} />
          <Route path="/deliveries" element={<RouteGuard><DeliveryDashboard /></RouteGuard>} />
          <Route path="/help" element={<HelpGuide />} />
          <Route path="/presentation-pack" element={<PresentationPack />} />
        </Route>
        <Route path="/client-portal/:token" element={<ClientPortal />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
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