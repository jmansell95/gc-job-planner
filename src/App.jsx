import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import StaffDashboard from './pages/StaffDashboard';
import StaffProfile from './pages/StaffProfile';
import ClientPortal from './pages/ClientPortal';
import DeliveryDashboard from './pages/DeliveryDashboard';
import HelpGuide from './pages/HelpGuide';
import { StaffAssistantProvider } from '@/components/StaffAssistantChat';
import AppBaseUrlSync from '@/components/AppBaseUrlSync';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  const isClientPortalRoute = window.location.pathname.includes('/client-portal/');

  // Skip auth checks for public client portal routes
  if (!isClientPortalRoute && (isLoadingPublicSettings || isLoadingAuth)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors (skip for public client portal)
  if (!isClientPortalRoute && authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <StaffAssistantProvider>
      <AppBaseUrlSync />
      <Routes>
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/staff-schedule" element={<StaffDashboard />} />
          <Route path="/staff-profile" element={<StaffProfile />} />
          <Route path="/deliveries" element={<DeliveryDashboard />} />
          <Route path="/help" element={<HelpGuide />} />
        </Route>
        <Route path="/client-portal/:token" element={<ClientPortal />} />
        <Route path="*" element={<PageNotFound />} />
      </Routes>
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