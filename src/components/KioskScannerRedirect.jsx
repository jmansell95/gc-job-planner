import React from 'react';
import { Navigate } from 'react-router-dom';
import { isKioskScannerMode } from '@/utils/kioskMode';

/**
 * Wraps the home route. When kiosk scanner mode is enabled on this device
 * (localStorage flag set via the Asset Scanner page), the user is redirected
 * straight to the full-screen scanner instead of the admin dashboard.
 */
export default function KioskScannerRedirect({ children }) {
  if (isKioskScannerMode()) {
    return <Navigate to="/scanner" replace />;
  }
  return children;
}