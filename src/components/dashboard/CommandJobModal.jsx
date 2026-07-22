import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import JobDetail from '@/components/JobDetail';

/**
 * CommandJobModal — large centered Dialog wrapping the full JobDetail view.
 * Lets managers drill into a job without leaving the dashboard context.
 */
export default function CommandJobModal({ job, onClose }) {
  return (
    <Dialog open={!!job} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
        {job && <JobDetail job={job} onBack={onClose} />}
      </DialogContent>
    </Dialog>
  );
}