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
    classes: "bg-green-700 text-white",
    label: "エンジニア向け",
  },
  business: {
    classes: "bg-purple-700 text-white",
    label: "ビジネス向け",
  },
  general: {
    classes: "bg-pink-600 text-white",
    label: "一般向け",
  },
  researcher: {
    classes: "bg-teal-600 text-white",
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
