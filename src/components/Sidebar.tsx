import React, { useState, useEffect } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from './Navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  defaultLayout: number[] | undefined;
  children: React.ReactNode;
  onCollapseChange: (isCollapsed: boolean) => void; // NEW: Callback to notify parent
}

const Sidebar: React.FC<SidebarProps> = ({ defaultLayout = [20, 80], children, onCollapseChange }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedCollapsed = document.cookie.split('; ').find((c) => c.startsWith('react-resizable-panels:collapsed='));
      return savedCollapsed ? JSON.parse(savedCollapsed.split('=')[1]) : false;
    }
    return false;
  });

  useEffect(() => {
    onCollapseChange(isCollapsed);
  }, [isCollapsed, onCollapseChange]);

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(collapsed)}`;
  };

  const toggleCollapse = () => {
    handleCollapse(!isCollapsed);
  };

  return (
    <ResizablePanelGroup
      direction="horizontal"
      onLayout={(sizes: number[]) => {
        document.cookie = `react-resizable-panels:layout=${JSON.stringify(sizes)}`;
      }}
      className="h-full max-h-screen items-stretch"
    >
      <ResizablePanel
        defaultSize={defaultLayout[0]}
        collapsedSize={4}
        collapsible={true}
        minSize={15}
        maxSize={20}
        onCollapse={() => handleCollapse(true)}
        onExpand={() => handleCollapse(false)}
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          isCollapsed && "min-w-[50px] md:min-w-[70px]"
        )}
      >
        <div className={cn(
          "flex h-16 items-center justify-center px-4 relative",
          isCollapsed ? "h-16" : "h-16 px-4"
        )}>
          <img src="/aetherflow-logo.png" alt="Logo" className={cn("h-8 w-auto transition-all duration-300", isCollapsed && "h-6")} />
          {!isCollapsed && <span className="ml-2 text-base font-bold text-primary">AetherFlow</span>}
          
          {/* Toggle Button for expanded state (hidden when collapsed) */}
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="absolute right-2 h-8 w-8 text-muted-foreground hover:text-primary"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">Collapse sidebar</span>
            </Button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <Navigation isCollapsed={isCollapsed} />
        </div>
        
        {/* Toggle Button for collapsed state (only visible when collapsed) */}
        {isCollapsed && (
          <div className="mt-auto p-2 flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleCollapse}
              className="h-8 w-8 mx-auto flex items-center justify-center"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Expand sidebar</span>
            </Button>
          </div>
        )}
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={30} className="overflow-auto">
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default Sidebar;