import React from 'react';
import { cn, calculateLevelInfo } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { getDisplayNameFromEmail } from '@/lib/user-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Trophy, Settings, LogOut, Zap, Flame } from 'lucide-react';
import Navigation from './Navigation';
import ThemeToggle from './ThemeToggle';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { MAX_ENERGY } from '@/lib/constants';

const Sidebar: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const userEmail = user?.email || 'User';
  const displayName = profile?.first_name && profile?.last_name 
    ? `${profile.first_name} ${profile.last_name}` 
    : getDisplayNameFromEmail(userEmail);
  
  const userInitials = (profile?.first_name?.charAt(0) || userEmail.charAt(0) || 'U').toUpperCase() +
                       (profile?.last_name?.charAt(0) || userEmail.charAt(1) || 'N').toUpperCase();

  const { level } = profile ? calculateLevelInfo(profile.xp) : { level: 1 };

  return (
    <div 
      className={cn(
        "hidden lg:flex flex-col h-screen border-r bg-sidebar w-[220px] shrink-0",
        "sticky top-0 left-0 z-30 transition-all duration-300"
      )}
    >
      {/* Logo/Title */}
      <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
        <img src="/aetherflow-logo.png" alt="Logo" className="h-8 w-auto" />
        <span className="ml-2 text-lg font-bold text-sidebar-foreground">AetherFlow</span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        <Navigation isCollapsed={false} />
      </div>

      {/* Footer/User Info/Settings */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {user && profile && (
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              {profile.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={`${displayName}'s avatar`} />
              ) : (
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                  {userInitials}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold truncate text-sidebar-foreground">{displayName}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex items-center gap-1 text-logo-yellow font-mono">
                      <Sparkles className="h-3 w-3" /> Lvl {level}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Current Level</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("flex items-center gap-1 font-mono", profile.energy < 20 ? 'text-destructive' : 'text-logo-green')}>
                      <Zap className="h-3 w-3" /> {Math.max(0, profile.energy)}/{MAX_ENERGY}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>Current Energy</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        <Separator className="bg-sidebar-border" />

        <div className="flex justify-between items-center">
          <ThemeToggle />
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleGoToSettings} className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent">
                  <Settings className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Settings</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 text-destructive hover:bg-destructive/10">
                  <LogOut className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Sign Out</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;