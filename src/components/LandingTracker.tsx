"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

// Отмечает просмотр лендинга — чтобы видеть верх воронки. Ничего не рисует.
export function LandingTracker() {
  useEffect(() => {
    track("landing_view", undefined, true);
  }, []);
  return null;
}
