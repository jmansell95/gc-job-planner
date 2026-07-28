import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Upload, Loader2, FolderKanban, Building2, Check, X,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const fmt = (n) => (n != null && !isNaN(n)) ? '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

const CATEGORY_META = {
  labour: { label: 'Labour', color: 'emerald' },
  plant: { label: 'Plant Hire', color: 'blue' },
  materials: { label: 'Materials', color: 'amber' },
};

/**
 * Project Rate Cards manager — lets an admin upload a project-specific rate card
 * (e.g. the East West Rail "Application for Payment" workbook) and view the ingested
 * rates. Jobs linked to that project bill against these rates in preference to the
 * global Master Price List.
 */
export default function ProjectRateCardManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('labour');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list() });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['rate-card-items'],
    queryFn: () => base44.entities.RateCardItem.list('-created_date', 1000),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['rate-card-items'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  // Projects that have at least one project-scoped rate card item
  const projectsWithItems = useMemo(() => {
    const ids = new Set(items.filter((i) => i.project_id).map((i) => i.project_id));
    return projects.filter((p) => ids.has(p.id));
  }, [items, projects]);

  // Auto-select the first project with items (or EWR) on load
  const effectiveProjectId = selectedProjectId || projectsWithItems[0]?.id || null;
  const selectedProject = projects.find((p) => p.id === effectiveProjectId);

  const projectItems = useMemo(
    () => items.filter((i) => i.project_id === effectiveProjectId),
    [items, effectiveProjectId]
  );

  const counts = useMemo(() => ({
    labour: projectItems.filter((i) => i.category === 'labour').length,
    plant: projectItems.filter((i) => i.category === 'plant').length,
    materials: projectItems.filter((i) => i.category === 'materials').length,
  }), [projectItems]);

  const filtered = useMemo(() => {
    let list = projectItems.filter((i) => i.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((i) =>
        (i.description || '').toLowerCase().includes(q) ||
        (i.subcategory || '').toLowerCase().includes(q) ||
        (i.notes || '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [projectItems, activeCategory, query]);

  const grouped = useMemo(() => {
    const map = {};
    filtered.forEach((i) => {
      const key = i.subcategory || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(i);
    });
    return Object.entries(map);
  }, [filtered]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!effectiveProjectId) {
      toast({ title: 'Select a project first', description: 'Pick a project to attach this rate card to.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('processEWRRateCardUpload', {
        file_url: uploadRes.file_url,
        project_id: effectiveProjectId,
      });
      toast({
        title: 'Project rate card ingested',
        description: `${res.data.ingested} rates loaded for ${res.data.project}.`,
      });
      refresh();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Could not process file';
      toast({ title: 'Upload failed', description: msg, variant: 'destructive' });
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-wrap">
        <FolderKanban className="w-5 h-5 text-[#2E5A1A]" />
        <h2 className="font-semibold text-slate-900">Project Rate Cards</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
          {effectiveProjectId ? `${projectItems.length} rates` : 'No project selected'}
        </span>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || !effectiveProjectId}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition bg-[#2E5A1A] text-white hover:bg-[#1c4a12] disabled:opacity-50 flex-shrink-0"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Processing...' : 'Upload Project Rate Card'}
        </button>
      </div>

      {/* Project selector */}
      <div className="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 flex-1">
          <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={effectiveProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A] bg-white"
          >
            <option value="">Select a project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.reference ? ` (${p.reference})` : ''}
                {projectItems.some((i) => i.project_id === p.id) ? ' — has rate card' : ''}
              </option>
            ))}
          </select>
        </div>
        {selectedProject?.notes && (
          <p className="text-xs text-slate-400 max-w-md truncate" title={selectedProject.notes}>{selectedProject.notes}</p>
        )}
      </div>

      {!effectiveProjectId ? (
        <div className="text-center py-16 px-4">
          <FolderKanban className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No project rate card selected</p>
          <p className="text-xs text-slate-400 mt-1">Pick a project above, then upload its rate card workbook. Jobs linked to that project will bill against these rates automatically.</p>
        </div>
      ) : projectItems.length === 0 ? (
        <div className="text-center py-16 px-4">
          <Upload className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">No rates ingested for this project yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "Upload Project Rate Card" to load the schedule of rates for {selectedProject?.name}.</p>
        </div>
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-1 px-3 pt-3 border-b border-slate-100">
            {Object.entries(CATEGORY_META).map(([key, meta]) => {
              const active = activeCategory === key;
              return (
                <button key={key} onClick={() => setActiveCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-sm font-medium transition border-b-2 ${active ? 'border-[#2E5A1A] text-[#2E5A1A] bg-[#2E5A1A]/5' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                  {meta.label}
                  <span className="text-xs text-slate-400">({counts[key]})</span>
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${CATEGORY_META[activeCategory].label.toLowerCase()} rates for ${selectedProject?.name || 'this project'}…`} className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#2E5A1A]" />
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[55vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
            ) : grouped.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400">No rates found for this category.</div>
            ) : (
              grouped.map(([subcategory, subItems]) => (
                <div key={subcategory} className="border-b border-slate-100 last:border-0">
                  <div className="px-4 py-2 bg-slate-50/80 sticky top-0 z-10">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{subcategory}</p>
                  </div>
                  {subItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition border-t border-slate-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{item.description}</p>
                        {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.unit && <span className="text-xs text-slate-400">/{item.unit}</span>}
                        <span className={`text-sm font-semibold tabular-nums ${item.price != null ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                          {item.price != null ? fmt(item.price) : (item.price_text || '—')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}