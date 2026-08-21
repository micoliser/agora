import { useState, useEffect } from 'react';
import { useAccount, useSignMessage } from 'wagmi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let isLoggingIn = false;

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('jwt');
    if (storedToken) setToken(storedToken);
    setIsInitializing(false);
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
      try {
        signature = await signMessageAsync({ message });
      } catch (e: any) {
        if (e.message?.includes('getChainId is not a function')) {
          const provider = (window as any).genlayer?.provider || (window as any).ethereum;
          if (provider) {
            const hexMessage = '0x' + Buffer.from(message, 'utf8').toString('hex');
            signature = await provider.request({
              method: 'personal_sign',
              params: [hexMessage, address],
            });
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }

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
    } catch (e) {
      console.error("Login failed:", e);
    } finally {
      isLoggingIn = false;
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await fetch('http://localhost:8000/api/auth/logout/', {
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
    }
  }, [isConnected, address, token, isInitializing]);

  return { token, isAuthenticated: !!token, login, logout };
}
