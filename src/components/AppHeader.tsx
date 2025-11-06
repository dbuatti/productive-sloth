import React, { useState } from 'react';
import { LogOut, Settings, Flame } from 'lucide-react'; // Import Flame icon
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
import ProfileSettingsDialog from './ProfileSettingsDialog';
import { AvatarImage } from './ui/avatar';
import DailyChallengeClaimButton from './DailyChallengeClaimButton'; // Import the new component
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'; // Import Tooltip components

const AppHeader: React.FC = () => {
  const { user, profile } = useSession();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const userEmail = user?.email || 'User';
  const userId = user?.id;
  
  // Use profile first/last name if available, otherwise fallback to email-derived name
  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}` 
    : getDisplayNameFromEmail(userEmail);

  const userInitials = (profile?.first_name?.charAt(0) || userEmail.charAt(0) || 'U').toUpperCase() +
                       (profile?.last_name?.charAt(0) || userEmail.charAt(1) || 'N').toUpperCase();
  
  const secondaryIdentifier = userId ? `#${userId.substring(0, 8)}` : userEmail;

  // Determine the name to display next to the avatar
  const visibleFirstName = profile?.first_name || getDisplayNameFromEmail(userEmail).split(' ')[0];

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-3xl flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Daily Task Manager Logo" className="h-8 w-auto" />
          {/* Removed h1 text to let the logo be the primary identifier */}
        </div>
        
        {user && (
          <div className="flex items-center space-x-2">
            {/* Daily Challenge Claim Button */}
            <DailyChallengeClaimButton />

            {/* Daily Streak Display */}
            {profile && profile.daily_streak > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-sm font-semibold text-[hsl(var(--logo-orange))]">
                    <Flame className="h-4 w-4" />
                    <span>{profile.daily_streak}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Daily Streak: {profile.daily_streak} Day{profile.daily_streak !== 1 ? 's' : ''}</p>
                </TooltipContent>
              </Tooltip>
            )}

            <span className="text-sm font-medium hidden sm:inline-block">
              {visibleFirstName}
            </span>

            {/* Always visible Settings button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setIsSettingsDialogOpen(true)}
            >
              <Settings className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {profile?.avatar_url ? (
                      <AvatarImage src={profile.avatar_url} alt={`${displayName}'s avatar`} />
                    ) : (
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {userInitials}
                      </AvatarFallback>
                    )}
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
                
                {/* Settings option in dropdown (can be removed if direct button is preferred as sole entry) */}
                <DropdownMenuItem onClick={() => setIsSettingsDialogOpen(true)} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem onClick={handleSignOut} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <ProfileSettingsDialog 
              open={isSettingsDialogOpen} 
              onOpenChange={setIsSettingsDialogOpen} 
            />
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;