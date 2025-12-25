import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    console.log('[Login] Component mounted. Starting session check...');

    // Check if user is already logged in and redirect to home if they are
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[Login] Initial session check result:', session ? 'Session found' : 'No session');
      if (session) {
        console.log('[Login] Redirecting to home due to existing session...');
        navigate('/');
      }
    };
    
    checkSession();

    // Listen for auth state changes to catch successful login immediately
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`[Login] Auth state changed: ${event}`, session ? 'Session active' : 'No session');
      if (event === 'SIGNED_IN' && session) {
        console.log('[Login] SIGNED_IN event detected. Redirecting to home...');
        navigate('/');
      }
    });

    return () => {
      console.log('[Login] Component unmounting. Cleaning up auth listener.');
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

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
            // Removing explicit redirectTo to allow Supabase to use the default configuration
            // which is often more robust for local development across different ports.
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