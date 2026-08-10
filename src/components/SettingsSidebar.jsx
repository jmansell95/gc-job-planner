import React from 'react';
import { settingsGroups, HUB_MIGRATED_ITEMS } from '@/components/SettingsNav';

/**
 * Settings Sidebar — persistent left navigation for the settings area.
 * Only shows items that have NOT migrated to operational hubs.
 * Migrated items (billing rules, compliance rules, etc.) are rendered as
 * tabs inside their respective hub pages (Financial Control, Compliance,
 * Assets, Staff) instead of here.
 */
export default function SettingsSidebar({ activeTab, onNavigate, items }) {
  const itemMap = Object.fromEntries(items.map(i => [i.id, i]));
  const groups = settingsGroups
    .filter(g => g.label !== '_hidden_migrated')
    .map(g => ({ ...g, items: g.items.filter(i => itemMap[i.id] && !HUB_MIGRATED_ITEMS.has(i.id)) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="sticky top-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="px-3 py-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Settings Menu</h3>
        </div>
        <div className="p-2 max-h-[calc(100vh-180px)] overflow-y-auto">
          {groups.map(group => (
            <div key={group.label} className="mb-1.5">
              <p className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{group.label}</p>
              {group.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition text-left ${
                      isActive
                        ? 'bg-[#2E5A1A]/10 text-[#2E5A1A]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}