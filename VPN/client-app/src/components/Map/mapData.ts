import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import worldTopology from "../../assets/world-110m.json";

let cachedWorld: FeatureCollection<Geometry> | null = null;

export async function loadWorldData(): Promise<FeatureCollection<Geometry>> {
  if (cachedWorld) return cachedWorld;

  const countries = topojson.feature(
    worldTopology as unknown as Topology,
    (worldTopology as unknown as Topology).objects.countries
  ) as FeatureCollection<Geometry>;

  cachedWorld = countries;
  return countries;
}
