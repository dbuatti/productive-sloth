import React from 'react';
import { NavLink } from 'react-router-dom';
import { Settings, Trophy, TrendingUp, Clock, BookOpen, Trash2, CheckCircle, Code, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

interface NavLinkItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  onClick?: () => void;
}

const NavLinkItem: React.FC<NavLinkItemProps> = ({ to, icon: Icon, label, isCollapsed, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary relative",
        // Refined active state: lighter background, strong left border
        isActive && "bg-sidebar-accent text-primary hover:text-primary border-l-4 border-primary -ml-4 pl-4",
        isCollapsed ? "justify-center" : ""
      )
    }
  >
    <Icon className="h-6 w-6" />
    {!isCollapsed && <span className="text-base font-medium">{label}</span>}
  </NavLink>
);

interface NavigationProps {
  isCollapsed: boolean;
  onLinkClick?: () => void; // Optional handler for mobile to close sidebar
}

const Navigation: React.FC<NavigationProps> = ({ isCollapsed, onLinkClick }) => {
  const primaryNavItems = [
    { to: "/scheduler", icon: Clock, label: "Vibe Schedule" },
    { to: "/sink", icon: Trash2, label: "Aether Sink" },
    { to: "/recap", icon: CheckCircle, label: "Daily Recap" },
  ];
  
  const secondaryNavItems = [
    { to: "/analytics", icon: TrendingUp, label: "Analytics" },
    { to: "/documentation", icon: BookOpen, label: "Documentation" },
    { to: "/model", icon: Code, label: "App Model" },
    { to: "/settings", icon: Settings, label: "Settings" },
  ];

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-1">
      <h3 className={cn("text-xs font-semibold uppercase text-muted-foreground mb-2 mt-4", isCollapsed ? "text-center" : "pl-4")}>
        {isCollapsed ? "CORE" : "Core Views"}
      </h3>
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
      
      <Separator className="my-2" />

      <h3 className={cn("text-xs font-semibold uppercase text-muted-foreground mb-2 mt-4", isCollapsed ? "text-center" : "pl-4")}>
        {isCollapsed ? "INFO" : "Info & Tools"}
      </h3>
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
    </nav>
  );
};

export default Navigation;