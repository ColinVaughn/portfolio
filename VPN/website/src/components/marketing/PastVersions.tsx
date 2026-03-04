"use client";

import { useState } from "react";
import { Download, ChevronDown, ChevronUp, Monitor, Apple, Terminal } from "lucide-react";
import { type LucideIcon } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  windows: Monitor,
  mac: Apple,
  linux: Terminal,
};

interface VersionAsset {
  platform: string;
  platformLabel: string;
  fileName: string;
  sizeFormatted: string;
  downloadUrl: string;
}

interface PastVersion {
  version: string;
  releaseName: string;
  publishedAt: string;
  assets: VersionAsset[];
}

interface PastVersionsProps {
  versions: PastVersion[];
}

export function PastVersions({ versions }: PastVersionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  if (versions.length === 0) return null;

  return (
    <section className="py-16 border-b border-white/[0.08] bg-[#121212]">
      <div className="max-w-5xl mx-auto px-6">
        {/* Toggle Header */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between group cursor-pointer"
        >
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight text-left">
              Previous Versions
            </h2>
            <p className="text-[10px] font-mono text-text-dim uppercase tracking-widest mt-1 text-left">
              {versions.length} older {versions.length === 1 ? "release" : "releases"} available
            </p>
          </div>
          <div className="p-2 border border-white/[0.08] bg-white/[0.02] group-hover:border-white/[0.15] group-hover:bg-white/[0.04] transition-all">
            {isOpen ? (
              <ChevronUp className="w-4 h-4 text-text-dim" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-dim" />
            )}
          </div>
        </button>

        {/* Version List */}
        {isOpen && (
          <div className="mt-8 space-y-[1px] bg-white/[0.08] border border-white/[0.08]">
            {versions.map((version) => {
              const isExpanded = expandedVersion === version.version;

              return (
                <div key={version.version} className="bg-[#121212]">
                  {/* Version Row */}
                  <button
                    onClick={() => setExpandedVersion(isExpanded ? null : version.version)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-black text-white uppercase tracking-tight">
                        {version.version}
                      </span>
                      <span className="text-[10px] font-mono text-text-dim uppercase tracking-widest">
                        {version.releaseName}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-text-dim/60 uppercase tracking-widest">
                        {new Date(version.publishedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                      <div className="p-1">
                        {isExpanded ? (
                          <ChevronUp className="w-3.5 h-3.5 text-text-dim" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-text-dim" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Asset List */}
                  {isExpanded && (
                    <div className="px-6 pb-5 grid sm:grid-cols-3 gap-3">
                      {version.assets.map((asset) => {
                        const Icon = iconMap[asset.platform] || Monitor;
                        return (
                          <a
                            key={asset.fileName}
                            href={asset.downloadUrl}
                            className="flex items-center gap-3 px-4 py-3 bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] hover:border-white/[0.15] transition-all group"
                          >
                            <Icon className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={2} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-mono font-bold text-white uppercase tracking-widest truncate">
                                {asset.platformLabel}
                              </p>
                              <p className="text-[10px] font-mono text-text-dim/60 uppercase tracking-widest">
                                {asset.sizeFormatted}
                              </p>
                            </div>
                            <Download className="w-3.5 h-3.5 text-text-dim group-hover:text-primary transition-colors flex-shrink-0" strokeWidth={2.5} />
                          </a>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
