import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff, Settings2, Check, RotateCcw, Loader2, Maximize2, Minimize2, Square, Cloud } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WIDGET_REGISTRY, DEFAULT_WIDGETS, DEFAULT_HIDDEN } from '@/components/dashboard/registry';

const ORDER_KEY = 'dashboard-widget-order-v3';
const HIDDEN_KEY = 'dashboard-widget-hidden-v3';
const SIZES_KEY = 'dashboard-widget-sizes-v3';

// Size → Tailwind colspan on the 4-col grid
const SIZE_COLSPAN = { sm: 'lg:col-span-1', md: 'lg:col-span-2', lg: 'lg:col-span-3', xl: 'lg:col-span-4' };
const SIZE_ICON = { sm: Minimize2, md: Square, lg: Maximize2, xl: Maximize2 };
const SIZE_LABEL = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };
const SIZE_NEXT = { sm: 'md', md: 'lg', lg: 'xl', xl: 'sm' };

function loadOrderCache() {
  try {
    const saved = localStorage.getItem(ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const valid = parsed.filter(id => WIDGET_REGISTRY[id]);
      const newWidgets = DEFAULT_WIDGETS.filter(id => !valid.includes(id));
      return [...valid, ...newWidgets];
    }
  } catch {}
  return [...DEFAULT_WIDGETS];
}
function loadHiddenCache() {
  try { const s = localStorage.getItem(HIDDEN_KEY); if (s) return JSON.parse(s); } catch {}
  return [...DEFAULT_HIDDEN];
}
function loadSizesCache() {
  try { const s = localStorage.getItem(SIZES_KEY); if (s) return JSON.parse(s); } catch {}
  return {};
}

export default function CustomisableWidgetGrid({ renderWidget, canShowWidget }) {
  const [customise, setCustomise] = useState(false);
  const [order, setOrder] = useState(loadOrderCache);
  const [hidden, setHidden] = useState(loadHiddenCache);
  const [sizes, setSizes] = useState(loadSizesCache);
  const [layoutId, setLayoutId] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const hasAppliedServer = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  const { data: savedLayout } = useQuery({
    queryKey: ['my-dashboard-layout', profile?.id],
    queryFn: async () => {
      const layouts = await base44.entities.DashboardLayout.filter({ staff_id: profile.id });
      return layouts[0] || null;
    },
    enabled: !!profile?.id,
  });

  useEffect(() => {
    if (!savedLayout || hasAppliedServer.current) return;
    hasAppliedServer.current = true;
    if (savedLayout.widget_order) {
      const valid = savedLayout.widget_order.filter(id => WIDGET_REGISTRY[id]);
      const newWidgets = DEFAULT_WIDGETS.filter(id => !valid.includes(id));
      setOrder([...valid, ...newWidgets]);
    }
    if (savedLayout.hidden_widgets) setHidden(savedLayout.hidden_widgets);
    if (savedLayout.widget_sizes) setSizes(savedLayout.widget_sizes || {});
    if (savedLayout.id) setLayoutId(savedLayout.id);
  }, [savedLayout]);

  useEffect(() => { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }, [order]);
  useEffect(() => { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); }, [hidden]);
  useEffect(() => { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes)); }, [sizes]);

  const saveToEntity = useCallback((newOrder, newHidden, newSizes) => {
    if (!profile?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const payload = { staff_id: profile.id, widget_order: newOrder, hidden_widgets: newHidden, widget_sizes: newSizes };
        if (layoutId) await base44.entities.DashboardLayout.update(layoutId, payload);
        else { const created = await base44.entities.DashboardLayout.create(payload); if (created?.id) setLayoutId(created.id); }
      } catch {}
      setSaving(false);
    }, 800);
  }, [profile?.id, layoutId]);

  useEffect(() => { saveToEntity(order, hidden, sizes); }, [order, hidden, sizes, saveToEntity]);

  const availableWidgets = order.filter(canShowWidget);
  const visibleWidgets = availableWidgets.filter(id => !hidden.includes(id));

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = [...visibleWidgets];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const visibleSet = new Set(visibleWidgets);
    let vi = 0;
    const newOrder = order.map(id => (visibleSet.has(id) ? reordered[vi++] : id));
    setOrder(newOrder);
  };

  const toggleHidden = (id) => setHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const cycleSize = (id) => setSizes(prev => ({ ...prev, [id]: SIZE_NEXT[prev[id] || 'md'] }));
  const resetLayout = () => { setOrder([...DEFAULT_WIDGETS]); setHidden([...DEFAULT_HIDDEN]); setSizes({}); };

  return (
    <div className="mb-4">
      {/* Customise bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          {saving && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Cloud className="w-3 h-3 animate-pulse" /> Saving…
            </span>
          )}
          {customise && (
            <span className="text-[11px] text-slate-400 font-medium hidden sm:block">
              Drag to reorder · click size to resize
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {customise && (
            <button onClick={resetLayout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          <button onClick={() => setCustomise(!customise)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${customise ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {customise ? <><Check className="w-4 h-4" /> Done</> : <><Settings2 className="w-4 h-4" /> Customise</>}
          </button>
        </div>
      </div>

      {/* Visibility toggles — customise mode only */}
      {customise && availableWidgets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 px-1">
          {availableWidgets.map(id => {
            const config = WIDGET_REGISTRY[id];
            if (!config) return null;
            const isHidden = hidden.includes(id);
            return (
              <button key={id} onClick={() => toggleHidden(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${isHidden ? 'bg-slate-100 text-slate-400 line-through' : 'bg-[#2E5A1A]/10 text-[#2E5A1A] hover:bg-[#2E5A1A]/20'}`}>
                {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {config.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Flat widget grid — single Droppable so drag-and-drop actually works */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="widget-grid">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {visibleWidgets.map((widgetId, index) => {
                const content = renderWidget(widgetId);
                if (!content) return null;
                const config = WIDGET_REGISTRY[widgetId];
                const userSize = sizes[widgetId] || (config?.fullWidth ? 'xl' : 'md');
                const colspanClass = SIZE_COLSPAN[userSize] || 'lg:col-span-2';
                const SizeIcon = SIZE_ICON[userSize] || Square;
                return (
                  <Draggable key={widgetId} draggableId={widgetId} index={index} isDragDisabled={!customise}>
                    {(prov, snapshot) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        className={`${colspanClass} relative ${customise ? 'ring-2 ring-[#2E5A1A]/30 rounded-2xl pt-8' : ''} ${snapshot.isDragging ? 'z-50 shadow-2xl opacity-90' : ''}`}
                      >
                        {customise && (
                          <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5">
                            <div {...prov.dragHandleProps}
                              className="bg-[#2E5A1A] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-grab active:cursor-grabbing touch-manipulation">
                              <GripVertical className="w-3.5 h-3.5" /> Drag
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); cycleSize(widgetId); }}
                              className="bg-white text-[#2E5A1A] px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg ring-1 ring-[#2E5A1A]/20 hover:bg-[#2E5A1A]/5 transition z-30 relative touch-manipulation"
                              title={`Size: ${SIZE_LABEL[userSize]} (click to change)`}
                            >
                              <SizeIcon className="w-3.5 h-3.5" /> {SIZE_LABEL[userSize]}
                            </button>
                          </div>
                        )}
                        {content}
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}