"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, RefreshCw, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type ExternalArticle = {
  title: string;
  url: string;
  date: string;
  slug: string;
  exists: boolean;
};

export default function ImportNyhederClient() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [articles, setArticles] = useState<ExternalArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/import-news?year=${year}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fejl");
      setArticles(data.articles);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kunne ikke hente artikler");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  async function handleImport(article: ExternalArticle) {
    setImporting((prev) => new Set(prev).add(article.slug));
    try {
      const res = await fetch("/api/admin/import-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleUrl: article.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fejl");

      toast.success(`"${article.title}" importeret`);
      setArticles((prev) =>
        prev.map((a) => (a.slug === article.slug ? { ...a, exists: true } : a)),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import fejlede");
    } finally {
      setImporting((prev) => {
        const next = new Set(prev);
        next.delete(article.slug);
        return next;
      });
    }
  }

  async function handleImportAll() {
    const newArticles = articles.filter((a) => !a.exists);
    for (const article of newArticles) {
      await handleImport(article);
    }
  }

  const newCount = articles.filter((a) => !a.exists).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        <a href="/admin/nyheder" className="text-sm text-gray-500 hover:text-secondary">
          ← Nyheder
        </a>
        <h1 className="text-3xl font-bold">Importer nyheder</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Henter nyheder fra{" "}
        <a
          href="https://live-911-vorbasse-b-af-1912.umbraco-proxy.com/nyheder/klub-nyheder/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-secondary underline"
        >
          vorbassebk.dk
        </a>{" "}
        og importerer dem som nyheder på denne side.
      </p>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-6">
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        >
          <option value="2026">2026</option>
          <option value="2025">2025</option>
        </select>

        <button
          onClick={fetchArticles}
          disabled={loading}
          className="flex items-center gap-2 border rounded-lg px-4 py-2 text-sm hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Opdater
        </button>

        {newCount > 0 && (
          <button
            onClick={handleImportAll}
            disabled={loading || importing.size > 0}
            className="flex items-center gap-2 bg-secondary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary-dark transition disabled:opacity-50"
          >
            <Download size={14} />
            Importer alle nye ({newCount})
          </button>
        )}
      </div>

      {/* Article list */}
      {loading && articles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Henter artikler…</div>
      ) : articles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Ingen artikler fundet for {year}</div>
      ) : (
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Titel</th>
                <th className="px-4 py-3 font-medium whitespace-nowrap">Dato</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {articles.map((article) => {
                const isImporting = importing.has(article.slug);
                return (
                  <tr
                    key={article.slug}
                    className={article.exists ? "bg-gray-50/50" : ""}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={`font-medium ${article.exists ? "text-gray-400" : "text-gray-800"}`}
                        >
                          {article.title}
                        </span>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-gray-300 hover:text-secondary mt-0.5"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{article.date}</td>
                    <td className="px-4 py-3">
                      {article.exists ? (
                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                          <CheckCircle size={13} />
                          Importeret
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">Ny</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!article.exists && (
                        <button
                          onClick={() => handleImport(article)}
                          disabled={isImporting}
                          className="flex items-center gap-1.5 ml-auto bg-primary text-secondary px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-dark transition disabled:opacity-50"
                        >
                          <Download size={12} />
                          {isImporting ? "Importerer…" : "Importer"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Artikler importeres med deres originale publiceringsdato og er synlige med det samme.
        Du kan redigere dem i{" "}
        <a href="/admin/nyheder" className="underline">nyheder-oversigten</a>.
      </p>
    </div>
  );
}
