/** JSON-safe row for client-side filtering/sorting on /search */
export type SearchExpertSerialized = {
  userId: string;
  profileId: string;
  displayName: string;
  initials: string;
  avatarUrl: string | null;
  keywords: string[];
  matchedServiceName: string | null;
  fromPrice: number | null;
  avgRating: number | null;
  reviewCount: number;
  offersVideo: boolean;
  offersAudio: boolean;
  offersMessaging: boolean;
  hasAvailabilitySlots: boolean;
  isFounding: boolean;
  /** Preserves keyword-relevance ordering from server (RPC / initial list) */
  relevanceOrder: number;
};
