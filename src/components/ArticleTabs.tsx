"use client";

/**
 * 記事詳細ページのタブUI コンポーネント
 * 「記事解説」タブと「動画まとめ」タブを切り替えて表示する。
 * 動画まとめデータがない記事（videoSummaries が空）ではタブを表示せず、
 * 記事解説のみを表示してレイアウトを崩さないようにする。
 */
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Article } from "@/types/article";

type Props = {
  article: Article;
};

/** タブの識別子型 */
type TabId = "article" | "video";

export default function ArticleTabs({ article }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("article");

  // 動画まとめがない記事はタブを表示せず記事解説のみを直接レンダリングする
  const hasVideoSummaries = article.videoSummaries.length > 0;

  return (
    <div>
      {/* タブヘッダー: 動画まとめがある記事のみ表示する */}
      {hasVideoSummaries && (
        <div className="flex border-b border-gray-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("article")}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "article"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            記事解説
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("video")}
            className={[
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === "video"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            動画まとめ
          </button>
        </div>
      )}

      {/* 記事解説タブ（タブなし記事は常に表示、タブあり記事はアクティブ時のみ表示） */}
      {(!hasVideoSummaries || activeTab === "article") && (
        <ArticleContent article={article} />
      )}

      {/* 動画まとめタブ（動画がある記事でアクティブ時のみ表示） */}
      {hasVideoSummaries && activeTab === "video" && (
        <VideoSummaryContent article={article} />
      )}
    </div>
  );
}

/**
 * 記事解説タブのコンテンツ
 * 詳細解説・ポイントまとめ・日本での活用イメージを表示する
 */
function ArticleContent({ article }: Props) {
  return (
    <div>
      {/* 詳細解説（Markdown レンダリング） */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">詳細解説</h2>
        <div className="prose prose-slate max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.detailedExplanation}
          </ReactMarkdown>
        </div>
      </section>

      {/* ポイントまとめ（エンジニア向け・ビジネス向けを2カラム） */}
      {(article.keyPointsEngineer.length > 0 ||
        article.keyPointsBusiness.length > 0) && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">ポイントまとめ</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* エンジニア向けポイント */}
            {article.keyPointsEngineer.length > 0 && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                <h3 className="text-sm font-bold text-green-800 mb-3">
                  エンジニア向け
                </h3>
                <ul className="space-y-2">
                  {article.keyPointsEngineer.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="mt-0.5 text-green-600 flex-shrink-0">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ビジネス向けポイント */}
            {article.keyPointsBusiness.length > 0 && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
                <h3 className="text-sm font-bold text-purple-800 mb-3">
                  ビジネス向け
                </h3>
                <ul className="space-y-2">
                  {article.keyPointsBusiness.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="mt-0.5 text-purple-600 flex-shrink-0">✓</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 日本での活用イメージ */}
      {article.japanUseCases && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            日本での活用イメージ
          </h2>
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {article.japanUseCases}
            </ReactMarkdown>
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * 動画まとめタブのコンテンツ
 * 複数動画に対応し、各動画の YouTube 埋め込みプレーヤーと日本語まとめを表示する
 */
function VideoSummaryContent({ article }: Props) {
  return (
    <div className="space-y-10">
      {article.videoSummaries.map((vs) => (
        <section key={vs.videoId}>
          {/* YouTube 埋め込みプレーヤー
              aspect-video（16:9）で表示し、全画面再生を許可する
              セキュリティ向上のため allow 属性でパーミッションを明示する */}
          <div className="relative w-full aspect-video mb-4 rounded-xl overflow-hidden bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${vs.videoId}`}
              title={`YouTube video ${vs.videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            />
          </div>

          {/* 動画の日本語まとめ（Markdown レンダリング） */}
          <div className="prose prose-slate max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {vs.japaneseSummary}
            </ReactMarkdown>
          </div>
        </section>
      ))}
    </div>
  );
}
