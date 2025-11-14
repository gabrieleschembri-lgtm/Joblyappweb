import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import WebView, { type WebView as WebViewType } from 'react-native-webview';

type Marker = {
  lat: number;
  lng: number;
  label?: string;
};

type LeafletMapProps = {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  markers?: Marker[];
  height?: number;
  style?: StyleProp<ViewStyle>;
};

const PIN_SVG_BASE64 =
  'PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iNDIiIHZpZXdCb3g9IjAgMCAzMiA0MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTYgMEM3LjE2MyAwIDAgNy4xMzQgMCAxNS45MiAwIDI3Ljg2IDE2IDQyIDE2IDQyUzMyIDI3Ljg2IDMyIDE1LjkyQzMyIDcuMTM0IDI0LjgzNyAwIDE2IDBaIiBmaWxsPSIjMjU2M0VCIi8+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iNyIgZmlsbD0iI0ZGRkZGRiIvPjwvc3ZnPg==';

const LeafletMap: React.FC<LeafletMapProps> = ({
  centerLat = 41.9028,
  centerLng = 12.4964,
  zoom = 5,
  markers = [],
  height = 220,
  style,
}) => {
  const webviewRef = useRef<WebViewType | null>(null);

  const html = useMemo(() => {
    const markersJs = markers
      .map(
        (marker) =>
          `L.marker([${marker.lat}, ${marker.lng}], { icon: pinIcon }).addTo(map)` +
          (marker.label ? `.bindPopup(${JSON.stringify(marker.label)})` : '') +
          ';'
      )
      .join('\n');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
          />
          <link
            rel="stylesheet"
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
            integrity="sha256-sA+0uFALeXUao2cCM+U6Z8Z5vJQ5YwF3R0zE2Jk0nU8="
            crossorigin=""
          />
          <style>
            html, body { height: 100%; margin: 0; background-color: #f8fafc; }
            #map { height: 100%; width: 100%; }
            .jobly-map-pin { filter: drop-shadow(0px 3px 6px rgba(15, 23, 42, 0.25)); }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script
            src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-o9N1j7kP6+YMt9Jf4fHVzLemw+cKk7tGJ1Boutt4c0A="
            crossorigin=""
          ></script>
          <script>
            const map = L.map('map', {
              zoomControl: false,
            }).setView([${centerLat}, ${centerLng}], ${zoom});
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              attribution: '&copy; OpenStreetMap contributors',
              maxZoom: 19,
            }).addTo(map);
            const pinIcon = L.icon({
              iconUrl: 'data:image/svg+xml;base64,${PIN_SVG_BASE64}',
              iconSize: [32, 42],
              iconAnchor: [16, 42],
              popupAnchor: [0, -32],
              className: 'jobly-map-pin',
            });
            ${markersJs}
            window.addEventListener('load', () => {
              setTimeout(() => map.invalidateSize(), 0);
            });
            const invalidate = () => setTimeout(() => map.invalidateSize(), 0);
            document.addEventListener('message', (event) => {
              if (event.data === 'invalidate') {
                invalidate();
              }
            });
            window.addEventListener('message', (event) => {
              if (event.data === 'invalidate') {
                invalidate();
              }
            });
          </script>
        </body>
      </html>
    `;
  }, [centerLat, centerLng, markers, zoom]);

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webviewRef}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        scrollEnabled={false}
        onLoadEnd={() => {
          webviewRef.current?.postMessage('invalidate');
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 18,
    width: '100%',
  },
  webview: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});

export default LeafletMap;
