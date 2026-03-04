import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { BlogContent } from "@/components/blog/BlogContent";
import { Calendar, Clock, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { generateArticleLD } from "@/lib/utils/structured-data";
import Link from "next/link";

export const revalidate = 86400; // 24h, with on-demand revalidation

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const db = createAdminClient();
    const { data: posts } = await db
      .from("blog_posts")
      .select("slug")
      .eq("status", "published");

    return (posts ?? []).map((post) => ({ slug: post.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, excerpt, meta_title, meta_description, cover_image_url, published_at, author_name, tags")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) return { title: "Post Not Found" };

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    keywords: post.tags?.join(", ") || "",
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || "",
      type: "article",
      url: `/blog/${slug}`,
      siteName: "Tunnely",
      publishedTime: post.published_at || undefined,
      authors: [post.author_name],
      images: post.cover_image_url ? [{ url: post.cover_image_url, width: 1200, height: 630 }] : [{ url: "/images/og-default.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || "",
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("*, blog_categories(name, slug)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!post) notFound();

  const articleLD = generateArticleLD({
    title: post.title,
    published_at: post.published_at,
    updated_at: post.updated_at,
    author_name: post.author_name,
    cover_image_url: post.cover_image_url,
    excerpt: post.excerpt,
    tags: post.tags,
  });

  return (
    <>
      <Navbar />
      <main className="pt-16 bg-[#121212] min-h-screen">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLD) }}
        />

        <article className="max-w-3xl mx-auto px-6 py-24">
          {/* Back link */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-text-dim hover:text-white transition-colors mb-12"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={3} />
            Back to Overview
          </Link>

          {/* Category */}
          {post.blog_categories && (
            <div className="mb-6 inline-flex items-center gap-2 px-2 py-0.5 border border-primary/30 bg-primary/10">
               <span className="w-1.5 h-1.5 bg-primary rounded-none" />
               <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
                 {(post.blog_categories as { name: string }).name}
               </span>
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-8 tracking-tight uppercase">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-6 text-xs font-mono text-text-dim mb-12 uppercase tracking-wider py-4 border-y border-white/[0.08]">
            <span className="font-bold text-white">{post.author_name}</span>
            {post.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {post.reading_time_min && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                {post.reading_time_min}M READ
              </span>
            )}
          </div>

          {/* Cover Image */}
          {post.cover_image_url && (
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full grayscale opacity-80 rounded-none mb-16 border border-white/[0.08]"
            />
          )}

          {/* Content */}
          <div className="prose prose-invert prose-p:font-mono prose-p:text-text-dim prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-a:text-primary max-w-none">
            <BlogContent content={post.content} />
          </div>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-16 pt-8 border-t border-white/[0.08]">
              {post.tags.map((tag: string) => (
                <span key={tag} className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest text-text-dim border border-white/[0.08] bg-white/[0.02]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </article>
      </main>
      <Footer />

    </>
  );
}
