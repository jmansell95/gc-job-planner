import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Upload, Trash2, Download, Eye, Truck, Link2 } from 'lucide-react';

const categoryConfig = {
  rams: { label: 'RAMS', badge: 'bg-red-100 text-red-700' },
  method_statement: { label: 'Method Statement', badge: 'bg-blue-100 text-blue-700' },
  risk_assessment: { label: 'Risk Assessment', badge: 'bg-amber-100 text-amber-700' },
  completion_cert: { label: 'Completion Cert', badge: 'bg-emerald-100 text-emerald-700' },
  other: { label: 'Document', badge: 'bg-slate-100 text-slate-600' }
};

export default function DocumentManager({ job }) {
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('other');
  const [linkedCostItemId, setLinkedCostItemId] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [collectionNotes, setCollectionNotes] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: documents = [] } = useQuery({
    queryKey: ['job-documents', job.id],
    queryFn: () => base44.entities.JobDocument.filter({ job_id: job.id })
  });

  const { data: costItems = [] } = useQuery({
    queryKey: ['job-cost-items', job.id],
    queryFn: () => base44.entities.JobCostItem.filter({ job_id: job.id })
  });

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.JobDocument.create({
        job_id: job.id,
        document_url: file_url,
        document_name: file.name,
        category,
        linked_cost_item_id: linkedCostItemId || '',
        delivery_notes: deliveryNotes || '',
        collection_notes: collectionNotes || ''
      });
      queryClient.invalidateQueries({ queryKey: ['job-documents', job.id] });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setLinkedCostItemId('');
      setDeliveryNotes('');
      setCollectionNotes('');
      setShowDetails(false);
    } catch (error) {
      console.error('Error uploading document:', error);
    }
    setUploading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.JobDocument.delete(id);
    queryClient.invalidateQueries({ queryKey: ['job-documents', job.id] });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <FileText className="w-5 h-5 text-emerald-700" />
        <h2 className="font-semibold text-slate-900">Documents</h2>
        <span className="ml-auto text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{documents.length}</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
            {Object.entries(categoryConfig).map(([key, cfg]) => (
              <option key={key} value={key}>{cfg.label}</option>
            ))}
          </select>
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-medium disabled:opacity-50">
            <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
          </button>
          <button onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 rounded-lg hover:bg-slate-50 transition text-sm font-medium ml-auto">
            <Link2 className="w-4 h-4" /> {showDetails ? 'Hide' : 'Link & notes'}
          </button>
        </div>

        {showDetails && (
          <div className="border border-slate-200 rounded-lg p-3 mb-4 space-y-3 bg-slate-50/50">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Link to equipment</label>
              <select value={linkedCostItemId} onChange={e => setLinkedCostItemId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600">
                <option value="">None (standalone document)</option>
                {costItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.description}{item.reference_number ? ` · Ref: ${item.reference_number}` : ''}{item.category === 'hired_equipment' ? ' (Hired)' : ' (Internal)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Delivery Notes</label>
                <textarea value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} rows="2" placeholder="Delivery address, contact, timing" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Collection Notes</label>
                <textarea value={collectionNotes} onChange={e => setCollectionNotes(e.target.value)} rows="2" placeholder="Collection date, contact, return condition" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-emerald-600" />
              </div>
            </div>
            <p className="text-xs text-slate-400">These details are saved with the document and visible on its card below.</p>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">No documents uploaded yet</p>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const cfg = categoryConfig[doc.category] || categoryConfig.other;
              const linkedItem = costItems.find(c => c.id === doc.linked_cost_item_id);
              return (
                <div key={doc.id} className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">{doc.document_name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                      {linkedItem && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600 inline-flex items-center gap-1">
                          <Link2 className="w-2.5 h-2.5" /> {linkedItem.description}{linkedItem.reference_number ? ` · ${linkedItem.reference_number}` : ''}
                        </span>
                      )}
                    </div>
                    {(doc.delivery_notes || doc.collection_notes) && (
                      <div className="mt-1.5 space-y-1">
                        {doc.delivery_notes && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-500">
                            <Truck className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span><span className="font-medium text-slate-600">Delivery:</span> {doc.delivery_notes}</span>
                          </div>
                        )}
                        {doc.collection_notes && (
                          <div className="flex items-start gap-1.5 text-xs text-slate-500">
                            <Truck className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span><span className="font-medium text-slate-600">Collection:</span> {doc.collection_notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <a href={doc.document_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                    <a href={doc.document_url} download={doc.document_name}
                      className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}