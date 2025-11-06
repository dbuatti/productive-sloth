import React from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TaskItem from './TaskItem';
import { Task } from '@/lib/types'; // Corrected import to use the Task type from lib/types

interface PrioritySectionProps {
  priority: string;
  tasks: Task[];
}

const PrioritySection: React.FC<PrioritySectionProps> = ({ priority, tasks }) => {
  return (
    <AccordionItem value={priority}>
      <AccordionTrigger className="text-lg font-semibold capitalize">
        {priority} Priority ({tasks.length})
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4">No {priority} priority tasks.</p>
          ) : (
            tasks.map(task => (
                <TaskItem key={task.id} task={task} />
              ))
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PrioritySection;