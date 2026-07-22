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
      <DialogContent className="max-w-5xl w-full h-screen h-[100dvh] sm:h-auto sm:w-[95vw] sm:max-h-[92vh] overflow-y-auto p-0 !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!left-1/2 sm:!top-1/2 sm:!-translate-x-1/2 sm:!-translate-y-1/2 !rounded-none sm:!rounded-lg !border-0 sm:!border">
        {job && <JobDetail job={job} onBack={onClose} />}
      </DialogContent>
    </Dialog>
  );
}