import { useState, useEffect } from 'react';

export function useAppealTimer(appealDeadlineSeconds: number | undefined) {
  const [isAppealExpired, setIsAppealExpired] = useState(false);
  const [appealTimeRemaining, setAppealTimeRemaining] = useState('');

  useEffect(() => {
    if (!appealDeadlineSeconds) {
      setIsAppealExpired(true);
      setAppealTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds >= appealDeadlineSeconds) {
        setIsAppealExpired(true);
        setAppealTimeRemaining('');
      } else {
        setIsAppealExpired(false);
        const remaining = appealDeadlineSeconds - nowSeconds;
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        if (hours > 0) {
            setAppealTimeRemaining(`${hours}h ${minutes}m`);
        } else {
            setAppealTimeRemaining(`${minutes}m ${seconds}s`);
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [appealDeadlineSeconds]);

  return { isAppealExpired, appealTimeRemaining };
}
