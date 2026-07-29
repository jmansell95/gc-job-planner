import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Mail, Bell, Truck, Save, Loader2, ShieldCheck, UserCog } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';

/**
 * Slide-out drawer for editing your own staff profile fields.
 * Keeps the user in context — no page navigation needed.
 */
export default function StaffProfileEditDrawer({ open, onOpenChange, staff }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ phone: '', email_notifications_enabled: true, delivery_dashboard_enabled: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (staff) {
      setForm({
        phone: staff.phone || '',
        email_notifications_enabled: staff.email_notifications_enabled ?? true,
        delivery_dashboard_enabled: staff.delivery_dashboard_enabled ?? false,
      });
    }
  }, [staff, open]);

  const handleSave = async () => {
    if (!staff?.id) {
      toast({ title: 'No profile linked', description: 'Contact your supervisor to set up your crew profile.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Staff.update(staff.id, {
        phone: form.phone,
        email_notifications_enabled: form.email_notifications_enabled,
        delivery_dashboard_enabled: form.delivery_dashboard_enabled,
      });
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
    }
    setSaving(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2.5 text-xl">
            <div className="w-9 h-9 rounded-xl stat-gradient-brand flex items-center justify-center shadow-sm">
              <UserCog className="w-5 h-5 text-white" />
            </div>
            Edit My Profile
          </SheetTitle>
          <SheetDescription>Update your contact details and notification preferences.</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Read-only identity fields */}
          <div className="insight-card rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5 mb-1">
              <ShieldCheck className="w-4 h-4 text-[#2E5A1A]" />
              <p className="text-sm font-semibold text-slate-700">Identity</p>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600 truncate">{staff?.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <UserCog className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-600">{staff?.name || '—'}</span>
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-100">Name and email are managed by your supervisor. Contact them to change these.</p>
          </div>

          {/* Editable fields */}
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
                <Phone className="w-4 h-4 text-slate-400" /> Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="07XXX XXX XXX"
                className="w-full px-3.5 py-3 border border-slate-300 rounded-lg text-base sm:text-sm focus:outline-none focus:border-[#2E5A1A] focus:ring-2 focus:ring-[#2E5A1A]/20 transition"
              />
            </div>

            <div className="insight-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-4 h-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Email Notifications</p>
                  <p className="text-xs text-slate-500 mt-0.5">Receive schedule reminders, assignment alerts and daily digests.</p>
                </div>
              </div>
              <Switch
                checked={form.email_notifications_enabled}
                onCheckedChange={(v) => setForm({ ...form, email_notifications_enabled: v })}
              />
            </div>

            <div className="insight-card rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Delivery Dashboard Access</p>
                  <p className="text-xs text-slate-500 mt-0.5">Show the Deliveries button on your device for collection and delivery tasks.</p>
                </div>
              </div>
              <Switch
                checked={form.delivery_dashboard_enabled}
                onCheckedChange={(v) => setForm({ ...form, delivery_dashboard_enabled: v })}
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white rounded-xl font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 shadow-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}