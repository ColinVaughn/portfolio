"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const SERVER_LOCATIONS = [
  { lat: 33.749, lng: -84.388, label: "ATL" },
  { lat: 40.713, lng: -74.006, label: "NYC" },
  { lat: 51.507, lng: -0.128, label: "LON" },
  { lat: 50.1109, lng: 8.6821, label: "FRA" },
  { lat: 34.0522, lng: -118.2437, label: "LAX" },
];

const DATA_ARCS = [
  { startLat: 33.749, startLng: -84.388, endLat: 40.713, endLng: -74.006 },
  { startLat: 33.749, startLng: -84.388, endLat: 51.507, endLng: -0.128 },
  { startLat: 40.713, startLng: -74.006, endLat: 51.507, endLng: -0.128 },
  { startLat: 51.507, startLng: -0.128, endLat: 50.1109, endLng: 8.6821 },
  { startLat: 33.749, startLng: -84.388, endLat: 34.0522, endLng: -118.2437 },
  { startLat: 40.713, startLng: -74.006, endLat: 50.1109, endLng: 8.6821 },
];

export function NetworkGlobe() {
  const globeRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 550, height: 550 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.8;
      controls.enableZoom = false;
      globeRef.current.pointOfView({ altitude: 2.3, lat: 25, lng: -30 });
    }
  }, [mounted, globeRef.current]);

  if (!mounted) {
    return (
      <div className="relative w-[550px] h-[550px] rounded-full bg-surface-50 animate-pulse opacity-10" />
    );
  }

  return (
    <div className="relative w-[550px] h-[550px] flex items-center justify-center rounded-full overflow-hidden">
      {/* Background soft glow behind globe */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(108,60,255,0.06)_0%,transparent_60%)] pointer-events-none" />
      
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        
        // Rings for cities
        ringsData={SERVER_LOCATIONS}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => "#7c4cff"}
        ringMaxRadius={4}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={800}

        // City Dots and Labels
        labelsData={SERVER_LOCATIONS}
        labelLat="lat"
        labelLng="lng"
        labelText="label"
        labelSize={1.8}
        labelDotRadius={0.8}
        labelColor={() => "rgba(255, 255, 255, 0.95)"}
        labelResolution={2}
        labelAltitude={0.01}

        // Arcs between cities
        arcsData={DATA_ARCS}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ['rgba(59, 130, 246, 0.8)', 'rgba(124, 76, 255, 0.8)']}
        arcDashLength={0.5}
        arcDashGap={1}
        arcDashInitialGap={() => Math.random() * 2}
        arcDashAnimateTime={2000}
        arcAltitudeAutoScale={0.3}
      />
    </div>
  );
}
