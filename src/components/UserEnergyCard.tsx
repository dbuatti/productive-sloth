import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Zap } from 'lucide-react';

const MAX_ENERGY = 100; // Should match the constant in useTasks

const UserEnergyCard: React.FC = () => {
  const { profile } = useSession();

  if (!profile) {
    return null; // Don't render if no profile data
  }

  const energyPercentage = (profile.energy / MAX_ENERGY) * 100;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Your Energy
        </CardTitle>
        <div className="text-2xl font-bold">
          {profile.energy} / {MAX_ENERGY}
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={energyPercentage} className="h-2" /> {/* Removed indicatorColor prop */}
        <p className="text-xs text-muted-foreground mt-1">
          Energy regenerates over time (feature coming soon!).
        </p>
      </CardContent>
    </Card>
  );
};

export default UserEnergyCard;