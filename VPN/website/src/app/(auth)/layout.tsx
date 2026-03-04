import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212] relative">
      <Link
        href="/"
        className="absolute top-8 left-6 md:left-8 inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-text-dim hover:text-white transition-colors z-20"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={3} />
        Back to Home
      </Link>
      <div className="relative z-10 w-full max-w-md px-6 py-12">{children}</div>
    </div>
  );
}
