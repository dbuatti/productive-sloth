import * as LucideIcons from 'lucide-react';

// This utility allows us to get a Lucide icon component by its string name.
// Example: getLucideIcon('Home') will return the Home icon component.
export const getLucideIcon = (iconName: string): LucideIcons.Icon | null => {
  const IconComponent = (LucideIcons as any)[iconName];
  return IconComponent || null;
};

// A list of common icon names that can be used for environments
export const availableIconNames: string[] = [
  'Laptop', 'Home', 'Globe', 'Music', 'Coffee', 'Book', 'Dumbbell', 'Briefcase',
  'Palette', 'Brain', 'Car', 'ShoppingBag', 'Utensils', 'Bed', 'Cloud', 'Sun',
  'Moon', 'Zap', 'Star', 'Heart', 'MessageSquare', 'Camera', 'Mic', 'PenTool',
  'Code', 'Terminal', 'Server', 'Database', 'Shield', 'Lock', 'Unlock', 'Bell',
  'CalendarDays', 'Clock', 'Target', 'Archive', 'Trash2', 'Settings', 'Cpu',
  'Layers', 'Split', 'ListTodo', 'Trophy', 'TrendingUp', 'BookOpen', 'Flame',
  'Gamepad2', 'RefreshCcw', 'ChevronsUp', 'Shuffle', 'CalendarOff', 'AlertCircle',
  'PlusCircle', 'Feather', 'Anchor', 'Smile', 'BatteryCharging', 'Lightbulb',
  'Rocket', 'Check', 'Sparkles', 'Hourglass', 'AlertTriangle', 'List', 'LayoutDashboard',
  'ChevronUp', 'ChevronDown', 'ArrowLeft', 'ArrowRight', 'X', 'Save', 'Pencil',
  'MoreHorizontal', 'Filter', 'CheckCircle', 'Info', 'Droplet', 'Thermometer',
  'CloudSun', 'CloudRain', 'CloudSnow', 'CloudLightning', 'Cloud', 'Play', 'ListOrdered',
  'ArrowDownWideNarrow', 'ArrowUpWideNarrow', 'SortAsc', 'SortDesc', 'Utensils'
];