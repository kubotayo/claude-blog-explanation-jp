/**
 * Claude API を使って Anthropic 公式ブログ記事の翻訳・解説を生成するモジュール
 * モデル: claude-opus-4-7、extended thinking（adaptive）を使用して高品質な解説を生成する
 */
import { anthropic } from "./anthropic";
import type { CrawledArticle, GeneratedArticle } from "@/types/article";

/** システムプロンプト: Anthropic ブログの日本語解説ライターとして振る舞う */
const SYSTEM_PROMPT = `あなたは Anthropic 公式ブログの日本語解説ライターです。
英語の技術ブログ記事を読み、以下の役割を果たしてください。

## あなたの役割
- 翻訳者ではなく「技術ライター」として、原文の内容を深く理解した上で日本語で解説する
- 読者が「誰向けの記事か」「どのくらい重要か」を一目で判断できるメタ情報を付与する
- 原文の情報量を削らず、背景知識や日本市場への示唆を加えて 1.5〜2 倍の情報密度を目指す

## 文体・スタイルルール
- 文体は「です・ます調」で統一する
- モデル名・製品名・API 名は英語のままにする（例: Claude Opus, Function Calling）
- 技術用語は初出時に補足説明を付ける
- 機械翻訳的な直訳は避け、自然な日本語で意訳・補完を積極的に行う

## 出力形式
必ず以下の JSON スキーマに従って出力すること。JSON 以外のテキストは出力しないこと。`;

/**
 * ユーザープロンプトテンプレートに CrawledArticle のデータを埋め込む
 */
function buildUserPrompt(crawled: CrawledArticle): string {
  const publishedAt = crawled.originalPublishedAt
    ? crawled.originalPublishedAt.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "不明";

  return `以下の Anthropic 公式ブログ記事を翻訳・解説してください。

# 原文メタ情報
- タイトル（英語）: ${crawled.originalTitle}
- 著者: ${crawled.author}
- カテゴリ: ${crawled.category}
- 公開日: ${publishedAt}
- URL: ${crawled.originalUrl}

# 原文本文
${crawled.originalContent}

# 出力 JSON スキーマ
{
  "japaneseTitle": "日本語タイトル（意訳可）",
  "summary": "3〜5行の要約。この記事が何について、なぜ重要かを端的に伝える",
  "detailedExplanation": "原文の見出し構造を維持した詳細解説（Markdown形式）。各セクションに解説者コメントを追記すること",
  "keyPointsEngineer": ["エンジニア向けポイント1", "ポイント2", "（5〜8項目）"],
  "keyPointsBusiness": ["ビジネス向けポイント1", "ポイント2", "（5〜8項目）"],
  "japanUseCases": "日本での活用イメージ（Markdown形式）",
  "targetAudience": ["engineer", "business", "general", "researcher のうち該当するもの（複数可）"],
  "importanceScore": "S, A, B, C のいずれか",
  "importanceReason": "重要度判定の根拠（1〜2文）"
}

# 重要度スコアの基準
- S: 新モデルリリース・API breaking change など即時対応が必要なもの
- A: 業界インパクトが高い発表・重要な安全性研究
- B: 有用な活用事例・技術解説・機能改善
- C: 一般情報・トピック記事・コミュニティ向け

# 対象読者の基準
- engineer: コード・API・アーキテクチャの話題が中心
- business: ROI・企業導入事例・ワークフロー効率化が中心
- general: Claude の機能紹介・使い方・社会的トピック
- researcher: 論文・モデルの仕組み・安全性研究が中心`;
}

/**
 * レスポンステキストから JSON を抽出してパースする
 * ```json ... ``` コードブロック形式と、生JSONどちらにも対応する
 */
function extractJson(text: string): GeneratedArticle {
  // ```json ... ``` コードブロックを優先的に抽出する
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim()) as GeneratedArticle;
  }

  // コードブロックがない場合は { ... } の範囲を直接抽出する
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]) as GeneratedArticle;
  }

  throw new Error("レスポンスから JSON を抽出できませんでした");
}

/**
 * Claude API を呼び出して記事の翻訳・解説を生成する
 * extended thinking（adaptive）を使用して深い分析を行う
 */
export async function generateArticle(
  crawled: CrawledArticle
): Promise<GeneratedArticle> {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: {
      type: "enabled",
      budget_tokens: 10000,
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserPrompt(crawled),
      },
    ],
  });

  // レスポンスのテキストブロックを結合して JSON を抽出する
  // thinking ブロックは除外し、text ブロックのみを対象とする
  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  return extractJson(textContent);
}
