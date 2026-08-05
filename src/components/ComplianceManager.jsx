import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldCheck, BarChart3, GraduationCap, AlertTriangle, CheckCircle2, XCircle, Clock, Grid3x3, FileCheck2 } from 'lucide-react';
import PillTabs from '@/components/PillTabs';
import ComplianceTracking from '@/components/compliance/ComplianceTracking';
import ComplianceReports from '@/components/compliance/ComplianceReports';
import TrainingManager from '@/components/TrainingManager';
import TrainingGapAnalysis from '@/components/compliance/TrainingGapAnalysis';
import SkillsMatrix from '@/components/compliance/SkillsMatrix';
import RAMSManager from '@/components/compliance/RAMSManager';

const tabs = [
  { id: 'tracking', label: 'Tracking', icon: ShieldCheck },
  { id: 'matrix', label: 'Skills Matrix', icon: Grid3x3 },
  { id: 'rams', label: 'RAMS', icon: FileCheck2 },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'gaps', label: 'Training Gaps', icon: AlertTriangle },
];

export default function ComplianceManager() {
  const [activeTab, setActiveTab] = useState('tracking');
  const { data: complianceItems = [] } = useQuery({ queryKey: ['compliance-items-hub'], queryFn: () => base44.entities.ComplianceItem.list('-created_date', 500) });

  const todayStr = new Date().toISOString().slice(0, 10);
  const total = complianceItems.length;
  const expired = complianceItems.filter(c => c.status_override !== 'not_required' && c.expiry_date && c.expiry_date.slice(0, 10) < todayStr).length;
  const expiringSoon = complianceItems.filter(c => {
    if (c.status_override === 'not_required' || !c.expiry_date) return false;
    const days = Math.floor((new Date(c.expiry_date + 'T00:00:00') - new Date(todayStr + 'T00:00:00')) / 86400000);
    return days >= 0 && days <= 30;
  }).length;
  const compliant = total - expired - expiringSoon;

  const summary = [
    { label: 'Total Items', value: total, icon: ShieldCheck, tone: 'text-emerald-100' },
    { label: 'Compliant', value: compliant, icon: CheckCircle2, tone: 'text-emerald-100' },
    { label: 'Expiring', value: expiringSoon, icon: Clock, tone: 'text-amber-100' },
    { label: 'Expired', value: expired, icon: XCircle, tone: 'text-rose-100' },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl mesh-bg shadow-xl">
        <div className="relative z-10 px-5 py-5 md:px-6 md:py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 ring-1 ring-white/25 flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Compliance Manager</h2>
              <p className="text-emerald-50/90 text-sm">Track certificates, training &amp; site qualifications — synced live.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {summary.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 ring-1 ring-white/15">
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${s.tone}`} />
                    <p className="text-[11px] font-medium text-emerald-100 uppercase tracking-wide">{s.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-white mt-0.5 tabular-nums">{s.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/70 shadow-sm p-1.5 inline-flex flex-wrap gap-1">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} type="button"
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-gradient-to-br from-[#2E5A1A] to-[#5A8C1E] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="insight-card rounded-2xl p-4 md:p-5">
        {activeTab === 'tracking' && <ComplianceTracking />}
        {activeTab === 'matrix' && <SkillsMatrix />}
        {activeTab === 'rams' && <RAMSManager />}
        {activeTab === 'reports' && <ComplianceReports />}
        {activeTab === 'training' && <TrainingManager />}
        {activeTab === 'gaps' && <TrainingGapAnalysis />}
      </div>
    </div>
  );
}