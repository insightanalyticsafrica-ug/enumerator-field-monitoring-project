import { createServerFn } from "@tanstack/react-start";

export type Submission = {
  submission_id: number | string;
  unique_uuid: string;
  enumerator_id: string;
  district: string;
  submission_time: string;
  interview_duration_mins: number;
  household_interviewed: string;
  gps_captured: 0 | 1;
  gps_lat: number | null;
  gps_lng: number | null;
  is_duplicate: 0 | 1;
  is_duration_outlier: 0 | 1;
  quality_score: number;
  flag_reason: string;
};

export type DashboardData = {
  submissions: Submission[];
  fetchedAt: string;
  error?: string;
};

function parseGps(raw: unknown): { lat: number | null; lng: number | null; present: 0 | 1 } {
  if (raw == null || typeof raw !== "string" || raw.trim() === "") {
    return { lat: null, lng: null, present: 0 };
  }
  const parts = raw.trim().split(/\s+/);
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, present: 1 };
  }
  return { lat: null, lng: null, present: 0 };
}

function transform(raw: any[]): Submission[] {
  const mapped = raw.map((r) => {
    const gps = parseGps(r.gps_captured ?? r._geolocation);
    const duration = Number(r.interview_duration ?? r.interview_duration_mins ?? 0) || 0;
    return {
      submission_id: r._id ?? r.submission_id ?? "",
      unique_uuid: r._uuid ?? "",
      enumerator_id: String(r.enumerator_id ?? "Unknown"),
      district: String(r.district ?? "Unknown"),
      submission_time: r._submission_time ?? new Date().toISOString(),
      interview_duration_mins: duration,
      household_interviewed: String(r.household_interviewed ?? ""),
      gps_captured: gps.present,
      gps_lat: gps.lat,
      gps_lng: gps.lng,
    };
  });

  // Duplicate detection
  const seen = new Set<string>();
  const enriched: Submission[] = mapped.map((m) => {
    const key = `${m.enumerator_id}|${m.household_interviewed}`;
    const dup = seen.has(key) ? 1 : 0;
    if (m.household_interviewed) seen.add(key);
    const outlier =
      m.interview_duration_mins < 15 || m.interview_duration_mins > 90 ? 1 : 0;
    let score = 100;
    if (m.gps_captured === 0) score -= 40;
    if (outlier) score -= 30;
    if (dup) score -= 50;
    score = Math.max(0, score);
    const reasons: string[] = [];
    if (m.gps_captured === 0) reasons.push("Missing GPS");
    if (outlier) reasons.push("Duration Outlier");
    if (dup) reasons.push("Duplicate Entry");
    return {
      ...m,
      is_duplicate: dup as 0 | 1,
      is_duration_outlier: outlier as 0 | 1,
      quality_score: score,
      flag_reason: reasons.length ? reasons.join(", ") : "Clean",
    };
  });

  return enriched;
}

export const getDashboardData = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const token = process.env.KOBO_TOKEN;
    const assetUid = process.env.KOBO_ASSET_UID;

    if (!token || !assetUid) {
      return {
        submissions: [],
        fetchedAt: new Date().toISOString(),
        error: "Missing KOBO_TOKEN or KOBO_ASSET_UID secret.",
      };
    }

    const urls = [
      `https://kf.kobotoolbox.org/api/v2/assets/${assetUid}/data.json`,
      `https://eu.kobotoolbox.org/api/v2/assets/${assetUid}/data.json`,
    ];

    let lastErr = "";
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Token ${token}` },
        });
        if (!res.ok) {
          lastErr = `${res.status} ${res.statusText}`;
          continue;
        }
        const json = (await res.json()) as { results?: any[] };
        const results = Array.isArray(json.results) ? json.results : [];
        return {
          submissions: transform(results),
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }

    return {
      submissions: [],
      fetchedAt: new Date().toISOString(),
      error: `Could not reach KoboToolbox: ${lastErr}`,
    };
  },
);