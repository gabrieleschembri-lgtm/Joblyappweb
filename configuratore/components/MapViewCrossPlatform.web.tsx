import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import L from 'leaflet';

import type { MapMarker } from './MapViewCrossPlatform';

type MapViewCrossPlatformProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  style?: React.CSSProperties;
  onMarkerPress?: (marker: MapMarker) => void;
};

const pinSvg =
  'PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iNDIiIHZpZXdCb3g9IjAgMCAzMiA0MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgMEM3LjE2MyAwIDAgNy4xMzQgMCAxNS45MiAwIDI3Ljg2IDE2IDQyIDE2IDQyUzMyIDI3Ljg2IDMyIDE1LjkyQzMyIDcuMTM0IDI0LjgzNyAwIDE2IDBaIiBmaWxsPSIjMjU2M0VCIi8+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iNyIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==';

const pinIcon = L.icon({
  iconUrl: `data:image/svg+xml;base64,${pinSvg}`,
  iconRetinaUrl: `data:image/svg+xml;base64,${pinSvg}`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -32],
  shadowUrl: undefined,
});

const MapViewCrossPlatform: React.FC<MapViewCrossPlatformProps> = ({
  center,
  zoom = 12,
  markers = [],
  style,
  onMarkerPress,
}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('jobly-leaflet-css')) return;
    const styleTag = document.createElement('style');
    styleTag.id = 'jobly-leaflet-css';
    styleTag.textContent = `
      .leaflet-container{position:relative;overflow:hidden;background:#e5e7eb;outline:0;}
      .leaflet-pane,.leaflet-tile,.leaflet-marker-icon,.leaflet-marker-shadow,.leaflet-tile-container,.leaflet-map-pane svg,.leaflet-map-pane canvas{position:absolute;left:0;top:0;}
      .leaflet-tile{max-width:none!important;max-height:none!important;}
      .leaflet-control-container{position:absolute;z-index:1000;pointer-events:none;}
      .leaflet-control{pointer-events:auto;}
      .leaflet-zoom-animated{transform-origin:0 0;}
      .leaflet-pane{z-index:400;}
      .leaflet-tile-pane{z-index:200;}
      .leaflet-overlay-pane{z-index:400;}
      .leaflet-shadow-pane{z-index:500;}
      .leaflet-marker-pane{z-index:600;}
      .leaflet-tooltip-pane{z-index:650;}
      .leaflet-popup-pane{z-index:700;}
    `;
    document.head.appendChild(styleTag);
  }, []);

  const resolvedStyle = useMemo<React.CSSProperties>(
    () => ({
      width: '100%',
      height: '100%',
      borderRadius: 18,
      ...style,
    }),
    [style]
  );

  if (!isClient) {
    return <div style={resolvedStyle} />;
  }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      style={resolvedStyle}
      zoomControl={false}
    >
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {markers.map((marker, index) => (
        <Marker
          key={marker.id ?? `${marker.lat}-${marker.lng}-${index}`}
          position={[marker.lat, marker.lng]}
          icon={pinIcon}
          eventHandlers={{
            click: () => onMarkerPress?.(marker),
          }}
        />
      ))}
    </MapContainer>
  );
};

export default MapViewCrossPlatform;
