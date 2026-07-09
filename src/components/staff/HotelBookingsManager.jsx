import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { Hotel, X, MapPin, Calendar, Phone, FileText, Loader2, BedDouble } from 'lucide-react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

/**
 * Read-only view of hotel bookings for a single staff member.
 * Management is now job-centric via JobHotelBookings.
 */
export default function HotelBookingsManager({ staffId, staffName }) {
  const { data: allBookings = [], isLoading } = useQuery({
    queryKey: ['all-hotel-bookings'],
    queryFn: () => base44.entities.HotelBooking.list('-created_date', 500)
  });

  const myBookings = allBookings.filter(b =>
    (b.assigned_staff_ids || []).includes(staffId) ||
    (b.staff_id === staffId) // legacy fallback
  );

  return (
    <div>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : myBookings.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Hotel className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-700">No hotel bookings</p>
          <p className="text-xs text-slate-400 mt-1">Hotels are now managed per job from the job detail page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myBookings.map(item => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-blue-50">
                  <Hotel className="w-5 h-5 text-blue-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{item.hotel_name}</p>
                  {item.job_name && <p className="text-xs text-slate-500 mt-0.5">{item.job_name}</p>}
                  {item.address && (
                    <p className="text-xs text-slate-500 mt-1 flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" /> {item.address}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                    {item.check_in_date && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(item.check_in_date + 'T00:00:00'), 'dd MMM')}{item.check_out_date ? ` – ${format(new Date(item.check_out_date + 'T00:00:00'), 'dd MMM')}` : ''}</span>
                    )}
                    {item.room_type && <span>· {item.room_type}</span>}
                    {item.booking_reference && <span className="flex items-center gap-1">· <FileText className="w-3 h-3" /> {item.booking_reference}</span>}
                    {item.contact_phone && (
                      <a href={`tel:${item.contact_phone}`} className="flex items-center gap-1 text-blue-700 font-medium hover:underline">
                        <Phone className="w-3 h-3" /> {item.contact_phone}
                      </a>
                    )}
                  </div>
                  {item.notes && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{item.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}