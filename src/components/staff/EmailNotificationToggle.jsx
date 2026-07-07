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
      className={`flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl text-sm font-medium active:scale-95 transition touch-manipulation ${enabled ? 'bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white' : 'bg-amber-500/30 hover:bg-amber-500/40 ring-1 ring-amber-300/30 text-amber-50'}`}>
      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
      <span className="hidden sm:inline">{enabled ? 'Emails On' : 'Emails Off'}</span>
    </button>
  );
}