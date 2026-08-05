import React from 'react';
import { CheckCircle2, Eye, CalendarClock, CalendarPlus, X } from 'lucide-react';
import DisciplinePills from '@/components/disciplines/DisciplinePills';

export default function JobCreatedModal({ job, onView, onBuildRota, onLater, onClose }) {
  if (!job) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 px-6 py-6 text-center relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Job Created!</h2>
          <p className="text-emerald-100 text-sm mt-1">{job.name}</p>
          {(job.disciplines || []).length > 0 && (
            <div className="mt-2 flex justify-center"><DisciplinePills job={job} size="sm" /></div>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="flex items-start gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
              <CalendarClock className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">What's next?</p>
              <p className="text-sm text-slate-500 mt-0.5">Open the job to assign required teams, build the weekly rota, and publish it to your staff.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <button onClick={onView} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition font-medium text-sm">
              <Eye className="w-4 h-4" /> View Job & Set Up Now
            </button>
            {onBuildRota && (
              <button onClick={onBuildRota} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                <CalendarPlus className="w-4 h-4" /> Build Rota for This Job
              </button>
            )}
            <button onClick={onLater} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium text-sm">
              Do It Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}