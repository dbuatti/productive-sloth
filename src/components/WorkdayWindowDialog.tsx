import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserProfile } from '@/types/scheduler';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { useSession } from '@/hooks/use-session';

interface WorkdayWindowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile | null; // Added this prop
  refreshProfile: () => Promise<void>;
}

const WorkdayWindowDialog: React.FC<WorkdayWindowDialogProps> = ({ open, onOpenChange, profile, refreshProfile }) => {
  const { user } = useSession();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setStartTime(profile.default_auto_schedule_start_time || '');
      setEndTime(profile.default_auto_schedule_end_time || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) {
      showError("You must be logged in to save settings.");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_auto_schedule_start_time: startTime,
          default_auto_schedule_end_time: endTime,
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile(); // Refresh the session profile
      showSuccess("Workday window updated successfully!");
      onOpenChange(false);
    } catch (error: any) {
      showError(`Failed to update workday window: ${error.message}`);
      console.error("Update workday window error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adjust Workday Window</DialogTitle>
          <DialogDescription>
            Set the default start and end times for your auto-scheduled workday.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startTime" className="text-right">
              Start Time
            </Label>
            <Input
              id="startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="col-span-3"
              disabled={isSaving}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endTime" className="text-right">
              End Time
            </Label>
            <Input
              id="endTime"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="col-span-3"
              disabled={isSaving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WorkdayWindowDialog;