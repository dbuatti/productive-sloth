import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';

export interface AetherSinkSnapshot {
  snapshot_id: number;
  user_id: string;
  backup_timestamp: string;
  sink_data: any[]; // JSONB array of retired tasks
}

const SUPABASE_PROJECT_ID = "yfgapigmiyclgryqdgne";
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;

export const useAetherSinkSnapshots = () => {
  const queryClient = useQueryClient();
  const { user, session } = useSession();
  const userId = user?.id;

  const { data: snapshots = [], isLoading: isLoadingSnapshots } = useQuery<AetherSinkSnapshot[]>({
    queryKey: ['aetherSinkSnapshots', userId],
    queryFn: async () => {
      if (!userId) return [];
      console.log(`[useAetherSinkSnapshots] Fetching snapshots for user: ${userId}`);
      const { data, error } = await supabase
        .from('aethersink_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('backup_timestamp', { ascending: false }); // Newest first
      if (error) {
        console.error("[useAetherSinkSnapshots] Error fetching snapshots:", error);
        throw new Error(error.message);
      }
      console.log(`[useAetherSinkSnapshots] Fetched ${data.length} snapshots.`);
      return data as AetherSinkSnapshot[];
    },
    enabled: !!userId,
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      if (!userId || !session?.access_token) throw new Error("User not authenticated.");
      console.log(`[useAetherSinkSnapshots] Restoring snapshot: ${snapshotId}`);

      const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/restore-aethersink-snapshot`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ snapshotId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[useAetherSinkSnapshots] Failed to restore Aether Sink snapshot via Edge Function:", errorData);
        throw new Error(errorData.error || 'Failed to restore Aether Sink snapshot.');
      }
      console.log(`[useAetherSinkSnapshots] Snapshot ${snapshotId} restored successfully via Edge Function.`);
      return await response.json();
    },
    onSuccess: () => {
      console.log("[useAetherSinkSnapshots] Invalidate queries after restoreSnapshot.");
      queryClient.invalidateQueries({ queryKey: ['aetherSinkSnapshots'] });
      queryClient.invalidateQueries({ queryKey: ['retiredTasks'] }); // Invalidate retired tasks to show restored state
      showSuccess("Aether Sink restored successfully!");
    },
    onError: (e) => {
      showError(`Failed to restore Aether Sink: ${e.message}`);
    }
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      if (!userId) throw new Error("User not authenticated.");
      console.log(`[useAetherSinkSnapshots] Deleting snapshot: ${snapshotId}`);
      const { error } = await supabase
        .from('aethersink_snapshots')
        .delete()
        .eq('snapshot_id', snapshotId)
        .eq('user_id', userId);
      if (error) {
        console.error("[useAetherSinkSnapshots] Error deleting snapshot:", error);
        throw new Error(error.message);
      }
      console.log(`[useAetherSinkSnapshots] Snapshot ${snapshotId} deleted successfully.`);
    },
    onSuccess: () => {
      console.log("[useAetherSinkSnapshots] Invalidate queries after deleteSnapshot.");
      queryClient.invalidateQueries({ queryKey: ['aetherSinkSnapshots'] });
      showSuccess("Snapshot deleted.");
    },
    onError: (e) => {
      showError(`Failed to delete snapshot: ${e.message}`);
    }
  });

  return {
    snapshots,
    isLoadingSnapshots,
    restoreSnapshot: restoreSnapshotMutation.mutateAsync,
    deleteSnapshot: deleteSnapshotMutation.mutateAsync,
  };
};