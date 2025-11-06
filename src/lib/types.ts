export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  due_date?: string; // ISO string format
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}