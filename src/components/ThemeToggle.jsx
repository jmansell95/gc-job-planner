import React, { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

// Dark mode toggle — uses next-themes (already installed) with system preference
// detection. The .dark CSS tokens in index.css are already fully defined.
// Persists to localStorage and respects OS preference by default.

export default function ThemeToggle({ className }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only show toggle after mount
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={cn('w-9 h-9 rounded-lg bg-slate-100', className)} />;
  }

  const isDark = resolvedTheme === 'dark';
  const cycle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const label = theme === 'system' ? 'System' : isDark ? 'Dark' : 'Light';
  const Icon = theme === 'system' ? Monitor : isDark ? Moon : Sun;

  return (
    <button
      onClick={cycle}
      title={`Theme: ${label} — click to change`}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all',
        'ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50',
        'dark:ring-slate-700 dark:hover:bg-slate-800',
        className
      )}
    >
      <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
    </button>
  );
}