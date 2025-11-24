import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ListTodo, Settings, Trophy, TrendingUp, Clock, BookOpen, Trash2, CheckCircle } from 'lucide-react'; // Import Trash2 and CheckCircle
import { cn } from '@/lib/utils';

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
        "flex items-center gap-4 rounded-lg px-4 py-3 text-base text-muted-foreground transition-all hover:text-primary", // Increased gap, padding, and font size
        isActive && "bg-muted text-primary hover:text-primary",
        isCollapsed ? "justify-center" : ""
      )
    }
  >
    <Icon className="h-6 w-6" /> {/* Increased icon size */}
    {!isCollapsed && <span className="text-base font-medium">{label}</span>} {/* Increased font size */}
  </NavLink>
);

interface NavigationProps {
  isCollapsed: boolean;
  onLinkClick?: () => void; // Optional handler for mobile to close sidebar
}

const Navigation: React.FC<NavigationProps> = ({ isCollapsed, onLinkClick }) => {
  const navItems = [
    { to: "/", icon: Home, label: "Dashboard" },
    { to: "/scheduler", icon: Clock, label: "Vibe Schedule" }, // Renamed label
    // Removed: { to: "/sink", icon: Trash2, label: "Aether Sink" }, 
    // Removed: { to: "/recap", icon: CheckCircle, label: "Daily Recap" }, 
    { to: "/analytics", icon: TrendingUp, label: "Analytics" },
    { to: "/achievements", icon: Trophy, label: "Achievements" },
    { to: "/documentation", icon: BookOpen, label: "Documentation" },
    { to: "/settings", icon: Settings, label: "Settings" }, // Added Settings back to main nav for desktop/mobile menu
  ];

  return (
    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
      {navItems.map((item) => (
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