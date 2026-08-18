import React from 'react';

// TabletSplitPane — renders a list/detail split on tablet+ (md breakpoint),
// stacked on mobile. The list pane is a fixed-width left column on tablets;
// the detail pane fills the rest. Both panes scroll independently.
// Use this for any field/admin screen that shows a selectable list with a
// detail view, so phone and tablet get appropriate layouts from one code path.
export default function TabletSplitPane({ list, detail, listClassName = '', detailClassName = '', className = '' }) {
  return (
    <div className={`flex flex-col md:flex-row gap-3 md:gap-4 h-full ${className}`}>
      <div className={`md:w-2/5 md:max-w-sm lg:max-w-md flex-shrink-0 md:overflow-y-auto ${listClassName}`}>
        {list}
      </div>
      <div className={`flex-1 md:overflow-y-auto ${detailClassName}`}>
        {detail}
      </div>
    </div>
  );
}