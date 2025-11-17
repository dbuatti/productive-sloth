import React from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TaskItem from './TaskItem';
import { Task } from '@/types'; // Updated import to use the consolidated Task type
import { ClipboardList } from 'lucide-react'; // Import ClipboardList

interface PrioritySectionProps {
  priority: string;
  tasks: Task[];
}

const PrioritySection: React.FC<PrioritySectionProps> = ({ priority, tasks }) => {
  return (
    <AccordionItem value={priority}>
      <AccordionTrigger className="text-base font-semibold capitalize"> {/* Changed text-lg to text-base */}
        {priority} Priority ({tasks.length})
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-4 text-muted-foreground text-sm space-y-2">
              <ClipboardList className="h-6 w-6" />
              <p>No {priority} priority tasks.</p>
            </div>
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