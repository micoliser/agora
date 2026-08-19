import { useState, useEffect } from 'react';

export function useAppealTimer(appealDeadlineSeconds: number | undefined) {
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  let isAppealExpired = true;
  let appealTimeRemaining = '';

  if (appealDeadlineSeconds) {
    if (currentTime >= appealDeadlineSeconds) {
      isAppealExpired = true;
    } else {
      isAppealExpired = false;
      const remaining = appealDeadlineSeconds - currentTime;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      
      if (hours > 0) {
          appealTimeRemaining = `${hours}h ${minutes}m`;
      } else {
          appealTimeRemaining = `${minutes}m ${seconds}s`;
      }
    }
  }

  return { isAppealExpired, appealTimeRemaining };
}
