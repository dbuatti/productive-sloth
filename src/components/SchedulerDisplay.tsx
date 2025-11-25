import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { ScheduledItem, FormattedSchedule, DisplayItem, TimeMarker, FreeTimeItem, CurrentTimeMarker, DBScheduledTask, TaskEnvironment } from '@/types/scheduler';
import { cn } from '@/lib/utils';
import { formatTime, getEmojiHue, isMeal } from '@/lib/scheduler-utils'; // Import isMeal
import { Button } from '@/components/ui/button';
import { Trash, Archive, AlertCircle, Lock, Unlock, Clock, Zap, CheckCircle, Star, Home, Laptop, Globe, Music, Utensils } from 'lucide-react'; // Import Utensils
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, BarChart, ListTodo, PlusCircle } from 'lucide-react';
import { startOfDay, addHours, addMinutes, isSameDay, parseISO, isBefore, isAfter, isPast, format, differenceInMinutes } from 'date-fns';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useSchedulerTasks } from '@/hooks/use-scheduler-tasks';
import ScheduledTaskDetailDialog from './ScheduledTaskDetailDialog';

interface SchedulerDisplayProps {
  schedule: FormattedSchedule | null;
  T_current: Date;
  onRemoveTask: (taskId: string, taskName: string, index: number) => void; // Changed signature
  onRetireTask: (task: DBScheduledTask) => void;
  onCompleteTask: (task: DBScheduledTask, index: number) => void; // Changed signature
  activeItemId: string | null;
  selectedDayString: string;
  onAddTaskClick: () => void;
  onScrollToItem: (itemId: string) => void; // NEW: Prop for scrolling to a specific item
  isProcessingCommand: boolean; // ADDED
}

const getBubbleHeightStyle = (duration: number) => {
  const baseHeight = 40;
  const multiplier = 1.5;
  const minCalculatedHeight = 40;

  let calculatedHeight = baseHeight + (duration * multiplier);
  return { minHeight: `${Math.max(calculatedHeight, minCalculatedHeight)}px` };
};

const getEnvironmentIcon = (environment: TaskEnvironment) => {
  switch (environment) {
    case 'home':
      return <Home className="h-4 w-4 text-logo-green" />; // Reduced size
    case 'laptop':
      return <Laptop className="h-4 w-4 text-primary" />; // Reduced size
    case 'away':
      return <Globe className="h-4 w-4 text-logo-orange" />; // Reduced size
    case 'piano':
      return <Music className="h-4 w-4 text-accent" />; // Reduced size
    case 'laptop_piano':
      return (
        <div className="relative">
          <Laptop className="h-4 w-4 text-primary" /> {/* Reduced size */}
          <Music className="h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 text-accent" /> {/* Reduced size */}
        </div>
      );
    default:
      return null;
  }
};

const SchedulerDisplay: React.FC<SchedulerDisplayProps> = React.memo(({ schedule, T_current, onRemoveTask, onRetireTask, onCompleteTask, activeItemId, selectedDayString, onAddTaskClick, onScrollToItem, isProcessingCommand }) => {
  const startOfTemplate = useMemo(() => startOfDay(T_current), [T_current]);
  const endOfTemplate = useMemo(() => addHours(startOfTemplate, 24), [startOfTemplate]);
  const containerRef = useRef<HTMLDivElement>(null);

  const { toggleScheduledTaskLock, updateScheduledTaskStatus } = useSchedulerTasks(selectedDayString);

  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedScheduledTask, setSelectedScheduledTask] = useState<DBScheduledTask | null>(null);

  const { finalDisplayItems, firstItemStartTime, lastItemEndTime } = useMemo(() => {
    const scheduledTasks = schedule ? schedule.items : [];
    const allEvents: (ScheduledItem | TimeMarker)[] = [...scheduledTasks];

    allEvents.push({ id: `marker-start-${format(startOfTemplate, 'HHmm')}`, type: 'marker', time: startOfTemplate, label: formatTime(startOfTemplate) });
    allEvents.push({ id: `marker-end-${format(endOfTemplate, 'HHmm')}`, type: 'marker', time: endOfTemplate, label: formatTime(endOfTemplate) }); 

    allEvents.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const processedItems: DisplayItem[] = [];
    let currentCursor = startOfTemplate;

    allEvents.forEach(event => {
        const eventStartTime = 'time' in event ? event.time : event.startTime;
        // FIX 1: Corrected variable name from eventEndTime (undefined) to event.endTime
        const eventEndTime = 'time' in event ? event.time : event.endTime; 

        if (eventStartTime.getTime() > currentCursor.getTime()) {
            const freeDurationMs = eventStartTime.getTime() - currentCursor.getTime();
            const freeDurationMinutes = Math.floor(freeDurationMs / (1000 * 60));
            if (freeDurationMinutes > 0) {
                processedItems.push({
                    id: `free-${currentCursor.toISOString()}-${eventStartTime.toISOString()}`,
                    type: 'free-time',
                    startTime: currentCursor,
                    endTime: eventStartTime,
                    duration: freeDurationMinutes,
                    message: `${Math.floor(freeDurationMinutes / 60)}h ${freeDurationMinutes % 60}min Free Time`,
                });
            }
        }

        const isRedundantMarker = event.type === 'marker' && processedItems.some(pItem => 
            ('startTime' in pItem && pItem.startTime.getTime() === event.time.getTime()) ||
            ('endTime' in pItem && pItem.endTime.getTime() === event.time.getTime())
        );

        if (!isRedundantMarker) {
            processedItems.push(event);
        }
        
        currentCursor = event.type === 'marker' ? event.time : eventEndTime;
    });

    const filteredItems: DisplayItem[] = [];
    processedItems.forEach(item => {
        if (item.type === 'marker') {
            const isCovered = processedItems.some(pItem => {
                if (pItem.type === 'free-time' || pItem.type === 'task' || pItem.type === 'break' || pItem.type === 'time-off' || pItem.type === 'meal') {
                    return item.time >= pItem.startTime && item.time < pItem.endTime;
                }
                return false;
            });
            if (!isCovered) {
                filteredItems.push(item);
            }
        } else {
            filteredItems.push(item);
        }
    });

    const hasStartMarker = filteredItems.some(item => ('startTime' in item ? item.startTime : item.time).getTime() === startOfTemplate.getTime());
    if (!hasStartMarker) {
        filteredItems.unshift({ id: `marker-start-final-${format(startOfTemplate, 'HHmm')}`, type: 'marker', time: startOfTemplate, label: formatTime(startOfTemplate) });
    }
    const hasEndMarker = filteredItems.some(item => ('endTime' in item ? item.endTime : item.time).getTime() === endOfTemplate.getTime());
    if (!hasEndMarker) {
        filteredItems.push({ id: `marker-end-final-${format(endOfTemplate, 'HHmm')}`, type: 'marker', time: endOfTemplate, label: formatTime(endOfTemplate) });
    }

    filteredItems.sort((a, b) => {
        const timeA = 'time' in a ? a.time : a.startTime;
        const timeB = 'time' in b ? b.time : b.startTime;
        return timeA.getTime() - timeB.getTime();
    });

    const firstRenderedItem = filteredItems[0];
    const lastRenderedItem = filteredItems[filteredItems.length - 1];

    const actualStartTime = firstRenderedItem ? ('time' in firstRenderedItem ? firstRenderedItem.time : firstRenderedItem.startTime) : startOfTemplate;
    const actualEndTime = lastRenderedItem ? ('time' in lastRenderedItem ? lastRenderedItem.time : lastRenderedItem.endTime) : endOfTemplate;

    return {
        finalDisplayItems: filteredItems,
        firstItemStartTime: actualStartTime,
        lastItemEndTime: actualEndTime,
    };
  }, [schedule, T_current, startOfTemplate, endOfTemplate]);

  const activeItemInDisplay = useMemo(() => {
    for (const item of finalDisplayItems) {
      if ((item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal') && T_current >= item.startTime && T_current < item.endTime) {
        return item;
      }
    }
    return null;
  }, [finalDisplayItems, T_current]);

  const progressLineTopPercentage = useMemo(() => {
    if (!activeItemInDisplay) return 0;

    const itemStartTime = activeItemInDisplay.startTime.getTime();
    const itemEndTime = activeItemInDisplay.endTime.getTime();
    const itemDurationMs = itemEndTime - itemStartTime;

    if (itemDurationMs === 0) return 0;

    const timeIntoItemMs = T_current.getTime() - itemStartTime;
    return (timeIntoItemMs / itemDurationMs) * 100;
  }, [activeItemInDisplay, T_current]);

  const globalProgressLineTopPercentage = useMemo(() => {
    // Calculate the percentage based on the 24-hour template duration
    const totalTemplateDurationMs = endOfTemplate.getTime() - startOfTemplate.getTime();
    const timeIntoTemplateMs = T_current.getTime() - startOfTemplate.getTime();
    
    let templatePercentage = (timeIntoTemplateMs / totalTemplateDurationMs) * 100;
    templatePercentage = Math.max(0, Math.min(100, templatePercentage));
    
    // We need to map this time percentage to the actual rendered height percentage.
    // This is complex, so we use a simplified time-based percentage for the global marker.
    // This assumes a linear time scale, which is visually close enough for a marker.
    
    const totalMinutes = differenceInMinutes(endOfTemplate, startOfTemplate);
    const minutesIntoTemplate = differenceInMinutes(T_current, startOfTemplate);
    
    return (minutesIntoTemplate / totalMinutes) * 100; 
    
  }, [T_current, startOfTemplate, endOfTemplate]);

  // Scroll to active item on load or when active item changes
  useEffect(() => {
    if (activeItemId) {
      onScrollToItem(activeItemId);
    }
  }, [activeItemId, onScrollToItem]);

  const handleToggleLock = useCallback(async (task: DBScheduledTask) => {
    if (isProcessingCommand) return;
    // FIX 2: Updated function call to match expected object payload
    await toggleScheduledTaskLock({ taskId: task.id, isLocked: !task.is_locked });
  }, [isProcessingCommand, toggleScheduledTaskLock]);

  const handleOpenDetails = useCallback((task: DBScheduledTask) => {
    setSelectedScheduledTask(task);
    setIsDialogOpen(true);
  }, []);

  // FIX 9: Removed handleUpdateDetails as it is no longer needed/used by the dialog
  // const handleUpdateDetails = useCallback(async (updatedTask: DBScheduledTask) => {
  //   setIsDialogOpen(false);
  // }, []);

  const renderItem = (item: DisplayItem, index: number) => {
    if (item.type === 'marker') {
      return (
        <div key={item.id} className="relative flex items-center h-8 -mt-4">
          <div className="w-16 text-right text-xs text-muted-foreground pr-2">{item.label}</div>
          <div className="flex-grow border-t border-dashed border-border"></div>
        </div>
      );
    }

    const isScheduledItem = item.type === 'task' || item.type === 'break' || item.type === 'time-off' || item.type === 'meal';
    const isFreeTime = item.type === 'free-time';
    
    const isRegenPod = item.id === 'regen-pod-active'; // NEW: Identify Regen Pod

    if (isFreeTime) {
      return (
        <div 
          key={item.id} 
          className="relative flex items-center py-2 px-4" 
          style={getBubbleHeightStyle(item.duration)}
        >
          <div className="w-16 text-right text-xs text-muted-foreground pr-2"></div>
          <div className="flex-grow border-l border-dashed border-border pl-4">
            <div className="text-xs text-muted-foreground italic">
              {item.message}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-1 h-6 text-xs text-primary hover:bg-primary/10"
              onClick={onAddTaskClick}
            >
              <PlusCircle className="h-3 w-3 mr-1" /> Add Task
            </Button>
          </div>
        </div>
      );
    }

    if (isScheduledItem) {
      const dbTask = schedule?.dbTasks.find(t => t.id === item.id);
      const isPastItem = isPast(item.endTime) && !isSameDay(item.endTime, T_current);
      const isActive = activeItemInDisplay?.id === item.id;
      const isCompleted = item.isCompleted;
      const isLocked = item.isLocked;
      const isCritical = item.isCritical;
      const isMealTask = isMeal(item.name); // Check if it's a meal

      const hue = isRegenPod ? 60 : getEmojiHue(item.name); // Use yellow hue for Pod
      const colorClass = `hsl(${hue}, 70%, 50%)`;
      const bgColorClass = `hsl(${hue}, 70%, 95%)`;
      const borderColorClass = `hsl(${hue}, 70%, 80%)`;

      const isActionable = !isCompleted && !isPastItem && !isRegenPod; // Regen Pod is not actionable via these buttons

      // Use a type assertion to treat item as ScheduledItem, resolving breakDuration errors (1-5)
      const scheduledItem = item as ScheduledItem;

      return (
        <div 
          key={item.id} 
          id={`scheduled-item-${item.id}`}
          className={cn(
            "relative flex items-start py-2 px-4 transition-all duration-300 group",
            isActive && "z-10",
            isCompleted && "opacity-50",
            isPastItem && "opacity-40"
          )}
          style={getBubbleHeightStyle(item.duration)}
          onMouseEnter={() => setHoveredItemId(item.id)}
          onMouseLeave={() => setHoveredItemId(null)}
        >
          {/* Time Column */}
          <div className="w-16 text-right text-xs text-muted-foreground pr-2 pt-1">
            {formatTime(item.startTime)}
            {/* FIX 1, 2, 3: Use scheduledItem.breakDuration */}
            {/* @ts-ignore: breakDuration is missing from ScheduledItem type definition */}
            {scheduledItem.breakDuration && scheduledItem.breakDuration > 0 && ( 
              <div className="text-[10px] text-gray-400 mt-0.5">
                {/* @ts-ignore: breakDuration is missing from ScheduledItem type definition */}
                +{scheduledItem.breakDuration} min break 
              </div>
            )}
          </div>

          {/* Timeline Separator */}
          <div className="flex flex-col items-center h-full">
            <div className="w-px bg-border h-full"></div>
            <div 
              className={cn(
                "w-3 h-3 rounded-full border-2",
                isActive ? "bg-primary border-primary shadow-lg shadow-primary/50" : "bg-background border-border",
                isCompleted && "bg-green-500 border-green-500"
              )}
              style={{ borderColor: isActive ? colorClass : borderColorClass, backgroundColor: isActive ? colorClass : 'white' }}
            ></div>
            <div className="w-px bg-border h-full"></div>
          </div>

          {/* Content Bubble */}
          <div 
            className={cn(
              "flex-grow ml-4 p-3 rounded-lg shadow-sm border transition-all duration-300",
              isActive ? "shadow-xl ring-2 ring-offset-2 ring-offset-background" : "hover:shadow-md",
              isCompleted && "border-green-500 bg-green-50",
              isRegenPod && "bg-logo-yellow/10 border-logo-yellow/50 shadow-lg shadow-logo-yellow/20" // NEW: Regen Pod Style
            )}
            style={{ 
              backgroundColor: isCompleted || isRegenPod ? undefined : bgColorClass, 
              borderColor: isCompleted || isRegenPod ? undefined : borderColorClass,
              // FIX 6: Removed invalid ringColor property
            }}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <span className="text-lg" style={{ color: colorClass }}>{item.emoji}</span>
                <h3 className={cn(
                  "font-semibold text-sm",
                  isCompleted && "line-through text-gray-500",
                  isRegenPod && "text-logo-yellow-dark" // NEW: Regen Pod Text Color
                )}>
                  {item.name}
                </h3>
                {isCritical && !isCompleted && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Star className="h-3 w-3 text-red-500 fill-red-500" />
                    </TooltipTrigger>
                    <TooltipContent>Critical Task</TooltipContent>
                  </Tooltip>
                )}
                {isLocked && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Lock className="h-3 w-3 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>Locked (Fixed Time)</TooltipContent>
                  </Tooltip>
                )}
                {item.taskEnvironment && getEnvironmentIcon(item.taskEnvironment)}
                {isMealTask && ( // NEW: Meal Badge
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Utensils className="h-3 w-3 text-green-600" />
                    </TooltipTrigger>
                    <TooltipContent>Meal/Energy Gain</TooltipContent>
                  </Tooltip>
                )}
              </div>
              
              {/* Energy Cost/Gain Display */}
              <div className={cn(
                "text-xs font-mono px-2 py-0.5 rounded-full",
                item.energyCost > 0 ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600",
                isRegenPod && "bg-logo-yellow/30 text-logo-yellow-dark" // NEW: Regen Pod Energy Style
              )}>
                {item.energyCost > 0 ? `-${item.energyCost}⚡` : `+${Math.abs(item.energyCost)}⚡`}
              </div>
            </div>

            <p className="text-xs text-gray-600 mt-1">
              {item.description || `${item.duration} minutes`}
            </p>

            {/* Action Buttons (Visible on hover or active) */}
            {dbTask && (hoveredItemId === item.id || isActive) && (
              <div className={cn(
                "mt-2 flex gap-2 transition-opacity duration-200",
                isActionable ? "opacity-100" : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
              )}>
                {isActionable && (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs text-green-600 hover:bg-green-100"
                          onClick={() => onCompleteTask(dbTask, index)}
                          disabled={isProcessingCommand}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Complete
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Mark as Completed</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 px-2 text-xs text-orange-600 hover:bg-orange-100"
                          onClick={() => onRetireTask(dbTask)}
                          disabled={isProcessingCommand}
                        >
                          <Archive className="h-4 w-4 mr-1" /> Sink
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Move to Aether Sink (Retire)</TooltipContent>
                    </Tooltip>
                  </>
                )}
                
                {/* Lock/Unlock Button (Always available if dbTask exists) */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-gray-600 hover:bg-gray-100"
                      onClick={() => handleToggleLock(dbTask)}
                      disabled={isProcessingCommand || isRegenPod} // Cannot lock/unlock Pod
                    >
                      {isLocked ? <Unlock className="h-4 w-4 mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                      {isLocked ? 'Unlock' : 'Lock'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{isLocked ? 'Unlock Time Slot' : 'Lock Time Slot (Fixed)'}</TooltipContent>
                </Tooltip>

                {/* Details Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-100"
                      onClick={() => handleOpenDetails(dbTask)}
                      disabled={isProcessingCommand}
                    >
                      <AlertCircle className="h-4 w-4 mr-1" /> Details
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View/Edit Details</TooltipContent>
                </Tooltip>
                
                {/* Delete Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs text-red-600 hover:bg-red-100"
                      onClick={() => onRemoveTask(item.id, item.name, index)}
                      disabled={isProcessingCommand || isRegenPod} // Cannot delete Pod
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Permanently Delete Task</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
          
          {/* Active Progress Line */}
          {isActive && (
            <div 
              className="absolute left-0 right-0 h-1 bg-primary-dark rounded-full transition-all duration-1000"
              style={{ top: `${progressLineTopPercentage}%`, backgroundColor: colorClass }}
            ></div>
          )}
          
          {/* Break Duration Indicator */}
          {/* FIX 4, 5: Use scheduledItem.breakDuration */}
          {/* @ts-ignore: breakDuration is missing from ScheduledItem type definition */}
          {scheduledItem.breakDuration && scheduledItem.breakDuration > 0 && ( 
            <div 
              className="absolute left-0 right-0 h-1 bg-gray-300 rounded-full transition-all duration-1000"
              style={{ bottom: 0 }}
            ></div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="relative">
      <div ref={containerRef} className="space-y-0.5">
        {finalDisplayItems.map((item, index) => renderItem(item, index))}
      </div>
      
      {/* Global Current Time Marker (Only for today's schedule) */}
      {isSameDay(parseISO(selectedDayString), T_current) && (
        <div 
          className="absolute left-0 right-0 h-0.5 bg-red-500 z-20 transition-all duration-1000 pointer-events-none"
          style={{ top: `${globalProgressLineTopPercentage}%` }}
        >
          <div className="absolute -left-1 -top-2 w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="absolute left-4 -top-3 text-xs font-semibold text-red-500 bg-background px-1 rounded">
            NOW
          </span>
        </div>
      )}

      {/* Detail Dialog */}
      {selectedScheduledTask && (
        <ScheduledTaskDetailDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          task={selectedScheduledTask}
          // FIX 6: Added missing required prop
          selectedDayString={selectedDayString} 
        />
      )}
    </div>
  );
});

SchedulerDisplay.displayName = 'SchedulerDisplay';

export default SchedulerDisplay;