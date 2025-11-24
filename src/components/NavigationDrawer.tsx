import React from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import Navigation from './Navigation';
import { cn } from '@/lib/utils';

interface NavigationDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  side: 'left' | 'right';
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({ isOpen, onOpenChange, side }) => {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange} modal={false}> {/* Set modal to false */}
      {/* Note: SheetTrigger is handled by the parent component (AppHeader/MainLayout) */}
      <SheetContent 
        side={side} 
        className={cn(
          "flex flex-col p-0 w-64 z-40", // Ensure it's below the header (z-10) but above content
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
          "sm:w-72" // Slightly wider on desktop
        )}
      >
        <div className="flex h-16 items-center px-4 border-b">
          <img src="/aetherflow-logo.png" alt="Logo" className="h-8 w-auto" />
          <span className="ml-2 text-lg font-bold text-primary">AetherFlow</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <Navigation isCollapsed={false} onLinkClick={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NavigationDrawer;