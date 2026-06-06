import { useCallback, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

import { supabase } from "@/lib/supabase";

export interface MemorizedVerseRow {
  ref: string;
  memorizedPct: number;
  completions: number;
}

export interface InsightsData {
  loading: boolean;
  activeDays: Set<string>;
  successfulWakeUps: number;
  avgWakeTime: string;
  avgResponse: string;
  versesRecited: number;
  favoriteVerse: string;
  versesMemorized: number;
  successRate: string;
  memorizedVerses: MemorizedVerseRow[];
}

function formatAvgWakeTime(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return "—";
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const display = (h % 12 || 12).toString();
  const mStr = m.toString().padStart(2, "0");
  return `${display}:${mStr} ${ampm}`;
}

function formatAvgResponse(seconds: number | null | undefined): string {
  if (seconds == null || isNaN(seconds)) return "—";
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

export interface InsightsDataWithRefetch extends InsightsData {
  refetch: () => void;
}

export function useInsightsData(): InsightsDataWithRefetch {
  const [loading, setLoading] = useState(true);
  const [activeDays, setActiveDays] = useState<Set<string>>(new Set());
  const [successfulWakeUps, setSuccessfulWakeUps] = useState(0);
  const [avgWakeTime, setAvgWakeTime] = useState("—");
  const [avgResponse, setAvgResponse] = useState("—");
  const [versesRecited, setVersesRecited] = useState(0);
  const [favoriteVerse, setFavoriteVerse] = useState("—");
  const [versesMemorized, setVersesMemorized] = useState(0);
  const [successRate, setSuccessRate] = useState("—");
  const [memorizedVerses, setMemorizedVerses] = useState<MemorizedVerseRow[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

      // Fetch all three datasets in parallel:
      // 1. wake_history for heatmap + avg wake time + avg response
      // 2. All verse_stats rows (no limit) for aggregate totals
      // 3. Top 20 verse_stats rows sorted by last_used_at for display list
      const [wakeRes, allStatsRes, displayStatsRes] = await Promise.all([
        supabase
          .from("wake_history")
          .select("dismissed_at, recital_duration_seconds, recital_success")
          .eq("user_id", userId)
          .gte("dismissed_at", twelveMonthsAgo.toISOString()),
        supabase
          .from("verse_stats")
          .select("verse_ref, times_recited, times_succeeded, is_memorized")
          .eq("user_id", userId),
        supabase
          .from("verse_stats")
          .select("verse_ref, times_recited, times_succeeded, is_memorized, last_used_at")
          .eq("user_id", userId)
          .order("last_used_at", { ascending: false })
          .limit(20),
      ]);

      const wakeRows = wakeRes.data ?? [];
      const allStatsRows = allStatsRes.data ?? [];
      const displayStatsRows = displayStatsRes.data ?? [];

      // ── Wake history computations ────────────────────────────────────────────

      // activeDays: days with a successful recital (for heatmap)
      const days = new Set<string>();

      // avgWakeTime: average over ALL dismissed_at rows (not just successful)
      let totalWakeHours = 0;
      let wakeHourCount = 0;

      // avgResponse: average over rows that have recital_duration_seconds
      let totalRecitalSeconds = 0;
      let recitalCount = 0;

      for (const row of wakeRows) {
        if (row.recital_success === true && row.dismissed_at) {
          const dateStr = row.dismissed_at.split("T")[0];
          days.add(dateStr);
        }
        if (row.dismissed_at) {
          const d = new Date(row.dismissed_at);
          const hourFrac = d.getUTCHours() + d.getUTCMinutes() / 60;
          totalWakeHours += hourFrac;
          wakeHourCount++;
        }
        if (row.recital_duration_seconds != null) {
          totalRecitalSeconds += row.recital_duration_seconds;
          recitalCount++;
        }
      }

      setActiveDays(days);
      setSuccessfulWakeUps(days.size);
      setAvgWakeTime(
        wakeHourCount > 0 ? formatAvgWakeTime(totalWakeHours / wakeHourCount) : "—"
      );
      setAvgResponse(
        recitalCount > 0 ? formatAvgResponse(totalRecitalSeconds / recitalCount) : "—"
      );

      // ── verse_stats aggregate computations (full dataset) ───────────────────

      let totalRecited = 0;
      let totalSucceeded = 0;
      let memorizedCount = 0;
      let topVerseRef = "—";
      let topVerseCount = 0;

      for (const row of allStatsRows) {
        const recited = row.times_recited ?? 0;
        const succeeded = row.times_succeeded ?? 0;

        totalRecited += recited;
        totalSucceeded += succeeded;
        if (row.is_memorized) memorizedCount++;

        // Favorite verse = highest times_recited in verse_stats
        if (recited > topVerseCount) {
          topVerseCount = recited;
          topVerseRef = row.verse_ref;
        }
      }

      setVersesRecited(totalRecited);
      setVersesMemorized(memorizedCount);
      setFavoriteVerse(topVerseRef);
      setSuccessRate(
        totalRecited > 0
          ? `${Math.round((totalSucceeded / totalRecited) * 100)}%`
          : "—"
      );

      // ── Display list: top 20 verses by last_used_at ──────────────────────────
      const memorizedList: MemorizedVerseRow[] = displayStatsRows.map((row) => ({
        ref: row.verse_ref,
        memorizedPct: Math.round(
          ((row.times_succeeded ?? 0) / Math.max(row.times_recited ?? 1, 1)) * 100
        ),
        completions: row.times_succeeded ?? 0,
      }));
      setMemorizedVerses(memorizedList);
    } catch (err) {
      console.warn("[BibleWake] useInsightsData fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        fetchData();
      }
    });
    return () => sub.remove();
  }, [fetchData]);

  return {
    loading,
    activeDays,
    successfulWakeUps,
    avgWakeTime,
    avgResponse,
    versesRecited,
    favoriteVerse,
    versesMemorized,
    successRate,
    memorizedVerses,
    refetch: fetchData,
  };
}
