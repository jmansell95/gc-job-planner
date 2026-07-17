import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { ExternalLink } from 'lucide-react';

// Opens a certificate file — handles both public URLs (http/https) and
// private file URIs that require a signed download link.
export default function CertificateLink({ url, label = 'View Certificate', icon: Icon, className = '' }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e) => {
    if (!url) return;
    // Public HTTP URLs open directly via the <a> — no interception needed
    if (url.startsWith('http://') || url.startsWith('https://')) return;
    // Private file URI — generate a signed URL on demand
    e.preventDefault();
    setLoading(true);
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url });
      if (res?.signed_url) {
        window.open(res.signed_url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('Failed to open certificate:', err);
    }
    setLoading(false);
  };

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-xs text-emerald-700 font-medium mt-1.5 hover:underline ${className}`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {loading ? 'Opening…' : label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}