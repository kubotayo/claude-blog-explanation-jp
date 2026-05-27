/**
 * 初回遡及取得スクリプト
 * claude.com/blog の全記事を Claude API で翻訳・解説して Firestore に保存する。
 * Firebase Admin SDK 不使用。GCLOUD_TOKEN を使った Firestore REST API 方式で実装する。
 *
 * 実行方法:
 *   GCLOUD_TOKEN=$(gcloud auth print-access-token) ANTHROPIC_API_KEY=xxx node scripts/seed.mjs
 *
 * 注意:
 *   - 処理済みURLは crawl_log コレクションで管理するため、再実行しても重複しない
 *   - Claude API は extended thinking を使うため1記事あたり数十秒かかる
 *   - API レートリミットに配慮し、記事間に2秒のインターバルを置く
 */

import Anthropic from "@anthropic-ai/sdk";
import { load } from "cheerio";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 設定
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Firestore プロジェクト ID（環境変数から取得できない場合はデフォルト値を使う）
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!PROJECT_ID) {
  console.error("エラー: FIREBASE_PROJECT_ID または NEXT_PUBLIC_FIREBASE_PROJECT_ID が未設定です。");
  process.exit(1);
}

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const BLOG_BASE_URL = "https://claude.com";
const BLOG_LIST_URL = "https://claude.com/blog/";

// 認証トークン（gcloud auth print-access-token で取得）
const GCLOUD_TOKEN = process.env.GCLOUD_TOKEN;
if (!GCLOUD_TOKEN) {
  console.error("エラー: GCLOUD_TOKEN が未設定です。GCLOUD_TOKEN=$(gcloud auth print-access-token) で実行してください。");
  process.exit(1);
}

// Anthropic API キー
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error("エラー: ANTHROPIC_API_KEY が未設定です。");
  process.exit(1);
}

const FIRESTORE_HEADERS = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${GCLOUD_TOKEN}`,
};

// Anthropic クライアント
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Firestore REST API ヘルパー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Firestore フィールド値ヘルパー */
function fsString(v) { return { stringValue: v ?? "" }; }
function fsNull() { return { nullValue: null }; }
function fsTimestamp(d) { return { timestampValue: d instanceof Date ? d.toISOString() : new Date(d).toISOString() }; }
function fsArray(items) { return { arrayValue: { values: items } }; }

/**
 * Firestore REST API でドキュメントを PATCH（作成・上書き）する
 */
async function writeDocument(collectionName, docId, fields) {
  const url = `${FIRESTORE_BASE_URL}/${collectionName}/${docId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: FIRESTORE_HEADERS,
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${res.status}] ${collectionName}/${docId}: ${body}`);
  }

  const json = await res.json();
  // ドキュメントIDを name フィールドの末尾から取得する
  return json.name.split("/").pop();
}

/**
 * articles コレクションに自動IDでドキュメントを追加する
 * REST API の POST メソッドを使う
 */
async function addDocument(collectionName, fields) {
  const url = `${FIRESTORE_BASE_URL}/${collectionName}`;
  const res = await fetch(url, {
    method: "POST",
    headers: FIRESTORE_HEADERS,
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${res.status}] ${collectionName}: ${body}`);
  }

  const json = await res.json();
  return json.name.split("/").pop();
}

/**
 * crawl_log から処理済みURLのセットを取得する
 */
async function getCrawledUrls() {
  const url = `${FIRESTORE_BASE_URL}/crawl_log`;
  const res = await fetch(url, { headers: FIRESTORE_HEADERS });

  if (res.status === 404) {
    // コレクションが存在しない場合は空セットを返す
    return new Set();
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`crawl_log 取得エラー: ${res.status} ${body}`);
  }

  const json = await res.json();
  const urls = new Set();

  if (json.documents) {
    for (const doc of json.documents) {
      const urlField = doc.fields?.url?.stringValue;
      if (urlField) {
        urls.add(urlField);
      }
    }
  }

  return urls;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// クローラー
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** HTML を取得するヘルパー */
async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ClaudeBlogExplanationBot/1.0)",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }

  return res.text();
}

/**
 * ブログ一覧ページから記事URLを抽出する
 */
async function fetchArticleUrls() {
  const html = await fetchHtml(BLOG_LIST_URL);
  const $ = load(html);
  const urls = new Set();

  $("a[href^='/blog/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (
      href.startsWith("/blog/") &&
      !href.startsWith("/blog/category/") &&
      href !== "/blog/" &&
      !href.includes("#")
    ) {
      urls.add(`${BLOG_BASE_URL}${href}`);
    }
  });

  return Array.from(urls);
}

/**
 * 個別記事ページから本文・メタ情報を取得する
 */
async function fetchArticleContent(url) {
  const html = await fetchHtml(url);
  const $ = load(html);

  // JSON-LD からタイトル・日付を取得する
  let originalTitle = "";
  let originalPublishedAt = null;

  const ldJsonText = $('script[type="application/ld+json"]').first().text();
  if (ldJsonText) {
    try {
      const ldJson = JSON.parse(ldJsonText);
      originalTitle = ldJson.headline ?? "";
      if (ldJson.datePublished) {
        const parsed = new Date(ldJson.datePublished);
        if (!isNaN(parsed.getTime())) {
          originalPublishedAt = parsed;
        }
      }
    } catch {
      // フォールバック: title タグから取得する
    }
  }

  if (!originalTitle) {
    originalTitle = $("title").text().replace(/\s*\|\s*Claude$/, "").trim();
  }

  // カテゴリを取得する
  let category = "";
  $(".hero_blog_post_details_content").each((_, el) => {
    const labelText = $(el).find(".u-text-style-caption").text().trim();
    if (labelText === "Category") {
      const cats = [];
      $(el).find(".w-dyn-item a").each((_, a) => {
        const text = $(a).text().trim();
        if (text) cats.push(text);
      });
      category = cats.join(", ");
    }
  });

  // 記事本文を取得する
  let originalContent = "";
  const richtextEl = $(".u-rich-text-blog.w-richtext").first();

  if (richtextEl.length > 0) {
    const lines = [];
    richtextEl.find("h1, h2, h3, h4, h5, h6, p, li, blockquote").each((_, el) => {
      const tagName = el.type === "tag" ? el.name : "";
      const text = $(el).text().trim();
      if (!text) return;

      if (tagName === "h1") lines.push(`# ${text}`);
      else if (tagName === "h2") lines.push(`## ${text}`);
      else if (tagName === "h3") lines.push(`### ${text}`);
      else if (tagName === "h4") lines.push(`#### ${text}`);
      else if (tagName === "li") lines.push(`- ${text}`);
      else if (tagName === "blockquote") lines.push(`> ${text}`);
      else lines.push(text);
    });
    originalContent = lines.join("\n\n");
  }

  // 著者情報（JSON-LD に author がない場合は "Anthropic" をデフォルトとする）
  let author = "Anthropic";
  if (ldJsonText) {
    try {
      const ldJson = JSON.parse(ldJsonText);
      if (ldJson.author?.name) author = ldJson.author.name;
    } catch {
      // フォールバック
    }
  }

  return {
    originalUrl: url,
    originalTitle,
    originalContent,
    author,
    category: category || "General",
    originalPublishedAt,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Claude API による翻訳・解説生成
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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

function buildUserPrompt(crawled) {
  const publishedAt = crawled.originalPublishedAt
    ? crawled.originalPublishedAt.toLocaleDateString("ja-JP", {
        year: "numeric", month: "long", day: "numeric",
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

/** レスポンステキストから JSON を抽出してパースする */
function extractJson(text) {
  // ```json ... ``` コードブロックを優先的に抽出する
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // { ... } の範囲を直接抽出する
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("レスポンスから JSON を抽出できませんでした");
}

/** Claude API で翻訳・解説を生成する */
async function generateArticle(crawled) {
  const response = await anthropic.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: {
      type: "enabled",
      budget_tokens: 10000,
    },
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(crawled) }],
  });

  const textContent = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return extractJson(textContent);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Firestore への保存
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** articles コレクションに記事を保存してドキュメントIDを返す */
async function saveArticle(crawled, generated) {
  const now = new Date();

  const fields = {
    // 生成コンテンツ
    japaneseTitle: fsString(generated.japaneseTitle),
    summary: fsString(generated.summary),
    detailedExplanation: fsString(generated.detailedExplanation),
    keyPointsEngineer: fsArray(generated.keyPointsEngineer.map(fsString)),
    keyPointsBusiness: fsArray(generated.keyPointsBusiness.map(fsString)),
    japanUseCases: fsString(generated.japanUseCases),
    targetAudience: fsArray(generated.targetAudience.map(fsString)),
    importanceScore: fsString(generated.importanceScore),
    importanceReason: fsString(generated.importanceReason),
    // クロールメタ情報
    originalUrl: fsString(crawled.originalUrl),
    originalTitle: fsString(crawled.originalTitle),
    author: fsString(crawled.author),
    category: fsString(crawled.category),
    originalPublishedAt: crawled.originalPublishedAt
      ? fsTimestamp(crawled.originalPublishedAt)
      : fsNull(),
    // システムフィールド
    status: fsString("published"),
    createdAt: fsTimestamp(now),
  };

  return addDocument("articles", fields);
}

/** crawl_log に処理結果を記録する */
async function logCrawl(url, articleId, status, errorMessage) {
  // URLをbase64urlエンコードしてドキュメントIDとする（URLの重複チェックのため）
  const docId = Buffer.from(url).toString("base64url");
  const now = new Date();

  const fields = {
    url: fsString(url),
    articleId: articleId ? fsString(articleId) : fsNull(),
    status: fsString(status),
    errorMessage: errorMessage ? fsString(errorMessage) : fsNull(),
    retryCount: { integerValue: "0" },
    processedAt: fsTimestamp(now),
  };

  await writeDocument("crawl_log", docId, fields);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メイン処理
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log(`[seed] プロジェクト: ${PROJECT_ID}`);
  console.log("[seed] claude.com/blog の全記事を処理します...");
  console.log();

  // 1. 全記事URLを取得する
  const allUrls = await fetchArticleUrls();
  console.log(`[seed] 全${allUrls.length}件の記事URLを取得しました`);

  // 2. 処理済みURLを取得して差分のみを対象とする
  const crawledUrls = await getCrawledUrls();
  const newUrls = allUrls.filter((url) => !crawledUrls.has(url));
  console.log(`[seed] 処理済み: ${crawledUrls.size}件 / 新規: ${newUrls.length}件`);
  console.log();

  if (newUrls.length === 0) {
    console.log("[seed] 処理する新規記事はありません。");
    return;
  }

  let processed = 0;
  let failed = 0;
  const total = newUrls.length;

  // 3. 未処理URLを2秒インターバルで順次処理する
  for (const url of newUrls) {
    const progress = `[${processed + failed + 1}/${total}]`;
    console.log(`${progress} 処理中: ${url}`);

    try {
      // クロール → 生成 → 保存の順で処理する
      const crawled = await fetchArticleContent(url);
      console.log(`  タイトル: ${crawled.originalTitle}`);

      const generated = await generateArticle(crawled);
      console.log(`  日本語タイトル: ${generated.japaneseTitle}`);
      console.log(`  重要度: ${generated.importanceScore}`);

      const articleId = await saveArticle(crawled, generated);
      await logCrawl(url, articleId, "success");

      processed++;
      console.log(`  完了: articleId=${articleId}`);
    } catch (error) {
      // 個別記事のエラーは記録して次のURLへ継続する（バッチ全体を止めない）
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  エラー: ${errorMessage}`);

      try {
        await logCrawl(url, null, "error", errorMessage);
      } catch (logError) {
        console.error(`  crawl_log 記録エラー: ${logError.message}`);
      }

      failed++;
    }

    console.log();

    // API レートリミットに配慮した2秒インターバル
    if (processed + failed < total) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`[seed] 完了: 成功=${processed}件 / 失敗=${failed}件`);
}

main().catch((err) => {
  console.error("[seed] 致命的エラー:", err.message);
  process.exit(1);
});
