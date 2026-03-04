import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogCard } from "@/components/blog/BlogCard";
import { CategoryFilter } from "@/components/blog/CategoryFilter";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Engineering Blog",
  description:
    "Privacy guides, technical security deep-dives, infrastructure updates, and VPN industry insights from the Tunnely team. Read our latest engineering posts.",
  keywords: ["VPN blog", "privacy guides", "WireGuard tutorials", "network security", "tunnely blog", "cybersecurity articles"],
  openGraph: {
    title: "Engineering Blog | Tunnely",
    description:
      "Privacy methodologies, infrastructure post-mortems, and technical updates from the Tunnely engineering team.",
    url: "/blog",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Engineering Blog | Tunnely",
    description: "Privacy methodologies and technical updates from the Tunnely engineering team.",
  },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  // Fetch categories
  const { data: categories } = await supabase
    .from("blog_categories")
    .select("*")
    .order("name");

  // Fetch posts
  let query = supabase
    .from("blog_posts")
    .select("*, blog_categories(name, slug)")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (category) {
    const { data: cat } = await supabase
      .from("blog_categories")
      .select("id")
      .eq("slug", category)
      .single();

    if (cat) {
      query = query.eq("category_id", cat.id);
    }
  }

  const { data: posts } = await query;

  return (
    <>
      <Navbar />
      <main className="pt-16 bg-[#121212] min-h-screen">
        {/* Hero */}
        <section className="py-24 relative border-b border-white/[0.08]">
          <div className="relative max-w-7xl mx-auto px-6">
            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 uppercase tracking-tight">
              Engineering Blog
            </h1>
            <p className="text-lg text-text-dim max-w-2xl font-mono">
              Privacy methodologies, infrastructure post-mortems, and technical updates from the core Tunnely engineering team.
            </p>
          </div>
        </section>

        {/* Categories + Posts */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6">
            <CategoryFilter
              categories={categories || []}
              activeSlug={category}
            />

            {posts && posts.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/[0.08] border border-white/[0.08] mt-10">
                {posts.map((post) => (
                  <div key={post.id} className="bg-[#121212] flex flex-col h-full hover:bg-white/[0.02] transition-colors p-6">
                      <BlogCard post={post} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20 border border-white/[0.08] bg-[#121212] mt-10">
                <p className="text-text-dim font-mono tracking-widest uppercase">No posts found matching filter.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
