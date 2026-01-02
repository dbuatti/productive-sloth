import React from 'react';
import { Link } from 'react-router-dom';
import { useSession } from '@/hooks/use-session';
import { useIsMobile } from '@/hooks/use-mobile'; 
import ProfileDropdown from './ProfileDropdown';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  onMenuToggle: () => void; 
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuToggle }) => { 
  const { user } = useSession();
  const isMobile = useIsMobile();

  // The Header is mobile-only as per your layout strategy (lg:hidden)
  if (!isMobile) {
    return null;
  }

  return (
    <header className={cn(
      "h-16 transition-all duration-300 ease-aether-out", // Removed fixed positioning and glass-header
      "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm" // Added header styling
    )}>
      <div className="mx-auto max-w-5xl h-full px-4 flex items-center">
        
        {/* Left Section: Placeholder for balance */}
        <div className="flex-1 flex justify-start">
          {/* Keeping this flex-1 ensures the logo stays perfectly centered. 
            If you add a left-side action later (like a back button), place it here.
          */}
        </div>

        {/* Center Section: Branding */}
        <div className="flex-none">
          <Link 
            to="/" 
            className="flex items-center gap-2 group active:scale-95 transition-transform duration-200"
          >
            <div className="relative">
              <img 
                src="/aetherflow-logo.png" 
                alt="AetherFlow Logo" 
                className="h-9 w-auto drop-shadow-[0_0_8px_rgba(var(--primary),0.3)]"
              />
              {/* Subtle Aether Glow behind logo */}
              <div className="absolute -inset-1 bg-primary/10 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            
            {/* Optional Text Branding - hidden by default but follows design tokens */}
            <span className="sr-only">AetherFlow</span>
          </Link>
        </div>
        
        {/* Right Section: User Controls */}
        <div className="flex-1 flex justify-end items-center gap-3">
          {user && (
            <div className="animate-pop-in">
              <ProfileDropdown />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;