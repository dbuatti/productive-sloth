import { useState, useEffect } from 'react';

export type SinkViewMode = 'list' | 'kanban';
export type GroupingOption = 'environment' | 'priority' | 'type'; // Added 'type'

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
          // Ensure 'type' is a valid option if loaded from old settings
          if (!['environment', 'priority', 'type'].includes(parsed.groupBy)) {
            return { viewMode: 'kanban', groupBy: 'type' }; // Default to new Kanban view
          }
          return parsed;
        } catch (e) {
          console.warn(`[useSinkView] Corrupted settings found, resetting to default.`);
          return { viewMode: 'kanban', groupBy: 'type' }; // Default to new Kanban view
        }
      }
    }
    console.log(`[useSinkView] No saved settings, using default: { viewMode: 'kanban', groupBy: 'type' }`);
    return { viewMode: 'kanban', groupBy: 'type' }; // Default to Kanban 'type' view
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