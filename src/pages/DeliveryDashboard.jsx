import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Truck, Package, ArrowRightLeft, Calendar, CheckCircle2, Clock, HardHat, HelpCircle, ArrowRight, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isFuture, isToday } from 'date-fns';
import { EmptyState, Skeleton, SkeletonText } from '@/components/StateViews';
import DeliveryCard from '@/components/delivery/DeliveryCard';
import DeliveryCompleteModal from '@/components/delivery/DeliveryCompleteModal';
import MissionTimeline from '@/components/delivery/MissionTimeline';
import RouteOptimizeBar from '@/components/delivery/RouteOptimizeBar';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { isWithinSiteHours, isBeforeSiteOpen, SITE_OPEN_TIME, SITE_CLOSE_TIME } from '@/utils/siteHours';
import { saveOfflineDelivery, hasOfflineDelivery } from '@/utils/offlineSync';
import { isDriver } from '@/utils/access';

const listContainer = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

function SectionHeader({ icon: Icon, title, count, tone = 'dark' }) {
  const textTone = tone === 'muted' ? 'text-slate-400' : 'text-slate-900';
  return (
    <div className="flex items-center gap-2.5 mb-3 md:mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tone === 'muted' ? 'bg-slate-100' : 'bg-emerald-50'}`}>
        <Icon className={`w-4 h-4 ${tone === 'muted' ? 'text-slate-400' : 'text-emerald-700'}`} />
      </div>
      <h2 className={`text-lg md:text-xl font-bold ${textTone}`}>{title}</h2>
      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tone === 'muted' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'}`}>{count}</span>
    </div>
  );
}

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === 'admin';
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completeDelivery, setCompleteDelivery] = useState(null);
  const [autoExpandId, setAutoExpandId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await base44.functions.invoke('getMyStaffProfile');
        // Platform admins can access the delivery dashboard even without a
        // linked crew profile — they see ALL deliveries instead of just their own.
        if (res.data && (res.data.is_admin || (res.data.id && !res.data.no_staff_profile))) {
          if (!res.data.is_admin && !res.data.delivery_dashboard_enabled) {
            navigate('/staff-schedule', { replace: true });
            return;
          }
          setStaff(res.data);
        } else if (isPlatformAdmin) {
          // Profile returned but wasn't usable — platform admin fallback.
          setStaff({ id: null, name: user?.full_name || user?.email || 'Admin', email: user?.email, is_admin: true, delivery_dashboard_enabled: true, no_staff_profile: true });
        }
      } catch (e) {
        console.error('Error loading staff:', e);
        // Profile fetch failed (401/500) — platform admins still get through.
        if (isPlatformAdmin) {
          setStaff({ id: null, name: user?.full_name || user?.email || 'Admin', email: user?.email, is_admin: true, delivery_dashboard_enabled: true, no_staff_profile: true });
        }
      } finally {
        setLoading(false);
      }
    }
    loadStaff();
  }, [navigate, isPlatformAdmin, user]);

  // Real-time subscription
  useEffect(() => {
    if (!staff?.id) return;
    const unsub = base44.entities.DeliveryLog.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    });
    return () => { if (unsub) unsub(); };
  }, [staff?.id, queryClient]);

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['my-deliveries', staff?.id, staff?.is_admin],
    queryFn: async () => {
      // Platform admin with no crew profile — show all deliveries
      if (!staff?.id && staff?.is_admin) {
        const list = await base44.entities.DeliveryLog.list('-scheduled_date', 200);
        return list.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
      }
      if (!staff?.id) return [];
      const list = await base44.entities.DeliveryLog.filter({ driver_staff_id: staff.id });
      return list.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));
    },
    enabled: !!staff?.id || !!staff?.is_admin
  });

  const { data: jobs = [] } = useQuery({ queryKey: ['delivery-jobs'], queryFn: () => base44.entities.Job.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ['delivery-vehicles'], queryFn: () => base44.entities.Vehicle.list() });
  const { data: allStaff = [] } = useQuery({ queryKey: ['delivery-all-staff'], queryFn: () => base44.entities.Staff.filter({ is_active: true }) });

  const canPerformActions = isWithinSiteHours() || isBeforeSiteOpen() || staff?.is_admin;

  const handleStart = async (deliveryId) => {
    try {
      await base44.entities.DeliveryLog.update(deliveryId, {
        status: 'in_progress',
        started_at: new Date().toISOString()
      });
      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
    } catch (e) {
      console.error('Error starting delivery:', e);
      toast({ title: 'Error', description: 'Could not start delivery. Try again.' });
    }
  };

  const handleComplete = async (data) => {
    const deliveryId = data.delivery_id;

    try {
      let signatureUrl = '';
      if (data.signature_data_url) {
        const [meta, base64] = data.signature_data_url.split(',');
        const mime = meta.match(/:(.*?);/)[1];
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: mime });
        const file = new File([blob], `delivery_sig_${deliveryId}.png`, { type: 'image/png' });
        const res = await base44.integrations.Core.UploadFile({ file });
        signatureUrl = res.file_url;
      }

      let photoUrls = '';
      if (data.photo_data_urls) {
        const dataUrls = (data.photo_data_urls || '').split('||').filter(Boolean);
        const uploaded = [];
        for (let i = 0; i < dataUrls.length; i++) {
          const [meta, base64] = dataUrls[i].split(',');
          const mime = meta.match(/:(.*?);/)[1];
          const bytes = atob(base64);
          const arr = new Uint8Array(bytes.length);
          for (let j = 0; j < bytes.length; j++) arr[j] = bytes.charCodeAt(j);
          const blob = new Blob([arr], { type: mime });
          const file = new File([blob], `delivery_photo_${deliveryId}_${i}.png`, { type: 'image/png' });
          const res = await base44.integrations.Core.UploadFile({ file });
          uploaded.push(res.file_url);
        }
        photoUrls = uploaded.join(',');
      }

      const handoverColleague = data.handover_mode ? allStaff.find(s => s.id === data.handover_to_staff_id) : null;
      const updated = await base44.entities.DeliveryLog.update(deliveryId, {
        status: 'completed',
        completed_at: data.completed_at,
        signature_url: signatureUrl,
        signed_by_name: data.signed_by_name,
        photo_urls: photoUrls,
        gps_coordinates: data.gps_coordinates || '',
        notes: data.notes,
        condition_report: data.condition_report,
        synced_from_offline: false,
        ...(data.handover_mode && handoverColleague ? {
          handover_to_staff_id: handoverColleague.id,
          handover_to_staff_name: handoverColleague.name,
        } : {})
      });

      // Auto-update linked cost item locations based on delivery type
      const linkedIds = (updated.linked_cost_item_ids || '').split(',').map(s => s.trim()).filter(Boolean);
      const isHandover = data.handover_mode && data.handover_to_staff_id;
      if (linkedIds.length > 0 && !isHandover) {
        const newLocation = updated.delivery_type === 'supplier_collection' ? 'returned' : 'site';
        const updates = linkedIds.map(id => ({
          id,
          current_location: newLocation,
          location_updated_at: new Date().toISOString(),
          ...(newLocation === 'returned' ? {
            hire_status: 'off_hired',
            off_hire_date: new Date().toISOString().split('T')[0]
          } : {})
        }));
        try { await base44.entities.JobCostItem.bulkUpdate(updates); } catch (e) { console.error('Item location sync error:', e); }
      }

      // Handover-to-colleague: create a chained delivery task for the receiving
      // colleague so it appears on their delivery dashboard for them to deliver
      // to the final recipient and capture the recipient's signature.
      if (isHandover) {
        const colleague = allStaff.find(s => s.id === data.handover_to_staff_id);
        try {
          await base44.entities.DeliveryLog.create({
            job_id: updated.job_id,
            job_name: updated.job_name || '',
            driver_staff_id: data.handover_to_staff_id,
            driver_staff_name: colleague?.name || '',
            delivery_type: updated.delivery_type === 'supplier_collection' ? 'site_delivery' : updated.delivery_type,
            status: 'pending',
            items: updated.items || '',
            linked_cost_item_ids: updated.linked_cost_item_ids || '',
            pickup_address: updated.pickup_address || '',
            delivery_address: updated.delivery_address || '',
            contact_name: updated.contact_name || '',
            contact_phone: updated.contact_phone || '',
            po_number: updated.po_number || '',
            scheduled_date: format(new Date(), 'yyyy-MM-dd'),
            vehicle_id: '',
            notes: `Handed over by ${data.signed_by_name || staff?.name || 'previous driver'}${updated.notes ? ' — ' + updated.notes : ''}`,
            chargeable: updated.chargeable !== false,
            parent_delivery_id: deliveryId,
            handover_from_staff_name: data.signed_by_name || staff?.name || '',
          });
          toast({ title: 'Handover created', description: `${colleague?.name || 'Colleague'} now has a delivery task to complete.` });
        } catch (e) {
          console.error('Chained handover creation error:', e);
          toast({ title: 'Handover task could not be created', description: 'The delivery was signed off but the colleague task failed — create it manually.', variant: 'destructive' });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });

      // Surface the next stop so the driver knows where to go next.
      const remaining = deliveries.filter(d => d.id !== deliveryId && d.status !== 'completed' && d.scheduled_date === format(new Date(), 'yyyy-MM-dd'));
      const next = [...remaining].sort((a, b) => (a.started_at ? 1 : 0) - (b.started_at ? 1 : 0))[0];
      const nextAddr = next ? (next.delivery_type === 'supplier_collection' ? next.pickup_address : next.delivery_address) : null;
      if (next) setAutoExpandId(next.id);
      if (next && nextAddr) {
        toast({
          title: `${remaining.length} ${remaining.length === 1 ? 'stop' : 'stops'} to go — next: ${next.job_name || 'delivery'}`,
          description: nextAddr,
        });
      } else {
        toast({ title: 'All done!', description: 'No more deliveries scheduled for today.' });
      }
      setCompleteDelivery(null);
      return true;
    } catch (e) {
      console.error('Error completing delivery:', e);
      // Network failed (or upload was rejected) — queue the sign-off offline so it syncs later.
      try {
        saveOfflineDelivery(data);
        queryClient.invalidateQueries({ queryKey: ['my-deliveries'] });
        toast({ title: 'Saved offline', description: 'Will sync automatically when you\u2019re back online.' });
        setCompleteDelivery(null);
        return true;
      } catch (saveErr) {
        console.error('Offline save error:', saveErr);
        toast({ title: 'Could not sign off', description: 'Check your connection and try again.' });
        return false;
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-700 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Truck className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-slate-700 font-semibold">No driver profile found</p>
          <p className="text-slate-400 text-sm mt-1">Contact your supervisor to get set up.</p>
          <button onClick={() => navigate('/staff-schedule')} className="mt-4 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition">
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  // Group deliveries
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todays = deliveries.filter(d => d.scheduled_date === todayStr && d.status !== 'completed');
  const todaysSorted = [...todays].sort((a, b) => (a.started_at ? 1 : 0) - (b.started_at ? 1 : 0));
  const upcoming = deliveries.filter(d => isFuture(new Date(d.scheduled_date + 'T00:00:00')) && d.scheduled_date !== todayStr && d.status !== 'completed');
  const completed = deliveries.filter(d => d.status === 'completed').sort((a, b) => new Date(b.completed_at || b.scheduled_date) - new Date(a.completed_at || a.scheduled_date)).slice(0, 10);

  const vehicleDateWeightMap = {};
  deliveries.forEach(d => {
    if (d.vehicle_id && d.scheduled_date) {
      const key = `${d.vehicle_id}_${d.scheduled_date}`;
      vehicleDateWeightMap[key] = (vehicleDateWeightMap[key] || 0) + (Number(d.weight_kg) || 0);
    }
  });

  const cardProps = (delivery) => ({
    delivery,
    job: jobs.find(j => j.id === delivery.job_id),
    vehicle: vehicles.find(v => v.id === delivery.vehicle_id),
    vehicleTotalWeight: vehicleDateWeightMap[`${delivery.vehicle_id}_${delivery.scheduled_date}`] || 0,
    onStart: handleStart,
    onComplete: (d) => setCompleteDelivery(d),
    canPerformActions,
    isOfflinePending: hasOfflineDelivery(delivery.id)
  });

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="hero-gradient relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-7">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg ring-1 ring-white/25 flex-shrink-0">
                <Truck className="w-5 h-5 md:w-7 md:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-3xl font-bold text-white truncate tracking-tight">Deliveries</h1>
                <p className="text-emerald-100 text-xs md:text-base mt-0.5 truncate">{staff.name.split(' ')[0]} · {format(new Date(), 'EEEE, do MMMM')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => navigate('/help')} type="button"
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                <HelpCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Help</span>
              </button>
              {!isDriver(staff) && (
                <button onClick={() => navigate('/staff-schedule')} type="button"
                  className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                  <Calendar className="w-5 h-5" />
                  <span className="hidden sm:inline">Schedule</span>
                </button>
              )}
              <button onClick={() => base44.auth.logout('/login')} type="button"
                className="flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-sm font-medium active:scale-95 transition touch-manipulation">
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            {[
              { label: 'Today', value: todays.length, icon: Clock },
              { label: 'Upcoming', value: upcoming.length, icon: Calendar },
              { label: 'Done', value: deliveries.filter(d => d.status === 'completed').length, icon: CheckCircle2 }
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
                <div className="flex items-center gap-1.5">
                  <stat.icon className="w-3.5 h-3.5 text-emerald-200" />
                  <p className="text-[10px] md:text-xs font-medium text-emerald-100 uppercase tracking-wide">{stat.label}</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-white mt-0.5">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-5 md:pt-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* My Deliveries Today heading */}
        <div className="flex items-center gap-2.5 mb-3 md:mb-4">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <h2 className="text-lg md:text-xl font-bold text-slate-900">My Deliveries Today</h2>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5">
                <Skeleton className="h-1.5 w-full mb-4 rounded-full" />
                <Skeleton className="h-4 w-1/3 mb-3" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        ) : todaysSorted.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState icon={Clock} title="No deliveries scheduled yet" message="Check back later — your supervisor will assign delivery tasks to you." />
          </div>
        ) : (
          <div className="space-y-3">
            {todaysSorted.length >= 2 && staff?.id && (
              <RouteOptimizeBar driverStaffId={staff.id} date={todayStr} count={todaysSorted.length} />
            )}
            <MissionTimeline
              deliveries={todaysSorted}
              jobs={jobs}
              vehicles={vehicles}
              allStaff={allStaff}
              onStart={handleStart}
              onComplete={(d) => setCompleteDelivery(d)}
              canPerformActions={canPerformActions}
              autoExpandId={autoExpandId}
            />
          </div>
        )}

        {/* Upcoming */}
        {!isLoading && upcoming.length > 0 && (
          <div className="mt-6">
            <SectionHeader icon={Calendar} title="Upcoming" count={upcoming.length} tone="muted" />
            <div className="space-y-3">
              {upcoming.slice(0, 10).map(d => (
                <DeliveryCard key={d.id} {...cardProps(d)} />
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {!isLoading && completed.length > 0 && (
          <div className="mt-6">
            <SectionHeader icon={CheckCircle2} title="Recently Completed" count={completed.length} tone="muted" />
            <div className="space-y-3">
              {completed.map(d => (
                <DeliveryCard key={d.id} {...cardProps(d)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Complete modal */}
      <DeliveryCompleteModal
        delivery={completeDelivery}
        open={!!completeDelivery}
        onClose={() => setCompleteDelivery(null)}
        onComplete={handleComplete}
        staffList={allStaff}
        currentDriverName={staff?.name || ''}
      />
    </div>
  );
}