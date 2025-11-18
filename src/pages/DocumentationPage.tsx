import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { BookOpen, Sparkles, Clock, ListTodo, Settings, Trophy, TrendingUp, Trash2, Command, Palette, Zap, Flame, Coffee, CalendarDays, Globe, RefreshCcw, ChevronsUp, Shuffle, CalendarOff, AlertCircle, Lock, Unlock, PlusCircle, Gamepad, Code, Star } from 'lucide-react'; // Removed Brain icon
import { EMOJI_MAP, EMOJI_HUE_MAP, calculateEnergyCost } from '@/lib/scheduler-utils';
import { cn } from '@/lib/utils';
import { useSession } from '@/hooks/use-session';
import { XP_PER_LEVEL, MAX_ENERGY, RECHARGE_BUTTON_AMOUNT, LOW_ENERGY_THRESHOLD, DAILY_CHALLENGE_XP, DAILY_CHALLENGE_ENERGY, DAILY_CHALLENGE_TASKS_REQUIRED } from '@/lib/constants';

const DocumentationPage: React.FC = () => {
  const { user } = useSession();

  const emojiKeywords = Object.keys(EMOJI_MAP).sort();

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-4xl space-y-6 text-center text-muted-foreground">
        <h1 className="text-2xl font-bold text-foreground flex items-center justify-center gap-2 animate-slide-in-up"> {/* Changed text-3xl to text-2xl */}
          <BookOpen className="h-7 w-7 text-primary" /> App Documentation
        </h1>
        <p className="text-base">Please log in to view the app documentation.</p> {/* Changed text-lg to text-base */}
      </div>
    );
  }

  const exampleDefaultEnergyCost = calculateEnergyCost(30, false);

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-8 animate-slide-in-up">
      <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"> {/* Changed text-4xl to text-3xl */}
        <BookOpen className="h-9 w-9 text-primary" /> AetherFlow App Documentation
      </h1>
      <p className="text-base text-muted-foreground"> {/* Changed text-lg to text-base */}
        Your comprehensive guide to mastering AetherFlow, the gamified productivity and scheduling app.
      </p>

      <Accordion type="multiple" defaultValue={['overview']} className="w-full space-y-4">
        {/* App Overview */}
        <AccordionItem value="overview">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
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
                The Vibe Scheduler intelligently organizes your tasks, while the Aether Sink provides a space for retired items,
                ensuring nothing truly gets lost.
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Core Concepts */}
        <AccordionItem value="core-concepts">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
            <Palette className="h-6 w-6 text-primary" /> Core Concepts
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Gamepad className="h-5 w-5 text-logo-yellow" /> Gamification
              </h3>
              <div className="space-y-2 text-muted-foreground"> {/* Changed p to div */}
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <span className="font-semibold text-foreground">XP (Experience Points):</span> Earned by completing tasks. Higher priority tasks yield more XP.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Levels:</span> Progress through levels by accumulating XP. Each level requires {XP_PER_LEVEL} XP.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Energy:</span> Consumed when completing tasks. Tasks have an energy cost. Energy regenerates over time (5 energy every minute) up to a maximum of {MAX_ENERGY}. You can also manually recharge {RECHARGE_BUTTON_AMOUNT} energy.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Daily Streak:</span> Maintained by completing at least one task each day. Resets if no tasks are completed.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Daily Challenge:</span> Complete {DAILY_CHALLENGE_TASKS_REQUIRED} tasks per day to earn a bonus of +{DAILY_CHALLENGE_XP} XP and +{DAILY_CHALLENGE_ENERGY} Energy.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Notifications:</span> Customizable alerts for low energy (below {LOW_ENERGY_THRESHOLD}%) and daily challenge status.
                  </li>
                </ul>
              </div> {/* Closed div */}

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <ListTodo className="h-5 w-5 text-primary" /> Task Management
              </h3>
              <div className="space-y-2 text-muted-foreground"> {/* Changed p to div */}
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <span className="font-semibold text-foreground">Priorities (High, Medium, Low):</span> Categorize tasks by importance. Higher priority tasks give more XP and cost more energy.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Due Dates:</span> Assign deadlines to your tasks for better organization.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Critical Tasks:</span> Mark tasks as critical (append ` !` to the title in quick add, or use the switch in detailed forms). Critical tasks are highlighted and give bonus XP if completed on their due date.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Descriptions:</span> Add detailed notes to your tasks using the detailed task creation dialog or the task detail sheet.
                  </li>
                </ul>
              </div> {/* Closed div */}

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Clock className="h-5 w-5 text-primary" /> Vibe Scheduler
              </h3>
              <div className="space-y-2 text-muted-foreground"> {/* Changed p to div */}
                <ul className="list-disc list-inside space-y-2">
                  <li>
                    <span className="font-semibold text-foreground">Flexible Tasks:</span> Tasks that the scheduler can automatically place into available time slots.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Fixed Tasks:</span> Tasks with specific start and end times that the scheduler will not move (e.g., "Meeting 10am-11am", or tasks explicitly marked `fixed`). "Time Off" blocks are always fixed.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Locked Tasks:</span> Any scheduled task can be locked to prevent the scheduler from moving or removing it. Locked tasks are visually distinct.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Compacting:</span> Rearranges flexible tasks to fill gaps and minimize free time within your workday window.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Randomizing Breaks:</span> Shuffles the placement of unlocked break tasks within your schedule.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Aether Dump:</span> Moves all *flexible, unlocked* tasks from the *current day's schedule* to the Aether Sink.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Aether Dump Mega:</span> Moves all *flexible, unlocked* tasks from *all future and current days' schedules* to the Aether Sink.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Auto-Balance:</span> A comprehensive process (triggered by "Auto Schedule" in Aether Sink) that unifies all flexible tasks from the current schedule and the Aether Sink, sorts them using a default pattern, and then attempts to re-place them into the current day's schedule. Tasks that cannot be placed are returned to the Aether Sink.
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Time Off:</span> Dedicated blocks in your schedule for personal time, always treated as fixed.
                  </li>
                </ul>
              </div> {/* Closed div */}
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Features Breakdown */}
        <AccordionItem value="features">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
            <ListTodo className="h-6 w-6 text-logo-green" /> Features Breakdown
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-6 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Sparkles className="h-5 w-5 text-logo-yellow" /> Dashboard
              </h3>
              <p className="text-muted-foreground">
                Your central hub for daily productivity. Features a quick overview of your daily challenge,
                task creation, filtering/sorting controls, and your prioritized task list.
                Includes a progress bar header for XP, Energy, and Daily Challenge status.
              </p>

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <ListTodo className="h-5 w-5 text-primary" /> My Tasks
              </h3>
              <p className="text-muted-foreground">
                A dedicated page to view and manage all your tasks. Similar to the dashboard's task list,
                but without the gamification overview, focusing purely on task organization.
              </p>

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Clock className="h-5 w-5 text-primary" /> Vibe Scheduler
              </h3>
              <p className="text-muted-foreground">
                The heart of your time management. Visually plan your day with scheduled tasks and breaks.
                Features a calendar strip for navigating days, a "Now Focus" card for your current activity,
                and powerful commands for dynamic scheduling.
              </p>

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <TrendingUp className="h-5 w-5 text-primary" /> Analytics
              </h3>
              <p className="text-muted-foreground">
                Track your progress with visual charts. See your XP gain trend, tasks completed over time,
                current level, total XP, and daily streak.
              </p>

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Trophy className="h-5 w-5 text-logo-yellow" /> Achievements
              </h3>
              <p className="text-muted-foreground">
                (Coming Soon!) This section will celebrate your milestones and accomplishments within the app.
              </p>

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Trash2 className="h-5 w-5 text-muted-foreground" /> Aether Sink
              </h3>
              <p className="text-muted-foreground">
                A holding area for tasks that have been retired from your schedule. You can re-zone them back into your schedule,
                or permanently delete them. Tasks can be locked in the sink to prevent accidental re-zoning or deletion.
              </p>

              <Separator />

              <h3 className="text-lg font-bold flex items-center gap-2"> {/* Changed text-xl to text-lg */}
                <Settings className="h-5 w-5 text-primary" /> Settings
              </h3>
              <p className="text-muted-foreground">
                Manage your profile information, gamification preferences, notification settings,
                default auto-schedule times, and access developer tools. Includes a "Danger Zone" for
                resetting game progress or deleting your account.
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Emoji Guide */}
        <AccordionItem value="emoji-guide">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
            <Palette className="h-6 w-6 text-logo-orange" /> Emoji & Color Guide
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-6 space-y-4">
              <p className="text-muted-foreground">
                AetherFlow automatically assigns an emoji and a color hue to your tasks based on keywords in their names.
                This helps you quickly identify task types in your schedule.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {emojiKeywords.map(keyword => (
                  <div key={keyword} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                    <span className="text-lg">{EMOJI_MAP[keyword]}</span>
                    <span className="font-medium capitalize">{keyword}</span>
                    <div 
                      className="ml-auto h-4 w-4 rounded-full" 
                      style={{ backgroundColor: `hsl(${EMOJI_HUE_MAP[keyword]} 50% 50%)` }} 
                      title={`Hue: ${EMOJI_HUE_MAP[keyword]}`}
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                If no specific keyword is found, the default clipboard emoji (📋) and a blue hue are used.
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Scheduler Commands */}
        <AccordionItem value="scheduler-commands">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
            <Command className="h-6 w-6 text-logo-green" /> Vibe Scheduler Commands
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-6 space-y-4">
              <p className="text-muted-foreground">
                The Vibe Scheduler input field understands natural language and specific commands to help you manage your schedule efficiently.
              </p>
              <div className="space-y-3 text-muted-foreground"> {/* Changed p to div */}
                <ul className="list-disc list-inside space-y-3">
                  <li>
                    <span className="font-semibold text-foreground">Add a duration-based task:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">Task Name 60 [BreakDuration] [!] [sink]</code>
                    <p className="text-sm italic ml-4">e.g., <code className="font-mono">Gym 60</code> (60 min task, calculated energy cost), <code className="font-mono">Read Book 30 10</code> (30 min task, 10 min break, calculated energy cost), <code className="font-mono">Critical Task 45 !</code> (45 min task, critical, calculated energy cost), <code className="font-mono">Old Task 20 sink</code> (20 min task, sent to sink, calculated energy cost)</p>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Add a fixed-time task:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">Task Name HH:MM AM/PM - HH:MM AM/PM [!] [fixed]</code>
                    <p className="text-sm italic ml-4">e.g., <code className="font-mono">Meeting 10am-11am</code> (calculated energy cost), <code className="font-mono">Doctor Appt 2:30pm-3pm fixed !</code> (critical, calculated energy cost)</p>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Add "Time Off":</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">Time Off HH:MM AM/PM - HH:MM AM/PM</code>
                    <p className="text-sm italic ml-4">e.g., <code className="font-mono">Time Off 1pm-2pm</code> (always fixed, 0 energy cost)</p>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Quick Add 15-min Break:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">Click the <Coffee className="inline-block h-4 w-4 align-text-bottom" /> button next to the input field.</code>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Inject a task (detailed dialog):</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">inject "Task Name" [Duration] [BreakDuration] [from HH:MM AM/PM to HH:MM AM/PM] [!] [fixed]</code>
                    <p className="text-sm italic ml-4">e.g., <code className="font-mono">inject "Project X" 30</code>, <code className="font-mono">inject "Client Call" from 3pm to 3:30pm fixed</code>. The dialog will automatically calculate energy cost based on duration and criticality.</p>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Remove a task:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">remove "Task Name"</code> or <code className="font-mono">remove index [number]</code>
                    <p className="text-sm italic ml-4">e.g., <code className="font-mono">remove "Gym"</code>, <code className="font-mono">remove index 1</code> (removes the first task)</p>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Clear all unlocked tasks for today:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">clear</code>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Compact flexible tasks:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">compact</code> (or click <ChevronsUp className="inline-block h-4 w-4 align-text-bottom" />)
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Randomize unlocked breaks:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">Click the <Shuffle className="inline-block h-4 w-4 align-text-bottom" /> button.</code>
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Move all flexible, unlocked tasks from CURRENT day to Aether Sink:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">aether dump</code> (or click <RefreshCcw className="inline-block h-4 w-4 align-text-bottom" />)
                  </li>
                  <li>
                    <span className="font-semibold text-foreground">Move ALL flexible, unlocked tasks from ALL days to Aether Sink:</span>
                    <code className="block bg-muted p-2 rounded-md mt-1">aether dump mega</code> (or click <Globe className="inline-block h-4 w-4 align-text-bottom" />)
                  </li>
                </ul>
              </div> {/* Closed div */}
              <p className="text-sm text-muted-foreground mt-4">
                <span className="font-semibold">Flags:</span>
                <ul className="list-disc list-inside ml-4">
                  <li><code className="font-mono">!</code>: Marks a task as critical.</li>
                  <li><code className="font-mono">sink</code>: Sends a duration-based task directly to the Aether Sink instead of scheduling it.</li>
                  <li><code className="font-mono">fixed</code>: Explicitly marks a duration-based task as fixed, preventing the scheduler from moving it. Timed tasks are implicitly fixed.</li>
                  <li>Energy cost is automatically calculated based on duration and criticality.</li>
                </ul>
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Technical Details */}
        <AccordionItem value="technical-details">
          <AccordionTrigger className="text-xl font-semibold flex items-center gap-2"> {/* Changed text-2xl to text-xl */}
            <Code className="h-6 w-6 text-secondary-foreground" /> Technical Details
          </AccordionTrigger>
          <AccordionContent>
            <Card className="p-6 space-y-4 text-muted-foreground">
              <p>
                AetherFlow is built as a modern web application using the following technologies:
              </p>
              <ul className="list-disc list-inside space-y-1">
                <li><span className="font-semibold text-foreground">Frontend:</span> React with TypeScript</li>
                <li><span className="font-semibold text-foreground">Routing:</span> React Router</li>
                <li><span className="font-semibold text-foreground">Styling:</span> Tailwind CSS with shadcn/ui components</li>
                <li><span className="font-semibold text-foreground">Backend & Database:</span> Supabase (PostgreSQL, Authentication, Edge Functions)</li>
                <li><span className="font-semibold text-foreground">State Management:</span> React Query for server state, React Context for session management</li>
              </ul>
              <p>
                The application leverages Supabase Edge Functions for server-side logic, such as fetching weather data,
                and PostgreSQL for robust data storage with Row Level Security (RLS) for user data protection.
              </p>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
};

export default DocumentationPage;