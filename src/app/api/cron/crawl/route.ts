/**
 * Vercel Cron Functions で毎日実行されるクロールバッチ
 * schedule: 0 21 * * * (毎日21:00 UTC = 06:00 JST)
 *
 * Authorization: Bearer {CRON_SECRET} ヘッダーで認証する。
 * 処理済みURLをスキップし、新規URLのみ翻訳・保存する。
 */
import { NextResponse } from "next/server";
import { fetchArticleUrls, fetchArticleContent } from "@/lib/crawler";
import { generateArticle } from "@/lib/generator";
import { saveArticle, logCrawl, getCrawledUrls } from "@/lib/firestore";

/** クロール結果のサマリー */
type CrawlResult = {
  processed: number;
  failed: number;
  skipped: number;
};

export async function GET(request: Request): Promise<NextResponse> {
  // Authorization ヘッダーでの認証チェック
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: CrawlResult = { processed: 0, failed: 0, skipped: 0 };

  try {
    // 一覧ページから全記事URLを取得する
    const allUrls = await fetchArticleUrls();

    // 処理済みURLを取得して差分のみを対象とする
    const crawledUrls = await getCrawledUrls();
    const newUrls = allUrls.filter((url) => !crawledUrls.has(url));

    console.log(
      `[cron/crawl] 全${allUrls.length}件 / 新規${newUrls.length}件 / スキップ${crawledUrls.size}件`
    );

    result.skipped = allUrls.length - newUrls.length;

    // 新規URLを順次処理する（並列処理は API レートリミットに配慮してしない）
    for (const url of newUrls) {
      try {
        console.log(`[cron/crawl] 処理中: ${url}`);

        // クロール → 生成 → 保存の順で処理する
        const crawled = await fetchArticleContent(url);
        const generated = await generateArticle(crawled);
        const articleId = await saveArticle(crawled, generated);

        // 成功ログを記録する
        await logCrawl(url, articleId, "success");
        result.processed++;

        console.log(`[cron/crawl] 完了: ${url} → articleId=${articleId}`);
      } catch (error) {
        // 個別記事のエラーは記録して次のURLへ継続する（バッチ全体を止めない）
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`[cron/crawl] エラー: ${url} - ${errorMessage}`);

        await logCrawl(url, null, "error", errorMessage);
        result.failed++;
      }
    }
  } catch (error) {
    // 一覧取得など致命的なエラーの場合は500を返す
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(`[cron/crawl] 致命的エラー: ${errorMessage}`);

    return NextResponse.json(
      { error: "Internal Server Error", details: errorMessage },
      { status: 500 }
    );
  }

  return NextResponse.json(result);
}
