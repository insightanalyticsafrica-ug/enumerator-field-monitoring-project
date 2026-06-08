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
  is_cross_enumerator_dup: 0 | 1;
  is_velocity_violation: 0 | 1;
  is_gps_invalid: 0 | 1;
  quality_score: number;
  flag_reason: string;
};

export type DashboardData = {
  submissions: Submission[];
  fetchedAt: string;
  error?: string;
  pages?: number;
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

function normalizeHh(raw: string): string {
  return raw.toUpperCase().replace(/[\s_\-./]+/g, "").trim();
}

function isValidLatLng(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false; // null island
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
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

  // Pre-pass: normalized HH counts (cross-enumerator) and per-enum dup keys
  const hhEnumerators = new Map<string, Set<string>>();
  for (const m of mapped) {
    const hh = normalizeHh(m.household_interviewed);
    if (!hh) continue;
    if (!hhEnumerators.has(hh)) hhEnumerators.set(hh, new Set());
    hhEnumerators.get(hh)!.add(m.enumerator_id);
  }

  // Velocity: sort per enumerator by time, flag gaps < 10 min
  const byEnum = new Map<string, typeof mapped>();
  for (const m of mapped) {
    if (!byEnum.has(m.enumerator_id)) byEnum.set(m.enumerator_id, []);
    byEnum.get(m.enumerator_id)!.push(m);
  }
  const velocityViolations = new Set<string | number>();
  for (const arr of byEnum.values()) {
    arr.sort(
      (a, b) =>
        new Date(a.submission_time).getTime() - new Date(b.submission_time).getTime(),
    );
    for (let i = 1; i < arr.length; i++) {
      const prev = new Date(arr[i - 1].submission_time).getTime();
      const cur = new Date(arr[i].submission_time).getTime();
      if (cur - prev < 10 * 60 * 1000) velocityViolations.add(arr[i].submission_id);
    }
  }

  const seen = new Set<string>();
  const enriched: Submission[] = mapped.map((m) => {
    const hh = normalizeHh(m.household_interviewed);
    const key = `${m.enumerator_id}|${hh}`;
    const dup = hh && seen.has(key) ? 1 : 0;
    if (hh) seen.add(key);

    const crossDup =
      hh && (hhEnumerators.get(hh)?.size ?? 0) > 1 ? 1 : 0;
    const outlier =
      m.interview_duration_mins < 15 || m.interview_duration_mins > 90 ? 1 : 0;
    const velocity = velocityViolations.has(m.submission_id) ? 1 : 0;
    const gpsInvalid =
      m.gps_captured === 1 && !isValidLatLng(m.gps_lat, m.gps_lng) ? 1 : 0;

    let score = 100;
    if (m.gps_captured === 0) score -= 30;
    if (gpsInvalid) score -= 25;
    if (outlier) score -= 25;
    if (dup) score -= 50;
    if (crossDup) score -= 40;
    if (velocity) score -= 20;
    score = Math.max(0, score);

    const reasons: string[] = [];
    if (m.gps_captured === 0) reasons.push("Missing GPS");
    if (gpsInvalid) reasons.push("Invalid GPS");
    if (outlier) reasons.push("Duration Outlier");
    if (dup) reasons.push("Duplicate Entry");
    if (crossDup) reasons.push("Cross-Enumerator Overlap");
    if (velocity) reasons.push("Velocity Violation");

    return {
      ...m,
      is_duplicate: dup as 0 | 1,
      is_duration_outlier: outlier as 0 | 1,
      is_cross_enumerator_dup: crossDup as 0 | 1,
      is_velocity_violation: velocity as 0 | 1,
      is_gps_invalid: gpsInvalid as 0 | 1,
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

    const bases = [
      "https://kf.kobotoolbox.org",
      "https://eu.kobotoolbox.org",
    ];

    let lastErr = "";
    for (const base of bases) {
      try {
        const all: any[] = [];
        let url: string | null =
          `${base}/api/v2/assets/${assetUid}/data.json?limit=1000`;
        let pages = 0;
        while (url && pages < 50) {
          const res: Response = await fetch(url, {
            headers: { Authorization: `Token ${token}` },
          });
          if (!res.ok) {
            lastErr = `${res.status} ${res.statusText}`;
            url = null;
            break;
          }
          const json = (await res.json()) as { results?: any[]; next?: string | null };
          if (Array.isArray(json.results)) all.push(...json.results);
          url = json.next ?? null;
          pages += 1;
        }
        if (pages === 0) continue;
        return {
          submissions: transform(all),
          fetchedAt: new Date().toISOString(),
          pages,
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