import { base44 } from '@/api/base44Client';

const STORAGE_KEY = 'pending_briefing_signatures';

export function saveOfflineBriefing(data) {
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  pending.push({ ...data, saved_at: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
}

export function getOfflineBriefingCount() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').length;
}

export function hasOfflineBriefing(assignmentId) {
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return pending.some(p => p.assignment_id === assignmentId);
}

function dataURLtoBlob(dataURL) {
  const [meta, base64] = dataURL.split(',');
  const mime = meta.match(/:(.*?);/)[1];
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function syncPendingBriefings() {
  const pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (pending.length === 0) return 0;

  const remaining = [];
  let synced = 0;

  for (const item of pending) {
    try {
      let signatureUrl = item.signature_url || '';
      if (item.signature_data_url) {
        const blob = dataURLtoBlob(item.signature_data_url);
        const file = new File([blob], `signature_${item.assignment_id}.png`, { type: 'image/png' });
        const res = await base44.integrations.Core.UploadFile({ file });
        signatureUrl = res.file_url;
      }

      await base44.entities.BriefingSignature.create({
        assignment_id: item.assignment_id,
        staff_id: item.staff_id,
        staff_name: item.staff_name,
        job_id: item.job_id,
        assigned_date: item.assigned_date,
        signature_url: signatureUrl,
        signed_at: item.signed_at,
        induction_completed: item.induction_completed || false,
        induction_completed_at: item.induction_completed_at || null,
        document_ids_reviewed: item.document_ids_reviewed || '',
        briefing_duration_minutes: item.briefing_duration_minutes || 0,
        synced_from_offline: true
      });

      await base44.entities.RotaAssignment.update(item.assignment_id, {
        briefing_signed: true,
        briefing_signed_at: item.signed_at
      });

      synced++;
    } catch (err) {
      console.error('Sync error for briefing item:', err);
      remaining.push(item);
    }
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  return synced;
}