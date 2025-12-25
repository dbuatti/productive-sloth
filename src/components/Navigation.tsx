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
  Sparkles 
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
          "group relative flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-bold tracking-tight transition-all duration-300 ease-aether-out",
          "text-muted-foreground/70 hover:text-primary hover:bg-primary/5 hover:pl-5",
          isActive && [
            "text-primary bg-primary/10 border-r-2 border-primary shadow-[inset_0_0_20px_rgba(var(--primary),0.05)]",
            "after:absolute after:left-0 after:top-1/4 after:h-1/2 after:w-1 after:bg-primary after:rounded-full after:shadow-[0_0_10px_hsl(var(--primary))]"
          ],
          isCollapsed && "justify-center px-0 hover:pl-0"
        )
      }
    >
      <div className="relative">
        <Icon className={cn(
          "h-5 w-5 transition-all duration-300 group-hover:scale-110",
          "group-hover:drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]"
        )} />
      </div>
      
      {!isCollapsed && (
        <span className="truncate transition-opacity duration-300">{label}</span>
      )}

      {/* Subtle indicator dot for "Active" or "Live" status */}
      {!isCollapsed && to === "/scheduler" && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-live-progress animate-pulse shadow-[0_0_5px_hsl(var(--live-progress))]" />
      )}
    </NavLink>
  );

  if (isCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="glass-card ml-2 font-bold">
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

  const SectionLabel = ({ children, icon: Icon }: { children: string, icon?: any }) => (
    <div className={cn(
      "flex items-center gap-2 px-4 mb-2 mt-6 transition-all duration-300",
      isCollapsed && "justify-center px-0"
    )}>
      {!isCollapsed ? (
        <>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
            {children}
          </span>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-border/50 to-transparent" />
        </>
      ) : (
        <div className="h-[1px] w-4 bg-border" />
      )}
    </div>
  );

  return (
    <nav className="grid items-start px-3 space-y-1 select-none">
      <SectionLabel>Core Views</SectionLabel>
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
      
      <SectionLabel>System Tools</SectionLabel>
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

      {!isCollapsed && (
        <div className="mt-10 px-4">
          <div className="glass-card p-4 rounded-2xl border-primary/10 bg-primary/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-logo-yellow" />
              <span className="text-[10px] font-bold uppercase text-primary">Aether Cloud</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              System synchronized. All vibe data is encrypted.
            </p>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navigation;