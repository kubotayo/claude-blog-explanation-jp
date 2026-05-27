/**
 * 記事一覧カードコンポーネント（Server Component）
 * 重要度 S の記事はアンバー系で強調表示する
 */
import Link from "next/link";
import type { Article } from "@/types/article";
import ImportanceBadge from "./ImportanceBadge";
import AudienceBadge from "./AudienceBadge";

type Props = {
  article: Article;
};

/** 公開日を日本語表示にフォーマットする */
function formatDate(date: Date | null): string {
  if (!date) return "";
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ArticleCard({ article }: Props) {
  // 重要度 S の記事は強調スタイルを適用する（ユーザーが一目で重要記事を識別できるように）
  const isTopPriority = article.importanceScore === "S";
  const cardClasses = isTopPriority
    ? "rounded-xl border border-amber-300 bg-amber-50 p-4 hover:shadow-md transition"
    : "rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition";

  return (
    <Link href={`/articles/${article.id}`} className="block">
      <article className={cardClasses}>
        {/* バッジ行: 重要度 + 対象読者 */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <ImportanceBadge score={article.importanceScore} />
          {article.targetAudience.map((audience) => (
            <AudienceBadge key={audience} audience={audience} />
          ))}
        </div>

        {/* 日本語タイトル */}
        <h2 className="text-base font-semibold text-gray-900 leading-snug mb-2">
          {article.japaneseTitle}
        </h2>

        {/* 要約（2行でクリップ） */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {article.summary}
        </p>

        {/* フッター: 公開日・著者 */}
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {article.originalPublishedAt && (
            <time dateTime={article.originalPublishedAt.toISOString()}>
              {formatDate(article.originalPublishedAt)}
            </time>
          )}
          {article.originalPublishedAt && article.author && (
            <span>·</span>
          )}
          {article.author && <span>{article.author}</span>}
        </div>
      </article>
    </Link>
  );
}
