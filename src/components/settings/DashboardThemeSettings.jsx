import React, { useState } from 'react';
import { Palette, Check } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import SettingsSectionHeader from '@/components/SettingsSectionHeader';

// Customizable Dashboard Color Themes — lets each user pick from preset
// accent color themes that recolor their dashboard accents and stat tiles.
// Stored in localStorage and applied via a CSS custom property override.

const THEMES = [
  { id: 'emerald', label: 'Ground Control', primary: '96 52% 22%', accent: '88 52% 45%', preview: 'linear-gradient(135deg, #2E5A1A, #8DC63F)' },
  { id: 'blue', label: 'Ocean Blue', primary: '221 83% 28%', accent: '199 89% 48%', preview: 'linear-gradient(135deg, #1d4ed8, #06b6d4)' },
  { id: 'violet', label: 'Royal Violet', primary: '265 75% 45%', accent: '280 65% 55%', preview: 'linear-gradient(135deg, #7c3aed, #c026d3)' },
  { id: 'amber', label: 'Sunset Amber', primary: '28 80% 35%', accent: '38 92% 55%', preview: 'linear-gradient(135deg, #d97706, #fbbf24)' },
  { id: 'rose', label: 'Crimson Rose', primary: '342 75% 40%', accent: '350 80% 55%', preview: 'linear-gradient(135deg, #be123c, #fb7185)' },
  { id: 'teal', label: 'Forest Teal', primary: '173 80% 30%', accent: '160 60% 45%', preview: 'linear-gradient(135deg, #0d9488, #2dd4bf)' },
];

export default function DashboardThemeSettings() {
  const { toast } = useToast();
  const [selected, setSelected] = useState(() => localStorage.getItem('dashboard-theme') || 'emerald');

  const applyTheme = (themeId) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;
    localStorage.setItem('dashboard-theme', themeId);
    setSelected(themeId);
    // Apply CSS custom properties
    const root = document.documentElement;
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--accent', theme.accent);
    root.style.setProperty('--ring', theme.primary);
    root.style.setProperty('--sidebar-primary', theme.primary);
    root.style.setProperty('--sidebar-accent', theme.primary);
    root.style.setProperty('--sidebar-ring', theme.primary);
    toast({ title: `✓ ${theme.label} theme applied`, description: 'Your dashboard accents have been recolored.' });
  };

  return (
    <div>
      <SettingsSectionHeader
        icon={Palette}
        title="Dashboard Color Themes"
        description="Personalize your dashboard with a preset accent color theme. Changes apply instantly and persist on this device."
      />

      <div className="insight-card rounded-2xl p-5">
        <p className="text-sm font-semibold text-slate-700 mb-3">Choose Your Accent Theme</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {THEMES.map(t => (
            <button
              key={t.id}
              onClick={() => applyTheme(t.id)}
              className={`relative rounded-xl p-4 text-left transition-all ${
                selected === t.id
                  ? 'ring-2 ring-emerald-600 shadow-md scale-[1.02]'
                  : 'ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-sm'
              }`}
            >
              <div className="h-14 rounded-lg mb-2.5" style={{ background: t.preview }} />
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{t.label}</p>
                {selected === t.id && (
                  <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Your theme choice is stored on this device and overrides the default Ground Control green accents.
          </p>
        </div>
      </div>
    </div>
  );
}