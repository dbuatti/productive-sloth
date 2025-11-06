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
    HIGH: 'text-red-600 dark:text-red-400 border-red-500',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400 border-yellow-500',
    LOW: 'text-green-600 dark:text-green-400 border-green-500',
  };

  const headerText = `${priority} (${tasks.length})`;

  return (
    <Accordion type="single" collapsible defaultValue={priority}>
      <AccordionItem value={priority} className="border rounded-lg shadow-sm mb-4 bg-card">
        <AccordionTrigger className={cn(
          "px-4 py-3 font-semibold hover:no-underline",
          priorityClasses[priority]
        )}>
          {headerText}
        </AccordionTrigger>
        <AccordionContent className="p-0">
          <div className="divide-y">
            {tasks.length > 0 ? (
              tasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))
            ) : (
              <p className="p-4 text-center text-muted-foreground text-sm">
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