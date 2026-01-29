import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';

import MapPin from './map-pin';

export type MapMarker = {
  id?: string;
  lat: number;
  lng: number;
  title?: string;
  description?: string;
};

type MapViewCrossPlatformProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  style?: StyleProp<ViewStyle>;
  onMarkerPress?: (marker: MapMarker) => void;
};

const zoomToDelta = (zoom: number) => {
  const safe = Math.max(1, Math.min(zoom, 20));
  return 360 / Math.pow(2, safe);
};

const MapViewCrossPlatform: React.FC<MapViewCrossPlatformProps> = ({
  center,
  zoom = 12,
  markers = [],
  style,
  onMarkerPress,
}) => {
  const delta = zoomToDelta(zoom);
  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      style={style}
      initialRegion={{
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      }}
      showsUserLocation
      showsMyLocationButton
      loadingEnabled
    >
      <UrlTile
        urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        tileSize={256}
      />
      {markers.map((marker, index) => (
        <Marker
          key={marker.id ?? `${marker.lat}-${marker.lng}-${index}`}
          coordinate={{ latitude: marker.lat, longitude: marker.lng }}
          title={marker.title}
          description={marker.description}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 1 }}
          onPress={() => onMarkerPress?.(marker)}
        >
          <MapPin />
        </Marker>
      ))}
    </MapView>
  );
};

export default MapViewCrossPlatform;
