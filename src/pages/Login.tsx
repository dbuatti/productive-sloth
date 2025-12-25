import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect, useState } from 'react';

function Login() {
  const [redirectTo, setRedirectTo] = useState<string | undefined>(undefined);

  useEffect(() => {
    // Set the redirect URL to the current origin (e.g., http://localhost:32129)
    // This ensures Supabase knows where to send you back after Google login.
    setRedirectTo(window.location.origin);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="text-xl text-center">Daily Task Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <Auth
            supabaseClient={supabase}
            providers={['google']}
            redirectTo={redirectTo}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: 'hsl(var(--primary))',
                    brandAccent: 'hsl(var(--primary-foreground))',
                  },
                },
              },
            }}
            theme="light"
            view="sign_in"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;