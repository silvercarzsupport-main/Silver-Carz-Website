import { Mail, Phone, type LucideIcon } from 'lucide-react';

import { appConfig, contactConfig } from '@/config';
import { cn } from '@/lib/utils';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" strokeWidth="2" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const CONTACT_LINKS: ReadonlyArray<{
  readonly key: string;
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon | typeof InstagramIcon;
  readonly ariaLabel: string;
  readonly external: boolean;
}> = [
  {
    key: 'phone',
    href: contactConfig.phoneHref,
    label: contactConfig.phoneDisplay,
    icon: Phone,
    ariaLabel: `Call ${appConfig.companyName} at ${contactConfig.phoneDisplay}`,
    external: false,
  },
  {
    key: 'email',
    href: contactConfig.emailHref,
    label: contactConfig.email,
    icon: Mail,
    ariaLabel: `Email ${appConfig.companyName} at ${contactConfig.email}`,
    external: false,
  },
  {
    key: 'instagram',
    href: contactConfig.instagramUrl,
    label: contactConfig.instagramHandle,
    icon: InstagramIcon,
    ariaLabel: `${appConfig.companyName} on Instagram`,
    external: true,
  },
];

type CustomerContactLinksProps = {
  readonly layout?: 'stack' | 'icons';
  readonly tone?: 'dark' | 'light';
  readonly className?: string;
};

/**
 * Phone, email, and Instagram — used across customer chrome and contact spots.
 */
export function CustomerContactLinks({
  layout = 'stack',
  tone = 'light',
  className,
}: CustomerContactLinksProps) {
  if (layout === 'icons') {
    const iconClass =
      tone === 'dark'
        ? 'text-secondary-foreground hover:bg-white/10 hover:text-primary'
        : 'text-foreground hover:bg-muted hover:text-primary';

    return (
      <nav aria-label="Contact and social" className={cn('flex items-center gap-0.5', className)}>
        {CONTACT_LINKS.map((item) => (
          <a
            key={item.key}
            href={item.href}
            aria-label={item.ariaLabel}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md transition-colors',
              iconClass,
            )}
            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            <item.icon className="size-4" aria-hidden="true" />
          </a>
        ))}
      </nav>
    );
  }

  const linkClass =
    tone === 'dark'
      ? 'text-secondary-foreground/80 hover:text-primary'
      : 'text-muted-foreground hover:text-primary';

  return (
    <nav aria-label="Contact and social" className={cn('space-y-2.5', className)}>
      {CONTACT_LINKS.map((item) => (
        <a
          key={item.key}
          href={item.href}
          className={cn('flex items-center gap-2.5 text-sm transition-colors', linkClass)}
          {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <item.icon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-all">{item.label}</span>
        </a>
      ))}
    </nav>
  );
}
