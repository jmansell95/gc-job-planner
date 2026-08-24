import React from 'react';
import { startOfWeek, format } from 'date-fns';
import WeeklyRotaBuilder from '@/components/WeeklyRotaBuilder';
import { Plus } from 'lucide-react';

/**
 * Unified Rota Builder — wraps the WeeklyRotaBuilder with a single
 * "Add Shift" button. The button dispatches a custom event that the
 * WeeklyRotaBuilder listens for and opens the smart AssignmentModal.
 *
 * The old "Quick Assign" / RotaJobPool modal has been merged into the
 * AssignmentModal — one button, one adaptive form.
 */
export default function UnifiedRotaBuilder() {
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  const handleAddShift = () => {
    window.dispatchEvent(new CustomEvent('gc-open-add-shift'));
  };

  return (
    <div className="flex flex-col">
      <button
        onClick={handleAddShift}
        className="mb-3 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#2E5A1A] text-white hover:bg-[#1c4a12] shadow-sm transition w-fit active:scale-95"
      >
        <Plus className="w-4 h-4" /> Add Shift
      </button>
      <WeeklyRotaBuilder />
    </div>
  );
}