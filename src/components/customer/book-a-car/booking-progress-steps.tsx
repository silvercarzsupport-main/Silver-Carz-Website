import { cn } from '@/lib/utils';

const STEPS = [
  { number: 1, title: 'Select Car', caption: 'Choose your car' },
  { number: 2, title: 'Select Dates', caption: 'Pick-up & return' },
  { number: 3, title: 'Your Details', caption: 'Contact info' },
  { number: 4, title: 'Documents', caption: 'Upload ID docs' },
  { number: 5, title: 'Approval', caption: 'Awaiting review' },
  { number: 6, title: 'Vehicle Pickup', caption: 'Pay on collection' },
] as const;

/**
 * Visual booking progress across the customer request flow.
 */
export function BookingProgressSteps({ activeStep = 1 }: { activeStep?: number }) {
  return (
    <nav aria-label="Booking progress" className="border-b border-border bg-background">
      <ol className="mx-auto flex max-w-7xl flex-wrap items-stretch gap-2 px-4 py-4 sm:px-6 lg:gap-0 lg:px-8">
        {STEPS.map((step, index) => {
          const active = step.number === activeStep;
          const complete = step.number < activeStep;
          return (
            <li
              key={step.number}
              className={cn(
                'flex min-w-[8.5rem] flex-1 items-center gap-3',
                index < STEPS.length - 1 && 'lg:pr-2',
              )}
            >
              <div
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : complete
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-muted text-muted-foreground',
                )}
                aria-current={active ? 'step' : undefined}
              >
                {step.number}
              </div>
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate text-xs font-bold tracking-wide uppercase sm:text-sm',
                    active || complete ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {step.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{step.caption}</p>
              </div>
              {index < STEPS.length - 1 ? (
                <div
                  className="mx-2 hidden h-px flex-1 border-t border-dashed border-border lg:block"
                  aria-hidden="true"
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
