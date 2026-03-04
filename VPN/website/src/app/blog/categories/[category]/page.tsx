import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogCard } from "@/components/blog/BlogCard";
import { CategoryFilter } from "@/components/blog/CategoryFilter";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("blog_categories")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!category) return { title: "Category Not Found" };

  return {
    title: `${category.name}  - Blog`,
    description: category.description || `Articles about ${category.name}`,
    openGraph: {
      title: `${category.name}  - Tunnely Blog`,
      description: category.description || `Read articles about ${category.name} from the Tunnely engineering team.`,
      url: `/blog/categories/${slug}`,
      type: "website",
      siteName: "Tunnely",
      images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name}  - Tunnely Blog`,
      description: category.description || `Read articles about ${category.name} from the Tunnely engineering team.`,
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { category: slug } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("blog_categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  const { data: categories } = await supabase
    .from("blog_categories")
    .select("*")
    .order("name");

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("*, blog_categories(name, slug)")
    .eq("status", "published")
    .eq("category_id", category.id)
    .order("published_at", { ascending: false });

  return (
    <>
      <Navbar />
      <main className="pt-16 bg-[#121212] min-h-screen">
        <section className="py-24 relative border-b border-white/[0.08]">
          <div className="relative max-w-7xl mx-auto px-6 text-center">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-text-dim hover:text-white transition-colors mb-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={3} />
              All Posts
            </Link>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary mb-6 uppercase tracking-tight">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-lg text-text-dim max-w-2xl mx-auto font-mono">
                {category.description}
              </p>
            )}
          </div>
        </section>

        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6">
            <CategoryFilter
              categories={categories || []}
              activeSlug={slug}
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
                <p className="text-text-dim font-mono tracking-widest uppercase">No posts in this category yet.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
