import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './use-session';
import { showSuccess, showError } from '@/utils/toast';

export interface AetherSinkSnapshot {
  snapshot_id: number;
  user_id: string;
  backup_timestamp: string;
  sink_data: any[];
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
      const { data, error } = await supabase
        .from('aethersink_snapshots')
        .select('*')
        .eq('user_id', userId)
        .order('backup_timestamp', { ascending: false });
      if (error) throw new Error(error.message);
      return data as AetherSinkSnapshot[];
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      if (!userId || !session?.access_token) throw new Error("User not authenticated.");
      console.log(`[useAetherSinkSnapshots] Initiating Restoration: ${snapshotId}`);

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
        throw new Error(errorData.error || 'Restore failed');
      }
      return await response.json();
    },
    onSuccess: () => {
      console.log("[useAetherSinkSnapshots] Selective Invalidation Triggered.");
      // DO NOT invalidate all queries. Only the relevant sink data.
      queryClient.invalidateQueries({ queryKey: ['retiredTasks', userId] });
      queryClient.invalidateQueries({ queryKey: ['aetherSinkSnapshots', userId] });
      showSuccess("Timeline Restored.");
    },
    onError: (e) => {
      showError(`Restore failed: ${e.message}`);
    }
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: number) => {
      if (!userId) throw new Error("User not authenticated.");
      const { error } = await supabase.from('aethersink_snapshots').delete().eq('snapshot_id', snapshotId).eq('user_id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aetherSinkSnapshots', userId] });
      showSuccess("Snapshot purged.");
    }
  });

  return {
    snapshots,
    isLoadingSnapshots,
    restoreSnapshot: restoreSnapshotMutation.mutateAsync,
    deleteSnapshot: deleteSnapshotMutation.mutateAsync,
  };
};