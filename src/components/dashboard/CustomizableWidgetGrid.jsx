import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff, Settings2, Check, RotateCcw, Loader2, Maximize2, Minimize2, Square, Cloud } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WIDGET_REGISTRY, DEFAULT_WIDGETS, DEFAULT_HIDDEN, TIER_META, WIDGET_TIER } from '@/components/dashboard/registry';

// localStorage keys — used as instant-load cache so the UI never flashes
const ORDER_KEY = 'dashboard-widget-order-v3';
const HIDDEN_KEY = 'dashboard-widget-hidden-v3';
const SIZES_KEY = 'dashboard-widget-sizes-v3';

const TIER_ORDER = ['glance', 'insights'];
const TIER_GRADIENT = {
  glance: 'from-emerald-500 to-green-600',
  insights: 'from-blue-500 to-cyan-600',
};

// Size → Tailwind colspan class on large screens
// sm / md = half width (1 col), lg = full width (2 cols)
const SIZE_COLSPAN = { sm: '', md: '', lg: 'lg:col-span-2' };
const SIZE_ICON = { sm: Minimize2, md: Square, lg: Maximize2 };
const SIZE_LABEL = { sm: 'Small', md: 'Medium', lg: 'Large' };

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
  try {
    const saved = localStorage.getItem(HIDDEN_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [...DEFAULT_HIDDEN];
}

function loadSizesCache() {
  try {
    const saved = localStorage.getItem(SIZES_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

export default function CustomizableWidgetGrid({ renderWidget, canShowWidget }) {
  const [customize, setCustomize] = useState(false);
  const [order, setOrder] = useState(loadOrderCache);
  const [hidden, setHidden] = useState(loadHiddenCache);
  const [sizes, setSizes] = useState(loadSizesCache);
  const [layoutId, setLayoutId] = useState(null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);
  const hasAppliedServer = useRef(false);
  const queryClient = useQueryClient();

  // Fetch staff profile so we know which DashboardLayout record to load/save
  const { data: profile } = useQuery({
    queryKey: ['my-staff-profile'],
    queryFn: async () => { const res = await base44.functions.invoke('getMyStaffProfile'); return res.data; }
  });

  // Load the user's saved layout from the entity (persists across devices/logins)
  const { data: savedLayout } = useQuery({
    queryKey: ['my-dashboard-layout', profile?.id],
    queryFn: async () => {
      const layouts = await base44.entities.DashboardLayout.filter({ staff_id: profile.id });
      return layouts[0] || null;
    },
    enabled: !!profile?.id,
  });

  // Apply server layout once when it first arrives (overrides localStorage cache)
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

  // Persist to localStorage immediately (instant feedback, offline fallback)
  useEffect(() => { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }, [order]);
  useEffect(() => { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); }, [hidden]);
  useEffect(() => { localStorage.setItem(SIZES_KEY, JSON.stringify(sizes)); }, [sizes]);

  // Debounced save to entity — persists across logins and devices
  const saveToEntity = useCallback((newOrder, newHidden, newSizes) => {
    if (!profile?.id) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        const payload = {
          staff_id: profile.id,
          widget_order: newOrder,
          hidden_widgets: newHidden,
          widget_sizes: newSizes,
        };
        if (layoutId) {
          await base44.entities.DashboardLayout.update(layoutId, payload);
        } else {
          const created = await base44.entities.DashboardLayout.create(payload);
          if (created?.id) setLayoutId(created.id);
        }
      } catch (e) {
        // silent — localStorage is the fallback
      }
      setSaving(false);
    }, 800);
  }, [profile?.id, layoutId]);

  // Trigger entity save whenever layout changes
  useEffect(() => {
    saveToEntity(order, hidden, sizes);
  }, [order, hidden, sizes, saveToEntity]);

  const availableWidgets = order.filter(canShowWidget);
  const visibleWidgets = availableWidgets.filter(id => !hidden.includes(id));

  // Group visible widgets by tier
  const tieredWidgets = TIER_ORDER.map(tier => ({
    tier,
    meta: TIER_META[tier],
    widgets: visibleWidgets.filter(id => WIDGET_TIER[id] === tier),
  })).filter(t => t.widgets.length > 0);

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

  const toggleHidden = (id) => {
    setHidden(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const cycleSize = (id) => {
    setSizes(prev => {
      const current = prev[id] || 'md';
      const next = current === 'sm' ? 'md' : current === 'md' ? 'lg' : 'sm';
      return { ...prev, [id]: next };
    });
  };

  const resetLayout = () => {
    setOrder([...DEFAULT_WIDGETS]);
    setHidden([...DEFAULT_HIDDEN]);
    setSizes({});
  };

  return (
    <div className="mb-4">
      {/* Customize bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          {saving && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <Cloud className="w-3 h-3 animate-pulse" /> Saving layout…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {customize && (
            <button onClick={resetLayout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          <button onClick={() => setCustomize(!customize)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${customize ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {customize ? <><Check className="w-4 h-4" /> Done</> : <><Settings2 className="w-4 h-4" /> Customize</>}
          </button>
        </div>
      </div>

      {/* Visibility + size toggles — customize mode only */}
      {customize && availableWidgets.length > 0 && (
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

      {/* Tiered widget grid with drag-and-drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="widget-grid">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {tieredWidgets.map(({ tier, meta, widgets }) => {
                const TierIcon = meta.icon;
                const gradient = TIER_GRADIENT[tier];
                return (
                  <div key={tier} className="mb-6">
                    {/* Tier section header */}
                    <div className="flex items-center gap-2.5 mb-3 px-1">
                      <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <TierIcon className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-700 tracking-tight">{meta.label}</h3>
                      <div className="flex-1 h-px bg-gradient-to-r from-slate-200 to-transparent" />
                      <span className="text-xs text-slate-400 font-medium">{widgets.length} {widgets.length === 1 ? 'widget' : 'widgets'}</span>
                    </div>
                    {/* Widgets — sized by user preference, fullWidth config always spans both columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {widgets.map((widgetId) => {
                        const content = renderWidget(widgetId);
                        if (!content) return null;
                        const config = WIDGET_REGISTRY[widgetId];
                        const userSize = sizes[widgetId] || 'md';
                        const isFullWidth = config?.fullWidth || userSize === 'lg';
                        const SizeIcon = SIZE_ICON[userSize] || Square;
                        return (
                          <Draggable key={widgetId} draggableId={widgetId} index={visibleWidgets.indexOf(widgetId)} isDragDisabled={!customize}>
                            {(provided, snapshot) => (
                              <div ref={provided.innerRef} {...provided.draggableProps}
                                className={`${isFullWidth ? 'lg:col-span-2' : ''} relative ${customize ? 'ring-2 ring-[#2E5A1A]/30 rounded-2xl pt-5' : ''} ${snapshot.isDragging ? 'z-50 shadow-2xl' : ''}`}>
                                {customize && (
                                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
                                    <div {...provided.dragHandleProps}
                                      className="bg-[#2E5A1A] text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg cursor-grab active:cursor-grabbing">
                                      <GripVertical className="w-3 h-3" /> Drag
                                    </div>
                                    <button onClick={() => cycleSize(widgetId)}
                                      className="bg-white text-[#2E5A1A] px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg ring-1 ring-[#2E5A1A]/20 hover:bg-[#2E5A1A]/5 transition"
                                      title={`Size: ${SIZE_LABEL[userSize]} (click to change)`}>
                                      <SizeIcon className="w-3 h-3" /> {SIZE_LABEL[userSize]}
                                    </button>
                                  </div>
                                )}
                                {content}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                    </div>
                  </div>
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