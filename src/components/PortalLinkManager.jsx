import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2, Copy, Check, ExternalLink, Eye, EyeOff, RefreshCw, Mail, MessageCircle, Loader2, Send
} from 'lucide-react';

export default function PortalLinkManager({ job }) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [portalToken, setPortalToken] = useState(job.portal_token || null);
  const [portalEnabled, setPortalEnabled] = useState(job.portal_enabled || false);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const client = clients.find(c => c.id === job.client_id);
  const clientEmail = client?.contact_email || '';

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
      await base44.entities.Job.update(job.id, { portal_token: token, portal_enabled: true });
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

  const handleRegenerate = async () => {
    if (!confirm('Regenerate the portal link?\n\nThe old link will stop working immediately. You\'ll need to share the new link with your client.')) return;
    setRegenerating(true);
    try {
      const token = generateToken();
      await base44.entities.Job.update(job.id, { portal_token: token, portal_enabled: true });
      setPortalToken(token);
      setPortalEnabled(true);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error regenerating token:', error);
    }
    setRegenerating(false);
  };

  const handleEmailLink = async () => {
    if (!clientEmail) {
      setEmailStatus({ type: 'error', msg: 'No client contact email on file. Add one in Clients.' });
      return;
    }
    setEmailSending(true);
    setEmailStatus(null);
    try {
      const body = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
          <div style="background:linear-gradient(135deg,#0e7a4f,#065f46);padding:20px 24px;border-radius:10px 10px 0 0">
            <h2 style="color:#fff;margin:0;font-size:18px">Your project portal is ready</h2>
          </div>
          <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
            <p style="margin:0 0 12px">Hi ${client?.contact_name || ''},</p>
            <p style="margin:0 0 12px">You can now follow live progress on <strong>${job.name}</strong> — schedule, milestones, site photos and documents — anytime, no login required.</p>
            <a href="${portalUrl}" style="display:inline-block;background:#0e7a4f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0 16px">Open Project Portal</a>
            <p style="margin:0;font-size:12px;color:#64748b">If the button doesn't work, copy this link: ${portalUrl}</p>
          </div>
        </div>`;
      await base44.integrations.Core.SendEmail({
        to: clientEmail,
        subject: `Live progress portal for ${job.name}`,
        body
      });
      setEmailStatus({ type: 'success', msg: `Link emailed to ${clientEmail}` });
    } catch (e) {
      setEmailStatus({ type: 'error', msg: e.response?.data?.error || e.message || 'Could not send email' });
    }
    setEmailSending(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waUrl = portalUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Follow live progress on ${job.name}: ${portalUrl}`)}`
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Client Portal Access</h2>
        {portalEnabled && (
          <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
          </span>
        )}
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

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                <ExternalLink className="w-3.5 h-3.5" /> Preview
              </a>
              <button onClick={handleEmailLink} disabled={emailSending}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50">
                {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Email client
              </button>
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </a>
            </div>

            {emailStatus && (
              <div className={`text-xs px-3 py-2 rounded-lg ${emailStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {emailStatus.msg}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
              <button onClick={handleRegenerate} disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50">
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate link
              </button>
              <button onClick={handleDisable} disabled={toggling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50">
                <EyeOff className="w-3.5 h-3.5" /> Disable access
              </button>
            </div>
            {!clientEmail && (
              <p className="text-[11px] text-amber-600">No client contact email on file — add one in Clients to enable the email option.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Generate a secure link for your client to view live job progress, schedule, milestones and documents — no login required. Clients can acknowledge documents and message your team.</p>
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