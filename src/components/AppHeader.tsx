import React from 'react';
import { LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/use-session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { getDisplayNameFromEmail } from '@/lib/user-utils';
import ThemeSelector from './ThemeSelector';

const AppHeader: React.FC = () => {
  const { user } = useSession();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const userEmail = user?.email || 'User';
  const userId = user?.id;
  const userInitials = userEmail.slice(0, 2).toUpperCase();
  const displayName = getDisplayNameFromEmail(userEmail);
  
  const secondaryIdentifier = userId ? `#${userId.substring(0, 8)}` : userEmail;

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-3xl flex items-center justify-between h-16 px-4">
        <h1 className="text-xl font-bold tracking-tight">
          Daily Task Manager
        </h1>
        
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {secondaryIdentifier}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Theme Selector */}
              <ThemeSelector />
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
};

export default AppHeader;