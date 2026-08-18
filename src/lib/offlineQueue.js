// Singleton offline action queue — queues entity creates/updates when the
// network drops and flushes them on reconnect. Consumed by useOfflineQueue
// and any field workflow that needs offline-tolerant saves.
import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'gc-offline-queue';
let queue = [];
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let flushing = false;
const listeners = new Set();

try { queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch {}

function emit() { listeners.forEach((l) => l({ queue, isOnline })); }
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch {} }
function setQueue(next) { queue = next; persist(); emit(); }

export function queueAction(entity, op, data, recordId = null) {
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entity,
    op,
    data,
    recordId,
    timestamp: new Date().toISOString(),
  };
  setQueue([...queue, item]);
  if (isOnline) flush();
  return item.id;
}

export async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const pending = [...queue];
  const succeeded = [];
  for (const item of pending) {
    try {
      if (item.op === 'create') await base44.entities[item.entity].create(item.data);
      else if (item.op === 'update') await base44.entities[item.entity].update(item.recordId, item.data);
      succeeded.push(item.id);
    } catch (e) {
      // stop on first failure (likely still offline or server error)
      break;
    }
  }
  if (succeeded.length) setQueue(queue.filter((i) => !succeeded.includes(i.id)));
  flushing = false;
}

export function subscribe(listener) {
  listeners.add(listener);
  listener({ queue, isOnline });
  return () => listeners.delete(listener);
}

export function getState() {
  return { queue, isOnline };
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isOnline = true;
    emit();
    flush();
  });
  window.addEventListener('offline', () => {
    isOnline = false;
    emit();
  });
}