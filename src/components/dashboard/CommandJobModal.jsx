import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import JobDetail from '@/components/JobDetail';

/**
 * CommandJobModal — large centered Dialog wrapping the full JobDetail view.
 * Lets managers drill into a job without leaving the dashboard context.
 * Mobile: true full-screen takeover (100dvh, safe-area aware, no gaps).
 * Desktop: centered 95vw modal with max height 92vh.
 */
export default function CommandJobModal({ job, onClose }) {
  return (
    <Dialog open={!!job} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="
        dialog-fullscreen-mobile max-w-5xl w-full overflow-y-auto p-0 gap-0
        h-[100dvh] max-h-[100dvh] !left-0 !top-0 !translate-x-0 !translate-y-0 !rounded-none !border-0
        sm:h-auto sm:max-h-[92vh] sm:w-[95vw] sm:!left-1/2 sm:!top-1/2 sm:!-translate-x-1/2 sm:!-translate-y-1/2 sm:!rounded-lg sm:!border
      ">
        {job && <JobDetail job={job} onBack={onClose} />}
      </DialogContent>
    </Dialog>
  );
}