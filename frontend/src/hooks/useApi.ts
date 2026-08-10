"use client";

import { useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function useApi() {
  const fetchApi = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const [pathPart, queryPart] = endpoint.split('?', 2);
    let finalPath = pathPart;
    if (!finalPath.endsWith('/')) {
      finalPath += '/';
    }
    const urlPath = queryPart ? `${finalPath}?${queryPart}` : finalPath;
    const url = `${API_URL}${urlPath}`;

    const fetchOptions: RequestInit = {
      ...options,
    };

    return await fetch(url, fetchOptions);
  }, []);

  return { fetchApi };
}
