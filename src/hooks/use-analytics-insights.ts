import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin insights over the analytics event log.
 *
 * Admins can read every row (RLS), so the aggregation happens client-side over
 * a bounded window — enough to answer "what is failing, and where does playback
 * fall back?" without a warehouse.
 */

export type InsightsRange = "24h" | "7d" | "30d";

const RANGE_HOURS: Record<InsightsRange, number> = { "24h": 24, "7d": 24 * 7, "30d": 24 * 30 };

export interface InsightRow {
  event: string;
  category: string;
  source: string | null;
  status: string;
  reason: string | null;
  title: string | null;
  artist: string | null;
  query: string | null;
  duration_ms: number | null;
  result_count: number | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface InsightsSummary {
  total: number;
  searches: number;
  searchFailures: number;
  playbackStarts: number;
  playbackFailures: number;
  offlineReady: number;
  offlineFailed: number;
  strategies: { key: string; count: number }[];
  fallbacks: { key: string; from: string; to: string; reason: string; count: number }[];
  errors: InsightRow[];
  rows: InsightRow[];
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function useAnalyticsInsights(range: InsightsRange, enabled: boolean) {
  return useQuery({
    queryKey: ["analytics-insights", range],
    enabled,
    staleTime: 1000 * 60,
    queryFn: async (): Promise<InsightsSummary> => {
      const since = new Date(Date.now() - RANGE_HOURS[range] * 3600_000).toISOString();
      const { data, error } = await supabase
        .from("analytics_events")
        .select(
          "event, category, source, status, reason, title, artist, query, duration_ms, result_count, meta, created_at",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;

      const rows = (data ?? []) as unknown as InsightRow[];
      const strategies = new Map<string, number>();
      const fallbacks = new Map<string, { from: string; to: string; reason: string; count: number }>();

      let searches = 0;
      let searchFailures = 0;
      let playbackStarts = 0;
      let playbackFailures = 0;
      let offlineReady = 0;
      let offlineFailed = 0;

      for (const row of rows) {
        const meta = (row.meta ?? {}) as Record<string, unknown>;
        if (row.event === "search.completed" || row.event === "search.empty") searches += 1;
        if (row.event === "search.failed") searchFailures += 1;
        if (row.category === "search" && typeof meta.strategy === "string") {
          bump(strategies, meta.strategy);
        }
        if (row.event === "playback.started") playbackStarts += 1;
        if (row.category === "playback" && row.status === "error") playbackFailures += 1;
        if (row.event === "offline.item_ready") offlineReady += 1;
        if (row.event === "offline.item_failed") offlineFailed += 1;

        if (row.category === "fallback") {
          const from = typeof meta.from === "string" ? meta.from : "unknown";
          const to = typeof meta.to === "string" ? meta.to : (row.source ?? "unknown");
          const reason = row.reason ?? (row.event === "fallback.matched" ? "matched" : "—");
          const key = `${from}→${to}:${reason}`;
          const entry = fallbacks.get(key) ?? { from, to, reason, count: 0 };
          entry.count += 1;
          fallbacks.set(key, entry);
        }
      }

      return {
        total: rows.length,
        searches,
        searchFailures,
        playbackStarts,
        playbackFailures,
        offlineReady,
        offlineFailed,
        strategies: [...strategies.entries()]
          .map(([key, count]) => ({ key, count }))
          .sort((a, b) => b.count - a.count),
        fallbacks: [...fallbacks.entries()]
          .map(([key, value]) => ({ key, ...value }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20),
        errors: rows.filter((row) => row.status === "error").slice(0, 25),
        rows,
      };
    },
  });
}

const STRATEGY_LABELS: Record<string, string> = {
  cache: "Server cache",
  ytm_innertube: "YouTube Music catalog",
  keyless_web: "Keyless web search",
  data_api: "YouTube Data API",
  none: "No results",
};

export function strategyLabel(key: string): string {
  return STRATEGY_LABELS[key] ?? key;
}
