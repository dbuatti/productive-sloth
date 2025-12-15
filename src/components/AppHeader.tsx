import React from 'react';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile'; 
import MobileProfilePill from './MobileProfilePill'; 

const AppHeader: React.FC = () => { 
  const { user } = useSession();
  const isMobile = useIsMobile();

  // Only show the header content on mobile (lg:hidden)
  if (!isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
      <div className="mx-auto max-w-5xl flex items-center justify-between h-16 px-4">
        
        {/* Left side: Logo/Title */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/aetherflow-logo.png" alt="Daily Task Manager Logo" className="h-8 w-auto transition-transform duration-200 hover:scale-105" />
        </div>
        
        {/* Right side: User Controls (Profile Pill) */}
        {user && (
          <div className="flex items-center space-x-2 shrink-0">
            <MobileProfilePill />
          </div>
        )}
      </div>
    </header>
  );
};

export default AppHeader;