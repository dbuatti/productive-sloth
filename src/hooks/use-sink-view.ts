import { useState, useEffect } from 'react';

export type SinkViewMode = 'list' | 'kanban';
export type GroupingOption = 'environment' | 'priority';

interface SinkViewSettings {
  viewMode: SinkViewMode;
  groupBy: GroupingOption;
}

export const useSinkView = () => {
  // Load initial state from localStorage or default to 'list' and 'environment'
  const [settings, setSettings] = useState<SinkViewSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow_sink_view');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SinkViewSettings;
          return parsed;
        } catch (e) {
          return { viewMode: 'list', groupBy: 'environment' };
        }
      }
    }
    return { viewMode: 'list', groupBy: 'environment' };
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow_sink_view', JSON.stringify(settings));
    }
  }, [settings]);

  const setViewMode = (mode: SinkViewMode) => {
    setSettings(prev => ({ ...prev, viewMode: mode }));
  };

  const setGroupBy = (groupBy: GroupingOption) => {
    setSettings(prev => ({ ...prev, groupBy }));
  };

  return {
    viewMode: settings.viewMode,
    groupBy: settings.groupBy,
    setViewMode,
    setGroupBy,
  };
};