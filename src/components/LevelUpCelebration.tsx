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
        <DialogContent className="sm:max-w-md text-center animate-pop-in"> {/* Added animate-pop-in */}
          <DialogHeader>
            <DialogTitle className="text-4xl font-extrabold text-primary flex items-center justify-center gap-2 animate-pulse-glow"> {/* Changed text-5xl to text-4xl */}
              <Sparkles className="h-10 w-10 animate-bounce text-logo-yellow" /> {/* Changed h-12 w-12 to h-10 w-10 */}
              LEVEL UP!
              <Sparkles className="h-10 w-10 animate-bounce text-logo-yellow" /> {/* Changed h-12 w-12 to h-10 w-10 */}
            </DialogTitle>
            <DialogDescription className="text-lg mt-4 text-foreground"> {/* Changed text-xl to text-lg */}
              Congratulations! You've reached Level {levelUpLevel}!
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Keep up the great work and complete more tasks to advance further!</p>
          </div>
          <Button onClick={resetLevelUp} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-200">Awesome!</Button> {/* Ensured primary button styling */}
        </DialogContent>
      </Dialog>
      {showLevelUp && <ConfettiEffect show={showLevelUp} onComplete={resetLevelUp} />}
    </>
  );
};

export default LevelUpCelebration;