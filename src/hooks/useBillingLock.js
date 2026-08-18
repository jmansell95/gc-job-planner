import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Billing Lock — returns whether a job's cost data is frozen.
 *
 * A job is locked when EITHER:
 *   1. One or more invoices for the job have been sent or paid (legally issued).
 *   2. The job is in 'decommissioning' or 'completed' status — no new billable
 *      items can be added once the job is being wound down or finished.
 *
 * Admins can "temp open" a locked job to make late billing adjustments without
 * voiding the invoice. This is a session-level override (not persisted) — the
 * lock reinstates on next page load so it's never left open by accident.
 *
 * @param {string} jobId
 * @param {object} [job] — the job record (optional; enables status-based lock)
 * @returns {{ isLocked: boolean, effectiveLocked: boolean, lockedInvoices: array, isLoading: boolean, lockReason: string|null, statusLocked: boolean, tempOpen: boolean, setTempOpen: function }}
 */
export function useBillingLock(jobId, job) {
  const [tempOpen, setTempOpen] = useState(false);
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['job-invoices', jobId],
    queryFn: () => base44.entities.Invoice.filter({ job_id: jobId }, '-created_date', 50),
    enabled: !!jobId,
  });

  const lockedInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'paid');
  const invoiceLocked = lockedInvoices.length > 0;
  const statusLocked = !!job && (job.status === 'decommissioning' || job.status === 'completed');
  const isLocked = invoiceLocked || statusLocked;
  // Temp-open override: admins can bypass the lock for late billing edits.
  const effectiveLocked = isLocked && !tempOpen;

  let lockReason = null;
  if (invoiceLocked && statusLocked) lockReason = 'both';
  else if (invoiceLocked) lockReason = 'invoices';
  else if (statusLocked) lockReason = 'status';

  return {
    isLocked,
    effectiveLocked,
    lockedInvoices,
    isLoading,
    lockReason,
    statusLocked,
    tempOpen,
    setTempOpen,
  };
}