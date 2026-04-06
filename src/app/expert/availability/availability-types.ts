export type OverrideRow = {
  id: string;
  expert_user_id?: string;
  date: string;
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
};

/** Weekly grid: one card per weekday with optional multiple slots. */
export type WeeklyDayState = {
  dayOfWeek: number;
  enabled: boolean;
  slots: { clientKey: string; start: string; end: string }[];
};
