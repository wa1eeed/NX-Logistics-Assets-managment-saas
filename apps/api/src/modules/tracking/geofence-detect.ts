// Pure geometry for geofence containment — no I/O, unit-testable.

type Geo = Record<string, unknown>;

const toRad = (d: number): number => (d * Math.PI) / 180;

/** Great-circle distance between two points, in metres. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Even-odd ray-casting test. `poly` is an array of [lat, lng] vertices. */
export function pointInPolygon(lat: number, lng: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const latI = poly[i][0], lngI = poly[i][1];
    const latJ = poly[j][0], lngJ = poly[j][1];
    const intersect = ((latI > lat) !== (latJ > lat)) &&
      (lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** True when (lat,lng) falls inside the geofence (`CIRCLE` or `POLYGON`). */
export function isInsideGeofence(type: string, geo: Geo, lat: number, lng: number): boolean {
  if (type === 'CIRCLE') {
    const center = geo.center as { lat?: number; lng?: number } | undefined;
    const radiusM = Number(geo.radiusM);
    if (!center || !Number.isFinite(radiusM)) return false;
    return haversineM(lat, lng, Number(center.lat), Number(center.lng)) <= radiusM;
  }
  if (type === 'POLYGON') {
    const poly = geo.polygon as [number, number][] | undefined;
    if (!Array.isArray(poly) || poly.length < 3) return false;
    return pointInPolygon(lat, lng, poly);
  }
  return false;
}
