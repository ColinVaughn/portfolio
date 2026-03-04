import { NextResponse } from "next/server";

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
  content_type: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

interface PlatformInfo {
  platform: string;
  fileName: string;
  size: number;
  sizeFormatted: string;
  downloadUrl: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const mb = bytes / (1024 * 1024);
  return `~${Math.round(mb)} MB`;
}

function matchPlatformAsset(
  assets: GitHubAsset[],
  platform: string
): GitHubAsset | undefined {
  switch (platform) {
    case "windows":
      return assets.find(
        (a) => a.name.endsWith(".exe") && a.name.includes("setup")
      ) || assets.find((a) => a.name.endsWith(".msi"));
    case "mac":
      // Prefer ARM (Apple Silicon) DMG
      return assets.find(
        (a) => a.name.endsWith(".dmg") && a.name.includes("aarch64")
      ) || assets.find((a) => a.name.endsWith(".dmg"));
    case "linux":
      return assets.find((a) => a.name.endsWith(".AppImage")) ||
        assets.find((a) => a.name.endsWith(".deb"));
    default:
      return undefined;
  }
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;

  console.log("[download/latest] ENV check:", {
    hasPAT: !!pat,
    patLength: pat?.length ?? 0,
    repo: repo ?? "NOT SET",
  });

  if (!pat || !repo) {
    console.error("[download/latest] FATAL: Missing GITHUB_PAT or GITHUB_REPO");
    return null;
  }

  try {
    // Try published releases first
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    console.log("[download/latest] Fetching:", url);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 300 },
    });

    console.log("[download/latest] /releases/latest status:", res.status, res.statusText);

    if (res.ok) {
      const data = await res.json();
      console.log("[download/latest] Found published release:", data.tag_name, "| Assets:", data.assets?.length ?? 0);
      data.assets?.forEach((a: GitHubAsset) => console.log("  -", a.name, `(${(a.size / 1024 / 1024).toFixed(1)} MB)`));
      return data;
    }

    // Log the error body
    const errBody = await res.text();
    console.warn("[download/latest] /releases/latest failed:", errBody.slice(0, 300));

    // Fall back to all releases (including drafts)
    const allUrl = `https://api.github.com/repos/${repo}/releases?per_page=10`;
    console.log("[download/latest] Falling back to:", allUrl);

    const allRes = await fetch(allUrl, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 300 },
    });

    console.log("[download/latest] /releases status:", allRes.status, allRes.statusText);

    if (!allRes.ok) {
      const allErrBody = await allRes.text();
      console.error("[download/latest] /releases failed:", allErrBody.slice(0, 300));
      return null;
    }

    const releases: GitHubRelease[] = await allRes.json();
    console.log("[download/latest] Total releases found:", releases.length);
    releases.forEach((r) => console.log(`  - ${r.tag_name} | draft=${r.draft} | assets=${r.assets.length}`));

    const match = releases.find((r) => r.assets.length > 0) || null;
    console.log("[download/latest] Selected release:", match?.tag_name ?? "NONE");
    return match;
  } catch (err) {
    console.error("[download/latest] Exception:", err);
    return null;
  }
}

export async function GET() {
  console.log("[download/latest] GET request received");
  const release = await fetchLatestRelease();

  if (!release) {
    console.error("[download/latest] No release data  - returning 502");
    return NextResponse.json(
      {
        version: null,
        releaseName: null,
        platforms: [],
        error: "No release found or GitHub API unavailable",
      },
      { status: 502 }
    );
  }

  const version = release.tag_name.replace("tunnely-v", "v");
  console.log("[download/latest] Building response for version:", version);

  const platformKeys = ["windows", "mac", "linux"] as const;
  const platforms: PlatformInfo[] = [];

  for (const platform of platformKeys) {
    const asset = matchPlatformAsset(release.assets, platform);
    if (asset) {
      console.log(`[download/latest] Matched ${platform} → ${asset.name}`);
      platforms.push({
        platform,
        fileName: asset.name,
        size: asset.size,
        sizeFormatted: formatBytes(asset.size),
        downloadUrl: `/api/download?platform=${platform}`,
      });
    } else {
      console.warn(`[download/latest] No match for platform: ${platform}`);
    }
  }

  const response = {
    version,
    releaseName: release.name,
    publishedAt: release.published_at,
    platforms,
  };
  console.log("[download/latest] Response:", JSON.stringify(response, null, 2));

  return NextResponse.json(response);
}
