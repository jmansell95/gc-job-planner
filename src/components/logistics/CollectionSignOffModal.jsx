import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, AlertTriangle, Warehouse, ArrowRightLeft } from 'lucide-react';
import SignaturePad from '@/components/staff/SignaturePad';

/**
 * CollectionSignOffModal — signature capture step for completing a site
 * collection. Shown after the driver chooses "Return to Depot" or
 * "Transfer to Site". Captures the driver's signature confirming they've
 * loaded all collected items, plus their name. The signature data URL and
 * signed-by name are passed back to the parent for persistence on the
 * DeliveryLog record.
 */
export default function CollectionSignOffModal({
  open,
  itemCount,
  mode, // 'return' | 'transfer'
  destinationName = '',
  onClose,
  onConfirm,
  submitting = false,
}) {
  const [signature, setSignature] = useState(null);
  const [signedByName, setSignedByName] = useState('');

  if (!open) return null;

  const canSubmit = signature && signedByName.trim() && !submitting;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm({
      signature_data_url: signature,
      signed_by_name: signedByName.trim(),
    });
  };

  const isReturn = mode === 'return';
  const Icon = isReturn ? Warehouse : ArrowRightLeft;
  const accent = isReturn ? 'emerald' : 'amber';
  const title = isReturn ? 'Confirm Return to Depot' : 'Confirm Transfer';

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
          className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-md max-h-[92vh] overflow-y-auto shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isReturn ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                <Icon className={`w-5 h-5 ${isReturn ? 'text-emerald-700' : 'text-amber-700'}`} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{title}</h2>
                <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? 's' : ''} loaded{destinationName ? ` → ${destinationName}` : ''}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-slate-500">
              {isReturn
                ? 'Sign below to confirm all collected items are loaded and ready to return to the depot.'
                : 'Sign below to confirm all collected items are loaded and ready for transfer.'}
            </p>

            {/* Driver name */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">Your name</label>
              <input
                type="text"
                value={signedByName}
                onChange={e => setSignedByName(e.target.value)}
                placeholder="Enter your name"
                autoComplete="name"
                className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-base focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            {/* Signature */}
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Signature <span className="text-red-500">*</span>
              </label>
              <SignaturePad onChange={setSignature} />
              {!signature && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> A signature is required to complete the collection.
                </p>
              )}
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
              onClick={handleConfirm}
              disabled={!canSubmit}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-bold active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed ${isReturn ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'}`}
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  {isReturn ? 'Confirm & Return' : 'Confirm & Transfer'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}