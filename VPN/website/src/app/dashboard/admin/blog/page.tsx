import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Plus, Edit } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog Management",
  openGraph: {
    title: "Blog Management | Admin",
    description: "Manage Tunnely blog posts.",
    url: "/dashboard/admin/blog",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default async function AdminBlogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (!roleData || roleData.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("id, title, status, published_at, blog_categories(name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black mb-1">Blog Management</h1>
          <p className="text-text-dim text-sm">Create, edit, and publish posts to the main marketing blog.</p>
        </div>
        <Link href="/dashboard/admin/blog/new">
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            New Post
          </Button>
        </Link>
      </div>

      <div className="border border-white/[0.08] bg-[#161616] rounded-2xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/[0.08] bg-white/[0.02]">
              <th className="px-6 py-4 text-xs font-bold text-text-dim uppercase tracking-wider">Title</th>
              <th className="px-6 py-4 text-xs font-bold text-text-dim uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-text-dim uppercase tracking-wider">Category</th>
              <th className="px-6 py-4 text-xs font-bold text-text-dim uppercase tracking-wider">Published</th>
              <th className="px-6 py-4 text-xs font-bold text-text-dim uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(posts || []).length > 0 ? (
              posts!.map(post => (
                <tr key={post.id} className="border-b border-white/[0.08] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-bold text-white text-sm">{post.title}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${
                      post.status === 'published' ? 'bg-success/20 text-success' : 'bg-white/10 text-white'
                    }`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-dim">{(post.blog_categories as any)?.name || 'Unknown'}</td>
                  <td className="px-6 py-4 text-sm text-text-dim font-mono">
                    {post.published_at ? new Date(post.published_at).toLocaleDateString() : ' -'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/dashboard/admin/blog/${post.id}`}>
                      <button className="text-text-dim hover:text-white transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-text-dim text-sm">
                  No blog posts found. Create your first post to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
