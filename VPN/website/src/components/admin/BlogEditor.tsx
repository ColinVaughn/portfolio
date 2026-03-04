"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface BlogEditorProps {
  initialData?: any;
  categories: Category[];
}

export function BlogEditor({ initialData, categories }: BlogEditorProps) {
  const router = useRouter();
  const supabase = createClient();
  const isEditing = !!initialData;

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    slug: initialData?.slug || "",
    excerpt: initialData?.excerpt || "",
    cover_image_url: initialData?.cover_image_url || "",
    category_id: initialData?.category_id || "",
    status: initialData?.status || "draft",
    content: initialData?.content || "",
    author_name: initialData?.author_name || "Admin",
    reading_time_min: initialData?.reading_time_min || 5,
    meta_title: initialData?.meta_title || "",
    meta_description: initialData?.meta_description || "",
    keywords: (initialData?.tags || []).join(", "),
  });

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setFormData(prev => ({
      ...prev,
      title: newTitle,
      // Only auto-generate slug if not editing an existing post
      ...( !isEditing && { slug: generateSlug(newTitle) } )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthenticated");

      // Destructure keywords out of the frontend state, it's not a database column.
      const { keywords, ...formFields } = formData;

      const payload = {
        ...formFields,
        tags: keywords.split(",").map((k: string) => k.trim()).filter(Boolean),
        author_id: user.id,
        // If status changed to published, set published_at
        ...(formData.status === "published" && !initialData?.published_at && {
          published_at: new Date().toISOString()
        })
      };

      if (isEditing) {
        const { error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("blog_posts")
          .insert([payload]);
        if (error) throw error;
      }

      router.push("/dashboard/admin/blog");
      router.refresh();
    } catch (err: any) {
      alert("Error saving post: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-text-dim hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Posts
        </button>
        <Button type="submit" disabled={isLoading} className="flex items-center gap-2">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {isEditing ? "Update Post" : "Create Post"}
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-4">
            <input
              type="text"
              required
              placeholder="Post Title..."
              value={formData.title}
              onChange={handleTitleChange}
              className="w-full text-2xl font-black bg-transparent border-t-0 border-x-0 border-b-2 border-white/[0.08] focus:border-primary rounded-none px-0 py-4 h-auto shadow-none placeholder:text-text-dim/30 focus:outline-none"
            />
            <div className="flex items-center gap-2 text-sm text-text-dim font-mono">
              <span>/blog/</span>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                className="flex-1 bg-transparent border-none px-0 h-auto shadow-none focus-visible:ring-0 text-white focus:outline-none"
              />
            </div>
          </div>

          <div>
            <textarea
              required
              placeholder="Write your markdown content here..."
              value={formData.content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              className="w-full h-[600px] bg-[#161616] border border-white/[0.08] rounded-xl p-6 text-sm font-mono leading-relaxed text-text resize-y focus:outline-none focus:border-primary transition-colors"
            />
          </div>
        </div>

        {/* Sidebar Metadata */}
        <div className="space-y-6 bg-[#161616] p-6 rounded-2xl border border-white/[0.05]">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Status</label>
            <select
              value={formData.status}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Category</label>
            <select
              required
              value={formData.category_id}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-primary"
            >
              <option value="" disabled>Select a category...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Author Identity</label>
            <input
              type="text"
              required
              value={formData.author_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, author_name: e.target.value }))}
              className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Cover Image URL</label>
            <input
              type="text"
              placeholder="https://..."
              value={formData.cover_image_url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, cover_image_url: e.target.value }))}
              className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Excerpt</label>
            <textarea
              required
              rows={4}
              value={formData.excerpt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-3 text-sm text-text resize-y focus:outline-none focus:border-primary"
            />
            <div className="space-y-4 pt-4 border-t border-white/[0.08]">
             <h3 className="text-sm font-black text-white uppercase tracking-wider">SEO Details</h3>
             <div className="space-y-2">
                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Meta Title</label>
                <input
                  type="text"
                  placeholder="Overrides main title in search results..."
                  value={formData.meta_title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, meta_title: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Meta Description</label>
                <textarea
                  rows={3}
                  placeholder="Defaults to Excerpt if left blank..."
                  value={formData.meta_description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, meta_description: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-3 text-sm text-text resize-y focus:outline-none focus:border-primary"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Keywords</label>
                <input
                  type="text"
                  placeholder="privacy, security, vpn, protocols..."
                  value={formData.keywords}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
                  className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
                />
                <p className="text-[10px] uppercase font-mono tracking-widest text-text-dim mt-1">Comma-separated matrix. Ingested globally.</p>
             </div>
          </div>
        </div>
          
           <div className="space-y-2">
            <label className="text-xs font-bold text-text-dim uppercase tracking-wider">Est. Reading Time (min)</label>
            <input
              type="number"
              min="1"
              required
              value={formData.reading_time_min}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, reading_time_min: parseInt(e.target.value) }))}
              className="w-full bg-[#121212] border border-white/[0.08] rounded-lg p-2 text-sm text-white focus:outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>
    </form>
  );
}
