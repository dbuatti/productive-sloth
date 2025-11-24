import React, { useState } from 'react';
import { LogOut, Settings, Flame, Menu } from 'lucide-react'; 
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
import { AvatarImage } from './ui/avatar';
import DailyChallengeClaimButton from './DailyChallengeClaimButton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile'; 
import CustomMenuIcon from './CustomMenuIcon';

interface AppHeaderProps {
  onMenuToggle: () => void; 
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuToggle }) => {
  const { user, profile } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const userEmail = user?.email || 'User';
  const userId = user?.id;
  
  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}` 
    : getDisplayNameFromEmail(userEmail);

  const userInitials = (profile?.first_name?.charAt(0) || userEmail.charAt(0) || 'U').toUpperCase() +
                       (profile?.last_name?.charAt(0) || userEmail.charAt(1) || 'N').toUpperCase();
  
  const secondaryIdentifier = userId ? `#${userId.substring(0, 8)}` : userEmail;

  const visibleFirstName = profile?.first_name || getDisplayNameFromEmail(userEmail).split(' ')[0];

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-5xl flex items-center justify-between h-16 px-4">
        
        {/* Left side: Persistent Hamburger Menu */}
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onMenuToggle}
                // Custom styling to match Gemini icon: circular, primary color, subtle background
                className="h-10 w-10 bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-200"
              >
                <CustomMenuIcon />
                <span className="sr-only">Toggle Navigation Menu</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Navigation Menu</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Center: Logo/Title (Visually centered on mobile) */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          <img src="/aetherflow-logo.png" alt="Daily Task Manager Logo" className="h-8 w-auto transition-transform duration-200 hover:scale-105" />
        </div>
        
        {/* Right side: User Controls */}
        {user && (
          <div className="flex items-center space-x-2 shrink-0">
            {/* Daily Challenge Claim Button and Daily Streak Display - Hidden on mobile */}
            <div className="hidden sm:flex items-center space-x-2">
              <DailyChallengeClaimButton />

              {profile && profile.daily_streak > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-sm font-semibold text-logo-orange">
                      <Flame className="h-4 w-4" />
                      <span>{profile.daily_streak}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Daily Streak: {profile.daily_streak} Day{profile.daily_streak !== 1 ? 's' : ''}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            <span className="text-sm font-medium hidden sm:inline-block">
              {visibleFirstName}
            </span>

            {/* Always visible Settings button - now navigates */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 transition-transform duration-200 hover:scale-110"
                  onClick={handleGoToSettings}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Profile Settings</p>
              </TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full transition-transform duration-200 hover:scale-110">
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
                
                {/* Settings option in dropdown - now navigates */}
                <DropdownMenuItem onClick={handleGoToSettings} className="cursor-pointer">
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
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;