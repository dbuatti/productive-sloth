import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { XP_PER_LEVEL } from "./constants";
import { Home, Laptop, Globe, Music, Briefcase, Coffee, Star, Info, Zap, AlertCircle, CalendarDays, Clock, ListTodo, LayoutDashboard, RefreshCcw, ArrowDownWideNarrow, SortAsc, Smile, Trash2, RotateCcw, Lock, Unlock, CheckCircle, ChevronUp, ChevronDown, Cpu, CalendarCheck, HeartPulse, Plus, AlignLeft, ArrowLeft, TrendingUp, BookOpen, Flame, Gamepad, Gamepad2, Save, BatteryCharging, Layers, Split, Utensils, Ban, X, Target, SkipForward } from 'lucide-react';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculates the current level, XP towards the next level, and progress percentage.
 */
export const calculateLevelInfo = (totalXp: number) => {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
  const xpTowardsNextLevel = totalXp - xpForCurrentLevel;
  const xpNeededForNextLevel = XP_PER_LEVEL;
  const progressPercentage = (xpTowardsNextLevel / xpNeededForNextLevel) * 100;
  return { level, xpTowardsNextLevel, xpNeededForNextLevel, progressPercentage };
};

/**
 * Utility to ensure an array has a specific length by filling or trimming.
 */
export const adjustArrayLength = <T>(arr: T[], length: number, fillValue: T): T[] => {
  if (arr.length === length) return arr;
  if (arr.length > length) return arr.slice(0, length);
  return [...arr, ...Array(length - arr.length).fill(fillValue)];
};

/**
 * Maps a string icon name to its corresponding Lucide React component.
 */
export const getLucideIconComponent = (iconName: string | undefined): React.ElementType => {
  switch (iconName) {
    case 'Home': return Home;
    case 'Laptop': return Laptop;
    case 'Globe': return Globe;
    case 'Music': return Music;
    case 'Briefcase': return Briefcase;
    case 'Coffee': return Coffee;
    case 'Star': return Star;
    case 'Info': return Info;
    case 'Zap': return Zap;
    case 'AlertCircle': return AlertCircle;
    case 'CalendarDays': return CalendarDays;
    case 'Clock': return Clock;
    case 'ListTodo': return ListTodo;
    case 'LayoutDashboard': return LayoutDashboard;
    case 'RefreshCcw': return RefreshCcw;
    case 'ArrowDownWideNarrow': return ArrowDownWideNarrow;
    case 'SortAsc': return SortAsc;
    case 'Smile': return Smile;
    case 'Trash2': return Trash2;
    case 'RotateCcw': return RotateCcw;
    case 'Lock': return Lock;
    case 'Unlock': return Unlock;
    case 'CheckCircle': return CheckCircle;
    case 'ChevronUp': return ChevronUp;
    case 'ChevronDown': return ChevronDown;
    case 'Cpu': return Cpu;
    case 'CalendarCheck': return CalendarCheck;
    case 'HeartPulse': return HeartPulse;
    case 'Plus': return Plus;
    case 'AlignLeft': return AlignLeft;
    case 'ArrowLeft': return ArrowLeft;
    case 'TrendingUp': return TrendingUp;
    case 'BookOpen': return BookOpen;
    case 'Flame': return Flame;
    case 'Gamepad': return Gamepad;
    case 'Gamepad2': return Gamepad2;
    case 'Save': return Save;
    case 'BatteryCharging': return BatteryCharging;
    case 'Layers': return Layers;
    case 'Split': return Split;
    case 'Utensils': return Utensils;
    case 'Ban': return Ban;
    case 'X': return X;
    case 'Target': return Target;
    case 'SkipForward': return SkipForward;
    default: return Info; // Default to Info icon if not found
  }
};