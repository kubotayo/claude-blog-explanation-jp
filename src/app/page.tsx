/**
 * トップページ（記事一覧）
 * Server Component で Firestore から記事を取得してフィルタリングする。
 * ISR で1時間ごとに再生成することで、パフォーマンスとデータ鮮度を両立する。
 */
import { Suspense } from "react";
import { getArticles } from "@/lib/firestore";
import ArticleCard from "@/components/ArticleCard";
import FilterBar from "@/components/FilterBar";
import type { ImportanceScore, TargetAudience } from "@/types/article";

// ISR: 1時間ごとに再生成する
export const revalidate = 3600;

type SearchParams = Promise<{
  score?: string;
  audience?: string;
}>;

type Props = {
  searchParams: SearchParams;
};

export default async function HomePage({ searchParams }: Props) {
  // Next.js 15 では searchParams は Promise 型のため await が必要
  const { score, audience } = await searchParams;

  // Firestore から全記事を取得する（importanceScore 降順ソート済み）
  const allArticles = await getArticles();

  // サーバーサイドでフィルタリングを適用する
  const filteredArticles = allArticles.filter((article) => {
    // 重要度スコアフィルター
    if (score && article.importanceScore !== (score as ImportanceScore)) {
      return false;
    }
    // 対象読者フィルター
    if (audience && !article.targetAudience.includes(audience as TargetAudience)) {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* FilterBar は useSearchParams を使うため Suspense でラップする */}
      <Suspense fallback={<div className="h-20" />}>
        <FilterBar />
      </Suspense>

      {/* 記事カード一覧 */}
      {filteredArticles.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">まだ記録がありません。</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
