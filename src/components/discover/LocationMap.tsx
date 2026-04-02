'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslations } from 'next-intl';

interface LocationMapProps {
  onSelect: (location: { city: string; country: string; lat: number; lng: number }) => void;
}

export function LocationMap({ onSelect }: LocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const t = useTranslations('discover');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep callback ref fresh without re-creating the map
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: true,
      attributionControl: true,
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    // On click, reverse geocode to get city/country
    map.on('click', async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;

      // Visual feedback: place a marker immediately
      if (markerRef.current) {
        markerRef.current.remove();
      }
      markerRef.current = L.circleMarker([lat, lng], {
        radius: 8,
        color: '#8b5cf6',
        fillColor: '#8b5cf6',
        fillOpacity: 0.6,
        weight: 2,
      }).addTo(map);

      setLoading(true);
      setError('');

      try {
        const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }

        onSelectRef.current({
          city: data.city || '',
          country: data.countryCode || data.country || '',
          lat,
          lng,
        });
      } catch (err) {
        console.error('Reverse geocode failed:', err);
        setError('Geocode failed');
      } finally {
        setLoading(false);
      }
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        style={{ height: 260, width: '100%' }}
        className="cursor-crosshair"
      />
      {/* Instruction overlay */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-center">
        <span className="rounded-full bg-black/70 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
          {loading
            ? t('mapLoading')
            : error
              ? error
              : t('mapInstruction')}
        </span>
      </div>
    </div>
  );
}
