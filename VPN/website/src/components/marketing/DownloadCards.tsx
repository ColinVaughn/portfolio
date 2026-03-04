"use client";

import { Download, Monitor, Apple, Terminal } from "lucide-react";
import { type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  windows: Monitor,
  mac: Apple,
  linux: Terminal,
};

interface Platform {
  name: string;
  version: string;
  fileName: string;
  size: string;
  downloadUrl: string;
  platformKey: string;
}

interface DownloadCardsProps {
  platforms: Platform[];
}

export function DownloadCards({ platforms }: DownloadCardsProps) {
  console.log("[DownloadCards] Rendered with platforms:", platforms);

  const handleDownloadClick = (platform: Platform) => {
    console.log(`[DownloadCards] Download clicked for ${platform.name}`);
    console.log(`[DownloadCards] URL: ${platform.downloadUrl}`);
    console.log(`[DownloadCards] File: ${platform.fileName} | Size: ${platform.size}`);

    if (platform.downloadUrl === "#") {
      console.warn("[DownloadCards] Download URL is '#'  - no release data available");
    }
  };

  return (
    <section className="py-24 border-b border-border bg-bg">
      <div className="max-w-5xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-[1px] bg-white/[0.08] border border-white/[0.08]">
          {platforms.map((platform) => {
            const Icon = iconMap[platform.platformKey] || Monitor;
            return (
              <div
                key={platform.name}
                className="bg-[#121212] p-8 text-center flex flex-col hover:bg-white/[0.02] transition-colors"
              >
                <Icon className="w-12 h-12 text-primary mx-auto mb-6" strokeWidth={1.5} />
                <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                  {platform.name}
                </h2>
                <p className="text-xs font-mono text-text-dim mb-8">{platform.version}</p>

                <div className="border border-white/[0.08] bg-white/[0.02] p-4 mb-8 flex flex-col gap-1">
                  <p className="text-[10px] font-mono font-bold text-text-dim uppercase tracking-widest">
                    {platform.fileName}
                  </p>
                  <p className="text-[10px] font-mono text-text-dim/60 uppercase tracking-widest">{platform.size}</p>
                </div>

                <a
                  href={platform.downloadUrl}
                  onClick={() => handleDownloadClick(platform)}
                  className="w-full py-4 text-sm font-bold tracking-wide uppercase transition-colors bg-primary text-white hover:bg-primary/90 flex items-center justify-center gap-2 mt-auto"
                >
                  <Download className="w-4 h-4" strokeWidth={2.5} />
                  Download
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
