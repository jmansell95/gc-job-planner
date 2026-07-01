import React, { useState } from 'react';
import { Printer } from 'lucide-react';

/**
 * A print button that opens a new window with the provided HTML content styled for printing.
 * Pass `buildHtml` — a function that returns an HTML string — called on click.
 */
export default function PrintReportButton({ buildHtml, label = 'Print Report', className = '' }) {
  const [loading, setLoading] = useState(false);

  const handlePrint = () => {
    setLoading(true);
    try {
      const html = buildHtml();
      const win = window.open('', '_blank');
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        setLoading(false);
      }, 400);
    } catch (err) {
      console.error('Print error', err);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePrint}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium disabled:opacity-50 ${className}`}
    >
      <Printer className="w-4 h-4" />
      {loading ? 'Preparing...' : label}
    </button>
  );
}