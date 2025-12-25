import { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes';

function Login() {
  const [isLoading, setIsLoading] = useState(false); // Local loading state for UI
  const { resolvedTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md shadow-lg border-none">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Daily Task Manager</CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Sign in to manage your productivity
          </p>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={['google']}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary))',
                  },
                },
              },
            }}
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
            showLinks={true}
            view="sign_in"
            redirectTo={window.location.origin}
            // The SessionProvider will handle the redirection after sign-in
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;