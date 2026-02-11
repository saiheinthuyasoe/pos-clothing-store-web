import { useQuery } from "@tanstack/react-query";

type NewItem = {
  id: string;
  name?: string;
  image?: string;
  groupImage?: string;
  isNew?: boolean;
};

type NewItemsResponse = {
  items: NewItem[];
  error?: string;
};

/**
 * Fetch new items with 5-minute cache
 * @param limit - Optional limit on number of items (default: all)
 */
export function useNewItems(limit?: number) {
  return useQuery({
    queryKey: ["newItems", limit],
    queryFn: async (): Promise<NewItem[]> => {
      const response = await fetch("/api/new-items");
      if (!response.ok) {
        throw new Error(`New items API error: ${response.status}`);
      }
      const json: NewItemsResponse = await response.json();
      const items = json.items || [];

      // Apply limit if specified
      return limit ? items.slice(0, limit) : items;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}
