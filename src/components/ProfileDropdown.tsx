import React from 'react';
import { useSession } from '@/hooks/use-session';
import { getDisplayNameFromEmail } from '@/lib/user-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Zap, Settings, LogOut } from 'lucide-react';
import { cn, calculateLevelInfo } from '@/lib/utils';
import { MAX_ENERGY } from '@/lib/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const ProfileDropdown: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();

  if (!user || !profile || isSessionLoading) {
    return (
      <div className="h-10 w-24 rounded-full bg-muted animate-pulse" />
    );
  }

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

  const { level } = calculateLevelInfo(profile.xp);
  const isEnergyDeficit = profile.energy < 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          className={cn(
            "h-10 px-2 py-1 rounded-full flex items-center gap-2 transition-all duration-200 hover:bg-secondary/50",
            "border-2 border-primary/50 bg-background/80 backdrop-blur-sm shadow-md"
          )}
        >
          <Avatar className="h-7 w-7 shrink-0">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={`${displayName}'s avatar`} />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {userInitials}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex items-center gap-1 text-logo-yellow font-mono">
                  <Sparkles className="h-4 w-4" /> Lvl {level}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Current Level</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn("flex items-center gap-1 font-mono", isEnergyDeficit ? 'text-destructive' : 'text-logo-green')}>
                  <Zap className="h-4 w-4" /> {Math.max(0, profile.energy)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Current Energy ({profile.energy} / {MAX_ENERGY})</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
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
  );
};

export default ProfileDropdown;