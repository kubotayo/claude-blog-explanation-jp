/**
 * claude.com/blog クローラー
 * cheerio を使って一覧ページから記事URLを抽出し、
 * 個別記事ページから本文・メタ情報を取得する。
 *
 * HTML構造の確認結果（2026-05-27）:
 * - 記事URL: <a href="/blog/xxx"> の href 属性（/blog/ で始まるもの）
 * - 記事本文: class="u-rich-text-blog u-margin-trim w-richtext" の div 内
 * - メタ情報: JSON-LD（application/ld+json）から headline・datePublished を取得
 * - カテゴリ: "Category" ラベルに続く <a> タグのテキスト
 * - 著者情報: JSON-LD に著者フィールドがないため "Anthropic" をデフォルトとする
 */
import { load } from "cheerio";
import type { CrawledArticle } from "@/types/article";

const BLOG_BASE_URL = "https://claude.com";
const BLOG_LIST_URL = "https://claude.com/blog/";

/** User-Agent を設定してフェッチする（一部サイトではボット判定を防ぐため） */
async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ClaudeBlogExplanationBot/1.0; +https://claude.com)",
    },
    // キャッシュを使わず常に最新を取得する
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }

  return res.text();
}

/**
 * ブログ一覧ページから記事の絶対URLを抽出して返す
 * /blog/{slug} 形式のリンクを収集し、重複を除去する
 */
export async function fetchArticleUrls(): Promise<string[]> {
  const html = await fetchHtml(BLOG_LIST_URL);
  const $ = load(html);
  const urls = new Set<string>();

  // href="/blog/xxx" の形式でリンクされている記事URLを収集する
  // /blog/category/ や /blog/ 自体は除外する
  $("a[href^='/blog/']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    // カテゴリページ・ハッシュリンクは除外する
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
 * 個別記事ページから本文とメタ情報を取得する
 * JSON-LD から title・日付を、cheerio から本文・カテゴリを取得する
 */
export async function fetchArticleContent(url: string): Promise<CrawledArticle> {
  const html = await fetchHtml(url);
  const $ = load(html);

  // JSON-LD から構造化データを取得する（headline・datePublished が含まれる）
  let originalTitle = "";
  let originalPublishedAt: Date | null = null;

  const ldJsonText = $('script[type="application/ld+json"]').first().text();
  if (ldJsonText) {
    try {
      const ldJson = JSON.parse(ldJsonText);
      originalTitle = ldJson.headline ?? "";
      if (ldJson.datePublished) {
        const parsed = new Date(ldJson.datePublished);
        originalPublishedAt = isNaN(parsed.getTime()) ? null : parsed;
      }
    } catch {
      // JSON パースに失敗した場合は続行する
    }
  }

  // title タグから取得できる場合はフォールバック
  if (!originalTitle) {
    const titleText = $("title").text();
    // "記事タイトル | Claude" の形式から記事タイトルのみ抽出する
    originalTitle = titleText.replace(/\s*\|\s*Claude$/, "").trim();
  }

  // カテゴリ: "Category" ラベルに続く <a> テキストを結合する
  // Webflow の構造: .hero_blog_post_details_content 内の "Category" ラベルに続くリンク
  let category = "";
  $(".hero_blog_post_details_content").each((_, el) => {
    const labelText = $(el).find(".u-text-style-caption").text().trim();
    if (labelText === "Category") {
      const cats: string[] = [];
      $(el)
        .find(".w-dyn-item a")
        .each((_, a) => {
          const text = $(a).text().trim();
          if (text) cats.push(text);
        });
      category = cats.join(", ");
    }
  });

  // 記事本文: class="u-rich-text-blog u-margin-trim w-richtext" の div から取得する
  // 見出し（h2, h3等）とパラグラフを構造を保ちながらテキスト化する
  let originalContent = "";
  const richtextEl = $(".u-rich-text-blog.w-richtext").first();

  if (richtextEl.length > 0) {
    const lines: string[] = [];

    richtextEl.find("h1, h2, h3, h4, h5, h6, p, li, blockquote").each((_, el) => {
      const tagName = el.type === "tag" ? el.name : "";
      const text = $(el).text().trim();

      if (!text) return;

      // 見出しレベルに応じてマークダウン記法で整形する
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

  // 著者情報: JSON-LD に author フィールドがない場合は "Anthropic" をデフォルトとする
  let author = "Anthropic";
  if (ldJsonText) {
    try {
      const ldJson = JSON.parse(ldJsonText);
      if (ldJson.author?.name) {
        author = ldJson.author.name;
      }
    } catch {
      // フォールバック: "Anthropic" のまま
    }
  }

  // YouTube 動画ID: <iframe src="https://www.youtube.com/embed/VIDEO_ID..."> から抽出する
  // 記事内に埋め込まれた YouTube 動画を動画まとめ機能で処理するために収集する
  const youtubeVideoIds: string[] = [];
  richtextEl.find("iframe").each((_, el) => {
    const src = $(el).attr("src") ?? "";
    // youtube.com/embed/{videoId} または youtube-nocookie.com/embed/{videoId} に対応する
    const match = src.match(
      /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/
    );
    if (match && match[1]) {
      youtubeVideoIds.push(match[1]);
    }
  });

  return {
    originalUrl: url,
    originalTitle,
    originalContent,
    author,
    category: category || "General",
    originalPublishedAt,
    youtubeVideoIds,
  };
}
