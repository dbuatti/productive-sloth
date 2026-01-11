import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useKeyboardShortcuts = (actions: {
  onCompact?: () => void;
  onRebalance?: () => void;
  onClear?: () => void;
}) => {
  const navigate = useNavigate();

  useEffect(() => {
    let lastKey = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const key = e.key.toLowerCase();

      // Navigation Shortcuts (G + [Key])
      if (lastKey === 'g') {
        if (key === 's') navigate('/scheduler');
        if (key === 'k') navigate('/sink');
        if (key === 'a') navigate('/analytics');
        if (key === 'w') navigate('/wellness');
        if (key === 'r') navigate('/recap');
        if (key === 'p') navigate('/settings');
        lastKey = '';
        return;
      }

      // Action Shortcuts
      if (key === 'c' && actions.onCompact) actions.onCompact();
      if (key === 'r' && actions.onRebalance) actions.onRebalance();
      if (key === 'escape' && actions.onClear) actions.onClear();

      lastKey = key;
      // Reset prefix key after short delay
      setTimeout(() => { if (lastKey === key) lastKey = ''; }, 1000);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, actions]);
};