import React, { createContext, useContext, useState, useCallback } from 'react';
import GlobalScannerOverlay from '@/components/GlobalScannerOverlay';

const GlobalScannerContext = createContext(null);

/**
 * GlobalScannerProvider — wraps the app so any component can open the
 * full-screen camera scanner via `useGlobalScanner().openScanner()`.
 *
 * The scanner overlays the current page; closing it returns to whatever
 * the user was doing. Supports a `mode` option ('pat' for the PAT console)
 * to show PAT-specific action buttons in the scan result popup.
 */
export function GlobalScannerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('global');

  const openScanner = useCallback((opts = {}) => {
    setMode(opts.mode || 'global');
    setIsOpen(true);
  }, []);

  const closeScanner = useCallback(() => {
    setIsOpen(false);
    setMode('global');
  }, []);

  return (
    <GlobalScannerContext.Provider value={{ openScanner, closeScanner, isOpen, mode }}>
      {children}
      {isOpen && <GlobalScannerOverlay mode={mode} onClose={closeScanner} />}
    </GlobalScannerContext.Provider>
  );
}

export function useGlobalScanner() {
  const ctx = useContext(GlobalScannerContext);
  if (!ctx) return { openScanner: () => {}, closeScanner: () => {}, isOpen: false, mode: 'global' };
  return ctx;
}