'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { normalizeText } from '@/lib/utils';

interface MapEvent {
  lat: number;
  lng: number;
  name: string;
  city: string;
  date: string;
}

interface ConcertMapProps {
  events: MapEvent[];
  className?: string;
  eventsLabel?: string;
}

export function ConcertMap({ events, className, eventsLabel = 'events' }: ConcertMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView([20, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || events.length === 0) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        map.removeLayer(layer);
      }
    });

    const bounds: L.LatLngExpression[] = [];

    // Group events by city (same city = same marker even if venues differ)
    const grouped: Record<string, MapEvent[]> = {};
    events.forEach((event) => {
      const key = normalizeText(event.city) || `${event.lat.toFixed(1)},${event.lng.toFixed(1)}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });

    Object.values(grouped).forEach((group) => {
      // Use average coordinates for the group
      const lat = group.reduce((s, e) => s + e.lat, 0) / group.length;
      const lng = group.reduce((s, e) => s + e.lng, 0) / group.length;
      const latlng: L.LatLngExpression = [lat, lng];
      bounds.push(latlng);

      const popupHtml = group
        .map(
          (e) =>
            `<div style="padding:4px 0;${group.length > 1 ? 'border-bottom:1px solid #333;' : ''}">` +
            `<strong>${e.name}</strong><br/>` +
            `${e.city}<br/>` +
            `<span style="color:#888">${e.date}</span>` +
            `</div>`
        )
        .join('');

      const radius = Math.min(7 + (group.length - 1) * 2, 14);

      L.circleMarker(latlng, {
        radius,
        fillColor: '#D4845A',
        color: '#D4845A',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.6,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:13px;max-height:200px;overflow-y:auto">` +
          `${group.length > 1 ? `<div style="font-size:11px;color:#D4845A;margin-bottom:4px">${group.length} ${eventsLabel}</div>` : ''}` +
          `${popupHtml}</div>`,
          { maxWidth: 260 }
        );
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 8 });
    }
  }, [events, eventsLabel]);

  return (
    <div
      ref={mapRef}
      className={className}
      style={{ minHeight: 280, width: '100%', borderRadius: '0.75rem', overflow: 'hidden' }}
    />
  );
}
