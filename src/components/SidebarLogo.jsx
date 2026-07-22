import React from 'react';
import { EMBLEM_URL } from '@/components/Logo';

/**
 * Transparent Ground Control logo for the admin sidebar header.
 * Uses the transparent leaf emblem + orange "Ground Control®" wordmark and
 * the two-tone italic tagline, so there is no white background box on the
 * dark sidebar.
 */
export default function SidebarLogo({ className = '' }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <img src={EMBLEM_URL} alt="Ground Control" className="h-12 w-12 object-contain flex-shrink-0" />
      <div className="leading-none">
        <span className="block text-[22px] font-extrabold tracking-tight text-[#F3921E] font-display">Ground</span>
        <span className="block text-[22px] font-extrabold tracking-tight text-[#F3921E] font-display">
          Control<sup className="text-[10px] font-bold ml-0.5">®</sup>
        </span>
        <span className="block italic text-[10px] mt-1 font-medium">
          <span className="text-[#A8C633]">Caring</span>{' '}
          <span className="text-[#4A9D31]">for our Environment</span>
        </span>
      </div>
    </div>
  );
}