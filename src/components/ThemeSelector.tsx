import React, { useState, useEffect } from 'react';
import { Palette } from 'lucide-react';
import { DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';

type Theme = 'default' | 'ocean' | 'forest' | 'sunset';

const themes: { value: Theme; label: string }[] = [
  { value: 'default', label: 'Default (Slate)' },
  { value: 'ocean', label: 'Ocean Blue' },
  { value: 'forest', label: 'Forest Green' },
  { value: 'sunset', label: 'Sunset Orange' },
];

const ThemeSelector: React.FC = () => {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as Theme) || 'default';
    }
    return 'default';
  });

  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove(...themes.map(t => `theme-${t.value}`));
    
    // Apply selected theme class
    if (selectedTheme !== 'default') {
      root.classList.add(`theme-${selectedTheme}`);
    }
    
    // Save preference
    localStorage.setItem('theme', selectedTheme);

    // DEBUG: Log the applied theme and current classes
    console.log(`ThemeSelector: Applied theme: ${selectedTheme}`);
    console.log(`ThemeSelector: document.documentElement classes: ${root.className}`);

  }, [selectedTheme]);

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Palette className="mr-2 h-4 w-4" />
        <span>Theme</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup value={selectedTheme} onValueChange={(value) => setSelectedTheme(value as Theme)}>
          {themes.map((theme) => (
            <DropdownMenuRadioItem key={theme.value} value={theme.value}>
              {theme.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
};

export default ThemeSelector;