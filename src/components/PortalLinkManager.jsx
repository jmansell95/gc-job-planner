import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Link2, Copy, Check, ExternalLink, Eye, EyeOff } from 'lucide-react';

export default function PortalLinkManager({ job }) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [portalToken, setPortalToken] = useState(job.portal_token || null);
  const [portalEnabled, setPortalEnabled] = useState(job.portal_enabled || false);
  const queryClient = useQueryClient();

  const portalUrl = portalToken
    ? `${window.location.origin}/client-portal/${portalToken}`
    : null;

  const generateToken = () => {
    return 'cl_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };

  const handleEnable = async () => {
    setToggling(true);
    try {
      const token = portalToken || generateToken();
      await base44.entities.Job.update(job.id, {
        portal_token: token,
        portal_enabled: true
      });
      setPortalToken(token);
      setPortalEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error enabling portal:', error);
    }
    setToggling(false);
  };

  const handleDisable = async () => {
    setToggling(true);
    try {
      await base44.entities.Job.update(job.id, { portal_enabled: false });
      setPortalEnabled(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error disabling portal:', error);
    }
    setToggling(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Client Portal Access</h2>
      </div>
      <div className="px-5 py-4">
        {portalUrl && portalEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3">
              <span className="text-xs text-slate-500 font-mono truncate flex-1">{portalUrl}</span>
              <button onClick={handleCopy}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition flex-shrink-0">
                {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
              </button>
            </div>
            <div className="flex gap-2">
              <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                <ExternalLink className="w-3.5 h-3.5" /> Preview Portal
              </a>
              <button onClick={handleDisable} disabled={toggling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50">
                <EyeOff className="w-3.5 h-3.5" /> Disable Access
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Generate a secure link for your client to view live job progress, schedule, and status — no login required.</p>
            <button onClick={handleEnable} disabled={toggling}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
              <Eye className="w-4 h-4" /> {toggling ? 'Enabling...' : 'Enable Client Portal'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}