import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type TrackingState = 'idle' | 'tracking' | 'permission_denied' | 'error';

const MIN_DISTANCE_M = 25; // ignore updates where the driver moved less than ~25m
const MIN_INTERVAL_MS = 8000; // throttle DB writes to at most every 8s
const STALE_AFTER_MS = 4 * 60 * 1000; // stop reporting if no movement for 4 min

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function useDriverLocation() {
  const { profile } = useAuth();
  const [state, setState] = useState<TrackingState>('idle');
  const [lastPing, setLastPing] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastWriteRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const writeLocation = useCallback(async (lat: number, lng: number, heading: number | null, speedKmh: number | null) => {
    if (!profile) return;
    const now = Date.now();
    const last = lastWriteRef.current;

    if (last) {
      const moved = haversineMeters(last.lat, last.lng, lat, lng);
      const elapsed = now - last.ts;
      if (moved < MIN_DISTANCE_M && elapsed < STALE_AFTER_MS) return;
      if (elapsed < MIN_INTERVAL_MS) return;
    }

    lastWriteRef.current = { lat, lng, ts: now };
    setLastPing(new Date());

    try {
      const { data: existing } = await supabase
        .from('rider_locations')
        .select('id')
        .eq('rider_id', profile.id)
        .maybeSingle();

      const payload = {
        rider_id: profile.id,
        lat,
        lng,
        heading: heading ?? null,
        speed_kmh: speedKmh ?? null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from('rider_locations').update(payload).eq('rider_id', profile.id);
      } else {
        await supabase.from('rider_locations').insert(payload);
      }
    } catch {
      // Silent — GPS pings are best-effort
    }
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== 'driver') return;
    if (!('geolocation' in navigator)) {
      setState('error');
      return;
    }

    setState('tracking');

    const resetStale = () => {
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
      staleTimerRef.current = setTimeout(() => {
        // Re-mark as tracking but send a fresh ping so admin sees them as online
        if (lastWriteRef.current) {
          writeLocation(lastWriteRef.current.lat, lastWriteRef.current.lng, null, 0);
        }
        resetStale();
      }, STALE_AFTER_MS);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        resetStale();
        const heading = pos.coords.heading != null && !Number.isNaN(pos.coords.heading) ? pos.coords.heading : null;
        const speedKmh = pos.coords.speed != null && !Number.isNaN(pos.coords.speed) ? pos.coords.speed * 3.6 : null;
        writeLocation(pos.coords.latitude, pos.coords.longitude, heading, speedKmh);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setState('permission_denied');
        else setState('error');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    resetStale();

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (staleTimerRef.current) clearTimeout(staleTimerRef.current);
    };
  }, [profile?.id, profile?.role, writeLocation]);

  return { state, lastPing };
}
