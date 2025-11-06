import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, BatteryCharging } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { CustomProgress } from './CustomProgress'; // Import CustomProgress

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
    <Card className="w-full transition-all duration-200 ease-in-out hover:scale-[1.005]"> {/* Removed hover:shadow-md */}
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-bold flex items-center gap-2 text-[hsl(var(--logo-yellow))]"> {/* Using logo-yellow */}
          <Zap className="h-5 w-5" />
          Your Energy
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-5xl font-extrabold text-[hsl(var(--logo-yellow))] mb-2 leading-none"> {/* Using logo-yellow */}
          {profile.energy} / {MAX_ENERGY}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <CustomProgress 
              value={energyPercentage} 
              className="h-3 bg-[hsl(var(--logo-yellow))]/20" 
              indicatorClassName="bg-[hsl(var(--logo-yellow))]" 
            />
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