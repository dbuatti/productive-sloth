"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, CalendarDays, Loader2, Sparkles } from 'lucide-react';
import { useSession } from '@/hooks/use-session';
import { useReflections } from '@/hooks/use-reflections';
import DailyReflectionDialog from '@/components/DailyReflectionDialog';
import DatePicker from '@/components/DatePicker';
import { format, parseISO, isSameDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const RecapPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isReflectionDialogOpen, setIsReflectionDialogOpen] = useState(false);

  const formattedSelectedDate = useMemo(() => selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '', [selectedDate]);
  const { reflections, isLoading: isLoadingReflections } = useReflections(formattedSelectedDate);

  const currentReflection = useMemo(() => {
    if (!selectedDate || reflections.length === 0) return null;
    return reflections.find(r => isSameDay(parseISO(r.reflection_date), selectedDate));
  }, [selectedDate, reflections]);

  const handleOpenReflectionDialog = () => {
    if (selectedDate) {
      setIsReflectionDialogOpen(true);
    }
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-lg font-semibold mb-4">Please log in to view your daily recap.</p>
        <Button onClick={() => navigate('/login')}>Go to Login</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-in-up pb-12">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Daily Recap
        </h1>
        <Button variant="outline" onClick={() => navigate('/scheduler')} className="flex items-center gap-2 h-10 text-base" aria-label="Back to Scheduler">
          <ArrowLeft className="h-5 w-5" />
          Back
        </Button>
      </div>

      <Card className="p-4 rounded-xl shadow-sm">
        <CardHeader className="px-0 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" />
            Select Day
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <DatePicker
            date={selectedDate}
            setDate={setSelectedDate}
            placeholder="Select a date"
          />
          <Button
            onClick={handleOpenReflectionDialog}
            disabled={!selectedDate || isLoadingReflections}
            className="flex items-center gap-2"
          >
            {isLoadingReflections ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {currentReflection ? 'View/Edit Reflection' : 'Add Reflection'}
          </Button>
        </CardContent>
      </Card>

      {currentReflection && (
        <Card className="p-4 rounded-xl shadow-sm">
          <CardHeader className="px-0 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-logo-green" /> Your Reflection
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {currentReflection.prompt}
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48 rounded-md border p-4 bg-secondary/50">
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {currentReflection.notes}
              </p>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {selectedDate && (
        <DailyReflectionDialog
          open={isReflectionDialogOpen}
          onOpenChange={setIsReflectionDialogOpen}
          reflectionDate={formattedSelectedDate}
        />
      )}
    </div>
  );
};

export default RecapPage;