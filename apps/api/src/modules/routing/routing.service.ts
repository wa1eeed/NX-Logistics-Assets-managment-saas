import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { DirectionsRequest, OptimizeRequest, OptimizeResult, RouteResult } from '@nx-lam/shared';
import { MapsService } from '../maps/maps.service';

const ORS_BASE = 'https://api.openrouteservice.org';

interface OrsGeoJson {
  features?: { geometry: { coordinates: number[][] }; properties?: { summary?: { distance: number; duration: number } } }[];
}
interface OrsOptimization {
  routes?: { steps: { type: string; job?: number }[] }[];
}

/**
 * Routing via OpenRouteService — proxied server-side so the ORS key (a plain secret,
 * unlike the referrer-restricted Maps JS key) never reaches the browser. Coordinates
 * in/out are [lat, lng]; ORS itself uses [lng, lat].
 */
@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);

  constructor(private readonly maps: MapsService) {}

  private async key(): Promise<string> {
    const k = await this.maps.routingKey();
    if (!k) throw new BadRequestException('Routing is not configured — set the OpenRouteService key in the platform Maps provider.');
    return k;
  }

  /** Driving route through the given [lat,lng] waypoints (ORS Directions). */
  async directions(req: DirectionsRequest): Promise<RouteResult> {
    if (!req.coordinates || req.coordinates.length < 2) throw new BadRequestException('At least two coordinates are required');
    const key = await this.key();
    const profile = req.profile ?? 'driving-car';
    const coordinates = req.coordinates.map(([lat, lng]) => [lng, lat]);
    const res = await fetch(`${ORS_BASE}/v2/directions/${profile}/geojson`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates }),
    });
    if (!res.ok) {
      this.logger.error(`ORS directions failed: ${res.status} ${await res.text()}`);
      throw new BadRequestException(`Routing failed (${res.status})`);
    }
    const data = (await res.json()) as OrsGeoJson;
    const feat = data.features?.[0];
    if (!feat) throw new BadRequestException('No route found');
    const geometry = (feat.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
    const summary = feat.properties?.summary ?? { distance: 0, duration: 0 };
    return { geometry, distanceM: Math.round(summary.distance), durationS: Math.round(summary.duration) };
  }

  /** Optimize the visit order of `stops` for one vehicle (ORS Optimization), then draw it. */
  async optimize(req: OptimizeRequest): Promise<OptimizeResult> {
    if (!req.stops || req.stops.length < 1) throw new BadRequestException('At least one stop is required');
    const key = await this.key();
    const toLngLat = ([lat, lng]: [number, number]): [number, number] => [lng, lat];
    const jobs = req.stops.map((s, i) => ({ id: i + 1, location: toLngLat(s) }));
    const vehicle: Record<string, unknown> = { id: 1, profile: req.profile ?? 'driving-car', start: toLngLat(req.start) };
    if (req.end) vehicle.end = toLngLat(req.end);
    const res = await fetch(`${ORS_BASE}/optimization`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs, vehicles: [vehicle] }),
    });
    if (!res.ok) {
      this.logger.error(`ORS optimize failed: ${res.status} ${await res.text()}`);
      throw new BadRequestException(`Optimization failed (${res.status})`);
    }
    const data = (await res.json()) as OrsOptimization;
    const route = data.routes?.[0];
    if (!route) throw new BadRequestException('No optimized route found');
    const order = route.steps.filter((s) => s.type === 'job' && s.job != null).map((s) => (s.job as number) - 1);
    // Draw the real geometry: start → stops (in optimized order) → end.
    const ordered: [number, number][] = [req.start, ...order.map((i) => req.stops[i]), ...(req.end ? [req.end] : [])];
    const drawn = await this.directions({ coordinates: ordered, profile: req.profile });
    return { ...drawn, order };
  }
}
