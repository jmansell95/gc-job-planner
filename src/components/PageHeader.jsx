import React from 'react';

export default function PageHeader({ title, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
      {Icon && (
        <div className="p-2 md:p-3 bg-emerald-700 rounded-lg flex-shrink-0">
          <Icon className="w-6 md:w-8 h-6 md:h-8 text-white" />
        </div>
      )}
      <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
    </div>
  );
}