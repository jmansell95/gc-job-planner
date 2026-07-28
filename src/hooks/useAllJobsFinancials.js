import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Shared financials source — calls the calculateJobFinancials engine for every
// job so all dashboard widgets show identical, authoritative figures. Cached
// for 60s and shared via the 'all-jobs-financials' query key so multiple widgets
// on the same page reuse one batch of API calls.
export function useAllJobsFinancials() {
  return useQuery({
    queryKey: ['all-jobs-financials'],
    queryFn: async () => {
      const jobs = await base44.entities.Job.list();
      const results = await Promise.all(
        jobs.map((j) =>
          base44.functions
            .invoke('calculateJobFinancials', { job_id: j.id })
            .then((res) => ({ jobId: j.id, data: res.data }))
            .catch(() => ({ jobId: j.id, data: null }))
        )
      );
      const finMap = {};
      const jobMap = {};
      for (let i = 0; i < jobs.length; i++) {
        jobMap[jobs[i].id] = jobs[i];
        finMap[jobs[i].id] = results[i].data;
      }
      return { jobs, jobMap, finMap };
    },
    staleTime: 60000,
  });
}