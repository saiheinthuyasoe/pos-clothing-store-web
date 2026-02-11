import { useQuery } from "@tanstack/react-query";

type Shop = {
  id: string;
  name: string;
};

type ShopsResponse = {
  data?: Shop[];
  success?: boolean;
  error?: string;
};

/**
 * Fetch shops/branches data with 5-minute cache
 */
export function useShops() {
  return useQuery({
    queryKey: ["shops"],
    queryFn: async (): Promise<Shop[]> => {
      const response = await fetch("/api/shops");
      if (!response.ok) {
        throw new Error(`Shops API error: ${response.status}`);
      }
      const json: ShopsResponse = await response.json();
      return json.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}
