import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contributing Guidelines | Tunnely Docs",
  description: "Contribute to the Tunnely ecosystem. Read our guidelines on pull requests, reporting vulnerabilities, and submitting cryptographic improvement proposals.",
  keywords: ["tunnely contributing", "open source vpn", "tunnely pull requests", "report vulnerability vpn", "rust vpn contribution", "tunnely oss"],
  openGraph: {
    title: "Contributing Guidelines | Tunnely Docs",
    description: "Contribute to the Tunnely ecosystem. Read our guidelines on pull requests, reporting vulnerabilities, and submitting cryptographic improvement proposals.",
    url: "/docs/contributing",
    type: "website",
    siteName: "Tunnely Docs",
    images: [{ url: "/images/og-default.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contribute to Tunnely",
    description: "Help build the leading decentralized privacy network.",
  }
};

export default function ContributingDocs() {
  return (
    <div className="prose prose-invert prose-custom max-w-none">
      <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-8 border-b border-white/[0.08] pb-8">
        <span className="text-primary">Contributing</span>
      </h1>
      
      <p className="text-lg text-text-dim border-l-2 border-primary/30 pl-4 py-2 bg-[#121212] mb-12">
        We welcome code contributions, cryptographic audits, and architectural proposals from the open source community to strengthen the Tunnely network.
      </p>

      <h2>Pull Request Process</h2>
      <p>
        If you have successfully built the application locally and wish to submit a patch, please follow standard GitHub flow:
      </p>
      <ol>
        <li><strong>Fork</strong> the specific repository (<code>tunnely-client</code> or <code>tunnely-relay</code>).</li>
        <li><strong>Branch</strong> off of <code>main</code> with a descriptive title (e.g., <code>feature/mesh-optimization</code> or <code>bugfix/linux-dns-leak</code>).</li>
        <li><strong>Commit</strong> your changes using conventional commit styling.</li>
        <li><strong>Pull Request</strong> against the trunk. Ensure your PR description clearly outlines the problem being solved and the testing methodology you utilized.</li>
      </ol>

      <div className="p-6 border border-white/[0.08] bg-[#0A0A0A] mt-8 mb-8">
        <h3 className="m-0 mb-4 uppercase tracking-widest text-[#a1a1aa] text-xs font-bold">Code Reviews</h3>
        <p className="text-sm m-0 text-text-dim">
          Due to the critical privacy nature of this software, all PRs must pass comprehensive CI unit/integration tests and receive sign-off from at least two core cryptographic maintainers before merging.
        </p>
      </div>

      <h2>Vulnerability Disclosure Policy</h2>
      <p>
        If you discover a fundamental flaw in our WireGuard implementation, a method to deanonymize traffic paths, or a vulnerability in our API auth vectors, <strong>do not open a public GitHub issue.</strong>
      </p>
      <p>
        Instead, securely disclose the vulnerability to our security team via encrypted email.
      </p>
      
      <div className="p-4 bg-[#121212] border-l-4 border-red-500 font-mono text-sm inline-block">
        <div className="text-white mb-1"><span className="text-red-500 font-bold">Email:</span> security@tunnely.org</div>
        <div className="text-text-dim"><span className="text-white">PGP Key:</span> 0x8F3A22C99B8E4D5A</div>
      </div>

      <p className="mt-8">
        We maintain a bug bounty program. Valid disclosures indicating critical infrastructural vulnerabilities are eligible for significant bounties, paid out via cryptocurrency or USD. We provide safe harbor for researchers conducting good-faith network penetration testing on explicit testnet nodes.
      </p>

    </div>
  );
}
