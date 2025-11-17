import { RetiredTask } from "@/types/scheduler";
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks'; // Fixed: Changed to default import
import { showSuccess, showError } from "@/utils/toast";