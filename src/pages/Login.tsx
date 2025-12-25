import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from 'next-themes'; // Import useTheme

function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const { resolvedTheme } = useTheme(); // Get the resolved theme from next-themes

  useEffect(() => {
    // 1. Check current session once on mount
    const initCheck = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/', { replace: true });
      } else {
        setIsLoading(false);
      }
    };

    initCheck();

    // 2. Listen for auth changes (Login, Sign Out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Auth Event]: ${event}`);
      
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        navigate('/', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    );
  }

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
            theme={resolvedTheme === 'dark' ? 'dark' : 'light'} // Dynamically set theme
            showLinks={true}
            view="sign_in"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default Login;