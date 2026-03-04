"use client";

import { PrefetchLink as Link } from "@/components/ui/PrefetchLink";
import { cn } from "@/lib/utils/cn";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface CategoryFilterProps {
  categories: Category[];
  activeSlug?: string;
}

export function CategoryFilter({ categories, activeSlug }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/blog"
        className={cn(
          "px-4 py-2 text-sm font-bold font-mono tracking-widest uppercase rounded-none transition-all border",
          !activeSlug
            ? "bg-white text-black border-white"
            : "text-text-dim border-white/[0.08] hover:text-white hover:bg-white/[0.04]"
        )}
      >
        All
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/blog/categories/${cat.slug}`}
          className={cn(
            "px-4 py-2 text-sm font-bold font-mono tracking-widest uppercase rounded-none transition-all border",
            activeSlug === cat.slug
              ? "bg-white text-black border-white"
              : "text-text-dim border-white/[0.08] hover:text-white hover:bg-white/[0.04]"
          )}
        >
          {cat.name}
        </Link>
      ))}
    </div>
  );
}
