import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function EmailNotificationToggle({ initialEnabled }) {
  const [enabled, setEnabled] = useState(initialEnabled !== false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleToggle = async () => {
    const newValue = !enabled;
    setSaving(true);
    try {
      await base44.functions.invoke('updateMyEmailPreference', { enabled: newValue });
      setEnabled(newValue);
      toast({
        title: newValue ? 'Email notifications on' : 'Email notifications off',
        description: newValue
          ? "You'll receive your weekly schedule, daily reminders, and assignment notifications."
          : "You won't receive any schedule or assignment emails."
      });
    } catch (error) {
      toast({ title: 'Could not update preference', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <button onClick={handleToggle} disabled={saving} type="button"
      className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-95 transition touch-manipulation">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-100' : 'bg-amber-100'}`}>
        {saving
          ? <Loader2 className={`w-5 h-5 animate-spin ${enabled ? 'text-emerald-600' : 'text-amber-600'}`} />
          : enabled
            ? <Bell className="w-5 h-5 text-emerald-600" />
            : <BellOff className="w-5 h-5 text-amber-600" />}
      </div>
      <span className="text-sm font-medium text-slate-700">{enabled ? 'Emails On' : 'Emails Off'}</span>
    </button>
  );
}