/**
 * 記事に関連する型定義
 * Claude API が生成するデータ・クロールデータ・Firestore保存データを定義する
 */

/** 対象読者の種別 */
export type TargetAudience = "engineer" | "business" | "general" | "researcher";

/** 重要度スコア（S: 最重要 〜 C: 一般情報） */
export type ImportanceScore = "S" | "A" | "B" | "C";

/** Claude API が生成するデータ（翻訳・解説コンテンツ） */
export type GeneratedArticle = {
  japaneseTitle: string;
  summary: string;
  detailedExplanation: string;   // Markdown形式の詳細解説
  keyPointsEngineer: string[];   // エンジニア向けのポイント（5〜8項目）
  keyPointsBusiness: string[];   // ビジネス向けのポイント（5〜8項目）
  japanUseCases: string;         // Markdown形式の日本での活用イメージ
  targetAudience: TargetAudience[];
  importanceScore: ImportanceScore;
  importanceReason: string;      // 重要度判定の根拠
};

/** クロールで取得する原文のメタ情報 */
export type CrawledArticle = {
  originalUrl: string;
  originalTitle: string;
  originalContent: string;  // 原文本文（Firestore には保存しない）
  author: string;
  category: string;
  originalPublishedAt: Date | null;
};

/** Firestore に保存する完全な記事データ */
export type Article = GeneratedArticle &
  Omit<CrawledArticle, "originalContent"> & {
    id: string;
    status: "published" | "error";
    createdAt: Date;
  };
