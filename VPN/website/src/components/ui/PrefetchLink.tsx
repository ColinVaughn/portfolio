"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ComponentProps } from "react";

/**
 * A drop-in replacement for Next.js `<Link>` that aggressively
 * prefetches the target route on hover / focus, making subsequent
 * navigations feel instant.
 *
 * Next.js default `<Link>` only prefetches when the element scrolls
 * into the viewport and only fetches the loading shell. This component
 * triggers a full prefetch on pointer-enter so the entire page payload
 * is already cached by the time the user clicks.
 */
export function PrefetchLink({
  href,
  children,
  onMouseEnter,
  onFocus,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();

  const handlePrefetch = useCallback(() => {
    if (typeof href === "string") {
      router.prefetch(href);
    }
  }, [router, href]);

  return (
    <Link
      href={href}
      onMouseEnter={(e) => {
        handlePrefetch();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        handlePrefetch();
        onFocus?.(e);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
