import { useEffect, useState } from "react";
import type { ApiResponse } from "@repo/shared";
import { UNAUTHORIZED } from "./api";

export interface ApiData<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Runs `load` whenever it changes (wrap it in useCallback) and keeps the result. An expired session
 * calls onUnauthorized instead of showing an error. Pass null to load nothing yet.
 */
export function useApiData<T>(load: (() => Promise<ApiResponse<T>>) | null, onUnauthorized: () => void): ApiData<T> {
  const [state, setState] = useState<ApiData<T>>({ data: null, error: null, loading: load !== null });

  useEffect(() => {
    if (!load) return;
    // A slower earlier request must not overwrite the answer to a newer one
    let current = true;
    setState((prev) => ({ ...prev, error: null, loading: true }));
    load()
      .then((body) => {
        if (!current) return;
        if (body.ok) setState({ data: body.data, error: null, loading: false });
        else if (body.error === UNAUTHORIZED) onUnauthorized();
        else setState({ data: null, error: body.error, loading: false });
      })
      .catch(() => current && setState({ data: null, error: "Gagal terhubung ke server", loading: false }));
    return () => {
      current = false;
    };
  }, [load, onUnauthorized]);

  return state;
}
