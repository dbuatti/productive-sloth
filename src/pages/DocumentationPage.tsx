import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Sparkles, Clock, ListTodo, Settings, Trophy, TrendingUp, Trash2, Command, Palette, Zap, Flame, Coffee, CalendarDays, Globe, RefreshCcw, ChevronsUp, Shuffle, CalendarOff, AlertCircle, Lock, Unlock, PlusCircle, Gamepad, Code, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { XP_PER_LEVEL, MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, LOW_ENERGY_THRESHOLD, DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY, DAILY_CHALLENGE_TASKS_REQUIRED } from '@/lib/constants';

const DocumentationPage: React.FC = () => {
  const { user } = useSession();

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-4xl space-y-6 text-center text-muted-foreground">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2 animate-slide-in-up">
          <BookOpen className="h-7 w-7 text-primary" /> App Documentation
        </h1>
        <p className="text-base">Please log in to view the app documentation.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-8 animate-slide-in-up">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
        <BookOpen className="h-9 w-9 text-primary" /> AetherFlow App Documentation
      </h1>
      <p className="text-base text-muted-foreground">
        Your comprehensive guide to mastering AetherFlow, the gamified productivity and scheduling app.
      </p>

      <Accordion type="multiple" defaultValue={['overview']} className="w-full space-y-4">
        <AccordionItem value="overview">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-logo-yellow" /> App Overview
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-6 space-y-4">
              <p>
                AetherFlow is designed to transform your daily task management into an engaging, gamified experience.
                By combining traditional to-do lists with RPG-inspired progression and a dynamic scheduler,
                AetherFlow helps you stay motivated, organized, and in control of your time.
              </p>
              <p>
                Track your progress, earn XP, level up, and manage your energy as you tackle your daily goals.
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default DocumentationPage;