import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings, Users, Truck, HardHat, Shield, ChevronRight } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StaffManager from '@/components/StaffManager';
import VehicleManager from '@/components/VehicleManager';
import ContractorManager from '@/components/ContractorManager';

const tabs = [
  { id: 'users', label: 'Users & Roles', icon: Shield },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'vehicles', label: 'Vehicles', icon: Truck },
  { id: 'contractors', label: 'Contractors', icon: HardHat },
];

function UsersAndRoles() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list()
  });

  const handleRoleChange = async (userId, newRole) => {
    await base44.entities.User.update(userId, { role: newRole });
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
  };

  if (isLoading) return <div className="text-slate-500 text-sm">Loading users...</div>;

  return (
    <div>
      <PageHeader title="Users & Roles" icon={Shield} />
      <p className="text-sm text-slate-500 mb-6">Manage user access levels. <span className="font-medium text-slate-700">viewer</span> — read-only access to schedules. <span className="font-medium text-slate-700">user</span> — standard access. <span className="font-medium text-slate-700">admin</span> — full access.</p>
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-300 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-emerald-700 border-b border-emerald-800">
              <th className="px-4 py-3 text-left font-semibold text-white">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-white">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-slate-200 hover:bg-emerald-50 transition">
                <td className="px-4 py-3 font-medium text-slate-900">{user.full_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{user.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={user.role || 'user'}
                    onChange={e => handleRoleChange(user.id, e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
                  >
                    <option value="viewer">viewer</option>
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {users.map(user => (
          <div key={user.id} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-slate-900">{user.full_name || '—'}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <select
                value={user.role || 'user'}
                onChange={e => handleRoleChange(user.id, e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600"
              >
                <option value="viewer">viewer</option>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
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
      {activeTab === 'contractors' && <ContractorManager />}
    </div>
  );
}