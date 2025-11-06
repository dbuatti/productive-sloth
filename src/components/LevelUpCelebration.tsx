import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import ConfettiEffect from './ConfettiEffect';
import { Sparkles } from 'lucide-react';

const LevelUpCelebration: React.FC = () => {
  const { showLevelUp, levelUpLevel, resetLevelUp } = useSession();

  useEffect(() => {
    if (showLevelUp) {
      // Optionally play a sound or other effects here
    }
  }, [showLevelUp]);

  return (
    <>
      <Dialog open={showLevelUp} onOpenChange={resetLevelUp}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-4xl font-bold text-primary flex items-center justify-center gap-2">
              <Sparkles className="h-10 w-10 animate-bounce" />
              LEVEL UP!
              <Sparkles className="h-10 w-10 animate-bounce" />
            </DialogTitle>
            <DialogDescription className="text-xl mt-4">
              Congratulations! You've reached Level {levelUpLevel}!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Keep up the great work and complete more tasks to advance further!</p>
          </div>
          <Button onClick={resetLevelUp} className="w-full">Awesome!</Button>
        </DialogContent>
      </Dialog>
      {showLevelUp && <ConfettiEffect show={showLevelUp} onComplete={resetLevelUp} />}
    </>
  );
};

export default LevelUpCelebration;