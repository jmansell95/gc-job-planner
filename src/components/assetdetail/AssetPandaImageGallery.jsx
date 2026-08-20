import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Camera, X, ChevronLeft, ChevronRight, RefreshCw, AlertCircle } from 'lucide-react';

/**
 * Asset Panda image gallery — thumbnail strip with a count badge and a
 * full-screen lightbox. Fetches images via the getAssetPandaImages backend
 * function (which caches them on the SiteAsset record). Shown only when the
 * asset has a panda_asset_id; hides entirely when there are no images.
 */
export default function AssetPandaImageGallery({ asset }) {
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const queryClient = useQueryClient();

  const hasPandaId = !!asset?.panda_asset_id;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['asset-panda-images', asset?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAssetPandaImages', { site_asset_id: asset.id });
      return res.data;
    },
    enabled: hasPandaId,
    staleTime: 5 * 60 * 1000,
  });

  const images = Array.isArray(data?.images) ? data.images : [];

  // Keyboard navigation in the lightbox.
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const showPrev = useCallback(() => {
    setLightboxIndex((i) => (i == null ? null : (i - 1 + images.length) % images.length));
  }, [images.length]);
  const showNext = useCallback(() => {
    setLightboxIndex((i) => (i == null ? null : (i + 1) % images.length));
  }, [images.length]);

  useEffect(() => {
    if (lightboxIndex == null) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, closeLightbox, showPrev, showNext]);

  // Hide entirely when there's no Asset Panda id, or once we know there
  // are no images (and we're not loading / erroring).
  if (!hasPandaId) return null;
  if (!isLoading && !isFetching && !isError && images.length === 0) return null;

  return (
    <>
      <div className="insight-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Camera className="w-4 h-4 text-[#2E5A1A]" /> Asset Panda Photos
            {images.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[#2E5A1A] text-white text-[11px] font-bold">
                {images.length}
              </span>
            )}
          </h3>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#2E5A1A] disabled:opacity-50 transition"
            title="Refresh from Asset Panda"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Loading shimmer */}
        {(isLoading || isFetching) && images.length === 0 && (
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-24 h-24 rounded-xl bg-slate-100 shimmer" />
            ))}
          </div>
        )}

        {/* Error state — show only if we have no images at all */}
        {isError && images.length === 0 && !isFetching && (
          <div className="flex items-center gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-800">
              Couldn't load photos from Asset Panda.{' '}
              <button onClick={() => refetch()} className="font-semibold underline">Try again</button>
            </p>
          </div>
        )}

        {/* Thumbnail strip */}
        {images.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setLightboxIndex(i)}
                className="flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden border border-slate-200 hover:border-[#2E5A1A] hover:shadow-md transition group relative"
              >
                <img
                  src={img.thumb || img.medium || img.url}
                  alt={img.name || `Asset photo ${i + 1}`}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex != null && images[lightboxIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-blue-950/60 backdrop-blur-md p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition z-10"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); showPrev(); }}
                className="absolute left-2 sm:left-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition z-10"
                aria-label="Previous"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); showNext(); }}
                className="absolute right-2 sm:right-4 p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition z-10"
                aria-label="Next"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          <figure
            className="max-w-[92vw] max-h-[88vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex].large || images[lightboxIndex].url}
              alt={images[lightboxIndex].name || `Asset photo ${lightboxIndex + 1}`}
              className="max-w-[92vw] max-h-[80vh] object-contain rounded-xl shadow-2xl"
            />
            <figcaption className="mt-3 text-xs text-white/80 font-medium text-center max-w-full truncate">
              {images[lightboxIndex].name || `Photo ${lightboxIndex + 1} of ${images.length}`}
              <span className="mx-1.5 opacity-50">·</span>
              {lightboxIndex + 1} / {images.length}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}