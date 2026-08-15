import React from 'react';

export default function KpiTile({ label, value, sub, icon: Icon, gradient }) {
  return (
    <div className={`${gradient} rounded-2xl p-3.5 text-white relative overflow-hidden shadow-md`}>
      <div className="absolute right-2 top-2 opacity-20">
        <Icon className="w-8 h-8" />
      </div>
      <div className="relative">
        <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center mb-2">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <p className="text-[10px] font-bold text-white/80 uppercase tracking-wide">{label}</p>
        <p className="text-xl font-extrabold text-white mt-0.5 tabular-nums">{value}</p>
        <p className="text-[10px] text-white/70 mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  );
}