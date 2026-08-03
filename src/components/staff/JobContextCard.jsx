import React from 'react';
import { Phone, User, FileText, AlertTriangle, MapPin } from 'lucide-react';

/**
 * JobContextCard — shows relevant job information for staff when they arrive
 * on site: site contact, phone, special notes, and any hazards.
 */
export default function JobContextCard({ job }) {
  if (!job) return null;

  const hasContact = job.site_contact_name || job.site_contact_phone;
  const hasNotes = job.notes && job.notes.trim().length > 0;
  const hasHazards = job.emergency_procedures || job.fire_assembly_point || job.first_aid_location;

  if (!hasContact && !hasNotes && !hasHazards) return null;

  return (
    <div className="space-y-2">
      {/* Site contact */}
      {hasContact && (
        <div className="bg-white border border-slate-200 rounded-xl px-3.5 py-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Site Contact</p>
          <div className="space-y-1.5">
            {job.site_contact_name && (
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="font-medium">{job.site_contact_name}</span>
              </div>
            )}
            {job.site_contact_phone && (
              <a href={`tel:${job.site_contact_phone}`} className="flex items-center gap-2 text-sm text-emerald-700 font-medium active:scale-95 transition">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{job.site_contact_phone}</span>
              </a>
            )}
          </div>
        </div>
      )}

      {/* Special notes / instructions */}
      {hasNotes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <div className="flex items-start gap-2">
            <FileText className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Job Notes</p>
              <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">{job.notes}</p>
            </div>
          </div>
        </div>
      )}

      {/* Safety info */}
      {hasHazards && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">Site Safety Info</p>
              <div className="space-y-1 text-xs text-red-900">
                {job.fire_assembly_point && (
                  <p><span className="font-semibold">Fire assembly:</span> {job.fire_assembly_point}</p>
                )}
                {job.first_aid_location && (
                  <p><span className="font-semibold">First aid:</span> {job.first_aid_location}</p>
                )}
                {job.emergency_procedures && (
                  <p className="whitespace-pre-wrap"><span className="font-semibold">Emergency:</span> {job.emergency_procedures}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}