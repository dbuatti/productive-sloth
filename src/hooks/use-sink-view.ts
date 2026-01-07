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
          console.log(`[useSinkView] Loaded settings from localStorage:`, parsed);
          return parsed;
        } catch (e) {
          console.warn(`[useSinkView] Corrupted settings found, resetting to default.`);
          return { viewMode: 'list', groupBy: 'environment' };
        }
      }
    }
    console.log(`[useSinkView] No saved settings, using default: { viewMode: 'list', groupBy: 'environment' }`);
    return { viewMode: 'list', groupBy: 'environment' };
  });

  // Persist to localStorage whenever settings change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow_sink_view', JSON.stringify(settings));
      console.log(`[useSinkView] Settings updated and saved to localStorage:`, settings);
    }
  }, [settings]);

  const setViewMode = (mode: SinkViewMode) => {
    console.log(`[useSinkView] setViewMode called with: ${mode}`);
    setSettings(prev => ({ ...prev, viewMode: mode }));
  };

  const setGroupBy = (groupBy: GroupingOption) => {
    console.log(`[useSinkView] setGroupBy called with: ${groupBy}`);
    setSettings(prev => ({ ...prev, groupBy }));
  };

  return {
    viewMode: settings.viewMode,
    groupBy: settings.groupBy,
    setViewMode,
    setGroupBy,
  };
};