"use client";

import React from 'react';
import { useSession } from '@/hooks/use-session';
import { getDisplayNameFromEmail } from '@/lib/user-utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sparkles, Zap, Settings, LogOut, Trophy } from 'lucide-react';
import { cn, calculateLevelInfo } from '@/lib/utils';
import { MAX_ENERGY, XP_PER_LEVEL } from '@/lib/constants'; // Import XP_PER_LEVEL
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
import { useIsMobile } from '@/hooks/use-mobile';
import { isToday, parseISO } from 'date-fns';
import { CustomProgress } from './CustomProgress'; // NEW: Import CustomProgress

const ProfileDropdown: React.FC = () => {
  const { user, profile, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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

  const { level, xpTowardsNextLevel, xpNeededForNextLevel } = calculateLevelInfo(profile.xp);
  const isEnergyDeficit = profile.energy < 0;
  const energyDisplay = Math.max(0, profile.energy);
  const hasClaimedDailyChallengeToday = profile.last_daily_reward_claim ? isToday(parseISO(profile.last_daily_reward_claim)) : false;
  const isDailyChallengeComplete = profile.tasks_completed_today >= profile.daily_challenge_target;

  // NEW: Calculate progress percentages
  const xpProgressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
  const energyProgressPercentage = (profile.energy / MAX_ENERGY) * 100;

  // Determine the trigger content based on screen size
  const triggerContent = isMobile ? (
    <Button 
      variant="outline" 
      size="icon"
      className={cn(
        "h-10 w-10 p-0 rounded-full flex items-center justify-center transition-all duration-200 hover:bg-secondary/50",
        "border-2 border-primary/50 bg-background/80 backdrop-blur-sm shadow-md relative"
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        {profile.avatar_url ? (
          <AvatarImage src={profile.avatar_url} alt={`${displayName}'s avatar`} />
        ) : (
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            {userInitials.substring(0, 2)}
          </AvatarFallback>
        )}
      </Avatar>
      {/* Small status badge for mobile */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold font-mono",
            isEnergyDeficit ? 'bg-destructive text-destructive-foreground' : 'bg-logo-green text-logo-green-foreground'
          )}>
            {isEnergyDeficit ? <Zap className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Level {level} | Energy {profile.energy} / {MAX_ENERGY}</p>
        </TooltipContent>
      </Tooltip>
    </Button>
  ) : (
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
      <div className="flex flex-col items-start gap-0.5"> {/* Changed to flex-col for progress bars */}
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
                <Zap className="h-4 w-4" /> {energyDisplay}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Current Energy ({profile.energy} / {MAX_ENERGY})</p>
            </TooltipContent>
          </Tooltip>
          {/* Daily Challenge Stat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("flex items-center gap-1 font-mono", isDailyChallengeComplete && !hasClaimedDailyChallengeToday ? 'text-accent' : hasClaimedDailyChallengeToday ? 'text-logo-green' : 'text-muted-foreground')}>
                <Trophy className="h-4 w-4" /> {profile.tasks_completed_today}/{profile.daily_challenge_target}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Daily Challenge Progress</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {/* NEW: Progress Bars */}
        <div className="flex items-center gap-2 w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-20"> {/* Fixed width for XP bar */}
                <CustomProgress 
                  value={xpProgressPercentage} 
                  className="h-1.5 bg-logo-yellow/20" 
                  indicatorClassName="bg-logo-yellow" 
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{xpTowardsNextLevel} XP to next level</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-20"> {/* Fixed width for Energy bar */}
                <CustomProgress 
                  value={energyProgressPercentage} 
                  className="h-1.5 bg-logo-green/20" 
                  indicatorClassName={cn(isEnergyDeficit ? "bg-destructive" : "bg-logo-green")} 
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{profile.energy} / {MAX_ENERGY} Energy</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Button>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {triggerContent}
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