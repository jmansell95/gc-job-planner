import React from 'react';
import { History, Plus } from 'lucide-react';

const RING = {
  compliant: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  unknown: 'bg-slate-300',
};

/**
 * Horizontal strip of recent scans for this device. Tapping a chip re-adds the
 * asset to the basket without re-scanning. Reads from a `recent` array prop
 * (parent owns persistence to localStorage).
 */
export default function RecentScansStrip({ recent = [], onSelect, onClear }) {
  if (recent.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Recent Scans</h3>
        </div>
        {onClear && (
          <button onClick={onClear} className="text-[11px] text-slate-400 hover:text-slate-600 font-medium">Clear</button>
        )}
      </div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {recent.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className="flex-shrink-0 flex items-center gap-2 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl pl-2 pr-3 py-2 transition active:scale-95"
          >
            {(() => {
              const photo = r.panda_image_urls?.[0];
              const photoUrl = photo?.thumb || photo?.medium || photo?.url;
              return photoUrl
                ? <img src={photoUrl} alt={r.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                : <span className={`w-2 h-2 rounded-full flex-shrink-0 ${RING[r.compliance_status] || RING.unknown}`} />;
            })()}
            <div className="text-left min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate max-w-[120px]">{r.name}</p>
              {r.serial_number && <p className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{r.serial_number}</p>}
            </div>
            <Plus className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}