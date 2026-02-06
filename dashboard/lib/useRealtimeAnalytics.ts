import { useState, useEffect, useRef, useCallback } from "react";
import type { AnalyticsTrendPoint } from "@/lib/api";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8181";
const WS_URL = `${WS_BASE}/ws/realtime`;

export type RealtimeTimeframe = "1s" | "30s" | "1m" | "5m";

// Fixed window: Always show last 5 minutes of data for realtime monitoring
const WINDOW_DURATION_MS: Record<RealtimeTimeframe, number> = {
  "1s": 120_000,      // 2 minutes (legacy, not used in UI)
  "30s": 1_800_000,   // 30 minutes (legacy, not used in UI)
  "1m": 3_600_000,    // 1 hour (legacy, not used in UI)
  "5m": 300_000,      // 5 minutes - ACTIVE: Real-time monitoring window
};

const MAX_POINTS: Record<RealtimeTimeframe, number> = {
  "1s": 240,
  "30s": 120,
  "1m": 120,
  "5m": 120,          // Max 120 points in 5-minute window
};

interface SensorReadingPayload {
  sensor_id: string;
  timestamp: string;
  readings: Record<string, number | null>;
}

interface WsMessage {
  type: string;
  data: SensorReadingPayload;
}

export interface RealtimeState {
  points: AnalyticsTrendPoint[];
  isConnected: boolean;
  lastReceived: Date | null;
}

export function useRealtimeAnalytics(
  enabled: boolean,
  timeframe: RealtimeTimeframe,
  sensorId?: number,
): RealtimeState {
  const [points, setPoints] = useState<AnalyticsTrendPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastReceived, setLastReceived] = useState<Date | null>(null);

  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;

  const sensorIdRef = useRef(sensorId);
  sensorIdRef.current = sensorId;

  const prunePoints = useCallback(
    (current: AnalyticsTrendPoint[], tf: RealtimeTimeframe): AnalyticsTrendPoint[] => {
      const windowMs = WINDOW_DURATION_MS[tf];
      const cutoff = Date.now() - windowMs;
      const pruned = current.filter((p) => new Date(p.timestamp).getTime() > cutoff);
      return pruned.slice(-MAX_POINTS[tf]);
    },
    [],
  );

  useEffect(() => {
    setPoints([]);
  }, [timeframe]);

  useEffect(() => {
    setPoints([]);
  }, [sensorId]);

  useEffect(() => {
    if (!enabled) {
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
      setIsConnected(false);
      return;
    }

    function connect() {
      const socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        setIsConnected(true);
      };

      socket.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type !== "sensor_reading") return;

          const data = msg.data;
          const now = new Date(data.timestamp);
          const point: AnalyticsTrendPoint = {
            timestamp: data.timestamp,
            ph_avg: data.readings.ph ?? null,
            ph_min: data.readings.ph ?? null,
            ph_max: data.readings.ph ?? null,
            turbidity_avg: data.readings.turbidity ?? null,
            turbidity_min: data.readings.turbidity ?? null,
            turbidity_max: data.readings.turbidity ?? null,
            temperature_avg: data.readings.temperature ?? null,
            temperature_min: data.readings.temperature ?? null,
            temperature_max: data.readings.temperature ?? null,
          };

          setLastReceived(now);
          setPoints((prev) => {
            const next = [...prev, point];
            return prunePoints(next, timeframeRef.current);
          });
        } catch (e) {
          console.warn("Failed to parse WebSocket message:", e);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        socket.close();
      };

      ws.current = socket;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) {
        ws.current.close();
        ws.current = null;
      }
    };
  }, [enabled, prunePoints]);

  return { points, isConnected, lastReceived };
}
