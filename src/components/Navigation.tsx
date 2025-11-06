import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ListTodo, Settings, Trophy } from 'lucide-react';
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
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        isActive && "bg-muted text-primary hover:text-primary",
        isCollapsed ? "justify-center" : ""
      )
    }
  >
    <Icon className="h-5 w-5" />
    {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
  </NavLink>
);

interface NavigationProps {
  isCollapsed: boolean;
  onLinkClick?: () => void; // Optional handler for mobile to close sidebar
}

const Navigation: React.FC<NavigationProps> = ({ isCollapsed, onLinkClick }) => {
  const navItems = [
    { to: "/", icon: Home, label: "Dashboard" },
    { to: "/tasks", icon: ListTodo, label: "My Tasks" },
    { to: "/achievements", icon: Trophy, label: "Achievements" },
    { to: "/settings", icon: Settings, label: "Settings" }, // Added Settings page link
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