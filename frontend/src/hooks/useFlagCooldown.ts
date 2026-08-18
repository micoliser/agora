import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';

export function useFlagCooldown(address: string | undefined, communityId: number | undefined) {
  const { fetchApi } = useApi();
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [cooldownTimeRemaining, setCooldownTimeRemaining] = useState('');
  const [lastFlagTime, setLastFlagTime] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    if (!address) return;

    const fetchLastFlag = async () => {
      // Use a global window cache to prevent spamming the backend from multiple PostCards
      const cacheKey = `flag_time_${address}`;
      const now = Date.now();
      
      if (window[cacheKey as any] && (window[cacheKey as any] as any).expires > now) {
        setLastFlagTime((window[cacheKey as any] as any).value);
        return;
      }
      
      if ((window as any)[`${cacheKey}_promise`]) {
        const res = await (window as any)[`${cacheKey}_promise`];
        if (res?.last_flag_time !== undefined) setLastFlagTime(res.last_flag_time);
        return;
      }

      try {
        const promise = fetchApi(`/api/indexer/last-flag-time/?address=${address}`).then(r => r.json());
        (window as any)[`${cacheKey}_promise`] = promise;
        
        const res = await promise;
        if (res?.last_flag_time !== undefined) {
          (window as any)[cacheKey] = { value: res.last_flag_time, expires: now + 5000 };
          setLastFlagTime(res.last_flag_time);
        }
      } catch (e) {
        console.error("Failed to fetch last flag time", e);
      } finally {
        delete (window as any)[`${cacheKey}_promise`];
      }
    };

    fetchLastFlag();
  }, [address]);

  useEffect(() => {
    if (communityId === undefined) return;
    
    const fetchCommunity = async () => {
      try {
        const response = await fetchApi(`/api/communities/${communityId}/`);
        const res = await response.json();
        if (res.appeal_window_seconds !== undefined) {
           // We actually need flag_cooldown_seconds from the community
           setCooldownSeconds(res.flag_cooldown_seconds || 0);
        }
      } catch (e) {
        console.error("Failed to fetch community", e);
      }
    };
    
    fetchCommunity();
  }, [communityId]);

  useEffect(() => {
    if (!lastFlagTime || !cooldownSeconds) {
      setIsCooldownActive(false);
      setCooldownTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const nowSeconds = Math.floor(Date.now() / 1000);
      const endsAt = lastFlagTime + cooldownSeconds;
      if (nowSeconds < endsAt) {
        setIsCooldownActive(true);
        const remaining = endsAt - nowSeconds;
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        setCooldownTimeRemaining(`${minutes}m ${seconds}s`);
      } else {
        setIsCooldownActive(false);
        setCooldownTimeRemaining('');
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lastFlagTime, cooldownSeconds]);

    const triggerCooldown = () => {
    const now = Math.floor(Date.now() / 1000);
    setLastFlagTime(now);
    if (address) {
      const cacheKey = `flag_time_${address}`;
      (window as any)[cacheKey] = { value: now, expires: Date.now() + 5000 };
    }
  };

  return { isCooldownActive, cooldownTimeRemaining, triggerCooldown };
}
