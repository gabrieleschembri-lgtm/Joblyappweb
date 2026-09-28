import {
  distanceBetween,
  geohashForLocation,
  geohashQueryBounds,
} from "geofire-common";

export const WORKER_RADIUS_BUCKETS = [10, 25, 50, 100] as const;
export type WorkerRadiusKm = (typeof WORKER_RADIUS_BUCKETS)[number];

export const isValidGeoCoordinates = (
  latitude: unknown,
  longitude: unknown
): latitude is number =>
  typeof latitude === "number" &&
  typeof longitude === "number" &&
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

export const calculateLocationGeohash = (
  latitude: number,
  longitude: number
) => {
  if (!isValidGeoCoordinates(latitude, longitude)) {
    throw new Error("Invalid geographic coordinates");
  }

  return geohashForLocation([latitude, longitude]);
};

export const getGeohashQueryBounds = (
  latitude: number,
  longitude: number,
  radiusKm: WorkerRadiusKm
) => {
  if (!isValidGeoCoordinates(latitude, longitude)) {
    throw new Error("Invalid geographic coordinates");
  }

  return geohashQueryBounds([latitude, longitude], radiusKm * 1000);
};

export const getDistanceKm = (
  fromLatitude: number,
  fromLongitude: number,
  toLatitude: number,
  toLongitude: number
) => {
  if (
    !isValidGeoCoordinates(fromLatitude, fromLongitude) ||
    !isValidGeoCoordinates(toLatitude, toLongitude)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return distanceBetween(
    [fromLatitude, fromLongitude],
    [toLatitude, toLongitude]
  );
};
