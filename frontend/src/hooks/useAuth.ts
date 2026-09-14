/* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { stringToHex } from 'viem';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let isLoggingIn = false;

export function useAuth() {
  const { address, isConnected, isDisconnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('jwt');
    if (storedToken) setToken(storedToken);
    setIsInitializing(false);

    const handleUnauthorized = () => {
      setToken(null);
      localStorage.removeItem('jwt');
    };
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const login = async () => {
    if (!address || isLoggingIn) return;
    isLoggingIn = true;
    try {
      const nonceRes = await fetch(`${API_URL}/api/auth/nonce/?address=${address}`);
      const nonceData = await nonceRes.json();
      if (!nonceData.nonce) throw new Error("Failed to get nonce");

      const message = `Login to Agora.\nNonce: ${nonceData.nonce}`;
      let signature;
      signature = await signMessageAsync({ message });

      const verifyRes = await fetch(`${API_URL}/api/auth/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, message })
      });
      const verifyData = await verifyRes.json();
      
      if (verifyData.token) {
        localStorage.setItem('jwt', verifyData.token);
        setToken(verifyData.token);
      }
    } catch (e: any) {
      console.error("Login failed:", e);
      toast.error(`Login failed: ${e?.message || 'Unknown error'}`);
    } finally {
      isLoggingIn = false;
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch(`${API_URL}/api/auth/logout/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        console.error("Logout request failed:", e);
      }
    }
    localStorage.removeItem('jwt');
    setToken(null);
  };

  useEffect(() => {
    if (isInitializing) return;
    if (isConnected && address && !token) {
      login();
    } else if (isDisconnected && token) {
      logout();
    }
  }, [isConnected, isDisconnected, address, token, isInitializing]);

  return { token, isAuthenticated: !!token, login, logout };
}
