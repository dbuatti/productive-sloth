"use client";

import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import { showSuccess, showError } from '@/utils/toast';
import { format, isSameDay, parseISO } from 'date-fns';
import { CalendarOff, Save, Loader2 } from 'lucide-react'; // Removed 'Block', kept 'CalendarOff'
import { cn } from '@/lib/utils';
import { SelectMultipleEventHandler } from 'react-day-picker'; // Import the correct type

const BlockedDaysSettings: React.FC = () => {
  const { profile, updateProfile, isLoading: isSessionLoading } = useSession();
  const [selectedBlockedDays, setSelectedBlockedDays] = useState<Date[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile?.blocked_days) {
      setSelectedBlockedDays(profile.blocked_days.map(dateString => parseISO(dateString)));
    } else {
      setSelectedBlockedDays([]);
    }
  }, [profile?.blocked_days]);

  // Corrected handler for multiple day selection
  const handleDaySelect: SelectMultipleEventHandler = (days) => {
    if (!days) {
      setSelectedBlockedDays([]);
      return;
    }
    setSelectedBlockedDays(days);
  };

  const handleSaveBlockedDays = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const newBlockedDaysStrings = selectedBlockedDays.map(d => format(d, 'yyyy-MM-dd'));
      await updateProfile({ blocked_days: newBlockedDaysStrings });
      showSuccess("Blocked days updated successfully!");
    } catch (error) {
      showError("Failed to save blocked days.");
      console.error("Failed to save blocked days:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const modifiers = {
    blocked: selectedBlockedDays,
  };

  const modifiersClassNames = {
    blocked: "bg-destructive/20 text-destructive border border-destructive/50 rounded-md",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <CalendarOff className="h-4 w-4 text-destructive" /> Blocked Days
      </div>
      <p className="text-sm text-muted-foreground">
        Select days on the calendar to prevent any tasks from being scheduled on them.
      </p>

      <div className="flex flex-col items-center justify-center p-4 rounded-lg border bg-background/50">
        <Calendar
          mode="multiple"
          selected={selectedBlockedDays}
          onSelect={handleDaySelect}
          modifiers={modifiers}
          modifiersClassNames={modifiersClassNames}
          className="rounded-md border"
        />
        <div className="mt-4 text-sm text-muted-foreground">
          Selected: {selectedBlockedDays.length} day{selectedBlockedDays.length !== 1 ? 's' : ''} blocked.
        </div>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSaveBlockedDays} 
          disabled={isSaving || isSessionLoading}
          aria-label="Save Blocked Days"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save Blocked Days
        </Button>
      </div>
    </div>
  );
};

export default BlockedDaysSettings;