import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Settings, 
  TrendingUp, 
  Clock, 
  BookOpen, 
  Trash2, 
  CheckCircle, 
  Code, 
  Sparkles,
  CalendarDays,
  HeartPulse,
  LayoutDashboard,
  Archive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface NavLinkItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  onClick?: () => void;
}

const NavLinkItem: React.FC<NavLinkItemProps> = ({ to, icon: Icon, label, isCollapsed, onClick }) => {
  const content = (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
          "text-muted-foreground hover:text-foreground hover:bg-accent",
          isActive && "text-primary bg-primary/5 font-semibold",
          isCollapsed && "justify-center px-0"
        )
      }
    >
      <Icon className={cn(
        "h-4 w-4 transition-colors",
        "group-hover:text-foreground"
      )} />
      
      {!isCollapsed && (
        <span className="truncate">{label}</span>
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};

interface NavigationProps {
  isCollapsed: boolean;
  onLinkClick?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({ isCollapsed, onLinkClick }) => {
  const primaryNavItems = [
    { to: "/scheduler", icon: Clock, label: "Schedule" },
    { to: "/sink", icon: Archive, label: "Archive" },
    { to: "/recap", icon: CheckCircle, label: "Daily Summary" },
  ];
  
  const secondaryNavItems = [
    { to: "/wellness", icon: HeartPulse, label: "Wellness" },
    { to: "/analytics", icon: TrendingUp, label: "Analytics" },
    { to: "/documentation", icon: BookOpen, label: "Guide" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  const viewNavItems = [
    { to: "/simplified-schedule", icon: CalendarDays, label: "Weekly View" },
  ];

  const SectionLabel = ({ children }: { children: string }) => (
    <div className={cn(
      "px-3 mb-2 mt-6 transition-all duration-200",
      isCollapsed && "text-center px-0"
    )}>
      {!isCollapsed ? (
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          {children}
        </span>
      ) : (
        <div className="h-px w-4 bg-border mx-auto" />
      )}
    </div>
  );

  return (
    <nav className="grid items-start px-2 space-y-0.5 select-none">
      <SectionLabel>Main</SectionLabel>
      {primaryNavItems.map((item) => (
        <NavLinkItem
          key={item.to}
          to={item.to}
          icon={item.icon}
          label={item.label}
          isCollapsed={isCollapsed}
          onClick={onLinkClick}
        />
      ))}
      
      <SectionLabel>Tools</SectionLabel>
      {secondaryNavItems.map((item) => (
        <NavLinkItem
          key={item.to}
          to={item.to}
          icon={item.icon}
          label={item.label}
          isCollapsed={isCollapsed}
          onClick={onLinkClick}
        />
      ))}

      <SectionLabel>Views</SectionLabel>
      {viewNavItems.map((item) => (
        <NavLinkItem
          key={item.to}
          to={item.to}
          icon={item.icon}
          label={item.label}
          isCollapsed={isCollapsed}
          onClick={onLinkClick}
        />
      ))}
    </nav>
  );
};

export default Navigation;