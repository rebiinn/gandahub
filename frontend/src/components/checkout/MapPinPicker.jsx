import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [14.5995, 120.9842]; // Manila
const DEFAULT_ZOOM = 6;

const MapPinPicker = ({ center, pin, onPinChange, height = 280 }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current).setView(center || DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const icon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
      }
      onPinChange?.(lat, lng);
    });

    mapInstance.current = map;
    setReady(true);
    return () => {
      map.remove();
      mapInstance.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    if (center && center.length === 2) {
      mapInstance.current.setView(center, mapInstance.current.getZoom());
    }
  }, [ready, center]);

  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    if (pin && pin.lat != null && pin.lng != null) {
      if (markerRef.current) {
        markerRef.current.setLatLng([pin.lat, pin.lng]);
      } else {
        const icon = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        });
        markerRef.current = L.marker([pin.lat, pin.lng], { icon }).addTo(mapInstance.current);
      }
      mapInstance.current.setView([pin.lat, pin.lng], Math.max(14, mapInstance.current.getZoom()));
    } else if (markerRef.current) {
      mapInstance.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [ready, pin?.lat, pin?.lng]);

  return (
    <div className="rounded-lg overflow-hidden border border-gray-300 relative z-0 isolate">
      <div ref={mapRef} style={{ height: `${height}px`, width: '100%' }} className="relative z-0" />
      <p className="text-xs text-gray-500 p-2 bg-gray-50 border-t">Click on the map to set your delivery location.</p>
    </div>
  );
};

export default MapPinPicker;
