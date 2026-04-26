"use client";

import { useEffect } from "react";

type SyncSenseiModeOnMountProps = {
  senseiMode: boolean;
};

export default function SyncSenseiModeOnMount({
  senseiMode,
}: SyncSenseiModeOnMountProps) {
  useEffect(() => {
    void fetch("/api/profile/sync-sensei-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sensei_mode: senseiMode }),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget sync; no UI impact on failure.
    });
  }, [senseiMode]);

  return null;
}
