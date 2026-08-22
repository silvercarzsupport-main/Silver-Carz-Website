'use client';

import { motion } from 'framer-motion';

import { DetailingButton } from '@/components/customer/car-detailing/detailing-button';
import { DetailingSectionWrapper } from '@/components/customer/car-detailing/detailing-section-wrapper';
import { detailingFadeUp } from '@/components/customer/car-detailing/lib/animations';
import { carDetailingSite, carDetailingWhatsappLink } from '@/config/car-detailing';

function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  const name = String(data.get('name') ?? '').trim();
  const phone = String(data.get('phone') ?? '').trim();
  const service = String(data.get('service') ?? '').trim();
  const message = String(data.get('message') ?? '').trim();

  const text = [
    'New booking request — Silver Carz',
    '',
    `Name: ${name || '-'}`,
    `Phone: ${phone || '-'}`,
    `Service: ${service || '-'}`,
    message ? `Message: ${message}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  window.open(carDetailingWhatsappLink(text), '_blank', 'noopener,noreferrer');
}

export function DetailingContact() {
  return (
    <DetailingSectionWrapper
      id="contact"
      index="08"
      eyebrow="Contact"
      title="Book your slot."
      description="Share your car details — we'll confirm your appointment within a few hours."
    >
      <motion.form
        variants={detailingFadeUp}
        onSubmit={handleSubmit}
        className="detailing-card mx-auto max-w-2xl space-y-5 p-6 md:p-10"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs tracking-wide text-muted-foreground uppercase">
              Name
            </span>
            <input
              name="name"
              required
              data-cursor
              data-cursor-label="Type"
              data-cursor-size="40"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Your name"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs tracking-wide text-muted-foreground uppercase">
              Phone
            </span>
            <input
              name="phone"
              type="tel"
              required
              data-cursor
              data-cursor-label="Type"
              data-cursor-size="40"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="+91 98765 43210"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs tracking-wide text-muted-foreground uppercase">
            Service
          </span>
          <select
            name="service"
            required
            data-cursor
            data-cursor-label="Pick"
            data-cursor-size="48"
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            defaultValue=""
          >
            <option value="" disabled>
              Select a service
            </option>
            <option>Basic Water Wash</option>
            <option>Touchless Shampoo Wash</option>
            <option>Touchless Wash + Vacuum + Polish</option>
            <option>Premium Car Spa</option>
            <option>Interior Deep Cleaning</option>
            <option>Engine Bay Cleaning</option>
            <option>Ceramic / PPF Shampoo Wash</option>
            <option>Premium Detailing Wash</option>
            <option>Rubbing &amp; Polishing</option>
            <option>Ceramic Coating</option>
            <option>Other (Denting / Painting / Service / Repairing)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs tracking-wide text-muted-foreground uppercase">
            Message
          </span>
          <textarea
            name="message"
            rows={4}
            data-cursor
            data-cursor-label="Type"
            data-cursor-size="40"
            className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Car model, preferred date..."
          />
        </label>
        <DetailingButton
          type="submit"
          variant="pill"
          cursorLabel="Send"
          className="w-full sm:w-auto"
        >
          Request booking on WhatsApp
        </DetailingButton>
        <p className="text-xs text-muted-foreground">
          Prefer to talk?{' '}
          <a
            href={carDetailingSite.phoneHref}
            className="underline underline-offset-4 transition-colors hover:text-primary"
          >
            Call {carDetailingSite.phone}
          </a>{' '}
          · {carDetailingSite.hours.label}
        </p>
      </motion.form>
    </DetailingSectionWrapper>
  );
}
