import {
  onMount,
  onCleanup,
  createEffect,
  createSignal,
  createMemo,
  Show,
  For,
} from "solid-js";
import * as d3Geo from "d3-geo";
import * as d3Selection from "d3-selection";
import * as d3Zoom from "d3-zoom";
import { loadWorldData } from "./mapData";
import {
  servers,
  selectedServerId,
  setSelectedServerId,
  isConnected,
  connectionInfo,
  userLocation,
} from "../../lib/stores";
import type { RelayServer } from "../../lib/types";
import { isMobilePlatform } from "../../lib/usePageVisibility";

interface ServerCluster {
  servers: RelayServer[];
  x: number;
  y: number;
  latitude: number;
  longitude: number;
}

export default function WorldMap() {
  let svgRef!: SVGSVGElement;
  let containerRef!: HTMLDivElement;
  let mapLayerRef!: SVGGElement;

  const [tooltip, setTooltip] = createSignal<{
    x: number;
    y: number;
    cluster: ServerCluster;
  } | null>(null);
  const [mapReady, setMapReady] = createSignal(false);
  const [currentZoom, setCurrentZoom] = createSignal(1);

  let projection: d3Geo.GeoProjection;
  let pathGenerator: d3Geo.GeoPath;

  onMount(async () => {
    const world = await loadWorldData();
    const width = containerRef.clientWidth || 800;
    const height = containerRef.clientHeight || 400;
    const svg = d3Selection.select(svgRef);
    const mapLayer = d3Selection.select(mapLayerRef);

    let mapWidth = 0;
    let mapHeight = 0;

    // Setup zoom behavior
    const zoom = d3Zoom.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on("zoom", (event) => {
        let x = event.transform.x;
        let y = event.transform.y;
        const k = event.transform.k;
        
        const scaledWidth = mapWidth * k;
        
        if (x > 0) {
           x -= scaledWidth;
           svg.property("__zoom", d3Zoom.zoomIdentity.translate(x, y).scale(k));
        } else if (x < -scaledWidth) {
           x += scaledWidth;
           svg.property("__zoom", d3Zoom.zoomIdentity.translate(x, y).scale(k));
        }

        mapLayer.attr("transform", `translate(${x}, ${y}) scale(${k})`);
        setCurrentZoom(k);
      });

    svg.call(zoom);

    const initMap = (w: number, h: number, center: boolean = false) => {
      // Equirectangular is exactly 2:1 ratio. We ensure the map is always at least as tall as the container.
      mapHeight = Math.max(h, w / 2);
      mapWidth = mapHeight * 2;
      
      projection = d3Geo.geoEquirectangular()
        .scale(mapWidth / (2 * Math.PI))
        .translate([mapWidth / 2, mapHeight / 2]);

      pathGenerator = d3Geo.geoPath(projection);

      zoom.translateExtent([
        [Number.NEGATIVE_INFINITY, 0],
        [Number.POSITIVE_INFINITY, mapHeight], // Exactly clamp to map image bounds
      ]);

      if (center) {
        const initialY = -(mapHeight - h) / 2;
        let initialX = w / 2 - mapWidth * (13 / 24); // Center loosely on Europe
        if (initialX > 0) initialX -= mapWidth;
        if (initialX < -mapWidth) initialX += mapWidth;
        svg.call(zoom.transform, d3Zoom.zoomIdentity.translate(initialX, initialY).scale(1));
      }
    };

    initMap(width, height, true);
    
    setMapReady(true);
    
    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef) return;
      const newWidth = containerRef.clientWidth;
      const newHeight = containerRef.clientHeight;
      if (newWidth === 0 || newHeight === 0) return;
      
      initMap(newWidth, newHeight, false);
      
      setMapReady(false);
      setTimeout(() => setMapReady(true), 10);
    });
    resizeObserver.observe(containerRef);

    onCleanup(() => resizeObserver.disconnect());
  });

  // Cluster servers that are close together on the map (memoized  - only recalculates when servers change)
  const clusters = createMemo((): ServerCluster[] => {
    if (!projection || !mapReady()) return [];

    const serverList = servers();
    const result: ServerCluster[] = [];
    const used = new Set<string>();

    for (const server of serverList) {
      if (used.has(server.id)) continue;

      const pos = projection([server.longitude, server.latitude]);
      if (!pos) continue;

      const cluster: ServerCluster = {
        servers: [server],
        x: pos[0],
        y: pos[1],
        latitude: server.latitude,
        longitude: server.longitude,
      };

      // Find nearby servers to cluster
      for (const other of serverList) {
        if (other.id === server.id || used.has(other.id)) continue;
        const otherPos = projection([other.longitude, other.latitude]);
        if (!otherPos) continue;

        const dx = pos[0] - otherPos[0];
        const dy = pos[1] - otherPos[1];
        if (dx * dx + dy * dy < 225) { // 15^2, avoid sqrt
          cluster.servers.push(other);
          used.add(other.id);
        }
      }

      used.add(server.id);
      result.push(cluster);
    }

    return result;
  });

  // Render map instances  - debounced via requestAnimationFrame to avoid layout thrashing
  let renderRafId: number | undefined;
  createEffect(() => {
    if (!mapReady() || !pathGenerator) return;

    // Read reactive deps here so Solid tracks them
    const clusterData = clusters();
    const zoomLevel = currentZoom();
    const connected = isConnected();
    const connInfo = connectionInfo();
    const loc = userLocation();
    const selected = selectedServerId();

    if (renderRafId) cancelAnimationFrame(renderRafId);
    renderRafId = requestAnimationFrame(() => {
      renderMap(clusterData, zoomLevel, connected, connInfo, loc, selected);
    });
  });

  onCleanup(() => { if (renderRafId) cancelAnimationFrame(renderRafId); });

  const renderMap = (
    clusterData: ServerCluster[],
    zoomLevel: number,
    connected: boolean,
    connInfo: ReturnType<typeof connectionInfo>,
    loc: ReturnType<typeof userLocation>,
    selected: string | null,
  ) => {
    loadWorldData().then((world) => {
      const svg = d3Selection.select(mapLayerRef);
      const width = containerRef.clientWidth || 800;

      // Clear old content
      svg.selectAll(".world-instance").remove();
      let userPos: [number, number] | null = null;
      if (loc) {
        userPos = projection([loc.longitude, loc.latitude]);
      }

      // Draw map side-by-side: 3 copies on desktop for seamless scroll, 1 on mobile for performance
      const scale = projection.scale();
      const mapWidth = scale * 2 * Math.PI;
      const offsets = isMobilePlatform() ? [0] : [-mapWidth, 0, mapWidth];
      
      offsets.forEach((offsetX, index) => {
        const instance = svg
          .append("g")
          .attr("class", `world-instance instance-${index}`)
          .attr("transform", `translate(${offsetX}, 0)`);

        // 1. Draw Countries
        instance
          .selectAll("path.country")
          .data(world.features)
          .join("path")
          .attr("class", "country")
          .attr("d", pathGenerator as any)
          .style("fill", "var(--color-surface)")
          .style("stroke", "var(--color-border)")
          .style("stroke-width", `${0.5 / zoomLevel}px`)
          .style("vector-effect", "non-scaling-stroke");

        // 2. Draw Connection Arc
        if (connected && connInfo && loc) {
          const entryServer = servers().find((s) => s.id === connInfo.entry_server.id);
          
          if (entryServer) {
            const serverPos = projection([entryServer.longitude, entryServer.latitude]);
            if (serverPos) {
              const lineGenerator = d3Geo.geoPath(projection);
              const lineFeature: GeoJSON.Feature = {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [loc.longitude, loc.latitude],
                    [entryServer.longitude, entryServer.latitude],
                  ],
                },
              };

              instance
                .append("path")
                .attr("class", "connection-arc")
                .attr("d", lineGenerator(lineFeature))
                .style("fill", "none")
                .style("stroke", "var(--color-accent)")
                .style("stroke-width", `${2 / zoomLevel}px`)
                .style("stroke-dasharray", `${6 / zoomLevel} ${4 / zoomLevel}`)
                .style("filter", "drop-shadow(0 0 4px var(--color-accent))");
            }
          }
        }

        // 3. Draw User Location Pulse
        if (userPos) {
          const userGroup = instance.append("g").attr("class", "user-marker");
          
          userGroup
            .append("circle")
            .attr("cx", userPos[0])
            .attr("cy", userPos[1])
            .attr("r", 5 / zoomLevel)
            .style("fill", "var(--color-accent)")
            .style("opacity", "0.3")
            .attr("class", "pulse-ring");

          userGroup
            .append("circle")
            .attr("cx", userPos[0])
            .attr("cy", userPos[1])
            .attr("r", 3 / zoomLevel)
            .style("fill", "var(--color-accent)");
        }

        // 4. Draw Server Markers
        const markerGroup = instance
          .selectAll<SVGGElement, ServerCluster>(".server-marker")
          .data(clusterData)
          .join("g")
          .attr("class", "server-marker")
          .style("cursor", "pointer");

        markerGroup
          .append("circle")
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y)
          .attr("r", (d) => {
            const isSelected = d.servers.some((s) => s.id === selected);
            return isSelected ? 10 / zoomLevel : 0;
          })
          .style("fill", "none")
          .style("stroke", "var(--color-accent)")
          .style("stroke-width", `${1.5 / zoomLevel}px`)
          .style("opacity", "0.4");

        markerGroup
          .append("circle")
          .attr("cx", (d) => d.x)
          .attr("cy", (d) => d.y)
          .attr("r", (d) => (d.servers.length > 1 ? 6 / zoomLevel : 4 / zoomLevel))
          .style("fill", (d) => {
            const isSelected = d.servers.some((s) => s.id === selected);
            if (isSelected) return "var(--color-accent)";
            const avgLoad =
              d.servers.reduce(
                (sum, s) => sum + (s.max_clients > 0 ? s.current_clients / s.max_clients : 0),
                0
              ) / d.servers.length;
            if (avgLoad < 0.5) return "var(--color-success)";
            if (avgLoad < 0.8) return "var(--color-warning)";
            return "var(--color-danger)";
          })
          .style("stroke", "var(--color-bg)")
          .style("stroke-width", `${1.5 / zoomLevel}px`);

        // Marker Labels
        markerGroup
          .filter((d) => d.servers.length > 1)
          .append("text")
          .attr("class", "marker-label")
          .attr("x", (d) => d.x)
          .attr("y", (d) => d.y + 1 / zoomLevel)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .style("fill", "white")
          .style("font-size", `${8 / zoomLevel}px`)
          .style("font-weight", "bold")
          .style("pointer-events", "none")
          .text((d) => d.servers.length);

        // Marker Interactions
        // To avoid ghost tooltips clipping, clicking offset maps triggers selection logically
        markerGroup.on("click", function (_event: any, d: ServerCluster) {
          if (d.servers.length === 1) {
            setSelectedServerId(d.servers[0].id);
            setTooltip(null);
          } else {
            // Need absolute client coordinates for the tooltip to appear in exactly the right spot over the screen
            const matrix = (this as SVGGElement).getCTM();
            if (matrix) {
               const svgPoint = svgRef.createSVGPoint();
               svgPoint.x = d.x;
               svgPoint.y = d.y;
               const pt = svgPoint.matrixTransform(matrix);
               setTooltip({ x: pt.x, y: pt.y, cluster: d });
            } else {
               setTooltip({ x: d.x, y: d.y, cluster: d }); // fallback
            }
          }
        });
      });
    });
  };

  const handleClusterSelect = (server: RelayServer) => {
    setSelectedServerId(server.id);
    setTooltip(null);
  };

  const loadPercent = (s: RelayServer) =>
    s.max_clients > 0
      ? Math.round((s.current_clients / s.max_clients) * 100)
      : 0;

  return (
    <div ref={containerRef!} class="relative w-full h-full min-h-[250px] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
      <svg ref={svgRef!} class="w-full h-full absolute inset-0">
        <g ref={mapLayerRef!} class="map-layer"></g>
      </svg>

      {/* Cluster popup */}
      <Show when={tooltip()}>
        {(_t) => {
          const t = tooltip()!;
          return (
            <>
              {/* Backdrop */}
              <div
                class="absolute inset-0"
                onClick={() => setTooltip(null)}
              />
              {/* Popup */}
              <div
                class="absolute z-20 rounded-lg py-1 min-w-36 shadow-xl"
                style={{
                  left: `${t.x}px`,
                  top: `${t.y}px`,
                  transform: "translate(-50%, -100%)", // offset above point
                  "margin-top": "-10px",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <For each={t.cluster.servers}>
                  {(server) => (
                    <button
                      onClick={() => handleClusterSelect(server)}
                      class="w-full flex items-center justify-between px-3 py-1.5 text-left cursor-pointer transition-colors"
                      style={{
                        background:
                          selectedServerId() === server.id
                            ? "var(--color-surface-hover)"
                            : "transparent",
                      }}
                    >
                      <span class="text-xs font-medium">
                        {server.city}
                      </span>
                      <span
                        class="text-[10px]"
                        style="color: var(--color-text-dim)"
                      >
                        {loadPercent(server)}%
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </>
          );
        }}
      </Show>
    </div>
  );
}
