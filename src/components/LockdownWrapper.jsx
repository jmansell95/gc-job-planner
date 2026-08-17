// LockdownWrapper — a HOC that conditionally renders / disables / masks its
// children based on the active division's access manifest.
//
// Usage:
//   <LockdownWrapper feature="job_delete" module="jobs">
//     <Button>Delete Job</Button>
//   </LockdownWrapper>
//
// Props:
//   feature   — the UI element ID to check against hidden_elements / disabled_elements
//   module    — the permission module key (for feature_access overrides)
//   fallback  — what to render when hidden (default: null)
//   mask      — if true, blur the children instead of hiding when data_masking applies

import React from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';

export default function LockdownWrapper({ feature, module: moduleKey, fallback = null, mask = false, children }) {
  const { isHidden, isDisabled, isMasked } = useFeatureAccess(feature, moduleKey);

  if (isHidden) return <>{fallback}</>;

  if (isDisabled) {
    // Clone the child and inject disabled state
    const child = React.Children.only(children);
    return React.cloneElement(child, {
      disabled: true,
      className: `${child.props.className || ''} opacity-50 cursor-not-allowed pointer-events-none`,
      title: 'Restricted in this division',
    });
  }

  if (mask && isMasked) {
    return (
      <span className="blur-sm select-none" aria-hidden="true">
        {children}
      </span>
    );
  }

  return <>{children}</>;
}