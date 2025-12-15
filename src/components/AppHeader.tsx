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
import ProfileDropdown from './ProfileDropdown'; // UPDATED IMPORT

interface AppHeaderProps {
  onMenuToggle: () => void; 
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuToggle }) => { 
  const { user } = useSession();
  const isMobile = useIsMobile();

  // Only show the header content on mobile (lg:hidden)
  if (!isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
      <div className="mx-auto max-w-5xl flex items-center justify-between h-16 px-4">
        
        {/* Left side: Mobile Menu Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onMenuToggle} 
            className="h-12 w-12 bg-primary/10 text-primary hover:bg-primary/20 transition-colors duration-200" 
          >
            <CustomMenuIcon />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        </div>

        {/* Center: Logo/Title */}
        <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
          <img src="/aetherflow-logo.png" alt="Daily Task Manager Logo" className="h-8 w-auto transition-transform duration-200 hover:scale-105" />
        </div>
        
        {/* Right side: User Controls (Profile Pill) */}
        {user && (
          <div className="flex items-center space-x-2 shrink-0">
            <ProfileDropdown />
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;