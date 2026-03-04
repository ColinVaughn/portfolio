"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

const SERVER_LOCATIONS = [
  { lat: 33.749, lng: -84.388, label: "UNK_NODE" },
  { lat: 40.713, lng: -74.006, label: "ERR_404" },
  { lat: 51.507, lng: -0.128, label: "LOST" },
  { lat: 50.1109, lng: 8.6821, label: "DROP" },
  { lat: 34.0522, lng: -118.2437, label: "NULL" },
];

const DATA_ARCS = [
  { startLat: 33.749, startLng: -84.388, endLat: 40.713, endLng: -74.006 },
  { startLat: 33.749, startLng: -84.388, endLat: 51.507, endLng: -0.128 },
  { startLat: 40.713, startLng: -74.006, endLat: 51.507, endLng: -0.128 },
  { startLat: 51.507, startLng: -0.128, endLat: 50.1109, endLng: 8.6821 },
  { startLat: 33.749, startLng: -84.388, endLat: 34.0522, endLng: -118.2437 },
  { startLat: 40.713, startLng: -74.006, endLat: 50.1109, endLng: 8.6821 },
];

export function BrokenGlobe() {
  const globeRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4; // Slower rotation for dead end feel
      controls.enableZoom = false;
      globeRef.current.pointOfView({ altitude: 2.3, lat: 25, lng: -30 });
    }
  }, [mounted, globeRef.current]);

  if (!mounted) {
    return (
      <div className="relative w-[500px] h-[500px] rounded-full bg-white/[0.02] animate-pulse" />
    );
  }

  return (
    <div className="relative w-[500px] h-[500px] flex items-center justify-center rounded-full overflow-hidden opacity-80">
      {/* Background soft red glow behind globe */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(239,68,68,0.08)_0%,transparent_60%)] pointer-events-none" />
      
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        
        // Rings for cities - Error Red
        ringsData={SERVER_LOCATIONS}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => "#ef4444"}
        ringMaxRadius={6}
        ringPropagationSpeed={0.5} // Slow pulsating red
        ringRepeatPeriod={1500}

        // City Dots and Labels
        labelsData={SERVER_LOCATIONS}
        labelLat="lat"
        labelLng="lng"
        labelText="label"
        labelSize={1.8}
        labelDotRadius={1}
        labelColor={() => "rgba(239, 68, 68, 0.95)"}
        labelResolution={2}
        labelAltitude={0.01}

        // Arcs between cities - Broken / Red
        arcsData={DATA_ARCS}
        arcStartLat="startLat"
        arcStartLng="startLng"
        arcEndLat="endLat"
        arcEndLng="endLng"
        arcColor={() => ['rgba(239, 68, 68, 0.8)', 'rgba(239, 68, 68, 0.1)']}
        arcDashLength={0.1} // Short dashes (broken)
        arcDashGap={2} // Large gap
        arcDashInitialGap={() => Math.random() * 5}
        arcDashAnimateTime={4000} // Slow animation
        arcAltitudeAutoScale={0.2}
      />
    </div>
  );
}
