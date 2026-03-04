import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { slug, type } = await request.json();

    if (type === "blog_post" && slug) {
      revalidatePath(`/blog/${slug}`);
      revalidatePath("/blog");
      revalidatePath("/sitemap.xml");
    } else if (type === "blog_post") {
      revalidatePath("/blog");
      revalidatePath("/sitemap.xml");
    }

    return NextResponse.json({ revalidated: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to revalidate" },
      { status: 500 }
    );
  }
}
