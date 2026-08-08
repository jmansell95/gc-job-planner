import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Trash2, X, ChevronLeft, ChevronRight, Film } from 'lucide-react';
import { format } from 'date-fns';
import PhotoTimeLapseView from '@/components/jobs/PhotoTimeLapseView';

export default function JobPhotoGallery({ job }) {
  const queryClient = useQueryClient();
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showTimeLapse, setShowTimeLapse] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: ['site-photos', job.id],
    queryFn: () => base44.entities.SitePhoto.filter({ job_id: job.id }, '-created_date', 500),
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await base44.entities.SitePhoto.delete(id);
      queryClient.invalidateQueries({ queryKey: ['site-photos', job.id] });
      setLightboxIdx(null);
    } catch (e) { console.error(e); }
    setDeletingId(null);
  };

  const closeLightbox = () => setLightboxIdx(null);
  const prev = () => setLightboxIdx(i => (i - 1 + photos.length) % photos.length);
  const next = () => setLightboxIdx(i => (i + 1) % photos.length);
  const current = lightboxIdx != null ? photos[lightboxIdx] : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <Camera className="w-5 h-5 text-emerald-700" />
        <h3 className="font-semibold text-slate-900 text-sm">Site Photos</h3>
        <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">{photos.length}</span>
        {photos.length > 1 && (
          <button onClick={() => setShowTimeLapse(s => !s)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition ${showTimeLapse ? 'bg-[#2E5A1A] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Film className="w-3.5 h-3.5" /> Time-Lapse
          </button>
        )}
      </div>
      {showTimeLapse && photos.length > 1 && (
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <PhotoTimeLapseView jobId={job.id} />
        </div>
      )}
      {photos.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">No photos uploaded for this job yet</div>
      ) : (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((p, idx) => (
            <div key={p.id} className="relative group rounded-lg overflow-hidden border border-slate-200 aspect-square">
              <img src={p.photo_url} alt={p.caption || ''} className="w-full h-full object-cover cursor-pointer" onClick={() => setLightboxIdx(idx)} />
              <button onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600 disabled:opacity-50"
                title="Delete photo">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/65 to-transparent px-2 py-1.5">
                {p.caption && <p className="text-[10px] text-white truncate">{p.caption}</p>}
                <p className="text-[9px] text-white/70 truncate">
                  {p.uploaded_by_name ? p.uploaded_by_name : ''}
                  {p.created_date ? ` · ${format(new Date(p.created_date), 'dd MMM')}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition">
            <X className="w-5 h-5" />
          </button>
          {photos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-3 md:left-6 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition">
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-3 md:right-6 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition">
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <div className="max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={current.photo_url} alt={current.caption || ''} className="max-w-full max-h-[78vh] object-contain rounded-lg" />
            <div className="mt-3 flex items-center justify-between gap-4 w-full max-w-2xl">
              <div className="min-w-0">
                {current.caption && <p className="text-sm text-white truncate">{current.caption}</p>}
                <p className="text-xs text-white/60">
                  {current.uploaded_by_name ? `Uploaded by ${current.uploaded_by_name}` : ''}
                  {current.created_date ? ` · ${format(new Date(current.created_date), 'dd MMM yyyy')}` : ''}
                </p>
              </div>
              <button onClick={() => handleDelete(current.id)} disabled={deletingId === current.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}