import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Briefcase, Users, Truck, Search } from 'lucide-react';

export default function GlobalSearch({ compact = false }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => base44.entities.Job.list(),
    enabled: open,
  });
  const { data: staff = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => base44.entities.Staff.list(),
    enabled: open,
  });
  const { data: vehicles = [] } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => base44.entities.Vehicle.list(),
    enabled: open,
  });

  const navigate = (detail) => {
    window.dispatchEvent(new CustomEvent('app-navigate', { detail }));
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Search jobs, crew, vehicles…"
        className={`hidden lg:flex items-center ${compact ? 'justify-center px-2' : 'gap-2.5 px-4'} w-full py-2.5 bg-emerald-900/40 text-emerald-300/60 hover:text-white hover:bg-emerald-800/60 rounded-lg transition cursor-pointer text-sm font-medium ring-1 ring-emerald-700/30`}
      >
        <Search className="w-4 h-4 flex-shrink-0" />
        {!compact && <span>Search jobs, crew, vehicles…</span>}
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search jobs, crew, vehicles…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {jobs.length > 0 && (
            <CommandGroup heading="Jobs">
              {jobs.slice(0, 8).map(job => (
                <CommandItem key={job.id} value={`job ${job.name} ${job.location || ''}`} onSelect={() => navigate({ section: 'job-detail', job })}>
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{job.name}</p>
                    {job.location && <p className="text-xs text-slate-400 truncate">{job.location}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {staff.length > 0 && (
            <CommandGroup heading="Crew">
              {staff.slice(0, 8).map(member => (
                <CommandItem key={member.id} value={`staff ${member.name} ${member.email || ''}`} onSelect={() => navigate({ section: 'settings', settingsTab: 'staff' })}>
                  <Users className="w-4 h-4 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{member.name}</p>
                    {member.email && <p className="text-xs text-slate-400 truncate">{member.email}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {vehicles.length > 0 && (
            <CommandGroup heading="Vehicles">
              {vehicles.slice(0, 8).map(v => (
                <CommandItem key={v.id} value={`vehicle ${v.name} ${v.registration_number || ''}`} onSelect={() => navigate({ section: 'settings', settingsTab: 'vehicles' })}>
                  <Truck className="w-4 h-4 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{v.name}</p>
                    {v.registration_number && <p className="text-xs text-slate-400 truncate font-mono">{v.registration_number}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}