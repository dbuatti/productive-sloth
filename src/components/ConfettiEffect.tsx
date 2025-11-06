import React, { useEffect, useState } from 'react';
import Confetti from 'react-confetti';
import { useWindowSize } from '@/hooks/use-window-size'; // Assuming this hook exists or will be created

interface ConfettiEffectProps {
  show: boolean;
  onComplete?: () => void;
}

const ConfettiEffect: React.FC<ConfettiEffectProps> = ({ show, onComplete }) => {
  const { width, height } = useWindowSize();
  const [recycle, setRecycle] = useState(true);

  useEffect(() => {
    if (show) {
      setRecycle(true);
      const timer = setTimeout(() => {
        setRecycle(false);
        onComplete?.();
      }, 3000); // Confetti lasts for 3 seconds
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <Confetti
      width={width}
      height={height}
      recycle={recycle}
      numberOfPieces={200}
      gravity={0.1}
      tweenDuration={2000}
      initialVelocityX={{ min: -5, max: 5 }}
      initialVelocityY={{ min: -10, max: -5 }}
      colors={['#FFD700', '#FFA500', '#FF6347', '#ADFF2F', '#87CEEB']} // Fun, vibrant colors
    />
  );
};

export default ConfettiEffect;