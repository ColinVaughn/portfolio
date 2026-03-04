"use client";

import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { Calendar, Clock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  cover_image_url: string | null;
  author_name: string;
  published_at: string | null;
  reading_time_min: number | null;
  tags: string[];
  blog_categories: { name: string; slug: string } | null;
}

export function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col h-full">
      <article className="h-full flex flex-col">
        {/* Cover */}
        {post.cover_image_url ? (
          <div className="aspect-[16/9] overflow-hidden border border-white/[0.08] mb-6">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-[#0A0A0A] border border-white/[0.08] flex items-center justify-center mb-6">
            <Lock className="w-8 h-8 text-white/[0.1] group-hover:text-primary transition-colors" />
          </div>
        )}

        <div className="flex-1 flex flex-col">
          {/* Category */}
          {post.blog_categories && (
            <div className="mb-4 inline-flex items-center gap-2 px-2 py-0.5 border border-primary/30 bg-primary/10">
               <span className="w-1.5 h-1.5 bg-primary rounded-none" />
               <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
                 {post.blog_categories.name}
               </span>
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl font-bold text-white mb-3 group-hover:text-primary transition-colors leading-tight">
            {post.title}
          </h2>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-sm text-text-dim line-clamp-3 mb-6 flex-1 font-mono">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs font-mono text-text-dim/80 mt-auto pt-4 border-t border-white/[0.08] uppercase tracking-wider">
            <span className="font-bold text-text-dim">{post.author_name}</span>
            {post.published_at && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                {new Date(post.published_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            {post.reading_time_min && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                {post.reading_time_min}M
              </span>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}
