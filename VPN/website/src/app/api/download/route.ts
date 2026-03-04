import { NextRequest, NextResponse } from "next/server";

interface GitHubAsset {
  name: string;
  size: number;
  url: string;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
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

export async function GET(request: NextRequest) {
  const platform = request.nextUrl.searchParams.get("platform");
  const tag = request.nextUrl.searchParams.get("tag"); // Optional: specific release tag
  console.log("[download] GET request for platform:", platform, "| tag:", tag || "latest");

  if (!platform || !["windows", "mac", "linux"].includes(platform)) {
    return NextResponse.json(
      { error: "Invalid platform. Use: windows, mac, or linux" },
      { status: 400 }
    );
  }

  const pat = process.env.GITHUB_PAT;
  const repo = process.env.GITHUB_REPO;

  if (!pat || !repo) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  try {
    let release: GitHubRelease | null = null;

    const headers = {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };

    if (tag) {
      // Fetch a specific release by tag
      const tagRes = await fetch(
        `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
        { headers, next: { revalidate: 300 } }
      );
      console.log("[download] /releases/tags/ status:", tagRes.status);

      if (tagRes.ok) {
        release = await tagRes.json();
      } else {
        // Tag might belong to a draft, search all releases
        const allRes = await fetch(
          `https://api.github.com/repos/${repo}/releases?per_page=30`,
          { headers, next: { revalidate: 300 } }
        );
        if (allRes.ok) {
          const all: GitHubRelease[] = await allRes.json();
          release = all.find((r) => r.tag_name === tag) || null;
        }
      }
    } else {
      // Try latest published release
      const latestRes = await fetch(
        `https://api.github.com/repos/${repo}/releases/latest`,
        { headers, next: { revalidate: 300 } }
      );

      if (latestRes.ok) {
        release = await latestRes.json();
      } else {
        // Fall back to first release with assets
        const allRes = await fetch(
          `https://api.github.com/repos/${repo}/releases?per_page=10`,
          { headers, next: { revalidate: 300 } }
        );

        if (allRes.ok) {
          const releases: GitHubRelease[] = await allRes.json();
          release = releases.find((r) => r.assets.length > 0) || null;
        }
      }
    }

    if (!release) {
      return NextResponse.json({ error: "No release found" }, { status: 404 });
    }

    const asset = matchPlatformAsset(release.assets, platform);
    console.log("[download] Asset match:", asset?.name ?? "NO MATCH");

    if (!asset) {
      return NextResponse.json(
        { error: `No ${platform} asset found in release ${release.tag_name}` },
        { status: 404 }
      );
    }

    // Fetch the asset binary  - GitHub returns a 302 redirect to a signed S3 URL
    console.log("[download] Fetching asset from:", asset.url);
    const assetRes = await fetch(asset.url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: "application/octet-stream",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "manual",
    });

    console.log("[download] Asset fetch status:", assetRes.status);

    const redirectUrl = assetRes.headers.get("location");

    if (redirectUrl) {
      return NextResponse.redirect(redirectUrl);
    }

    // If no redirect, proxy the response directly
    const body = await assetRes.arrayBuffer();
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.name}"`,
        "Content-Length": String(asset.size),
      },
    });
  } catch (err) {
    console.error("[download] Exception:", err);
    return NextResponse.json(
      { error: "Failed to fetch download" },
      { status: 500 }
    );
  }
}
