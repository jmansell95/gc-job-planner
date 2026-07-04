import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/80 ${className}`} />;
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-slate-300" />
        </div>
      )}
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {message && <p className="text-sm text-slate-400 mt-1 max-w-sm">{message}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition">
          <RefreshCw className="w-4 h-4" /> Try again
        </button>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex gap-1.5 mb-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-3" />
          <SkeletonText lines={2} />
        </div>
      ))}
    </div>
  );
}

export function RotaSkeleton() {
  return (
    <div className="p-4">
      <div className="flex bg-emerald-800/90 px-4 py-3 gap-2 rounded-t-lg">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-6 flex-1 bg-emerald-700/60" />)}
      </div>
      {Array.from({ length: 6 }).map((_, r) => (
        <div key={r} className="flex px-4 py-3 gap-2 border-b border-slate-100">
          {Array.from({ length: 8 }).map((_, c) => <Skeleton key={c} className="h-12 flex-1" />)}
        </div>
      ))}
    </div>
  );
}