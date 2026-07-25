import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link2, Copy, Check, ExternalLink, Eye, EyeOff, RefreshCw, Mail, MessageCircle, Loader2, Settings, HardHat
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PortalSectionManager from '@/components/PortalSectionManager';

export default function PortalLinkManager({ job }) {
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [emailSending, setEmailSending] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);
  const [portalToken, setPortalToken] = useState(job.portal_token || null);
  const [portalEnabled, setPortalEnabled] = useState(job.portal_enabled || false);
  const [showSections, setShowSections] = useState(false);
  const queryClient = useQueryClient();

  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: contractors = [] } = useQuery({ queryKey: ['contractors'], queryFn: () => base44.entities.Contractor.list() });
  const client = clients.find(c => c.id === job.client_id);
  const contractor = contractors.find(c => c.id === job.contractor_id);
  const clientEmail = client?.contact_email || '';
  const contractorEmail = contractor?.contact_email || '';

  const enabledSections = job.portal_sections ? Object.values(job.portal_sections).filter(Boolean).length : 10;

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
    if (!confirm('Regenerate the portal link?\n\nThe old link will stop working immediately. You\'ll need to share the new link.')) return;
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

  const buildEmailBody = (recipientName, isContractor) => {
    const heading = isContractor ? 'Your site logging portal is ready' : 'Your project portal is ready';
    const intro = isContractor
      ? `You can now log your daily site activities and progress on <strong>${job.name}</strong> — site logs, timesheets and progress — anytime, no login required.`
      : `You can now follow live progress on <strong>${job.name}</strong> — schedule, milestones, site photos and documents — anytime, no login required.`;
    const cta = isContractor ? 'Open Site Logging Portal' : 'Open Project Portal';
    return `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
        <div style="background:linear-gradient(135deg,#0e7a4f,#065f46);padding:20px 24px;border-radius:10px 10px 0 0">
          <h2 style="color:#fff;margin:0;font-size:18px">${heading}</h2>
        </div>
        <div style="padding:24px;background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px">
          <p style="margin:0 0 12px">Hi ${recipientName || ''},</p>
          <p style="margin:0 0 12px">${intro}</p>
          <a href="${portalUrl}" style="display:inline-block;background:#0e7a4f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;margin:8px 0 16px">${cta}</a>
          <p style="margin:0;font-size:12px;color:#64748b">If the button doesn't work, copy this link: ${portalUrl}</p>
        </div>
      </div>`;
  };

  const handleEmail = async (recipient) => {
    const isContractor = recipient === 'contractor';
    const email = isContractor ? contractorEmail : clientEmail;
    const name = isContractor ? contractor?.contact_name : client?.contact_name;
    if (!email) {
      setEmailStatus({ type: 'error', msg: `No ${recipient} contact email on file. Add one in ${isContractor ? 'Contractors' : 'Clients'}.` });
      return;
    }
    setEmailSending(recipient);
    setEmailStatus(null);
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: `${isContractor ? 'Site logging portal for' : 'Live progress portal for'} ${job.name}`,
        body: buildEmailBody(name, isContractor)
      });
      setEmailStatus({ type: 'success', msg: `Link emailed to ${email}` });
    } catch (e) {
      setEmailStatus({ type: 'error', msg: e.response?.data?.error || e.message || 'Could not send email' });
    }
    setEmailSending(null);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waUrl = portalUrl
    ? `https://wa.me/?text=${encodeURIComponent(`Portal for ${job.name}: ${portalUrl}`)}`
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Link2 className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Portal Access</h2>
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

            <div className="space-y-2">
              {clientEmail && (
                <button onClick={() => handleEmail('client')} disabled={emailSending === 'client'}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition disabled:opacity-50">
                  {emailSending === 'client' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Email client · {clientEmail}
                </button>
              )}
              {contractorEmail && (
                <button onClick={() => handleEmail('contractor')} disabled={emailSending === 'contractor'}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50">
                  {emailSending === 'contractor' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HardHat className="w-3.5 h-3.5" />} Email subcontractor · {contractorEmail}
                </button>
              )}
              <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                <ExternalLink className="w-3.5 h-3.5" /> Preview portal
              </a>
              <a href={waUrl} target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition">
                <MessageCircle className="w-3.5 h-3.5" /> Share via WhatsApp
              </a>
            </div>

            {emailStatus && (
              <div className={`text-xs px-3 py-2 rounded-lg ${emailStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {emailStatus.msg}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
              <button onClick={() => setShowSections(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg transition">
                <Settings className="w-3.5 h-3.5" /> Sections ({enabledSections}/10)
              </button>
              <button onClick={handleRegenerate} disabled={regenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition disabled:opacity-50">
                {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate
              </button>
              <button onClick={handleDisable} disabled={toggling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition disabled:opacity-50">
                <EyeOff className="w-3.5 h-3.5" /> Disable
              </button>
            </div>
            {!clientEmail && !contractorEmail && (
              <p className="text-[11px] text-amber-600">No client or subcontractor contact email on file — add one to enable email sharing. You can still copy the link manually.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Generate a secure link for your client or subcontractor to view live job progress and log site activities — no login required.</p>
            <button onClick={handleEnable} disabled={toggling}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
              <Eye className="w-4 h-4" /> {toggling ? 'Enabling...' : 'Enable Portal'}
            </button>
          </div>
        )}
      </div>

      <Dialog open={showSections} onOpenChange={setShowSections}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-5 h-5 text-[#2E5A1A]" /> Portal Section Visibility</DialogTitle></DialogHeader>
          <PortalSectionManager job={job} embedded />
        </DialogContent>
      </Dialog>
    </div>
  );
}