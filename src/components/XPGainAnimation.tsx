import React, { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface XPGainAnimationProps {
  xpAmount: number;
  onAnimationEnd: () => void;
}

const XPGainAnimation: React.FC<XPGainAnimationProps> = ({ xpAmount, onAnimationEnd }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onAnimationEnd();
    }, 1500); // Animation duration + fade out

    return () => clearTimeout(timer);
  }, [onAnimationEnd]);

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "absolute right-0 top-1/2 -translate-y-1/2", // Position relative to parent
        "flex items-center gap-1 text-sm font-bold text-green-500",
        "animate-fade-out-up" // Tailwind animation for fade out and move up
      )}
      style={{ animationDuration: '1.5s' }} // Ensure animation duration matches timeout
    >
      <Sparkles className="h-4 w-4" />
      <span>+{xpAmount} XP!</span>
    </div>
  );
};

export default XPGainAnimation;