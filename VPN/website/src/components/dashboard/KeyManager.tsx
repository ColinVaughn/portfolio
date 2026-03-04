"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Copy, Check, Plus, Loader2, Key } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

interface TrialKey {
  id: string;
  trial_key: string;
  status: "active" | "converted" | "expired";
  created_at: string;
}

export function KeyManager() {
  const [keys, setKeys] = useState<TrialKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/integrator/keys");
      const data = await res.json();
      if (data.trials) setKeys(data.trials);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const generateKey = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/integrator/keys", { method: "POST" });
      const data = await res.json();
      if (data.trial) {
        setKeys((prev) => [data.trial, ...prev]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Generated Trial Keys</h3>
        <Button onClick={generateKey} disabled={generating} size="sm" variant="primary">
          {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
          Generate Key
        </Button>
      </div>

      {keys.length === 0 ? (
        <div className="text-center py-8 border border-white/[0.08] rounded-lg bg-[#121212]">
          <Key className="w-8 h-8 text-text-dim mx-auto mb-3" />
          <p className="text-sm text-text-dim">No keys generated yet.</p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden bg-[#121212]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#161616] border-b border-white/[0.08]">
              <tr>
                <th className="font-mono text-[10px] text-text-dim uppercase tracking-widest px-4 py-3">Trial Key</th>
                <th className="font-mono text-[10px] text-text-dim uppercase tracking-widest px-4 py-3">Status</th>
                <th className="font-mono text-[10px] text-text-dim uppercase tracking-widest px-4 py-3">Created</th>
                <th className="font-mono text-[10px] text-text-dim uppercase tracking-widest px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.08]">
              {keys.map((k) => (
                <tr key={k.id} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-white text-xs whitespace-nowrap">{k.trial_key}</td>
                  <td className="px-4 py-3">
                    <Badge variant={k.status === "converted" ? "success" : k.status === "expired" ? "danger" : "default"}>
                      {k.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-text-dim text-xs">
                    {new Date(k.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => copyToClipboard(k.id, k.trial_key)}
                      className="text-text-dim hover:text-white transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === k.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
