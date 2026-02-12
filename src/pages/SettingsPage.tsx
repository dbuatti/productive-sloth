"use client";

import React, { useState, useEffect } from 'react';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showError } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Settings, Trash2, ArrowLeft, ChevronUp, ChevronDown, Cpu, CalendarDays, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import ProfileSettings from '@/components/settings/ProfileSettings';
import { MAX_ENERGY } from '@/lib/constants';

const SettingsPage: React.FC = () => {
  const { user, profile, refreshProfile } = useSession();
  const navigate = useNavigate();
  
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aetherflow_settings_collapsed_v2');
      if (saved) {
        try { return JSON.parse(saved); } catch (e) { console.error(e); }
      }
    }
    return { profile: true, anchors: true, logic: true, environments: true, preferences: true, danger: false };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('aetherflow_settings_collapsed_v2', JSON.stringify(openSections));
    }
  }, [openSections]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleResetGameProgress = async () => {
    if (!user) return;
    try {
      await supabase.from('profiles').update({ xp: 0, level: 1, daily_streak: 0, energy: MAX_ENERGY }).eq('id', user.id);
      await refreshProfile();
      showSuccess("Timeline Reset.");
      window.location.reload();
    } catch (error: any) {
      showError(`Reset failed: ${error.message}`);
    }
  };

  if (!user || !profile) return null;

  return (
    <div className="space-y-8 animate-slide-in-up pb-20">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" />
          Settings
        </h1>
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2 h-10 text-base rounded-xl font-black uppercase tracking-widest text-[10px]" aria-label="Back to Scheduler">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>
      </div>
      
      <div className="space-y-6">
        <Collapsible open={openSections.profile} onOpenChange={() => toggleSection('profile')}>
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer group">
              <ProfileSettings />
            </div>
          </CollapsibleTrigger>
        </Collapsible>

        <Collapsible open={openSections.danger} onOpenChange={() => toggleSection('danger')}>
          <Card className="rounded-xl shadow-sm border-destructive/20 bg-destructive/[0.02]">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-destructive/[0.05] transition-colors p-4">
                <CardTitle className="flex items-center justify-between text-lg font-black uppercase tracking-tighter text-destructive">
                  <div className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" />Danger Zone</div>
                  {openSections.danger ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4 pt-0">
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest mb-4">Irreversible System Actions</p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full rounded-xl font-black uppercase tracking-widest text-[10px] h-11">
                      Wipe Timeline Progress
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter">Confirm Timeline Wipe?</AlertDialogTitle>
                      <AlertDialogDescription className="text-sm font-bold text-muted-foreground/60 leading-relaxed">
                        This will reset your XP, Level, and Daily Streak to zero. All scheduled tasks and sink objectives will remain, but your progression history will be purged.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl font-black uppercase tracking-widest text-[10px]">Abort</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetGameProgress} className="bg-destructive hover:bg-destructive/90 rounded-xl font-black uppercase tracking-widest text-[10px]">Confirm Wipe</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </div>
  );
};

export default SettingsPage;