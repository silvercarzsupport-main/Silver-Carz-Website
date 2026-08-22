import { Bell, Home } from 'lucide-react';
import Link from 'next/link';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { appConfig } from '@/config';
import { ROUTES } from '@/constants';
import { UserMenu } from '@/features/auth/components/user-menu';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Top navigation bar shared by authenticated app pages.
 */
export function AppHeader({ user }: { user: AuthUser }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b border-border/80 bg-background/90 px-3 backdrop-blur-md supports-backdrop-filter:bg-background/75 sm:h-16 sm:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 hidden h-4 sm:block" />

      <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
        <BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbPage className="truncate">{appConfig.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 px-2 sm:px-2.5">
          <Link href={ROUTES.home} aria-label="Home — Book a Car">
            <Home className="size-4" />
            <span className="hidden sm:inline">Home</span>
          </Link>
        </Button>

        <ThemeToggle />

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="size-4" />
        </Button>

        <UserMenu user={user} />
      </div>
    </header>
  );
}
