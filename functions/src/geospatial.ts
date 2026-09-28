import { geohashForLocation } from "geofire-common";

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
