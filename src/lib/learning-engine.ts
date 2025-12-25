import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

/**
 * Analyzes user feedback to identify patterns.
 * In a real-world scenario, this would be a more complex ML model.
 * Here, we'll simulate the analysis and return a recommendation string.
 */
export const analyzeEnergyPatterns = async (userId: string): Promise<string | null> => {
  try {
    // Fetch recent feedback data for the user
    const { data: feedbackData, error } = await supabase
      .from('task_energy_feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50); // Analyze last 50 entries

    if (error || !feedbackData || feedbackData.length < 5) {
      // Not enough data to form a pattern
      return null;
    }

    // --- Pattern Detection Logic (Simulation) ---
    // 1. Identify high-drain tasks in the afternoon
    const afternoonHighDrain = feedbackData.filter(f => {
      const hour = new Date(f.created_at).getHours();
      return hour >= 15 && hour <= 18 && f.reported_drain > f.predicted_drain * 1.5;
    });

    if (afternoonHighDrain.length >= 2) {
      const taskName = afternoonHighDrain[0].task_name;
      return `Pattern Detected: "${taskName}" is draining you more than expected in the late afternoon. I'll suggest a pre-emptive break for similar tasks.`;
    }

    // 2. Identify specific environments that are draining
    const environmentDrainMap: { [env: string]: { totalReported: number; totalPredicted: number; count: number } } = {};
    feedbackData.forEach(f => {
      if (f.task_environment) {
        if (!environmentDrainMap[f.task_environment]) {
          environmentDrainMap[f.task_environment] = { totalReported: 0, totalPredicted: 0, count: 0 };
        }
        environmentDrainMap[f.task_environment].totalReported += f.reported_drain;
        environmentDrainMap[f.task_environment].totalPredicted += f.predicted_drain;
        environmentDrainMap[f.task_environment].count++;
      }
    });

    for (const [env, stats] of Object.entries(environmentDrainMap)) {
      const avgReported = stats.totalReported / stats.count;
      const avgPredicted = stats.totalPredicted / stats.count;
      if (avgReported > avgPredicted * 1.4 && stats.count >= 3) {
        return `Pattern Detected: Tasks in the "${env}" environment are consistently more draining. Consider scheduling recovery breaks after these sessions.`;
      }
    }

    // 3. Identify specific tasks that are consistently under-estimated
    const taskDrainMap: { [task: string]: { totalReported: number; totalPredicted: number; count: number } } = {};
    feedbackData.forEach(f => {
      if (f.task_name) {
        if (!taskDrainMap[f.task_name]) {
          taskDrainMap[f.task_name] = { totalReported: 0, totalPredicted: 0, count: 0 };
        }
        taskDrainMap[f.task_name].totalReported += f.reported_drain;
        taskDrainMap[f.task_name].totalPredicted += f.predicted_drain;
        taskDrainMap[f.task_name].count++;
      }
    });

    for (const [task, stats] of Object.entries(taskDrainMap)) {
      const avgReported = stats.totalReported / stats.count;
      const avgPredicted = stats.totalPredicted / stats.count;
      if (avgReported > avgPredicted * 1.5 && stats.count >= 3) {
        return `Pattern Detected: You consistently report higher energy drain for "${task}". I'll adjust future energy cost calculations for this task.`;
      }
    }

    return null; // No strong patterns detected
  } catch (e) {
    console.error("Error analyzing energy patterns:", e);
    return null;
  }
};