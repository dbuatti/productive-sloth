// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import * as jose from "https://esm.sh/jose@5.2.4";
// @ts-ignore
import * as dateFns from 'https://esm.sh/date-fns@2.30.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock data for events (simulating a 30-day fetch)
const generateMockEvents = (calendarIds: string[], startDate: string, endDate: string) => {
    const events = [];
    const start = dateFns.parseISO(startDate);
    const end = dateFns.parseISO(endDate);
    
    let current = start;
    let eventCounter = 0;

    while (dateFns.isBefore(current, end)) {
        const dayOfWeek = dateFns.getDay(current); // 0 = Sunday, 1 = Monday
        
        // Mock events for Work calendar on weekdays
        if (calendarIds.includes('icloud-work') && dayOfWeek >= 1 && dayOfWeek <= 5) {
            eventCounter++;
            const startTime = dateFns.setHours(dateFns.setMinutes(current, 0), 10);
            const endTime = dateFns.setHours(dateFns.setMinutes(current, 30), 11);
            events.push({
                id: `work-meeting-${dateFns.format(current, 'yyyyMMdd')}`,
                calendar_id: 'icloud-work',
                title: `Team Sync ${eventCounter}`,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                is_all_day: false,
                location: 'Zoom',
                description: 'Weekly team meeting.',
            });
        }

        // Mock events for Personal calendar on weekends
        if (calendarIds.includes('icloud-personal') && (dayOfWeek === 0 || dayOfWeek === 6)) {
            eventCounter++;
            const startTime = dateFns.setHours(dateFns.setMinutes(current, 0), 14);
            const endTime = dateFns.setHours(dateFns.setMinutes(current, 0), 16);
            events.push({
                id: `personal-hobby-${dateFns.format(current, 'yyyyMMdd')}`,
                calendar_id: 'icloud-personal',
                title: `Hobby Time ${eventCounter}`,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                is_all_day: false,
                location: 'Home',
                description: 'Dedicated time for personal projects.',
            });
        }

        current = dateFns.addDays(current, 1);
    }
    return events;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, calendarIds, startDate, endDate } = await req.json();
    
    if (!userId || !calendarIds || calendarIds.length === 0) {
        return new Response(JSON.stringify({ error: 'Missing user ID or calendar IDs.' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    // Use the service role key for database access to bypass RLS
    const supabaseClient = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Simulate fetching events from iCloud API
    const iCloudEvents = generateMockEvents(calendarIds, startDate, endDate);
    
    // 2. Delete existing scheduled_tasks that originated from these calendars
    let deletedCount = 0;
    if (calendarIds.length > 0) {
        const { count, error: deleteError } = await supabaseClient
            .from('scheduled_tasks')
            .delete({ count: 'exact' })
            .eq('user_id', userId)
            .in('source_calendar_id', calendarIds);
            
        if (deleteError) {
            console.error("Error deleting old calendar events:", deleteError.message);
            throw new Error("Failed to delete old calendar events.");
        }
        deletedCount = count ?? 0;
    }

    // 3. Prepare new events for insertion
    const tasksToInsert = iCloudEvents.map(event => {
        const startTime = dateFns.parseISO(event.start_time);
        const endTime = dateFns.parseISO(event.end_time);
        const scheduledDate = dateFns.format(startTime, 'yyyy-MM-dd');
        
        // Calendar events are read-only, fixed, and locked
        return {
            user_id: userId,
            name: event.title,
            start_time: event.start_time,
            end_time: event.end_time,
            scheduled_date: scheduledDate,
            
            // Calendar events are read-only, fixed, and locked
            is_flexible: false, 
            is_locked: true, 
            is_critical: false,
            is_completed: false,
            energy_cost: 0, // Calendar events cost 0 energy
            task_environment: 'away', // Default environment for external events
            
            // Source tracking
            source_calendar_id: event.calendar_id,
            
            // Other required fields (defaults)
            break_duration: null,
            is_custom_energy_cost: false,
        };
    });

    let syncedCount = 0;
    if (tasksToInsert.length > 0) {
        const { error: insertError } = await supabaseClient
            .from('scheduled_tasks')
            .insert(tasksToInsert);
            
        if (insertError) {
            console.error("Error inserting new calendar events:", insertError.message);
            throw new Error("Failed to insert new calendar events.");
        }
        syncedCount = tasksToInsert.length;
    }
    
    // 4. Update last_synced_at for the user's selected calendars
    const now = new Date().toISOString();
    const calendarUpdates = calendarIds.map((id: string) => ({
        calendar_id: id,
        user_id: userId,
        last_synced_at: now,
    }));
    
    const { error: updateSyncError } = await supabaseClient
        .from('user_calendars')
        .upsert(calendarUpdates, { onConflict: 'user_id, calendar_id' });
        
    if (updateSyncError) {
        console.error("Error updating sync timestamps:", updateSyncError.message);
        // Note: We don't throw here as the main task is done.
    }

    return new Response(JSON.stringify({ syncedCount, deletedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Edge Function error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});