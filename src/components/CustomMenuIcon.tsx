import React from 'react';
import { cn } from '@/lib/utils';

const CustomMenuIcon: React.FC = () => {
  return (
    <div
      className={cn(
        "flex flex-col space-y-1.5 h-8 w-8 items-center justify-center",
        "text-current"
      )}
    >
      <span className="block h-1 w-6 rounded-full bg-current" />
      <span className="block h-1 w-6 rounded-full bg-current" />
      <span className="block h-1 w-6 rounded-full bg-current" />
    </div>
  );
};

export default CustomMenuIcon;