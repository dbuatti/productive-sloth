"use client";

import React, { useState } from 'react';
import { useMeals, MealIdea } from '@/hooks/use-meals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Plus, Trash2, CalendarDays, Utensils, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MealIdeasTab: React.FC = () => {
  const { mealIdeas, isLoading, addIdea, updateIdea, deleteIdea, assignMeal } = useMeals();
  const [newMealName, setNewMealName] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignDate, setAssignDate] = useState<Date | undefined>(new Date());
  const [assignType, setAssignType] = useState<'breakfast' | 'lunch' | 'dinner'>('dinner');

  const handleAddIdea = (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault(); // Ensure default form submission is prevented if it was a form
    if (!newMealName.trim()) return;
    addIdea({ name: newMealName, difficulty_rating: 2, has_ingredients: false });
    setNewMealName('');
  };

  const handleAssign = (id: string) => {
    if (!assignDate) return;
    assignMeal({
      meal_idea_id: id,
      assigned_date: format(assignDate, 'yyyy-MM-dd'),
      meal_type: assignType,
    });
    setAssigningId(null);
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2"> {/* Changed from <form> to <div> to fix nesting warning */}
        <Input 
          placeholder="Enter a new meal idea..." 
          value={newMealName}
          onChange={(e) => setNewMealName(e.target.value)}
          className="flex-grow"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddIdea(e);
            }
          }}
        />
        <Button type="button" onClick={handleAddIdea} size="icon"> {/* Changed type to button and added onClick */}
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-3">
        {mealIdeas.map((idea) => (
          <div 
            key={idea.id} 
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg border bg-background/50 gap-4"
          >
            <div className="flex items-center gap-3 flex-grow">
              <Checkbox 
                checked={idea.has_ingredients}
                onCheckedChange={(checked) => updateIdea({ id: idea.id, has_ingredients: !!checked })}
                className="h-5 w-5"
              />
              <div className="flex flex-col">
                <span className={cn("font-bold text-base", idea.has_ingredients && "text-logo-green")}>
                  {idea.name}
                </span>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "h-4 w-4 cursor-pointer transition-colors",
                        star <= idea.difficulty_rating ? "text-logo-yellow fill-logo-yellow" : "text-muted-foreground/30"
                      )}
                      onClick={() => updateIdea({ id: idea.id, difficulty_rating: star })}
                    />
                  ))}
                  <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground ml-2 opacity-50">
                    {idea.difficulty_rating === 1 ? 'Hard' : idea.difficulty_rating === 2 ? 'Medium' : 'Easy'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Popover open={assigningId === idea.id} onOpenChange={(open) => setAssigningId(open ? idea.id : null)}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-grow sm:flex-grow-0 gap-2 font-bold uppercase text-[10px] tracking-widest">
                    <CalendarDays className="h-4 w-4" /> Assign
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 space-y-4 glass-card border-white/10 shadow-2xl">
                  <div className="space-y-2">
                    <h4 className="font-black uppercase tracking-[0.2em] text-[11px] text-primary">Schedule Temporal Meal</h4>
                    <Calendar 
                      mode="single"
                      selected={assignDate}
                      onSelect={setAssignDate}
                      className="rounded-md border"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={assignType} onValueChange={(val: any) => setAssignType(val)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Meal Time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breakfast">Breakfast</SelectItem>
                        <SelectItem value="lunch">Lunch</SelectItem>
                        <SelectItem value="dinner">Dinner</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => handleAssign(idea.id)} className="shrink-0 h-10 w-10 p-0" variant="aether">
                      <Check className="h-5 w-5" />
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => deleteIdea(idea.id)}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {mealIdeas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg border-white/5 bg-secondary/5">
            <Utensils className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-bold uppercase tracking-widest">No meal ideas cataloged</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealIdeasTab;