import { useQuery } from "@tanstack/react-query";

type SettingsResponse = {
  data?: {
    currencyRate?: number;
  };
  currencyRate?: number;
  success?: boolean;
  error?: string;
};

/**
 * Fetch settings data with 10-minute cache
 * Settings change infrequently, so longer cache is appropriate
 */
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async (): Promise<SettingsResponse> => {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error(`Settings API error: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Get currency rate from settings
 * Returns default MMK rate if API fails
 */
export function useCurrencyRate() {
  const { data, isLoading, error } = useSettings();

  const rate =
    (data?.data?.currencyRate ??
      data?.currencyRate ??
      Number(process?.env?.NEXT_PUBLIC_MMK_RATE)) ||
    55;

  return {
    rate,
    isLoading,
    error,
  };
}
