/**
 * 記事詳細ページ
 * Server Component で Firestore から1件の記事を取得して表示する。
 * ISR で1時間ごとに再生成する。
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticleById } from "@/lib/firestore";
import ImportanceBadge from "@/components/ImportanceBadge";
import AudienceBadge from "@/components/AudienceBadge";
import ArticleTabs from "@/components/ArticleTabs";

// ISR: 1時間ごとに再生成する
export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

/** 日付を日本語形式にフォーマットする */
function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ArticleDetailPage({ params }: Props) {
  // Next.js 15 では params は Promise 型のため await が必要
  const { id } = await params;
  const article = await getArticleById(id);

  // 記事が存在しない場合は 404 を返す
  if (!article) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* ← 一覧に戻るリンク */}
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-gray-700 hover:text-gray-800 mb-6 transition"
      >
        ← 一覧に戻る
      </Link>

      {/* バッジ行 + 公開日・著者・カテゴリ */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ImportanceBadge score={article.importanceScore} />
        {article.targetAudience.map((audience) => (
          <AudienceBadge key={audience} audience={audience} />
        ))}
        {article.originalPublishedAt && (
          <time
            dateTime={article.originalPublishedAt.toISOString()}
            className="text-xs text-gray-600"
          >
            {formatDate(article.originalPublishedAt)}
          </time>
        )}
        {article.author && (
          <span className="text-xs text-gray-600">· {article.author}</span>
        )}
        {article.category && (
          <span className="text-xs text-gray-600">· {article.category}</span>
        )}
      </div>

      {/* 日本語タイトル */}
      <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-2">
        {article.japaneseTitle}
      </h1>

      {/* 原文タイトル */}
      <p className="text-sm text-gray-600 mb-6">{article.originalTitle}</p>

      {/* 要約ボックス */}
      <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-lg p-4 mb-8">
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {article.summary}
        </p>
      </div>

      {/* タブUI: 記事解説 / 動画まとめ
          動画まとめがある記事はタブ切り替えで表示し、ない記事は記事解説のみを表示する */}
      <ArticleTabs article={article} />

      {/* 原文リンクボタン */}
      <div className="border-t border-gray-200 pt-6">
        <a
          href={article.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition"
        >
          原文を読む（英語）
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
