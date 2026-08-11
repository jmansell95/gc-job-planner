import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Camera, MapPin, FileText, ShieldCheck, AlertTriangle, ArrowRightLeft, User, FlaskConical, CheckSquare, Square } from 'lucide-react';
import SignaturePad from '@/components/staff/SignaturePad';
import { format } from 'date-fns';

export default function DeliveryCompleteModal({ delivery, open, onClose, onComplete, staffList = [], currentDriverName = '' }) {
  const [signature, setSignature] = useState(null);
  const [signedByName, setSignedByName] = useState('');
  const [condition, setCondition] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]);
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [handoverMode, setHandoverMode] = useState(false);
  const [handoverToStaffId, setHandoverToStaffId] = useState('');
  const [samplesAccounted, setSamplesAccounted] = useState(false);
  const [sampleChecks, setSampleChecks] = useState({});
  const fileInputRef = useRef(null);

  // Reset state when modal opens for a new delivery
  useEffect(() => {
    if (open) {
      setSignature(null);
      setSignedByName('');
      setCondition('');
      setNotes('');
      setPhotos([]);
      setGps(null);
      setSubmitting(false);
      setHandoverMode(false);
      setHandoverToStaffId('');
      setSamplesAccounted(false);
      setSampleChecks({});
      // Try to capture GPS on open
      if (navigator.geolocation) {
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
          pos => { setGps(`${pos.coords.latitude},${pos.coords.longitude}`); setGpsLoading(false); },
          err => { console.error('GPS error:', err); setGpsLoading(false); },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    }
  }, [open, delivery?.id]);

  if (!open || !delivery) return null;

  const isSampleRun = delivery.delivery_type === 'sample_collection' || delivery.delivery_type === 'sample_delivery';
  const sampleIds = (delivery.sample_ids || '').split(',').map(s => s.trim()).filter(Boolean);
  const allSamplesChecked = sampleIds.length > 0 && sampleIds.every(id => sampleChecks[id]);
  const samplesReady = !isSampleRun || (allSamplesChecked && samplesAccounted);

  const handlePhotos = (files) => {
    const newPhotos = Array.from(files).slice(0, 4 - photos.length);
    newPhotos.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotos(prev => [...prev, { data_url: e.target.result, name: file.name }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!signature) return;
    if (handoverMode && !handoverToStaffId) return;
    setSubmitting(true);

    const completedAt = new Date().toISOString();
    // Use || as separator — data URLs themselves contain a comma (data:image/png;base64,...),
    // so splitting on ',' corrupts multi-photo parsing. Base64 never contains '|'.
    const photoDataUrls = photos.map(p => p.data_url).join('||');

    const success = await onComplete({
      delivery_id: delivery.id,
      completed_at: completedAt,
      signature_data_url: signature,
      signed_by_name: signedByName || (handoverMode ? currentDriverName : delivery.contact_name) || '',
      photo_data_urls: photoDataUrls,
      gps_coordinates: gps || '',
      notes: notes.trim(),
      condition_report: condition.trim(),
      delivery_type: delivery.delivery_type || '',
      linked_cost_item_ids: delivery.linked_cost_item_ids || '',
      handover_mode: handoverMode,
      handover_to_staff_id: handoverMode ? handoverToStaffId : '',
      samples_accounted: isSampleRun ? samplesAccounted : undefined,
    });

    // Only stop the spinner if the sign-off failed — on success the modal closes.
    // This keeps all form data (signature, photos, notes) intact so the driver can retry.
    if (!success) {
      setSubmitting(false);
    }
  };

  const canSubmit = signature && !submitting && (!handoverMode || !!handoverToStaffId) && samplesReady;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/60 backdrop-blur-md p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Sign Off Delivery</h2>
              <p className="text-xs text-slate-400 mt-0.5">{delivery.items || delivery.job_name || 'Delivery task'}</p>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* GPS pill — clear status at the top */}
            <div className="flex items-center gap-2">
              {gps ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Location captured
                </span>
              ) : gpsLoading ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5">
                  <MapPin className="w-3.5 h-3.5 animate-pulse" /> Capturing location…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-slate-50 border border-slate-100 rounded-full px-3 py-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Location unavailable
                </span>
              )}
            </div>

            {/* Sample checklist — confirm each sample is present */}
            {isSampleRun && sampleIds.length > 0 && (
              <div className="rounded-xl border border-teal-200 overflow-hidden bg-teal-50/40">
                <div className="px-3.5 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-teal-700" />
                  <span className="text-sm font-bold text-teal-800">Sample Checklist ({sampleIds.length})</span>
                </div>
                <div className="px-3.5 py-3 space-y-1.5">
                  {sampleIds.map(id => (
                    <button key={id} type="button" onClick={() => setSampleChecks(prev => ({ ...prev, [id]: !prev[id] }))}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg bg-white border border-teal-100 hover:border-teal-300 transition text-left">
                      {sampleChecks[id]
                        ? <CheckSquare className="w-5 h-5 text-teal-600 flex-shrink-0" />
                        : <Square className="w-5 h-5 text-slate-300 flex-shrink-0" />}
                      <span className="text-sm font-mono font-medium text-slate-800">{id}</span>
                    </button>
                  ))}
                </div>
                <div className="px-3.5 py-3 bg-white border-t border-teal-100">
                  <button type="button" onClick={() => setSamplesAccounted(v => !v)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition text-left ${
                      samplesAccounted ? 'bg-emerald-50 border-emerald-400' : 'bg-white border-slate-200 hover:border-teal-300'
                    }`}>
                    {samplesAccounted
                      ? <CheckSquare className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                      : <Square className="w-6 h-6 text-slate-300 flex-shrink-0" />}
                    <span className="flex-1">
                      <span className="block text-sm font-bold text-slate-900">All samples are there and accounted for</span>
                      <span className="block text-xs text-slate-500 mt-0.5">Tick this to confirm every sample on the list above is present.</span>
                    </span>
                  </button>
                  {!samplesReady && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> You must check off every sample and confirm they're all accounted for.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Handover-to-colleague toggle */}
            {staffList.length > 0 && (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button type="button" onClick={() => setHandoverMode(m => !m)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-3 text-left transition ${handoverMode ? 'bg-purple-50 text-purple-800' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${handoverMode ? 'bg-purple-500 text-white' : 'bg-white border border-slate-200 text-slate-400'}`}>
                    <ArrowRightLeft className="w-4 h-4" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold">{handoverMode ? 'Handing over to a colleague' : 'Hand over to a colleague instead?'}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{handoverMode ? 'They\'ll get a new delivery task to take it to the recipient.' : 'Tap to pass items to another crew member for them to deliver.'}</span>
                  </span>
                </button>
                {handoverMode && (
                  <div className="px-3.5 py-3 bg-white border-t border-slate-100 space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Hand items to
                    </label>
                    <select value={handoverToStaffId} onChange={e => setHandoverToStaffId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100">
                      <option value="">Select colleague…</option>
                      {staffList.filter(s => s.id !== delivery.driver_staff_id).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {!handoverToStaffId && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Select who you're handing the items to.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recipient name — essential, first */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                {handoverMode ? 'Your name (handing over)' : 'Recipient name'}
              </label>
              <input
                type="text"
                value={signedByName}
                onChange={e => setSignedByName(e.target.value)}
                placeholder={handoverMode ? (currentDriverName || 'Your name') : (delivery.contact_name || 'Who is receiving the items?')}
                autoComplete="name"
                className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              {handoverMode && (
                <p className="text-xs text-purple-600 mt-1.5 flex items-center gap-1">
                  <ArrowRightLeft className="w-3 h-3" /> You're signing to confirm you've handed the items to your colleague.
                </p>
              )}
            </div>

            {/* Signature — essential, second */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Recipient signature <span className="text-red-500">*</span>
              </label>
              <SignaturePad onChange={setSignature} />
              {!signature && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> A signature is required to complete the delivery.
                </p>
              )}
            </div>

            {/* Condition report */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Condition of items</label>
              <select
                value={condition}
                onChange={e => setCondition(e.target.value)}
                className="w-full px-3 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Select condition…</option>
                <option value="Good — no issues">Good — no issues</option>
                <option value="Minor wear — usable">Minor wear — usable</option>
                <option value="Damaged — see photos">Damaged — see photos</option>
                <option value="Missing parts">Missing parts</option>
                <option value="Refused — wrong items">Refused — wrong items</option>
              </select>
            </div>

            {/* Photo evidence */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Photo evidence (up to 4)</label>
              <div className="flex flex-wrap gap-2">
                {photos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={photo.data_url} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {photos.length < 4 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center hover:border-emerald-400 hover:bg-emerald-50/30 transition"
                  >
                    <Camera className="w-5 h-5 text-slate-300" />
                    <span className="text-[10px] text-slate-400 mt-1">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={e => handlePhotos(e.target.files)}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Access issues, delays, damages, anything else…"
                className="w-full px-3 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-100 px-5 py-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Complete & Sign
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}