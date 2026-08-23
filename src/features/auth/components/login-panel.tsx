import { BrandLogo } from '@/components/shared/brand-logo';
import { LoginForm } from '@/features/auth/components/login-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { appConfig } from '@/config';

interface LoginPanelProps {
  readonly nextPath?: string;
  readonly initialError?: string;
}

/**
 * Server-rendered login shell: brand mark + credential form.
 * The interactive form is a Client Component.
 */
export function LoginPanel({ nextPath, initialError }: LoginPanelProps) {
  return (
    <Card className="w-full max-w-md border-none bg-card/95 shadow-dialog ring-1 ring-border/60 backdrop-blur-sm">
      <CardHeader className="items-center text-center">
        <BrandLogo size={48} className="mb-2 rounded-xl" />
        <CardTitle className="text-xl font-semibold tracking-tight">{appConfig.name}</CardTitle>
        <CardDescription>
          Sign in to {appConfig.title}. Accounts are issued by your administrator.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm nextPath={nextPath} initialError={initialError} />
      </CardContent>
    </Card>
  );
}
