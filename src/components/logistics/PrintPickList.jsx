import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import PickListModal from './PickListModal';

/**
 * Pick List trigger button. Opens the on-screen PickListModal preview, which
 * has its own Print button. Routing through the modal keeps the preview and
 * the printed sheet identical (both use the shared HTML generator).
 *
 * Props:
 *   delivery   — the DeliveryLog record for this drop
 *   job        — optional Job record
 *   vehicle    — optional Vehicle record
 *   driverName — optional driver display name
 *   className   — optional button classes (defaults to the compact slate pill)
 *   label      — optional button label (defaults to 'Pick List')
 */
export default function PrintPickList({ delivery, job, vehicle, driverName, className, label = 'Pick List' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        type="button"
        className={className || 'inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-200 transition'}
      >
        <ClipboardList className="w-3.5 h-3.5" /> {label}
      </button>
      <PickListModal
        delivery={delivery}
        job={job}
        vehicle={vehicle}
        driverName={driverName}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}