import { Task, TaskPriority } from '@/types';
import TaskItem from './TaskItem';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { cn } from '@/lib/utils';

interface PrioritySectionProps {
  priority: TaskPriority;
  tasks: Task[];
}

const PrioritySection: React.FC<PrioritySectionProps> = ({ priority, tasks }) => {
  const priorityClasses = {
    HIGH: 'text-red-600 dark:text-red-400',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400',
    LOW: 'text-green-600 dark:text-green-400',
  };

  const headerText = `${priority} (${tasks.length})`;

  return (
    <Accordion type="single" collapsible defaultValue={priority}>
      <AccordionItem 
        value={priority} 
        className="rounded-lg bg-card border shadow-sm overflow-hidden mb-4" // Added mb-4 for spacing
      >
        <AccordionTrigger className={cn(
          "px-4 py-3 font-semibold hover:no-underline bg-muted/30 hover:bg-muted/50 rounded-t-lg",
          priorityClasses[priority]
        )}>
          {headerText}
        </AccordionTrigger>
        <AccordionContent className="p-4"> {/* Increased padding for content */}
          <div className="space-y-3"> {/* Used space-y-3 for consistent spacing between TaskItems */}
            {tasks.length > 0 ? (
              tasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))
            ) : (
              <p className="text-center text-muted-foreground text-sm">
                No {priority} priority tasks found for this filter.
              </p>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default PrioritySection;