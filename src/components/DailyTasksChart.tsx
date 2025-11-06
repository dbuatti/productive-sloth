import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Task } from '@/types';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';

interface DailyTasksChartProps {
  tasks: Task[];
}

const DailyTasksChart: React.FC<DailyTasksChartProps> = ({ tasks }) => {
  const data = React.useMemo(() => {
    const today = new Date();
    // Store actual Date objects for easier comparison
    const last7DaysData: { date: Date; tasks: number }[] = [];

    for (let i = 6; i >= 0; i--) {
      const day = subDays(today, i);
      last7DaysData.push({ date: day, tasks: 0 });
    }

    tasks.forEach(task => {
      if (task.is_completed) {
        const taskDate = parseISO(task.created_at);
        // Compare taskDate with the Date object stored in the data array
        const dayIndex = last7DaysData.findIndex(d => isSameDay(d.date, taskDate));
        if (dayIndex !== -1) {
          last7DaysData[dayIndex].tasks += 1;
        }
      }
    });

    return last7DaysData;
  }, [tasks]);

  return (
    <CardContent className="h-[150px] p-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            // Now 'value' will be a Date object, so format it directly
            tickFormatter={(value: Date) => format(value, 'EEE')} 
            className="text-xs text-muted-foreground"
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false} 
            tickLine={false} 
            width={20} 
            className="text-xs text-muted-foreground"
          />
          <Tooltip 
            cursor={{ fill: 'hsl(var(--muted))' }} 
            contentStyle={{ 
              backgroundColor: 'hsl(var(--popover))', 
              borderColor: 'hsl(var(--border))', 
              borderRadius: 'var(--radius)' 
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            // Custom tooltip to show full date and task count
            formatter={(value: number, name: string, props) => [`${value} tasks`, format(props.payload.date, 'MMM dd, yyyy')]}
            labelFormatter={(label: Date) => format(label, 'EEEE')}
          />
          <Bar dataKey="tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </CardContent>
  );
};

export default DailyTasksChart;