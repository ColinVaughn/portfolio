"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export interface RelayServer {
  id: string;
  hostname: string;
  region: string;
  city: string;
  country_code: string;
  public_ip: string;
  wireguard_port: number;
  quic_port: number;
  api_port: number;
  public_key: string;
  latitude: number;
  longitude: number;
  max_clients: number;
  current_clients: number;
  status: 'initializing' | 'online' | 'degraded' | 'offline' | 'draining';
  last_heartbeat: string;
  created_at: string;
  updated_at: string;
}

interface InteractiveGlobeProps {
  servers: RelayServer[];
}

export function InteractiveGlobe({ servers }: InteractiveGlobeProps) {
  const globeRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [hoverData, setHoverData] = useState<RelayServer | null>(null);

  useEffect(() => {
    setMounted(true);
    // Simple responsive resize
    const handleResize = () => {
      const width = window.innerWidth > 1024 ? 600 : window.innerWidth - 48;
      setDimensions({ width, height: width });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (mounted && globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.5;
      controls.enableZoom = false;
      globeRef.current.pointOfView({ altitude: 2.5, lat: 20, lng: 0 });
    }
  }, [mounted, globeRef.current]);

  if (!mounted) {
    return (
      <div 
        className="relative rounded-full bg-white/[0.02] animate-pulse" 
        style={{ width: dimensions.width, height: dimensions.height }}
      />
    );
  }

  // Format data for Globe
  const gData = servers.map(server => ({
    lat: server.latitude,
    lng: server.longitude,
    size: 2,
    color: server.status === 'online' ? '#3b82f6' : '#ef4444', 
    server: server,
  }));

  return (
    <div className="relative flex items-center justify-center rounded-full overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_60%)] pointer-events-none" />
      
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
        backgroundColor="rgba(0,0,0,0)"
        
        // Rings
        ringsData={gData}
        ringLat="lat"
        ringLng="lng"
        ringColor="color"
        ringMaxRadius={5}
        ringPropagationSpeed={1}
        ringRepeatPeriod={800}

        // Labels
        labelsData={gData}
        labelLat="lat"
        labelLng="lng"
        labelText={(d: any) => d.server.city.toUpperCase()}
        labelSize={1.5}
        labelDotRadius={0.5}
        labelColor={() => "rgba(255, 255, 255, 0.9)"}
        labelResolution={2}
        labelAltitude={0.01}

        onLabelHover={(label: any) => setHoverData(label ? label.server : null)}
      />

      {/* Floating Tooltip */}
      {hoverData && (
        <div className="absolute bottom-4 right-4 bg-[#121212] border border-white/[0.1] p-4 pointer-events-none min-w-[200px] z-20">
            <div className="flex justify-between items-center mb-2 border-b border-white/[0.05] pb-2">
                <span className="font-mono text-xs font-bold text-white uppercase">{hoverData.city}</span>
                <span className={`w-2 h-2 rounded-full ${hoverData.status === 'online' ? 'bg-primary' : 'bg-red-500'}`} />
            </div>
            <div className="space-y-1 font-mono text-[10px] text-text-dim uppercase tracking-wider">
               <div className="flex justify-between">
                  <span>Status</span>
                  <span className={hoverData.status === 'online' ? 'text-primary' : 'text-red-500'}>{hoverData.status}</span>
               </div>
               <div className="flex justify-between">
                  <span>Load</span>
                  <span className="text-white">{hoverData.current_clients} / {hoverData.max_clients}</span>
               </div>
               <div className="flex justify-between">
                  <span>Region</span>
                  <span className="text-white">{hoverData.region}</span>
               </div>
            </div>
        </div>
      )}
    </div>
  );
}
