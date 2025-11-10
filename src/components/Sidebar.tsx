import React, { useState } from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navigation from './Navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  defaultLayout: number[] | undefined;
  children: React.ReactNode;
}

const Sidebar: React.FC<SidebarProps> = ({ defaultLayout = [20, 80], children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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
        onCollapse={() => {
          setIsCollapsed(true);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(true)}`;
        }}
        onExpand={() => {
          setIsCollapsed(false);
          document.cookie = `react-resizable-panels:collapsed=${JSON.stringify(false)}`;
        }}
        className={cn(
          "flex flex-col transition-all duration-300 ease-in-out",
          isCollapsed && "min-w-[50px] md:min-w-[70px]"
        )}
      >
        <div className={cn(
          "flex h-16 items-center justify-center px-4",
          isCollapsed ? "h-16" : "h-16 px-4"
        )}>
          <img src="/logo.png" alt="Logo" className={cn("h-8 w-auto transition-all duration-300", isCollapsed && "h-6")} />
          {!isCollapsed && <span className="ml-2 text-lg font-bold text-primary">AetherFlow</span>} {/* Removed animate-pulse-glow */}
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <Navigation isCollapsed={isCollapsed} />
        </div>
        <div className="mt-auto p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 mx-auto flex items-center justify-center"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            <span className="sr-only">{isCollapsed ? "Expand" : "Collapse"} sidebar</span>
          </Button>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={defaultLayout[1]} minSize={30} className="overflow-auto"> {/* Added overflow-auto here */}
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};

export default Sidebar;