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
 * @param {string} jobId
 * @param {object} [job] — the job record (optional; enables status-based lock)
 * @returns {{ isLocked: boolean, lockedInvoices: array, isLoading: boolean, lockReason: string|null, statusLocked: boolean }}
 */
export function useBillingLock(jobId, job) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['job-invoices', jobId],
    queryFn: () => base44.entities.Invoice.filter({ job_id: jobId }, '-created_date', 50),
    enabled: !!jobId,
  });

  const lockedInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'paid');
  const invoiceLocked = lockedInvoices.length > 0;
  const statusLocked = !!job && (job.status === 'decommissioning' || job.status === 'completed');
  const isLocked = invoiceLocked || statusLocked;

  let lockReason = null;
  if (invoiceLocked && statusLocked) lockReason = 'both';
  else if (invoiceLocked) lockReason = 'invoices';
  else if (statusLocked) lockReason = 'status';

  return {
    isLocked,
    lockedInvoices,
    isLoading,
    lockReason,
    statusLocked,
  };
}