import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { FileBarChart, Loader2 } from 'lucide-react';

export default function BillingExportButton({ jobId, jobName }) {
  const [generating, setGenerating] = useState(false);

  const handleExport = async () => {
    setGenerating(true);
    try {
      const res = await base44.functions.invoke('generateJobReport', { jobId });
      const win = window.open('', '_blank');
      win.document.write(res.data.html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 500);
    } catch (err) {
      console.error('Billing export error:', err);
    }
    setGenerating(false);
  };

  return (
    <button
      onClick={handleExport}
      disabled={generating}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-700 to-teal-700 text-white rounded-xl font-semibold text-sm hover:from-emerald-800 hover:to-teal-800 transition disabled:opacity-50 shadow-sm"
    >
      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileBarChart className="w-4 h-4" />}
      {generating ? 'Generating billing report…' : 'Download Billing Report'}
    </button>
  );
}