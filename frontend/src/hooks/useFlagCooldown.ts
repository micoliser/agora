import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';

interface CacheEntry {
  value: number;
  expires: number;
}

export function useFlagCooldown(address: string | undefined, communityId: number | undefined) {
  const { fetchApi } = useApi();
  const [lastFlagTime, setLastFlagTime] = useState<number>(0);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchLastFlag = useCallback(async () => {
    const cacheKey = `flag_time_${address}`;
    const promiseKey = `flag_time_${address}_promise`;
    const now = Date.now();
    const win = window as unknown as Record<string, CacheEntry | Promise<{ last_flag_time?: number }> | undefined>;

    const cached = win[cacheKey] as CacheEntry | undefined;
    if (cached && cached.expires > now) {
      setLastFlagTime(cached.value);
      return;
    }

    const existingPromise = win[promiseKey] as Promise<{ last_flag_time?: number }> | undefined;
    if (existingPromise) {
      const res = await existingPromise;
      if (res?.last_flag_time !== undefined) setLastFlagTime(res.last_flag_time);
      return;
    }

    try {
      const promise = fetchApi(`/api/indexer/last-flag-time/?address=${address}`).then(r => r.json());
      win[promiseKey] = promise;

      const res = await promise;
      if (res?.last_flag_time !== undefined) {
        win[cacheKey] = { value: res.last_flag_time, expires: now + 5000 };
        setLastFlagTime(res.last_flag_time);
      }
    } catch (e) {
      console.error("Failed to fetch last flag time", e);
    } finally {
      delete win[promiseKey];
    }
  }, [address, fetchApi]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLastFlag();
  }, [fetchLastFlag]);

  const fetchCommunity = useCallback(async () => {
    if (communityId === undefined) return;
    try {
      const response = await fetchApi(`/api/communities/${communityId}/`);
      const res = await response.json();
      if (res.flag_cooldown_seconds !== undefined) {
         setCooldownSeconds(res.flag_cooldown_seconds || 0);
      }
    } catch (e) {
      console.error("Failed to fetch community", e);
    }
  }, [communityId, fetchApi]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCommunity();
  }, [fetchCommunity]);

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
    if (address) {
      const cacheKey = `flag_time_${address}`;
      const win = window as unknown as Record<string, CacheEntry>;
      win[cacheKey] = { value: now, expires: Date.now() + 5000 };
    }
  };

  return { isCooldownActive, cooldownTimeRemaining, triggerCooldown };
}
