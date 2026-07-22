import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Plus, FolderOpen, Check, X } from 'lucide-react';

const inputCls = "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-emerald-600 text-sm";

/**
 * Project selector with inline create.
 * Lets the user pick an existing Project to group this job under, or create
 * a new project on the fly. When a project is selected, optionally auto-fills
 * the client (projects carry their own client_id).
 */
export default function ProjectSelect({ value, onChange, onClientInherit, className = '' }) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-created_date', 200)
  });

  const selected = projects.find(p => p.id === value) || null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await base44.entities.Project.create({ name: newName.trim(), status: 'active' });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onChange(created.id);
      setNewName('');
      setShowNew(false);
    } catch (e) {
      console.error('Error creating project:', e);
      alert('Could not create project: ' + (e?.message || 'Please try again.'));
    } finally {
      setCreating(false);
    }
  };

  if (showNew) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <input
          autoFocus
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } if (e.key === 'Escape') { setShowNew(false); setNewName(''); } }}
          placeholder="New project name…"
          className={inputCls}
          disabled={creating}
        />
        <button type="button" onClick={handleCreate} disabled={creating || !newName.trim()} className="p-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition disabled:opacity-40 flex-shrink-0">
          {creating ? <span className="text-xs px-1">…</span> : <Check className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => { setShowNew(false); setNewName(''); }} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <select
        value={value || ''}
        onChange={(e) => {
          const pid = e.target.value;
          onChange(pid || '');
          // Inherit client from the selected project if the caller wants it
          if (pid && onClientInherit) {
            const p = projects.find(p => p.id === pid);
            if (p?.client_id) onClientInherit(p.client_id);
          }
        }}
        className={inputCls}
      >
        <option value="">Standalone job (no project)</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.reference ? ` · ${p.reference}` : ''}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setShowNew(true)}
        title="Create new project"
        className="p-2 bg-white border border-slate-300 text-slate-600 rounded-lg hover:border-emerald-400 hover:text-emerald-700 transition flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
      </button>
      {selected && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full flex-shrink-0">
          <FolderOpen className="w-3 h-3" /> Linked
        </span>
      )}
    </div>
  );
}