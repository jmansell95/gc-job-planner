import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import JobDetail from '@/components/JobDetail';

// Route-driven job detail. Reads the job id from the URL, fetches it, and
// renders <JobDetail>. The back button pops browser history so the user
// returns to the jobs list they came from.
export default function JobDetailRoute() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    base44.entities.Job.get(jobId)
      .then(j => { if (!cancelled) { setJob(j); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e.message || 'Job not found'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-700 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
        <p className="text-slate-700 font-semibold">{error || 'Job not found'}</p>
        <button onClick={() => navigate('/admin')} className="mt-4 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 transition">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return <JobDetail job={job} onBack={() => navigate(-1)} />;
}