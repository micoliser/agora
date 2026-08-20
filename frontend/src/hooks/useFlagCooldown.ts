import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';

interface CacheEntry {
  value: number;
  expires: number;
}

export function useFlagCooldown(address: string | undefined, communityId: number | undefined, cooldownSeconds: number | undefined) {
  const { fetchApi } = useApi();
  const [lastFlagTime, setLastFlagTime] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchLastFlag = useCallback(async () => {
    if (communityId === undefined || address === undefined) return;
    
    // Check local storage first
    const cacheKey = `flag_time_${communityId}_${address}`;
    const cachedStr = localStorage.getItem(cacheKey);
    const now = Date.now();
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr) as CacheEntry;
        if (cached && cached.expires > now) {
          setLastFlagTime(cached.value);
          return; // Valid cache exists
        }
      } catch(e) {}
    }

    // Bulk fetch promise deduplication
    const promiseKey = `flag_times_${address}_promise`;
    const win = window as unknown as Record<string, Promise<{ last_flag_times?: Record<string, number> }> | undefined>;

    let promise = win[promiseKey];
    if (!promise) {
      promise = fetchApi(`/api/indexer/last-flag-time/?address=${address}`).then(r => r.json());
      win[promiseKey] = promise;
      
      // Cleanup after a short delay so subsequent loads fetch fresh data
      setTimeout(() => { delete win[promiseKey]; }, 2000);
    }

    try {
      const res = await promise;
      if (res?.last_flag_times) {
        const flagTime = res.last_flag_times[String(communityId)];
        if (flagTime !== undefined) {
          localStorage.setItem(cacheKey, JSON.stringify({ value: flagTime, expires: now + 5000 }));
          setLastFlagTime(flagTime);
        } else {
          setLastFlagTime(0);
        }
      }
    } catch (e) {
      console.error("Failed to fetch last flag times", e);
    }
  }, [address, communityId, fetchApi]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLastFlag();
  }, [fetchLastFlag]);

  // Listen for global custom events for instant cross-component syncing
  useEffect(() => {
    const handleFlagTimeUpdated = (e: CustomEvent) => {
      if (e.detail.communityId === communityId) {
        setLastFlagTime(e.detail.lastFlagTime);
      }
    };
    window.addEventListener('flagTimeUpdated', handleFlagTimeUpdated as EventListener);
    return () => window.removeEventListener('flagTimeUpdated', handleFlagTimeUpdated as EventListener);
  }, [communityId]);

  let isCooldownActive = false;
  let cooldownTimeRemaining = '';

  if (lastFlagTime && cooldownSeconds) {
    const endsAt = lastFlagTime + cooldownSeconds;
    if (currentTime < endsAt) {
      isCooldownActive = true;
      const remaining = endsAt - currentTime;
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      cooldownTimeRemaining = `${minutes}m ${seconds}s`;
    }
  }

  const triggerCooldown = () => {
    const now = Math.floor(Date.now() / 1000);
    setLastFlagTime(now);
    if (address && communityId !== undefined) {
      const cacheKey = `flag_time_${communityId}_${address}`;
      localStorage.setItem(cacheKey, JSON.stringify({ value: now, expires: Date.now() + 10000 }));
      window.dispatchEvent(new CustomEvent('flagTimeUpdated', { detail: { communityId, lastFlagTime: now } }));
    }
  };

  return { isCooldownActive, cooldownTimeRemaining, triggerCooldown };
}
