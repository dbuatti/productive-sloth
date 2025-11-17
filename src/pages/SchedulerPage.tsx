import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, Calendar } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { Loader2 } from 'lucide-react';

const SchedulerPage: React.FC = () => {
  const { isLoading: isSessionLoading, user } = useSession();

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 animate-slide-in-up">
        <Clock className="h-7 w-7" /> Scheduler
      </h1>
      
      <Card className="animate-pop-in animate-hover-lift">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8 text-center text-muted-foreground">
          <div className="flex flex-col items-center space-y-4">
            <Clock className="h-12 w-12" />
            <p className="text-lg font-semibold">Schedule Coming Soon!</p>
            <p>Manage your fixed appointments and auto-schedule flexible tasks here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchedulerPage;