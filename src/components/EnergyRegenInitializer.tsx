import React from 'react';
import { useEnergyRegenTrigger } from '@/hooks/use-energy-regen-trigger';

/**
 * This component exists solely to call the useEnergyRegenTrigger hook,
 * ensuring it runs within the context of the SessionProvider.
 */
const EnergyRegenInitializer: React.FC = () => {
  useEnergyRegenTrigger();
  return null;
};

export default EnergyRegenInitializer;