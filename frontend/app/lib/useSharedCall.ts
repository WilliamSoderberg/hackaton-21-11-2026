"use client";

import { useEffect, useState } from "react";
import type { CallState, Role } from "./calls";

// Subscribes to the shared call on the Next.js server. Returns null until the
// first state arrives. EventSource reconnects by itself if the stream drops.
export function useSharedCall(role: Role) {
  const [state, setState] = useState<CallState | null>(null);
  const [connected, setConnected] = useState(false);
  // Difference between the server clock and this device's clock, so call
  // durations match across devices.
  const [clockOffset, setClockOffset] = useState(0);

  useEffect(() => {
    const source = new EventSource(`/api/call/events?role=${role}`);
    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      const next = JSON.parse(event.data) as CallState;
      setClockOffset(next.serverNow - Date.now());
      setState(next);
      setConnected(true);
    };
    return () => source.close();
  }, [role]);

  return { state, connected, clockOffset };
}
