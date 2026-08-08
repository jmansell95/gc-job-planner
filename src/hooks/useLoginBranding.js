import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Fetches the single LoginBranding record (if any) and returns the
 * resolved branding config with sensible defaults. Used by AuthLayout
 * to style the login / register / forgot-password / reset-password pages.
 */
export function useLoginBranding() {
  const { data } = useQuery({
    queryKey: ['login-branding'],
    queryFn: async () => {
      try {
        const records = await base44.entities.LoginBranding.list('-updated_date', 1);
        return records[0] || null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    background_type: data?.background_type || 'gradient',
    primary_color: data?.primary_color || '#2E5A1A',
    secondary_color: data?.secondary_color || '#1c4a12',
    background_image_url: data?.background_image_url || '',
    overlay_opacity: data?.overlay_opacity ?? 0.75,
    card_style: data?.card_style || 'glass',
    logo_url: data?.logo_url || '',
    show_logo: data?.show_logo || false,
    welcome_title: data?.welcome_title || 'Welcome back',
    welcome_subtitle: data?.welcome_subtitle || 'Log in to your account',
    footer_text: data?.footer_text || '',
  };
}