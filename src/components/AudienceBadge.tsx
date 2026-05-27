/**
 * 対象読者バッジコンポーネント
 * engineer / business / general / researcher の4種別でスタイルを変える
 */
import type { TargetAudience } from "@/types/article";

type Props = {
  audience: TargetAudience;
};

/** 対象読者種別に対応するスタイルクラスとラベルのマッピング */
const AUDIENCE_STYLE: Record<TargetAudience, { classes: string; label: string }> = {
  engineer: {
    classes: "bg-green-50 text-green-800 border border-green-200",
    label: "エンジニア向け",
  },
  business: {
    classes: "bg-purple-50 text-purple-800 border border-purple-200",
    label: "ビジネス向け",
  },
  general: {
    classes: "bg-pink-50 text-pink-800 border border-pink-200",
    label: "一般向け",
  },
  researcher: {
    classes: "bg-teal-50 text-teal-800 border border-teal-200",
    label: "研究者向け",
  },
};

export default function AudienceBadge({ audience }: Props) {
  const { classes, label } = AUDIENCE_STYLE[audience] ?? AUDIENCE_STYLE["general"];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${classes}`}
    >
      {label}
    </span>
  );
}
