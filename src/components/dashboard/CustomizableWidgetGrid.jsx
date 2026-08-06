import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Eye, EyeOff, Settings2, Check, RotateCcw } from 'lucide-react';
import { WIDGET_REGISTRY, DEFAULT_WIDGETS } from '@/components/dashboard/registry';

const ORDER_KEY = 'dashboard-widget-order';
const HIDDEN_KEY = 'dashboard-widget-hidden';

function loadOrder() {
  try {
    const saved = localStorage.getItem(ORDER_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge any new default widgets not yet in the saved order
      const newWidgets = DEFAULT_WIDGETS.filter(id => !parsed.includes(id));
      return [...parsed, ...newWidgets];
    }
  } catch {}
  return [...DEFAULT_WIDGETS];
}

function loadHidden() {
  try {
    const saved = localStorage.getItem(HIDDEN_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

/**
 * CustomizableWidgetGrid — renders dashboard widgets in a drag-and-drop grid.
 * - No outer card wrapper; each widget renders directly (widgets have their
 *   own WidgetShell with card + title).
 * - All widgets are visible by default (no Show More toggle).
 * - "Customize" button enters edit mode: drag handles appear, widgets can
 *   be reordered via drag-and-drop, and visibility can be toggled.
 * - Order and hidden state persist to localStorage.
 */
export default function CustomizableWidgetGrid({ renderWidget, canShowWidget }) {
  const [customize, setCustomize] = useState(false);
  const [order, setOrder] = useState(loadOrder);
  const [hidden, setHidden] = useState(loadHidden);

  useEffect(() => { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); }, [order]);
  useEffect(() => { localStorage.setItem(HIDDEN_KEY, JSON.stringify(hidden)); }, [hidden]);

  // Widgets that pass the permission/job-scope filter
  const availableWidgets = order.filter(canShowWidget);
  // Widgets that are also not manually hidden
  const visibleWidgets = availableWidgets.filter(id => !hidden.includes(id));

  const onDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    // Reorder within the visible list
    const reordered = [...visibleWidgets];
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    // Rebuild full order, preserving non-visible items in their original positions
    const visibleSet = new Set(visibleWidgets);
    let vi = 0;
    const newOrder = order.map(id => (visibleSet.has(id) ? reordered[vi++] : id));
    setOrder(newOrder);
  };

  const toggleHidden = (id) => {
    setHidden(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const resetLayout = () => {
    setOrder([...DEFAULT_WIDGETS]);
    setHidden([]);
  };

  return (
    <div className="mb-4">
      {/* Customize bar */}
      <div className="flex items-center justify-end mb-3 px-1">
        <div className="flex items-center gap-2">
          {customize && (
            <button
              onClick={resetLayout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          <button
            onClick={() => setCustomize(!customize)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition ${customize ? 'bg-[#2E5A1A] text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            {customize ? <><Check className="w-4 h-4" /> Done</> : <><Settings2 className="w-4 h-4" /> Customize</>}
          </button>
        </div>
      </div>

      {/* Visibility toggles — customize mode only */}
      {customize && availableWidgets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 px-1">
          {availableWidgets.map(id => {
            const config = WIDGET_REGISTRY[id];
            if (!config) return null;
            const isHidden = hidden.includes(id);
            return (
              <button
                key={id}
                onClick={() => toggleHidden(id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${isHidden ? 'bg-slate-100 text-slate-400 line-through' : 'bg-[#2E5A1A]/10 text-[#2E5A1A] hover:bg-[#2E5A1A]/20'}`}
              >
                {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {config.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Widget grid with drag-and-drop */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="widget-grid">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex flex-wrap gap-4"
            >
              {visibleWidgets.map((widgetId, index) => (
                <Draggable
                  key={widgetId}
                  draggableId={widgetId}
                  index={index}
                  isDragDisabled={!customize}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`w-full lg:w-[calc(50%-0.5rem)] relative ${customize ? 'ring-2 ring-[#2E5A1A]/30 rounded-2xl pt-5' : ''} ${snapshot.isDragging ? 'z-50 shadow-2xl' : ''}`}
                    >
                      {customize && (
                        <div
                          {...provided.dragHandleProps}
                          className="absolute -top-0.5 left-1/2 -translate-x-1/2 z-20 bg-[#2E5A1A] text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg cursor-grab active:cursor-grabbing"
                        >
                          <GripVertical className="w-3 h-3" /> Drag
                        </div>
                      )}
                      {renderWidget(widgetId)}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}