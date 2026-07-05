import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, X, Trash2 } from 'lucide-react';

export default function SitePhotoUpload({ jobId, staffName }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [caption, setCaption] = useState('');
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: photos = [] } = useQuery({
    queryKey: ['site-photos', jobId],
    queryFn: () => base44.entities.SitePhoto.filter({ job_id: jobId }, '-created_date', 200),
    enabled: !!jobId
  });

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !jobId) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i++) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: files[i] });
        await base44.entities.SitePhoto.create({
          job_id: jobId,
          photo_url: file_url,
          caption: caption || '',
          uploaded_by_name: staffName || ''
        });
        setProgress({ done: i + 1, total: files.length });
      }
      setCaption('');
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['site-photos', jobId] });
    } catch (error) {
      console.error('Error uploading photo:', error);
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.SitePhoto.delete(id);
    queryClient.invalidateQueries({ queryKey: ['site-photos', jobId] });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <Camera className="w-4 h-4 text-emerald-600" /> Site Photos
          {photos.length > 0 && <span className="text-xs font-medium text-slate-400">({photos.length})</span>}
        </div>
        <span className="text-[11px] text-slate-400">Optional</span>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
          {photos.map(p => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
              <img src={p.photo_url} alt={p.caption || ''} className="w-full h-full object-cover" />
              <button onClick={() => handleDelete(p.id)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-600">
                <Trash2 className="w-3 h-3" />
              </button>
              {p.caption && (
                <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[9px] px-1 py-0.5 truncate">{p.caption}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Caption (optional, applied to all photos)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            onChange={handleUpload} className="hidden" />
          <div className="flex gap-2">
            <button onClick={() => fileInputRef.current.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50">
              <Upload className="w-4 h-4" /> {uploading ? `Uploading ${progress.done}/${progress.total}…` : 'Choose Photos'}
            </button>
            <button onClick={() => setShowForm(false)} disabled={uploading}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium disabled:opacity-50">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
          <p className="text-[11px] text-slate-400">Select multiple photos at once and upload them any time before you submit your timesheet.</p>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium w-full sm:w-auto">
          <Camera className="w-4 h-4" /> {photos.length > 0 ? 'Add More Photos' : 'Add Site Photos'}
        </button>
      )}
    </div>
  );
}