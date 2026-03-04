import type { Metadata } from "next";
import { Shield, Check } from "lucide-react";
import { DownloadCards } from "@/components/marketing/DownloadCards";
import { PastVersions } from "@/components/marketing/PastVersions";

export const metadata: Metadata = {
  title: "Download Free VPN App",
  description:
    "Download Tunnely VPN for Windows, macOS, and Linux. Our lightweight, native Rust desktop app features multi-hop routing, channel bonding, and true privacy.",
  keywords: ["download VPN", "tunnely download", "VPN for Windows", "VPN for Mac", "VPN for Linux", "Tauri VPN app", "Rust VPN client"],
  openGraph: {
    title: "Download Tunnely VPN App",
    description:
      "Zero-bloat native binaries compiled in Rust. Available for Windows, macOS, and Linux.",
    url: "/download",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Download Tunnely VPN App",
    description: "Native VPN client for Windows, macOS, and Linux. Built with Rust.",
  },
};

/*  - - - Types  - - - */

interface GitHubAsset {
  name: string;
  size: number;
  url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  created_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

interface PlatformRelease {
  platform: string;
  fileName: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
}

interface ReleaseData {
  version: string;
  releaseName: string;
  publishedAt: string;
  platforms: PlatformRelease[];
}

interface PastVersionAsset {
  platform: string;
  platformLabel: string;
  fileName: string;
  sizeFormatted: string;
  downloadUrl: string;
}

interface PastVersionData {
  version: string;
  releaseName: string;
  publishedAt: string;
  assets: PastVersionAsset[];
}

/*  - - - Helpers  - - - */

const platformLabels: Record<string, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
};

function formatBytes(bytes: number): string {
  return `~${Math.round(bytes / (1024 * 1024))} MB`;
}

function matchAsset(assets: GitHubAsset[], platform: string): GitHubAsset | undefined {
  switch (platform) {
    case "windows":
      return assets.find((a) => a.name.endsWith(".exe") && a.name.includes("setup"))
        || assets.find((a) => a.name.endsWith(".msi"));
    case "mac":
      return assets.find((a) => a.name.endsWith(".dmg") && a.name.includes("aarch64"))
        || assets.find((a) => a.name.endsWith(".dmg"));
    case "linux":
      return assets.find((a) => a.name.endsWith(".AppImage"))
        || assets.find((a) => a.name.endsWith(".deb"));
    default:
      return undefined;
  }
}

function buildPlatformReleases(assets: GitHubAsset[], tagName: string): PlatformRelease[] {
  const platforms: PlatformRelease[] = [];
  for (const pk of ["windows", "mac", "linux"]) {
    const asset = matchAsset(assets, pk);
    if (asset) {
      platforms.push({
        platform: pk,
        fileName: asset.name,
        size: asset.size,
        sizeFormatted: formatBytes(asset.size),
        downloadUrl: `/api/download?platform=${pk}&tag=${encodeURIComponent(tagName)}`,
      });
    }
  }
  return platforms;
}

/*  - - - Static Fallback  - - - */

const staticPlatforms = [
  { name: "Windows", version: "10/11 (64-bit)", fileName: "Tunnely-Setup.exe", size: "~12 MB", downloadUrl: "#", platformKey: "windows" },
  { name: "macOS", version: "12+ (Apple Silicon & Intel)", fileName: "Tunnely.dmg", size: "~10 MB", downloadUrl: "#", platformKey: "mac" },
  { name: "Linux", version: "Ubuntu 22+, Fedora 38+, Arch", fileName: "tunnely.AppImage", size: "~15 MB", downloadUrl: "#", platformKey: "linux" },
];

const requirements = [
  "64-bit architecture",
  "Outbound port 443/UDP open",
  "TUN/TAP driver privileges",
  "50 MB disk allocation",
];

/*  - - - Data Fetching  - - - */

async function getAllReleases(): Promise<{ latest: ReleaseData | null; past: PastVersionData[] }> {
  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;

  if (!pat || !repo) {
    console.error("[download/page] Missing GITHUB_PAT or GITHUB_REPO");
    return { latest: null, past: [] };
  }

  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // Fetch all releases (up to 30)
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=30`,
      { headers, next: { revalidate: 300 } }
    );

    if (!res.ok) {
      console.error("[download/page] GitHub API error:", res.status);
      return { latest: null, past: [] };
    }

    const allReleases: GitHubRelease[] = await res.json();

    // Keep only releases with assets
    const releasesWithAssets = allReleases.filter((r) => r.assets.length > 0);

    if (releasesWithAssets.length === 0) {
      console.warn("[download/page] No releases with assets found");
      return { latest: null, past: [] };
    }

    const formatVersion = (tag: string) => tag.replace("tunnely-v", "v");

    // First release = latest
    const latestRelease = releasesWithAssets[0];
    const latest: ReleaseData = {
      version: formatVersion(latestRelease.tag_name),
      releaseName: latestRelease.name,
      publishedAt: latestRelease.published_at || latestRelease.created_at,
      platforms: buildPlatformReleases(latestRelease.assets, latestRelease.tag_name),
    };

    // Remaining releases = past versions
    const past: PastVersionData[] = releasesWithAssets.slice(1).map((r) => ({
      version: formatVersion(r.tag_name),
      releaseName: r.name,
      publishedAt: r.published_at || r.created_at,
      assets: ["windows", "mac", "linux"]
        .map((pk) => {
          const asset = matchAsset(r.assets, pk);
          if (!asset) return null;
          return {
            platform: pk,
            platformLabel: platformLabels[pk] || pk,
            fileName: asset.name,
            sizeFormatted: formatBytes(asset.size),
            downloadUrl: `/api/download?platform=${pk}&tag=${encodeURIComponent(r.tag_name)}`,
          };
        })
        .filter((a): a is PastVersionAsset => a !== null),
    }));

    console.log(`[download/page] Latest: ${latest.version} | Past versions: ${past.length}`);
    return { latest, past };
  } catch (err) {
    console.error("[download/page] Exception:", err);
    return { latest: null, past: [] };
  }
}

/*  - - - Page  - - - */

export default async function DownloadPage() {
  const { latest, past } = await getAllReleases();

  // Merge live data with static platform info
  const platforms = staticPlatforms.map((sp) => {
    const liveData = latest?.platforms.find((p) => p.platform === sp.platformKey);
    return {
      name: sp.name,
      version: sp.version,
      fileName: liveData?.fileName || sp.fileName,
      size: liveData?.sizeFormatted || sp.size,
      downloadUrl: liveData?.downloadUrl || sp.downloadUrl,
      platformKey: sp.platformKey,
    };
  });

  const appVersion = latest?.version || null;

  return (
    <>
      <main className="pt-16 bg-[#121212] min-h-screen">
        {/* Hero */}
        <section className="py-24 relative border-b border-white/[0.08]">
          <div className="relative max-w-7xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 border border-primary/30 bg-primary/10 text-primary uppercase tracking-widest font-mono text-[10px] font-bold mb-8">
              <Shield className="w-3.5 h-3.5" strokeWidth={2} />
              Verified Open-Source Binaries
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight">
              Get Network Access
            </h1>
            <p className="text-lg text-text-dim max-w-2xl mx-auto font-mono">
              Zero-bloat native binaries compiled in Rust. No Electron, no telemetry daemon, no hidden background services.
            </p>
            {appVersion && (
              <p className="mt-4 text-xs font-mono text-primary uppercase tracking-widest">
                Latest Release: {appVersion}
              </p>
            )}
          </div>
        </section>

        {/* Platform Cards */}
        <DownloadCards platforms={platforms} />

        {/* Past Versions */}
        <PastVersions versions={past} />

        <div className="grid md:grid-cols-2">
          {/* System Requirements */}
          <section className="py-24 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#121212]">
            <div className="max-w-md mx-auto px-6">
              <h2 className="text-2xl font-black text-white mb-8 tracking-tight uppercase">
                System Requirements
              </h2>
              <ul className="space-y-6">
                {requirements.map((req) => (
                  <li key={req} className="flex items-start gap-4 text-sm font-mono text-text-dim">
                    <div className="mt-0.5 p-0.5 bg-primary/20 text-primary">
                      <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>
                    {req}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Installation Steps */}
          <section className="py-24 bg-[#121212]">
            <div className="max-w-md mx-auto px-6">
              <h2 className="text-2xl font-black text-white mb-8 tracking-tight uppercase">
                Deployment Protocol
              </h2>
              <div className="space-y-6">
                {[
                  { step: "01", text: "Acquire target platform binary" },
                  { step: "02", text: "Execute local setup daemon" },
                  { step: "03", text: "Authenticate node via dashboard" },
                  { step: "04", text: "Initialize cryptographic tunnel" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-6">
                    <div className="border border-white/[0.08] bg-white/[0.02] px-2 py-1 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-mono font-bold text-primary tracking-widest">{item.step}</span>
                    </div>
                    <p className="text-sm font-mono text-text-dim pt-1.5">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
