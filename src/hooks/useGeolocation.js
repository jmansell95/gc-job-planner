import { useState, useEffect, useRef } from 'react';

// Browser Geolocation hook with graceful degradation.
// watch = true (default) keeps watching; false does a one-shot fix.
// enabled = false pauses watching entirely (saves battery).
// Returns { position: {lat, lng, accuracy, timestamp} | null, error: string | null }.
export function useGeolocation({ watch = true, enabled = true } = {}) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);
  const watchId = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (watchId.current && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported on this device');
      return;
    }
    const onSuccess = (pos) => {
      setPosition({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
      setError(null);
    };
    const onError = (err) => setError(err.message || 'Location unavailable');
    if (watch) {
      watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      });
      return () => {
        if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      };
    }
    navigator.geolocation.getCurrentPosition(onSuccess, onError, {
      enableHighAccuracy: true,
      timeout: 15000,
    });
  }, [watch, enabled]);

  return { position, error };
}