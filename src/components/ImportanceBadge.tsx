/**
 * 重要度スコアバッジコンポーネント
 * S/A/B/C の4段階でスタイルを変える
 */
import type { ImportanceScore } from "@/types/article";

type Props = {
  score: ImportanceScore;
};

/** 重要度スコアに対応するスタイルクラスとラベルのマッピング */
const SCORE_STYLE: Record<ImportanceScore, { classes: string; label: string }> = {
  S: {
    classes: "bg-red-50 text-red-700 border border-red-200",
    label: "重要度 S",
  },
  A: {
    classes: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "重要度 A",
  },
  B: {
    classes: "bg-blue-50 text-blue-700 border border-blue-200",
    label: "重要度 B",
  },
  C: {
    classes: "bg-gray-100 text-gray-600 border border-gray-300",
    label: "重要度 C",
  },
};

export default function ImportanceBadge({ score }: Props) {
  const { classes, label } = SCORE_STYLE[score] ?? SCORE_STYLE["C"];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${classes}`}
    >
      {label}
    </span>
  );
}
