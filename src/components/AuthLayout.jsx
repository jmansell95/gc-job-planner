import React from "react";
import { useLoginBranding } from "@/hooks/useLoginBranding";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const branding = useLoginBranding();

  // Background style
  const bgStyle = branding.background_type === 'image' && branding.background_image_url
    ? { backgroundImage: `url(${branding.background_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : branding.background_type === 'solid'
      ? { background: branding.primary_color }
      : { background: `linear-gradient(135deg, ${branding.primary_color} 0%, ${branding.secondary_color} 100%)` };

  const overlayStyle = branding.background_type === 'image' && branding.background_image_url
    ? { background: `rgba(0,0,0,${branding.overlay_opacity})` }
    : {};

  // Card style
  const cardCls = branding.card_style === 'glass'
    ? 'bg-white/80 backdrop-blur-xl border border-white/40 shadow-2xl'
    : branding.card_style === 'bordered'
      ? 'bg-white border-2 border-slate-200 shadow-sm'
      : 'bg-white border border-slate-200 shadow-xl';

  // Use custom title/subtitle from branding if defaults are set
  const displayTitle = branding.welcome_title && title === 'Welcome back' ? branding.welcome_title : title;
  const displaySubtitle = branding.welcome_subtitle && subtitle === 'Log in to your account' ? branding.welcome_subtitle : subtitle;

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={bgStyle}>
      <div className="absolute inset-0" style={overlayStyle} />
      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          {branding.show_logo && branding.logo_url ? (
            <img src={branding.logo_url} alt="Logo" className="mx-auto h-14 w-auto mb-4 object-contain" />
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: branding.primary_color }}>
              <Icon className="w-7 h-7 text-white" aria-hidden="true" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-sm">{displayTitle}</h1>
          {displaySubtitle && <p className="text-white/80 mt-2 drop-shadow-sm">{displaySubtitle}</p>}
        </div>
        <div className={`rounded-2xl p-8 ${cardCls}`}>
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-white/70 mt-6 drop-shadow-sm">{footer}</p>
        )}
        {branding.footer_text && !footer && (
          <p className="text-center text-sm text-white/70 mt-6 drop-shadow-sm">{branding.footer_text}</p>
        )}
      </div>
    </div>
  );
}