import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Truck, HardHat, Shield, Building2, ChevronRight, CalendarX, Link2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';
import ClientManager from '@/components/ClientManager';
import AbsenceManager from '@/components/AbsenceManager';

const tabs = [
  { id: 'users', label: 'Users & Roles', icon: Shield },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'vehicles', label: 'Vehicles', icon: Truck },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'contractors', label: 'Contractors', icon: HardHat },
  { id: 'absences', label: 'Absences', icon: CalendarX },
];

function UsersAndRoles() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list()
  });
  const { data: staff = [] } = useQuery({ queryKey: ['staff'], queryFn: () => base44.entities.Staff.list() });

  const getStaffForUser = (user) => staff.find(s => s.email?.toLowerCase() === user.email?.toLowerCase());

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  if (isLoading) return <div className="text-slate-500 text-sm">Loading users...</div>;

  return (
    <div>
      <PageHeader title="Users & Roles" icon={Shield} />
      <p className="text-sm text-slate-500 mb-6">Manage user access levels. <span className="font-medium text-slate-700">viewer</span> — read-only access to schedules. <span className="font-medium text-slate-700">user</span> — standard access. <span className="font-medium text-slate-700">admin</span> — full access.</p>
      <div className="space-y-2">
        {users.map(user => (
          <div key={user.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 font-bold text-sm">{(user.full_name || user.email || '?').charAt(0).toUpperCase()}</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{user.full_name || '—'}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                {getStaffForUser(user) && (
                  <p className="text-xs text-emerald-600 mt-0.5 flex items-center gap-1">
                    <Link2 className="w-3 h-3" /> {getStaffForUser(user).name} · {getStaffForUser(user).job_role?.replace(/_/g, ' ')}
                  </p>
                )}
              </div>
            </div>
            <select value={user.role || 'user'} onChange={e => handleRoleChange(user.id, e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600 flex-shrink-0">
              <option value="viewer">viewer</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div>
      <PageHeader title="Settings" icon={Settings} />

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && <UsersAndRoles />}
      {activeTab === 'staff' && <StaffManager />}
      {activeTab === 'vehicles' && <VehicleManager />}
      {activeTab === 'clients' && <ClientManager />}
      {activeTab === 'contractors' && <ContractorManager />}
  {activeTab === 'absences' && <AbsenceManager />}
    </div>
  );
}