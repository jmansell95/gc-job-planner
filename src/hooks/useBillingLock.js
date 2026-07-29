import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Billing Lock — returns whether a job's cost data is frozen because
 * one or more invoices for that job have been sent or paid.
 *
 * Once an invoice is issued (status 'sent' or 'paid'), the underlying
 * cost items, subcontractor logs, and timesheets should not be edited
 * — they're the basis of a legally-issued invoice document.
 *
 * @param {string} jobId
 * @returns {{ isLocked: boolean, lockedInvoices: array, isLoading: boolean }}
 */
export function useBillingLock(jobId) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['job-invoices', jobId],
    queryFn: () => base44.entities.Invoice.filter({ job_id: jobId }, '-created_date', 50),
    enabled: !!jobId,
  });

  const lockedInvoices = invoices.filter((i) => i.status === 'sent' || i.status === 'paid');
  return {
    isLocked: lockedInvoices.length > 0,
    lockedInvoices,
    isLoading,
  };
}