import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const metadata: Metadata = {
  title: "Blog Editor | Admin",
  openGraph: {
    title: "Blog Editor | Admin",
    description: "Create or edit Tunnely blog posts.",
    url: "/dashboard/admin/blog",
    type: "website",
    siteName: "Tunnely",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
};

export default async function AdminBlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Fetch categories for the editor dropdown
  const { data: categories } = await supabase
    .from("blog_categories")
    .select("id, name")
    .order("name");

  let initialData = null;

  // If "new", it's a creation flow
  if (id !== "new") {
    const { data: post, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !post) {
      notFound();
    }
    initialData = post;
  }

  return (
    <div className="pt-4">
      <BlogEditor
        initialData={initialData}
        categories={categories || []}
      />
    </div>
  );
}
