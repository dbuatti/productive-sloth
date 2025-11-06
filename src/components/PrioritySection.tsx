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
    HIGH: 'text-destructive', // Use destructive for HIGH priority
    MEDIUM: 'text-[hsl(var(--logo-yellow))]', // Use logo-yellow for MEDIUM priority
    LOW: 'text-[hsl(var(--logo-green))]', // Use logo-green for LOW priority
  };

  const headerText = `${priority} (${tasks.length})`;

  return (
    <Accordion type="single" collapsible defaultValue={priority}>
      <AccordionItem 
        value={priority} 
        className="rounded-lg overflow-hidden mb-4" // Removed bg-card, border, shadow-sm
      >
        <AccordionTrigger className={cn(
          "px-4 py-3 font-semibold hover:no-underline bg-background hover:bg-muted/20 rounded-t-lg border-b border-border/50", // Changed background and hover, added subtle border
          priorityClasses[priority]
        )}>
          {headerText}
        </AccordionTrigger>
        <AccordionContent className="p-4 bg-background"> {/* Explicitly set background for content */}
          <div className="space-y-3">
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