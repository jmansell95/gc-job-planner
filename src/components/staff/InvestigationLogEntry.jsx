import React from 'react';
import DrillerLogViewer from '@/components/investigation/DrillerLogViewer';
import GroundworkerLogForm from '@/components/investigation/GroundworkerLogForm';
import EnablingLogForm from '@/components/investigation/EnablingLogForm';

// Router component that renders the correct crew-specific logging form
// based on the job type and team assignment.
export default function InvestigationLogEntry({ staffId, jobId, job, staffName }) {
  const jobType = job?.job_type;

  // Drilling jobs (CP and Rotary) → Read-only viewer for KeyLogBook AGS imports.
  // All borehole data is managed in KeyLogBook and imported by an admin.
  if (jobType === 'cp_drilling' || jobType === 'rotary_drilling') {
    return <DrillerLogViewer jobId={jobId} job={job} staffName={staffName} />;
  }

  // Groundworks (trial pit, coring, cp_drilling sub-types handled above) → Groundworker log form
  if (jobType === 'groundworks' || jobType === 'trial_pit' || jobType === 'coring') {
    return <GroundworkerLogForm staffId={staffId} jobId={jobId} job={job} staffName={staffName} />;
  }

  // Enabling works → Enabling log form (site setup / reinstatement)
  if (jobType === 'enabling_works') {
    return <EnablingLogForm staffId={staffId} jobId={jobId} job={job} staffName={staffName} />;
  }

  // Default: show groundworker form (covers general groundworks tasks)
  return <GroundworkerLogForm staffId={staffId} jobId={jobId} job={job} staffName={staffName} />;
}