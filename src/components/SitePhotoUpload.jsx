import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Upload, X } from 'lucide-react';

export default function SitePhotoUpload({ jobId, staffName }) {
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState('');
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !jobId) return;

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.SitePhoto.create({
        job_id: jobId,
        photo_url: file_url,
        caption: caption || '',
        uploaded_by_name: staffName || ''
      });
      setCaption('');
      setShowForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      queryClient.invalidateQueries({ queryKey: ['site-photos', jobId] });
    } catch (error) {
      console.error('Error uploading photo:', error);
    }
    setUploading(false);
  };

  return (
    <div>
      {showForm ? (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
          <input type="text" value={caption} onChange={e => setCaption(e.target.value)}
            placeholder="Photo caption (optional)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
              onChange={handleUpload} className="hidden" />
            <button onClick={() => fileInputRef.current.click()} disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium disabled:opacity-50">
              <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Choose Photo'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-1 px-3 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition text-sm font-medium">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition text-sm font-medium w-full sm:w-auto">
          <Camera className="w-4 h-4" /> Upload Site Photo
        </button>
      )}
    </div>
  );
}