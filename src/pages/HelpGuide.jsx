import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, HelpCircle, FileText, Download, ChevronRight, BookOpen, Truck, ShieldCheck, AlertTriangle, Info, ArrowLeft, Boxes } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { EmptyState, Skeleton } from '@/components/StateViews';
import { Button } from '@/components/ui/button';
import Breadcrumbs from '@/components/Breadcrumbs';

const categoryConfig = {
  delivery: { label: 'Deliveries', icon: Truck, color: 'text-[#2E5A1A]', bg: 'bg-[#2E5A1A]/10' },
  logistics: { label: 'Logistics & Equipment', icon: Boxes, color: 'text-teal-600', bg: 'bg-teal-50' },
  compliance: { label: 'Compliance', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
  safety: { label: 'Safety', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
  general: { label: 'General', icon: Info, color: 'text-slate-600', bg: 'bg-slate-50' },
  app_usage: { label: 'Using the App', icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50' }
};

export default function HelpGuide() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTopic, setSelectedTopic] = useState(null);

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['help-topics'],
    queryFn: async () => {
      const list = await base44.entities.HelpTopic.filter({ is_active: true });
      return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
  });

  const filtered = useMemo(() => {
    let result = topics;
    if (activeCategory !== 'all') {
      result = result.filter(t => t.category === activeCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.summary?.toLowerCase().includes(q) ||
        t.content?.toLowerCase().includes(q) ||
        t.tags?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [topics, activeCategory, search]);

  const groupedByCategory = useMemo(() => {
    const groups = {};
    filtered.forEach(t => {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    });
    return groups;
  }, [filtered]);

  const handleExportPDF = () => {
    // Use browser print for a clean printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <html>
      <head>
        <title>GC Job Planner — Help Guide</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; }
          h1 { color: #2E5A1A; border-bottom: 2px solid #d1fae5; padding-bottom: 10px; }
          h2 { color: #2E5A1A; margin-top: 32px; }
          h3 { color: #2E5A1A; }
          .topic { margin-bottom: 24px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 8px; page-break-inside: avoid; }
          .category-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; }
          .summary { color: #475569; font-style: italic; margin: 4px 0 12px; }
          p { line-height: 1.6; }
          ul, ol { line-height: 1.6; }
          code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
          @media print { body { margin: 20px; } }
        </style>
      </head>
      <body>
        <h1>GC Job Planner — Help Guide</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        ${filtered.map(t => `
          <div class="topic">
            <p class="category-label">${categoryConfig[t.category]?.label || t.category}</p>
            <h2>${t.title}</h2>
            ${t.summary ? `<p class="summary">${t.summary}</p>` : ''}
            <div>${(t.content || '').replace(/\n/g, '<br>')}</div>
          </div>
        `).join('')}
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  };

  const categories = Object.keys(groupedByCategory);

  return (
    <div className="bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="hero-gradient relative overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="relative max-w-4xl mx-auto px-4 md:px-6 py-5 md:py-7">
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-[#8DC63F] to-[#2E5A1A] flex items-center justify-center shadow-lg ring-1 ring-white/25 flex-shrink-0">
                <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white truncate tracking-tight">Help Guide</h1>
                <p className="text-white/80 text-xs sm:text-sm md:text-base mt-0.5">Everything you need to know</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button onClick={handleExportPDF} type="button"
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-xs sm:text-sm font-medium active:scale-95 transition touch-manipulation">
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Print PDF</span>
              </button>
              <button onClick={() => navigate(-1)} type="button"
                className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-white/15 hover:bg-white/25 ring-1 ring-white/20 text-white text-xs sm:text-sm font-medium active:scale-95 transition touch-manipulation">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Back</span>
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search help topics…"
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/90 text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2E5A1A]/40 shadow-lg"
            />
          </div>
        </div>
      </div>
      <Breadcrumbs />

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 pt-5 md:pt-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${activeCategory === 'all' ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            All
          </button>
          {Object.entries(categoryConfig).map(([key, cfg]) => {
            const count = topics.filter(t => t.category === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${activeCategory === key ? 'bg-[#2E5A1A] text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200">
            <EmptyState icon={Search} title={search ? "No results found" : "No help topics yet"} message={search ? "Try a different search term." : "Help articles will appear here once published."} />
          </div>
        ) : (
          <div className="space-y-6">
            {categories.map(catKey => {
              const cfg = categoryConfig[catKey] || categoryConfig.general;
              const CatIcon = cfg.icon;
              return (
                <div key={catKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.bg}`}>
                      <CatIcon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide">{cfg.label}</h2>
                  </div>
                  <div className="space-y-2">
                    {groupedByCategory[catKey].map(topic => (
                      <button
                        key={topic.id}
                        onClick={() => setSelectedTopic(topic)}
                        className="w-full text-left bg-white rounded-xl border border-slate-200 p-4 hover:border-[#2E5A1A]/30 hover:shadow-md hover:bg-[#2E5A1A]/5 transition group"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 text-sm group-hover:text-[#2E5A1A] transition">{topic.title}</h3>
                            {topic.summary && <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">{topic.summary}</p>}
                          </div>
                          <div className="w-7 h-7 rounded-lg bg-slate-50 group-hover:bg-[#2E5A1A]/15 flex items-center justify-center flex-shrink-0 transition">
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#2E5A1A] transition" />
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Topic detail modal */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 p-0 md:p-4"
            onClick={() => setSelectedTopic(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-slate-100 px-5 sm:px-7 py-4 flex items-center justify-between z-10">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {(() => { const c = categoryConfig[selectedTopic.category]; return c && <span className="text-[10px] font-semibold text-[#2E5A1A] uppercase tracking-wide">{c.label}</span>; })()}
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate leading-tight">{selectedTopic.title}</h2>
                </div>
                <button onClick={() => setSelectedTopic(null)} className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition ml-3 flex-shrink-0">
                  <span className="text-slate-500 font-bold text-lg">✕</span>
                </button>
              </div>
              <div className="px-5 sm:px-7 py-5 sm:py-6">
                {selectedTopic.summary && (
                  <div className="mb-5 pb-4 border-b border-slate-100">
                    <p className="text-sm text-slate-500 leading-relaxed">{selectedTopic.summary}</p>
                  </div>
                )}
                <ReactMarkdown
                  components={{
                    h2: ({ children }) => <h2 className="text-lg font-bold text-slate-900 mt-6 mb-2.5 pb-1.5 border-b border-slate-100">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-semibold text-slate-800 mt-4 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="text-sm text-slate-600 leading-relaxed mb-3.5">{children}</p>,
                    li: ({ children }) => <li className="text-sm text-slate-600 leading-relaxed mb-1.5 ml-1">{children}</li>,
                    ul: ({ children }) => <ul className="list-disc list-outside space-y-1 mb-4 ml-4 text-slate-600 marker:text-[#8DC63F] marker:text-xs">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-outside space-y-1 mb-4 ml-4 text-slate-600 marker:text-[#2E5A1A] marker:font-semibold">{children}</ol>,
                    strong: ({ children }) => <strong className="font-semibold text-slate-800 bg-[#2E5A1A]/10 px-1 rounded">{children}</strong>,
                    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm text-[#2E5A1A] font-medium underline decoration-[#2E5A1A]/40 underline-offset-2 hover:text-[#2E5A1A]">{children}</a>,
                    code: ({ children }) => <code className="text-xs font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md border border-slate-200">{children}</code>,
                    blockquote: ({ children }) => <blockquote className="border-l-3 border-[#2E5A1A]/30 pl-4 my-4 text-sm text-slate-500 italic bg-[#2E5A1A]/10 py-2.5 pr-3 rounded-r-lg">{children}</blockquote>,
                  }}
                >
                  {selectedTopic.content || ''}
                </ReactMarkdown>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}