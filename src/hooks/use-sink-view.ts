import { useState, useEffect } from 'react';

export type SinkViewMode = 'list' | 'kanban';
export type GroupingOption = 'environment' | 'priority' | 'type';

interface SinkViewSettings {
  viewMode: SinkViewMode;
  groupBy: GroupingOption;
  showEmptyColumns: boolean; // NEW: Track empty column visibility
}

export const useSinkView = () => {
  const [settings, setSettings] = useState<SinkViewSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow_sink_view');
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as SinkViewSettings;
          // Ensure defaults for new properties if they were missing in old localstorage
          return {
            viewMode: parsed.viewMode || 'kanban',
            groupBy: parsed.groupBy || 'type',
            showEmptyColumns: parsed.showEmptyColumns ?? false,
          };
        } catch (e) {
          return { viewMode: 'kanban', groupBy: 'type', showEmptyColumns: false };
        }
      }
    }
    return { viewMode: 'kanban', groupBy: 'type', showEmptyColumns: false };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow_sink_view', JSON.stringify(settings));
    }
  }, [settings]);

  const setViewMode = (viewMode: SinkViewMode) => setSettings(prev => ({ ...prev, viewMode }));
  const setGroupBy = (groupBy: GroupingOption) => setSettings(prev => ({ ...prev, groupBy }));
  const setShowEmptyColumns = (showEmptyColumns: boolean) => setSettings(prev => ({ ...prev, showEmptyColumns }));

  return {
    ...settings,
    setViewMode,
    setGroupBy,
    setShowEmptyColumns,
  };
};