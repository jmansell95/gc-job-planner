import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Briefcase, Users, Truck, Search } from 'lucide-react';

export default function GlobalSearch() {
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
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs text-emerald-200/70 hover:text-white hover:bg-emerald-800/50 rounded-lg transition cursor-pointer"
        title="Search (⌘K)"
      >
        <Search className="w-3.5 h-3.5" />
        <span>Search…</span>
        <kbd className="ml-1 px-1.5 py-0.5 text-[10px] bg-emerald-900/60 rounded border border-emerald-700/50">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search jobs, staff, vehicles…" />
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
            <CommandGroup heading="Staff">
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