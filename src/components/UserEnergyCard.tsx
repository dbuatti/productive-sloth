import React from 'react';
import { useSession } from '@/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Zap, BatteryCharging } from 'lucide-react'; // Added BatteryCharging icon
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button'; // Import Button

const MAX_ENERGY = 100; // Should match the constant in useTasks
const ENERGY_REGEN_AMOUNT = 5; // Amount of energy to regenerate per interval (from SessionProvider)
const ENERGY_REGEN_INTERVAL_MINUTES = 1; // Regenerate every 1 minute (from SessionProvider)

const UserEnergyCard: React.FC = () => {
  const { profile, rechargeEnergy } = useSession(); // Get rechargeEnergy from session

  if (!profile) {
    return null; // Don't render if no profile data
  }

  const energyPercentage = (profile.energy / MAX_ENERGY) * 100;
  const isEnergyFull = profile.energy >= MAX_ENERGY;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="h-4 w-4 text-yellow-400" />
          Your Energy
        </CardTitle>
        <div className="text-3xl font-bold text-yellow-400">
          {profile.energy} / {MAX_ENERGY}
        </div>
      </CardHeader>
      <CardContent>
        <Tooltip>
          <TooltipTrigger asChild>
            <Progress value={energyPercentage} className="h-2" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{profile.energy} out of {MAX_ENERGY} Energy</p>
          </TooltipContent>
        </Tooltip>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground">
            Energy regenerates by {ENERGY_REGEN_AMOUNT} every {ENERGY_REGEN_INTERVAL_MINUTES} minute{ENERGY_REGEN_INTERVAL_MINUTES !== 1 ? 's' : ''}.
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => rechargeEnergy()} 
            disabled={isEnergyFull}
            className="flex items-center gap-1 text-xs"
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