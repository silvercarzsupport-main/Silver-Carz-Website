import Image from 'next/image';

import { cn } from '@/lib/utils';

/** Official Silver Carz mark served from /public. Square, high-res source with alpha. */
const BRAND_LOGO_SRC = '/logo/2.png';

type BrandLogoProps = {
  /** Rendered edge length in px. The source is square, so one value controls both axes. */
  readonly size?: number;
  readonly className?: string;
  /**
   * Preload the logo (Next.js 16 `preload` prop). Only enable for marks that are
   * guaranteed above-the-fold on first paint, e.g. the app sidebar.
   */
  readonly preload?: boolean;
};

/**
 * Official Silver Carz logo image.
 *
 * Rendered at an explicit square size matching the source aspect ratio (1:1),
 * so the artwork is never stretched or cropped. The optimizer downscales the
 * 1563px source to the rendered size (plus retina variants), keeping edges crisp
 * instead of shipping a browser-scaled bitmap.
 *
 * Decorative by default (`alt=""`) — every placement sits beside visible brand
 * text or an accessible label.
 */
export function BrandLogo({ size = 36, className, preload = false }: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO_SRC}
      alt=""
      width={size}
      height={size}
      preload={preload}
      aria-hidden="true"
      className={cn('shrink-0 object-contain', className)}
    />
  );
}
