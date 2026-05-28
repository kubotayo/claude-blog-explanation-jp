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
    classes: "bg-red-600 text-white",
    label: "重要度 S",
  },
  A: {
    classes: "bg-amber-500 text-white",
    label: "重要度 A",
  },
  B: {
    classes: "bg-blue-600 text-white",
    label: "重要度 B",
  },
  C: {
    classes: "bg-gray-500 text-white",
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
