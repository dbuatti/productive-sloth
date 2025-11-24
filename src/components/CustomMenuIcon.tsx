import React from 'react';
import { cn } from '@/lib/utils';

const CustomMenuIcon: React.FC = () => {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 h-6 w-6 items-center justify-center",
        "text-current" // Inherit color from parent button
      )}
    >
      <span className="block h-0.5 w-5 rounded-full bg-current" />
      <span className="block h-0.5 w-5 rounded-full bg-current" />
      <span className="block h-0.5 w-5 rounded-full bg-current" />
    </div>
  );
};

export default CustomMenuIcon;