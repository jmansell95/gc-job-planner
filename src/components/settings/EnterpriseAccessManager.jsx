import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  KeyRound, Plus, Users, Building2, Crown, Globe, Search, Lock, Layers, X,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { useDivision } from '@/contexts/DivisionContext';
import {
  PERMISSION_MODULES, SYSTEM_GROUPS, defaultPermissions, normalizePermissions,
} from '@/utils/permissions';
import AccessGroupCard from './access/AccessGroupCard';
import AccessGroupEditor from './access/AccessGroupEditor';
import AccessMatrixEditor from './access/AccessMatrixEditor';

export default function EnterpriseAccessManager({ profile }) {
  const [lockdownGroup, setLockdownGroup] = useState(null); // group object → opens drawer

  return (
    <div className="space-y-4">
      <div className="insight-card rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
          <Crown className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            Enterprise-Wide Access Control <Globe className="w-3.5 h-3.5 text-emerald-600" />
          </p>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            One central place to manage access across <strong>all divisions</strong>. Edit a group's base permissions, then use <strong>Division Lockdown</strong> on any group to override what it can do inside a specific division.
          </p>
        </div>
      </div>

      <GroupsTab onLockdown={setLockdownGroup} />

      {lockdownGroup && (
        <AccessLockdownDrawer group={lockdownGroup} onClose={() => setLockdownGroup(null)} />
      )}
    </div>
  );
}

function GroupsTab({ onLockdown }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { divisions = [] } = useDivision();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['permission-groups'],
    queryFn: async () => (await base44.entities.PermissionGroup.list('-created_date', 100)),
  });
  // Fetch ALL staff across ALL divisions — no division filter, high limit
  const { data: staff = [] } = useQuery({
    queryKey: ['staff-all-access'],
    queryFn: async () => (await base44.entities.Staff.list('-created_date', 5000)),
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams-all'],
    queryFn: async () => (await base44.entities.Team.list()),
  });
  // Fetch all manifests so we can show override counts per group
  const { data: manifests = [] } = useQuery({
    queryKey: ['all-access-manifests'],
    queryFn: async () => (await base44.entities.DivisionAccessManifest.list('-created_date', 5000)),
  });

  // Build assignment + division coverage maps — counts across ALL divisions
  const staffByGroup = {};
  const divisionsByGroup = {};
  const staffByGroupDivision = {}; // { groupId: { divisionId: count } }
  staff.forEach(s => {
    if (s.permission_group_id) {
      staffByGroup[s.permission_group_id] = (staffByGroup[s.permission_group_id] || 0) + 1;
      if (s.division_id) {
        if (!divisionsByGroup[s.permission_group_id]) divisionsByGroup[s.permission_group_id] = new Set();
        divisionsByGroup[s.permission_group_id].add(s.division_id);
        if (!staffByGroupDivision[s.permission_group_id]) staffByGroupDivision[s.permission_group_id] = {};
        staffByGroupDivision[s.permission_group_id][s.division_id] = (staffByGroupDivision[s.permission_group_id][s.division_id] || 0) + 1;
      }
    }
  });
  const teamCountByGroup = {};
  teams.forEach(t => {
    if (t.permission_group_id) {
      teamCountByGroup[t.permission_group_id] = (teamCountByGroup[t.permission_group_id] || 0) + 1;
    }
  });
  // Manifest (override) counts per group
  const manifestCountByGroup = {};
  manifests.forEach(m => {
    if (m.permission_group_id) {
      manifestCountByGroup[m.permission_group_id] = (manifestCountByGroup[m.permission_group_id] || 0) + 1;
    }
  });

  const ensureSystemGroups = useMutation({
    mutationFn: async () => {
      for (const g of SYSTEM_GROUPS) {
        const existing = await base44.entities.PermissionGroup.filter({ name: g.name });
        if (existing.length === 0) {
          await base44.entities.PermissionGroup.create({ ...g, permissions: normalizePermissions(g.permissions) });
        } else {
          const existingGroup = existing[0];
          const stored = existingGroup.permissions || {};
          const expected = normalizePermissions(g.permissions);
          let needsUpdate = false;
          const updatedPerms = { ...stored };
          PERMISSION_MODULES.forEach(m => {
            if (!(m.key in stored)) { updatedPerms[m.key] = expected[m.key]; needsUpdate = true; }
          });
          if (needsUpdate) {
            await base44.entities.PermissionGroup.update(existingGroup.id, { permissions: normalizePermissions(updatedPerms) });
          }
        }
      }
    },
    onSuccess: () => qc.invalidateQueries(['permission-groups']),
  });

  useEffect(() => {
    if (groups.length === 0 && !isLoading) ensureSystemGroups.mutate();
  }, [groups.length, isLoading]);

  const saveMutation = useMutation({
    mutationFn: async (group) => {
      const payload = { ...group, permissions: normalizePermissions(group.permissions) };
      if (group.id) await base44.entities.PermissionGroup.update(group.id, payload);
      else await base44.entities.PermissionGroup.create(payload);
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
    onSuccess: () => {
      qc.invalidateQueries(['permission-groups']);
      qc.invalidateQueries(['staff-all-access']);
      qc.invalidateQueries(['teams-all']);
      toast({ title: 'Group deleted' });
    },
    onError: (e) => toast({ title: 'Could not delete', description: e.message, variant: 'destructive' }),
  });

  const handleDelete = (group) => {
    const count = (staffByGroup[group.id] || 0) + (teamCountByGroup[group.id] || 0);
    if (count > 0) {
      toast({ title: 'Cannot delete group', description: `${count} staff/team member(s) are still assigned. Reassign them first.`, variant: 'destructive' });
      return;
    }
    if (confirm(`Delete "${group.name}"? This cannot be undone.`)) deleteMutation.mutate(group.id);
  };

  const getDivisionsForGroup = (groupId) => {
    const divIds = divisionsByGroup[groupId];
    if (!divIds) return [];
    return divisions.filter(d => divIds.has(d.id));
  };

  const systemGroups = groups.filter(g => g.is_system);
  const customGroups = groups.filter(g => !g.is_system);
  const totalAssigned = Object.values(staffByGroup).reduce((a, b) => a + b, 0);
  const totalDivisionsCovered = new Set(Object.values(divisionsByGroup).flatMap(s => [...s])).size;
  const totalManifests = manifests.length;

  const filteredSystem = systemGroups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));
  const filteredCustom = customGroups.filter(g => g.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile icon={KeyRound} label="Total Groups" value={groups.length} tone="emerald" />
        <StatTile icon={Users} label="Staff Assigned" value={totalAssigned} tone="blue" />
        <StatTile icon={Building2} label="Divisions Covered" value={totalDivisionsCovered} tone="amber" />
        <StatTile icon={Layers} label="Division Overrides" value={totalManifests} tone="violet" />
      </div>

      {/* Search + New */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
          />
        </div>
        <button onClick={() => setEditing({ name: '', description: '', is_read_only: false, permissions: defaultPermissions() })} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-[#2E5A1A] text-white rounded-xl text-sm font-semibold hover:bg-[#1c4a12] transition shadow-sm flex-shrink-0">
          <Plus className="w-4 h-4" /> New Group
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-3 border-slate-200 border-t-[#2E5A1A] rounded-full animate-spin" />
        </div>
      )}

      {/* System Groups */}
      {filteredSystem.length > 0 && (
        <div>
          <SectionHeader icon={Crown} title="System Groups" subtitle="Built-in access levels — can edit but not delete" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSystem.map(g => (
              <AccessGroupCard
                key={g.id}
                group={g}
                staffCount={staffByGroup[g.id] || 0}
                teamCount={teamCountByGroup[g.id] || 0}
                divisions={getDivisionsForGroup(g.id)}
                overrideCount={manifestCountByGroup[g.id] || 0}
                onEdit={() => setEditing(g)}
                onDelete={() => handleDelete(g)}
                onLockdown={() => onLockdown(g)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Groups */}
      {filteredCustom.length > 0 && (
        <div>
          <SectionHeader icon={Building2} title="Custom Groups" subtitle="Your own access levels — edit or delete anytime" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCustom.map(g => (
              <AccessGroupCard
                key={g.id}
                group={g}
                staffCount={staffByGroup[g.id] || 0}
                teamCount={teamCountByGroup[g.id] || 0}
                divisions={getDivisionsForGroup(g.id)}
                overrideCount={manifestCountByGroup[g.id] || 0}
                onEdit={() => setEditing(g)}
                onDelete={() => handleDelete(g)}
                onLockdown={() => onLockdown(g)}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && customGroups.length === 0 && systemGroups.length > 0 && !search && (
        <div className="insight-card rounded-2xl p-6 text-center">
          <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-700">No custom groups yet</p>
          <p className="text-xs text-slate-400 mt-1">Click "New Group" to create your own access level — e.g. "Office Staff", "Junior Manager", "Read-Only Accounts".</p>
        </div>
      )}

      {/* Inline editor */}
      {editing && (
        <AccessGroupEditor group={editing} onCancel={() => setEditing(null)} onSave={(g) => saveMutation.mutate(g)} saving={saveMutation.isPending} />
      )}
    </div>
  );
}

// The drawer that hosts the AccessMatrixEditor for a specific group
function AccessLockdownDrawer({ group, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] bg-blue-950/60 backdrop-blur-md flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl shadow-2xl w-full max-w-7xl h-full sm:h-auto sm:max-h-[calc(100dvh-2rem)] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Drawer header */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Layers className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Division Lockdown</h2>
              <p className="text-[11px] text-slate-500">Override <strong>{group.name}</strong> permissions per division</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Matrix editor with the group pre-selected */}
        <div className="p-4 sm:p-5">
          <AccessMatrixEditor fixedGroup={group} />
        </div>
      </div>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }) {
  const tones = {
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
    amber: 'from-amber-500 to-orange-600',
    violet: 'from-violet-500 to-purple-600',
  };
  return (
    <div className={`rounded-xl bg-gradient-to-br ${tones[tone]} p-3 text-white relative overflow-hidden shadow-md`}>
      <Icon className="absolute right-2 top-2 w-6 h-6 opacity-20" />
      <div className="relative">
        <p className="text-[10px] font-bold uppercase tracking-wide text-white/80">{label}</p>
        <p className="text-2xl font-extrabold tabular-nums mt-1">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-slate-500" />
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}