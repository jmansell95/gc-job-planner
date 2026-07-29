import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Plus, Trash2, Save, Lock, Eye, Pencil, X, KeyRound, Lock as LockIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { PERMISSION_MODULES, ACCESS_LEVELS, SYSTEM_GROUPS, defaultPermissions, normalizePermissions } from '@/utils/permissions';
import SettingsLockdownManager from '@/components/settings/SettingsLockdownManager';

export default function PermissionGroupManager({ profile }) {
  const [tab, setTab] = useState('groups'); // 'groups' | 'lockdowns'

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-full sm:w-auto sm:inline-flex">
        <button
          onClick={() => setTab('groups')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'groups' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <KeyRound className="w-4 h-4" /> Permission Groups
        </button>
        <button
          onClick={() => setTab('lockdowns')}
          className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition ${
            tab === 'lockdowns' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <LockIcon className="w-4 h-4" /> Page Lockdowns
        </button>
      </div>

      {tab === 'groups' ? <GroupsTab /> : <SettingsLockdownManager profile={profile} />}
    </div>
  );
}

function GroupsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 100)),
  });

  const ensureSystemGroups = useMutation({
    mutationFn: async () => {
      for (const g of SYSTEM_GROUPS) {
        const existing = await base44.entities.PermissionGroup.filter({ name: g.name });
        if (existing.length === 0) {
          await base44.entities.PermissionGroup.create({
            ...g,
            permissions: normalizePermissions(g.permissions),
          });
        }
      }
    },
    onSuccess: () => qc.invalidateQueries(['permission-groups']),
  });

  React.useEffect(() => { if (groups.length === 0 && !isLoading) ensureSystemGroups.mutate(); }, [groups.length, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (group) => {
      const payload = { ...group, permissions: normalizePermissions(group.permissions) };
      if (group.id) {
        await base44.entities.PermissionGroup.update(group.id, payload);
      } else {
        await base44.entities.PermissionGroup.create(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries(['permission-groups']);
      toast({ title: 'Permission group saved' });
      setEditing(null);
    },
    onError: (e) => toast({ title: 'Could not save', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => { await base44.entities.PermissionGroup.delete(id); },
    onSuccess: () => { qc.invalidateQueries(['permission-groups']); toast({ title: 'Group deleted' }); },
    onError: (e) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  });

  const startNew = () => setEditing({ name: '', description: '', is_read_only: false, permissions: defaultPermissions() });

  if (editing) {
    return (
      <GroupEditor
        group={editing}
        onCancel={() => setEditing(null)}
        onSave={(g) => saveMutation.mutate(g)}
        saving={saveMutation.isPending}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-800">Permission Groups</h2>
        </div>
        <button onClick={startNew} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      <p className="text-sm text-slate-500 -mt-2">
        Create access levels here, then assign each crew member to one from Staff Command → Profile. The group controls what they can see and do across the entire app. Use the <strong>Page Lockdowns</strong> tab to lock individual settings pages.
      </p>

      {isLoading && <p className="text-sm text-slate-400">Loading…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(g => (
          <div key={g.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {g.is_read_only && <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                  <h3 className="font-semibold text-slate-800 truncate">{g.name}</h3>
                  {g.is_system && <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">SYSTEM</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{g.description || 'No description'}</p>
              </div>
            </div>
            <PermissionSummary permissions={g.permissions} readOnly={g.is_read_only} />
            <div className="flex items-center gap-2 mt-3">
              <button onClick={() => setEditing(g)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                <Pencil className="w-3 h-3" /> Edit
              </button>
              {!g.is_system && (
                <button onClick={() => deleteMutation.mutate(g.id)} className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PermissionSummary({ permissions, readOnly }) {
  const p = normalizePermissions(permissions);
  const writeCount = Object.values(p).filter(v => v === 'write').length;
  const readCount = Object.values(p).filter(v => v === 'read').length;
  const noneCount = Object.values(p).filter(v => v === 'none').length;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {readOnly && <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1"><Lock className="w-2.5 h-2.5" />Read-Only Lockdown</span>}
      <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{writeCount} full</span>
      <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{readCount} read</span>
      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{noneCount} hidden</span>
    </div>
  );
}

function GroupEditor({ group, onCancel, onSave, saving }) {
  const [form, setForm] = useState(() => ({
    ...group,
    name: group.name || '',
    description: group.description || '',
    is_read_only: group.is_read_only || false,
    permissions: normalizePermissions(group.permissions),
  }));

  const setLevel = (key, level) => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: level } }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-800">{group.id ? 'Edit Group' : 'New Group'}</h2>
        </div>
        <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div>
          <label className="text-sm font-medium text-slate-700">Name</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
            placeholder="e.g. Field Supervisor" />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
            className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
            placeholder="What can members of this level do?" />
        </div>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.is_read_only} onChange={e => setForm({ ...form, is_read_only: e.target.checked })}
            className="w-4 h-4 rounded accent-emerald-600" />
          <div>
            <span className="text-sm font-medium text-slate-700">Read-Only Lockdown</span>
            <p className="text-xs text-slate-500">Force every module to read-only — members can view but never create, edit, upload or delete.</p>
          </div>
        </label>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-sm">Module Permissions</h3>
          <p className="text-xs text-slate-500">Choose the access level for each part of the admin dashboard.</p>
        </div>
        <div className="divide-y divide-slate-100">
          {PERMISSION_MODULES.map(m => (
            <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                {m.sensitive && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" title="Sensitive module" />}
                <span className="text-sm font-medium text-slate-700">{m.label}</span>
              </div>
              <div className="flex gap-1">
                {ACCESS_LEVELS.map(lvl => {
                  const active = (form.permissions[m.key] || 'none') === lvl.value;
                  const effectiveRead = form.is_read_only && lvl.value === 'write';
                  return (
                    <button key={lvl.value} onClick={() => setLevel(m.key, lvl.value)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                        active
                          ? effectiveRead
                            ? 'bg-amber-100 text-amber-700'
                            : lvl.value === 'write' ? 'bg-emerald-600 text-white'
                              : lvl.value === 'read' ? 'bg-amber-500 text-white'
                                : 'bg-slate-200 text-slate-600'
                          : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                      }`}>
                      {effectiveRead && active ? 'Read (locked)' : lvl.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => onSave(form)} disabled={saving || !form.name.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition">
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Group'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 text-slate-600 bg-slate-100 rounded-lg text-sm font-medium hover:bg-slate-200 transition">
          Cancel
        </button>
      </div>
    </div>
  );
}