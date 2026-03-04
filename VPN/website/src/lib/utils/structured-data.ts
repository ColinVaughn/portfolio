export function generateOrganizationLD() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Tunnely",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://tunnely.org",
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tunnely.org"}/images/logo.png`,
    sameAs: [
      "https://github.com/tunnely",
      "https://twitter.com/tunnely",
    ],
  };
}

export function generateSoftwareApplicationLD() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Tunnely",
    operatingSystem: "Windows, macOS, Linux",
    applicationCategory: "SecurityApplication",
    description:
      "Multi-hop tunnely with channel bonding for unbreakable privacy and speed.",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "19.99",
      priceCurrency: "USD",
      offerCount: "3",
    },
  };
}

export function generateArticleLD(post: {
  title: string;
  published_at: string | null;
  updated_at: string;
  author_name: string;
  cover_image_url: string | null;
  excerpt: string | null;
  tags?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    description: post.excerpt,
    keywords: post.tags?.join(", ") || "",
    author: {
      "@type": "Person",
      name: post.author_name,
    },
    image: post.cover_image_url,
    publisher: {
      "@type": "Organization",
      name: "Tunnely",
      logo: {
        "@type": "ImageObject",
        url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://tunnely.org"}/images/logo.png`,
      },
    },
  };
}

export function generateFAQPageLD(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}
