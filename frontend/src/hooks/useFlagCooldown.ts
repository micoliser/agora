/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useCallback } from 'react';
import { useApi } from '@/hooks/useApi';
import { useGenLayerRead } from './useGenLayerRead';

const FORUM_ADDRESS = process.env.NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS;

interface CacheEntry {
  value: number;
  expires: number;
}

export function useFlagCooldown(address: string | undefined, communityId: number | undefined, cooldownSeconds: number | undefined) {
  const { fetchApi } = useApi();
  const { readContract } = useGenLayerRead();
  const [lastFlagTime, setLastFlagTime] = useState<number>(0);
  const [memberJoinTime, setMemberJoinTime] = useState<number | null>(null);
  const [minFlagAge, setMinFlagAge] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchSybilData = useCallback(async () => {
    if (!address || communityId === undefined || !FORUM_ADDRESS) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const joinKey = `sybil_join_${communityId}_${address}`;
    const commKey = `sybil_comm_${communityId}`;
    
    try {
      let joinPromise = win[joinKey];
      if (!joinPromise) {
        joinPromise = readContract(FORUM_ADDRESS, 'get_member_join_time', [communityId, address]);
        win[joinKey] = joinPromise;
        setTimeout(() => { delete win[joinKey]; }, 30000); // cache for 30s
      }
      const joinTime = await joinPromise;
      setMemberJoinTime(Number(joinTime));
      
      let commPromise = win[commKey];
      if (!commPromise) {
        commPromise = readContract(FORUM_ADDRESS, 'get_community', [communityId]);
        win[commKey] = commPromise;
        setTimeout(() => { delete win[commKey]; }, 30000); // cache for 30s
      }
      const commData = await commPromise;
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMinFlagAge(Number((commData as any).min_flag_age_seconds || 86400));
    } catch (e) {
      console.error("Failed to fetch sybil data", e);
    }
  }, [address, communityId, readContract]);

  useEffect(() => {
    fetchSybilData();
  }, [fetchSybilData]);

  const fetchLastFlag = useCallback(async () => {
    if (communityId === undefined || address === undefined) return;
    
    const cacheKey = `flag_time_${communityId}_${address}`;
    const cachedStr = localStorage.getItem(cacheKey);
    const now = Date.now();
    if (cachedStr) {
      try {
        const cached = JSON.parse(cachedStr) as CacheEntry;
        if (cached && cached.expires > now) {
          setLastFlagTime(cached.value);
          return;
        }
      } catch(e) {}
    }

    const promiseKey = `flag_times_${address}_promise`;
    const win = window as unknown as Record<string, Promise<{ last_flag_times?: Record<string, number> }> | undefined>;

    let promise = win[promiseKey];
    if (!promise) {
      promise = fetchApi(`/api/indexer/last-flag-time/?address=${address}`).then(r => r.json());
      win[promiseKey] = promise;
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
  
  let isSybilGated = false;
  let sybilTimeRemaining = '';

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

  if (address && (memberJoinTime === null || minFlagAge === null)) {
    isSybilGated = true;
    sybilTimeRemaining = 'Checking community requirements...';
  } else if (memberJoinTime === 0 && address) {
    isSybilGated = true;
    sybilTimeRemaining = 'Must post first';
  } else if (memberJoinTime !== null && minFlagAge !== null) {
    const endsAt = memberJoinTime + minFlagAge;
    if (currentTime < endsAt) {
      isSybilGated = true;
      const remaining = endsAt - currentTime;
      const hours = Math.floor(remaining / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      sybilTimeRemaining = `${hours}h ${minutes}m left`;
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

  return { isCooldownActive, cooldownTimeRemaining, isSybilGated, sybilTimeRemaining, triggerCooldown };
}
