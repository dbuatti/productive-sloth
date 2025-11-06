import React, { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import Navigation from './Navigation';

const MobileSidebar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col p-0 w-64">
        <div className="flex h-16 items-center px-4 border-b">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <span className="ml-2 text-lg font-bold text-primary">AetherFlow</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <Navigation isCollapsed={false} onLinkClick={() => setIsOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileSidebar;