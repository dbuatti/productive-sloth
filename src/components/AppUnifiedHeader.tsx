"use client";

import React from 'react';
import { useSession } from '@/hooks/use-session';
import { cn } from '@/lib/utils';
import ThemeToggle from './ThemeToggle';
import ProfileDropdown from './ProfileDropdown';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import CustomMenuIcon from './CustomMenuIcon';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppUnifiedHeaderProps {
  onToggleMobileMenu?: () => void;
}

const AppUnifiedHeader: React.FC<AppUnifiedHeaderProps> = ({ onToggleMobileMenu }) => {
  const { profile } = useSession();
  const isMobile = useIsMobile();

  if (!profile) return null;

  return (
    <header className={cn(
      "flex items-center justify-between h-16 px-4 md:px-8",
      "border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm"
    )}>
      {/* Left: Mobile Menu Button or Logo/Title */}
      <div className="flex items-center">
        {isMobile && onToggleMobileMenu ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMobileMenu}
            className="h-10 w-10 text-muted-foreground hover:text-primary transition-colors"
            aria-label="Toggle mobile menu"
          >
            <CustomMenuIcon />
            <span className="sr-only">Toggle Menu</span>
          </Button>
        ) : (
          <Link 
            to="/" 
            className="flex items-center gap-2 group active:scale-95 transition-transform duration-200"
            aria-label="Go to Home"
          >
            <div className="relative">
              <img 
                src="/aetherflow-logo.png" 
                alt="AetherFlow Logo" 
                className="h-9 w-auto drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              />
              <div className="absolute -inset-1 bg-primary/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="ml-3 text-xl font-bold text-foreground hidden sm:inline">AetherFlow</span>
          </Link>
        )}
      </div>

      {/* Right: ThemeToggle, ProfileDropdown */}
      <div className="flex items-center space-x-3">
        <ThemeToggle />
        <ProfileDropdown />
      </div>
    </header>
  );
};

export default React.memo(AppUnifiedHeader);