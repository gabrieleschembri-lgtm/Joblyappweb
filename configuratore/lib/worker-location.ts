export type WorkLocationSource = 'current' | 'manual';

export type WorkerWorkLocation = {
  label: string;
  city: string;
  latitude: number;
  longitude: number;
  source: WorkLocationSource;
};

export type WorkerWorkRadius = 10 | 25 | 50 | 100;

export type WorkerWorkPreferences = {
  location: WorkerWorkLocation;
  radiusKm: WorkerWorkRadius;
};

export const WORK_RADIUS_OPTIONS: WorkerWorkRadius[] = [10, 25, 50, 100];

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  county?: string;
  state?: string;
};

type NominatimResult = {
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: NominatimAddress;
};

const cityFromAddress = (address?: NominatimAddress) =>
  address?.city ??
  address?.town ??
  address?.village ??
  address?.municipality ??
  address?.county ??
  address?.state ??
  '';

const mapNominatimResult = (
  result: NominatimResult,
  source: WorkLocationSource
): WorkerWorkLocation | null => {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const city = cityFromAddress(result.address);
  const label = result.display_name?.trim() || city;
  if (!label) return null;
  return { label, city, latitude, longitude, source };
};

export const searchWorkerLocations = async (
  query: string,
  signal?: AbortSignal
): Promise<WorkerWorkLocation[]> => {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=6&countrycodes=it`,
    { headers: { 'Accept-Language': 'it' }, signal }
  );
  if (!response.ok) throw new Error(`Location search failed (${response.status})`);
  const data = (await response.json()) as NominatimResult[];
  return data
    .map((result) => mapNominatimResult(result, 'manual'))
    .filter((result): result is WorkerWorkLocation => result !== null);
};

export const reverseWorkerLocation = async (
  latitude: number,
  longitude: number
): Promise<WorkerWorkLocation> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&addressdetails=1`,
      { headers: { 'Accept-Language': 'it' } }
    );
    if (response.ok) {
      const result = mapNominatimResult((await response.json()) as NominatimResult, 'current');
      if (result) return result;
    }
  } catch {}
  return {
    label: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
    city: '',
    latitude,
    longitude,
    source: 'current',
  };
};

export const normalizeWorkerPreferences = (value: unknown): WorkerWorkPreferences | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const location = candidate.location as Record<string, unknown> | undefined;
  const radiusKm = candidate.radiusKm;
  if (!location || (radiusKm !== 10 && radiusKm !== 25 && radiusKm !== 50 && radiusKm !== 100)) {
    return undefined;
  }
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const label = typeof location.label === 'string' ? location.label.trim() : '';
  const city = typeof location.city === 'string' ? location.city.trim() : '';
  const source = location.source === 'current' ? 'current' : 'manual';
  if (!label || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  return { location: { label, city, latitude, longitude, source }, radiusKm };
};
