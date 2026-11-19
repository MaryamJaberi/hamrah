'use client';
import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { tileLayer } from '@/lib/outings';

export type Pin = { lat: number; lng: number; label: string; highlight?: boolean; onClick?: () => void };

/** Free OpenStreetMap map (Leaflet). Load with next/dynamic and ssr:false. */
export default function LeafletMap({ center, pins, height = 260, circleKm }: { center: { lat: number; lng: number }; pins: Pin[]; height?: number; circleKm?: number }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!alive || !el.current) return;
      if (!map.current) {
        map.current = L.map(el.current, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 13);
        const t = tileLayer();
        L.tileLayer(t.url, { attribution: t.attribution, maxZoom: 19 }).addTo(map.current);
      }
      layer.current?.remove();
      layer.current = L.layerGroup().addTo(map.current);
      if (circleKm) L.circle([center.lat, center.lng], { radius: circleKm * 1000, color: '#6C5CE7', weight: 1, fillOpacity: 0.06 }).addTo(layer.current);
      const pts: [number, number][] = [];
      for (const p of pins) {
        const m = L.circleMarker([p.lat, p.lng], {
          radius: p.highlight ? 10 : 7, color: '#fff', weight: 2, fillColor: p.highlight ? '#00B894' : '#6C5CE7', fillOpacity: 1,
        }).bindTooltip(p.label, { direction: 'top' }).addTo(layer.current);
        if (p.onClick) m.on('click', p.onClick);
        pts.push([p.lat, p.lng]);
      }
      if (pts.length > 1) map.current.fitBounds(pts, { padding: [24, 24], maxZoom: 16 });
      else map.current.setView([center.lat, center.lng], pts.length ? 15 : 13);
    })();
    return () => { alive = false; };
  }, [center.lat, center.lng, pins, circleKm]);

  useEffect(() => () => { map.current?.remove(); map.current = null; }, []);

  return <div ref={el} style={{ height }} className="rounded-2xl overflow-hidden z-0 border border-line" role="region" aria-label="نقشه" />;
}
