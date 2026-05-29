"use client";

/**
 * フィルターバーコンポーネント（Client Component）
 * 重要度スコア・対象読者でフィルタリングする。
 * URL クエリパラメータを操作することで、ページ遷移なしにフィルターを反映できる。
 */
import { useSearchParams, useRouter } from "next/navigation";

/** 重要度スコアの選択肢 */
const SCORE_OPTIONS = [
  { value: "", label: "全て" },
  { value: "S", label: "重要度 S" },
  { value: "A", label: "重要度 A" },
  { value: "B", label: "重要度 B" },
  { value: "C", label: "重要度 C" },
];

/** 対象読者の選択肢 */
const AUDIENCE_OPTIONS = [
  { value: "", label: "全て" },
  { value: "engineer", label: "エンジニア向け" },
  { value: "business", label: "ビジネス向け" },
  { value: "general", label: "一般向け" },
  { value: "researcher", label: "研究者向け" },
];

export default function FilterBar() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentScore = searchParams.get("score") ?? "";
  const currentAudience = searchParams.get("audience") ?? "";

  /**
   * フィルター選択時に URL クエリパラメータを更新する
   * 空文字列の場合はパラメータを削除する
   */
  const handleFilter = (key: "score" | "audience", value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : "/");
  };

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* 重要度フィルター */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          重要度
        </p>
        <div className="flex flex-wrap gap-2">
          {SCORE_OPTIONS.map(({ value, label }) => {
            const isActive = currentScore === value;
            return (
              <button
                key={value}
                onClick={() => handleFilter("score", value)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                  isActive
                    ? "bg-[#0f3460] text-white border-[#0f3460]"
                    : "bg-white text-gray-700 border-gray-400 hover:border-[#0f3460] hover:text-[#0f3460]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 対象読者フィルター */}
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
          対象読者
        </p>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_OPTIONS.map(({ value, label }) => {
            const isActive = currentAudience === value;
            return (
              <button
                key={value}
                onClick={() => handleFilter("audience", value)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
                  isActive
                    ? "bg-[#0f3460] text-white border-[#0f3460]"
                    : "bg-white text-gray-700 border-gray-400 hover:border-[#0f3460] hover:text-[#0f3460]"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
