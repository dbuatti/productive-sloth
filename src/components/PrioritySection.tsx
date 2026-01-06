import React from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TaskItem from './TaskItem';
import { Task } from '@/types'; // Updated import to use the consolidated Task type
import { ClipboardList } from 'lucide-react'; // Import ClipboardList
import { cn } from '@/lib/utils';

interface PrioritySectionProps {
  priority: string;
  tasks: Task[];
  // Updated prop signature to explicitly pass the new completion state
  onCompleteTask: (task: Task, isCompleted: boolean) => Promise<void>; 
}

const getPriorityColorClass = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return 'text-destructive hover:text-destructive/90';
    case 'MEDIUM':
      return 'text-logo-orange hover:text-logo-orange/90';
    case 'LOW':
      return 'text-logo-green hover:text-logo-green/90';
    default:
      return 'text-foreground hover:text-primary';
  }
};

const PrioritySection: React.FC<PrioritySectionProps> = ({ priority, tasks, onCompleteTask }) => {
  return (
    <AccordionItem value={priority} className="border-none rounded-xl shadow-sm bg-card animate-hover-lift"> {/* Removed border, adjusted styling */}
      <AccordionTrigger className={cn(
        "text-base font-semibold capitalize p-4 transition-colors duration-200 hover:no-underline",
        getPriorityColorClass(priority)
      )}>
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          {priority} Priority ({tasks.length})
        </div>
      </AccordionTrigger>
      <AccordionContent className="p-4 pt-0">
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-4 text-muted-foreground text-sm space-y-2">
              <ClipboardList className="h-6 w-6" />
              <p>No {priority} priority tasks.</p>
            </div>
          ) : (
            tasks.map(task => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onCompleteTask={onCompleteTask} // NEW: Pass onCompleteTask
                />
              ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PrioritySection;