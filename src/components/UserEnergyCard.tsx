import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, BatteryCharging } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress'; // Use standard Progress

const MAX_ENERGY = 100;
const ENERGY_REGEN_AMOUNT = 5;
const ENERGY_REGEN_INTERVAL_MINUTES = 1;

const UserEnergyCard: React.FC = () => {
  const { profile, rechargeEnergy } = useSession();

  if (!profile) {
    return null;
  }

  const energyPercentage = (profile.energy / MAX_ENERGY) * 100;
  const isEnergyFull = profile.energy >= MAX_ENERGY;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          Your Energy
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 p-4 border rounded-md">
        <div className="text-5xl font-extrabold text-primary mb-2 leading-none">
          {profile.energy} / {MAX_ENERGY}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Progress value={energyPercentage} className="h-2" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{profile.energy} out of {MAX_ENERGY} Energy</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-foreground">
            Regenerates by {ENERGY_REGEN_AMOUNT} every {ENERGY_REGEN_INTERVAL_MINUTES} min.
          </p>
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={() => rechargeEnergy()} 
            disabled={isEnergyFull}
            className="flex items-center gap-1 text-xs font-semibold"
          >
            <BatteryCharging className="h-3 w-3" />
            Recharge
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserEnergyCard;