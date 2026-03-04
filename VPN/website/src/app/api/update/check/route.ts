import { NextRequest, NextResponse } from "next/server";

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string | null;
  published_at: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

function matchPlatformAsset(
  assets: GitHubAsset[],
  platform: string
): GitHubAsset | undefined {
  switch (platform) {
    case "windows":
      return (
        assets.find(
          (a) => a.name.endsWith(".exe") && a.name.includes("setup")
        ) || assets.find((a) => a.name.endsWith(".msi"))
      );
    case "mac":
      return (
        assets.find(
          (a) => a.name.endsWith(".dmg") && a.name.includes("aarch64")
        ) || assets.find((a) => a.name.endsWith(".dmg"))
      );
    case "linux":
      return (
        assets.find((a) => a.name.endsWith(".AppImage")) ||
        assets.find((a) => a.name.endsWith(".deb"))
      );
    default:
      return undefined;
  }
}

/** Compare two semver-like version strings. Returns true if `latest` is newer than `current`. */
function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const cur = parse(current);
  const lat = parse(latest);

  for (let i = 0; i < Math.max(cur.length, lat.length); i++) {
    const c = cur[i] ?? 0;
    const l = lat[i] ?? 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;
  if (!pat || !repo) return null;

  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  try {
    // Try published release first
    const res = await fetch(
      `https://api.github.com/repos/${repo}/releases/latest`,
      { headers, next: { revalidate: 300 } }
    );

    if (res.ok) return res.json();

    // Fallback: find first release with assets
    const allRes = await fetch(
      `https://api.github.com/repos/${repo}/releases?per_page=10`,
      { headers, next: { revalidate: 300 } }
    );

    if (!allRes.ok) return null;

    const releases: GitHubRelease[] = await allRes.json();
    return releases.find((r) => r.assets.length > 0) || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const currentVersion = request.nextUrl.searchParams.get("current");

  if (!platform || !["windows", "mac", "linux"].includes(platform)) {
    return NextResponse.json(
      { error: "Invalid platform. Use: windows, mac, or linux" },
      { status: 400 }
    );
  }

  if (!currentVersion) {
    return NextResponse.json(
      { error: "Missing 'current' version query parameter" },
      { status: 400 }
    );
  }

  const release = await fetchLatestRelease();

  if (!release) {
    return NextResponse.json({
      update_available: false,
      latest_version: currentVersion,
      download_url: "",
      release_notes: "",
      file_name: "",
      file_size: 0,
    });
  }

  const latestVersion = release.tag_name.replace("tunnely-v", "");

  if (!isNewerVersion(currentVersion, latestVersion)) {
    return NextResponse.json({
      update_available: false,
      latest_version: latestVersion,
      download_url: "",
      release_notes: "",
      file_name: "",
      file_size: 0,
    });
  }

  const asset = matchPlatformAsset(release.assets, platform);

  return NextResponse.json({
    update_available: true,
    latest_version: latestVersion,
    download_url: asset ? `/api/download?platform=${platform}` : "",
    release_notes: release.body || "",
    file_name: asset?.name || "",
    file_size: asset?.size || 0,
  });
}
