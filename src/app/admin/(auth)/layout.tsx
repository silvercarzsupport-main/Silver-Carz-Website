import { PortalThemeScope } from '@/components/shared/portal-theme-scope';
import { CustomerContactLinks } from '@/components/customer/shared/customer-contact-links';

/**
 * Auth route group layout — no app shell (sidebar/header).
 * Session refresh still runs via `src/proxy.ts`.
 * Background uses portal theme tokens (`--auth-glow`, `--auth-wash-*`).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-portal="admin"
      className="relative flex min-h-svh flex-col items-center justify-center bg-background px-4 py-10"
    >
      <PortalThemeScope portal="admin" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--auth-glow),transparent_55%),linear-gradient(to_bottom,var(--auth-wash-top),var(--auth-wash-bottom))]"
      />
      {children}
      <CustomerContactLinks className="mt-8" />
    </div>
  );
}
