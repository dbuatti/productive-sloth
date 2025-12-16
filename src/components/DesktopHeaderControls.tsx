import React from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import ProfileDropdown from './ProfileDropdown';
import ThemeToggle from './ThemeToggle';
import { cn } from '@/lib/utils';

const DesktopHeaderControls: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-20 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      "hidden lg:flex items-center justify-between px-6 shadow-sm"
    )}>
      {/* Left: Logo/Title */}
      <div className="flex items-center">
        <img src="/aetherflow-logo.png" alt="AetherFlow Logo" className="h-8 w-auto transition-transform duration-200 hover:scale-105" />
        <span className="ml-3 text-xl font-bold text-foreground">AetherFlow</span>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center space-x-3">
        <ThemeToggle />
        
        {/* Profile Dropdown */}
        <ProfileDropdown />
      </div>
    </header>
  );
};

export default DesktopHeaderControls;