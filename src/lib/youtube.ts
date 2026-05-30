/**
 * YouTube 字幕取得モジュール
 * youtube-transcript パッケージを使用して英語字幕を取得する。
 * 字幕が取得できない場合はエラーを上位に伝播させず null を返す。
 */
import { YoutubeTranscript } from "youtube-transcript";

/**
 * 指定した YouTube 動画IDの英語字幕をプレーンテキストで返す
 * 字幕が存在しない・取得エラーの場合は null を返す（例外を投げない）
 *
 * @param videoId YouTube 動画ID（11文字）
 * @returns 字幕のプレーンテキスト、取得失敗時は null
 */
export async function fetchYouTubeTranscript(
  videoId: string
): Promise<string | null> {
  try {
    // 英語字幕を優先して取得する。英語がなければライブラリがデフォルト言語を返す
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId, {
      lang: "en",
    });

    if (!transcriptItems || transcriptItems.length === 0) {
      return null;
    }

    // 各字幕セグメントのテキストをスペース区切りで結合してプレーンテキスト化する
    const plainText = transcriptItems
      .map((item) => item.text.trim())
      .filter((text) => text.length > 0)
      .join(" ");

    return plainText || null;
  } catch (err) {
    // 字幕なし・非公開動画・レート制限など様々な原因で失敗する可能性があるため
    // エラーをログのみで記録し null を返して処理を継続させる
    console.warn(`[youtube] 字幕取得失敗: videoId=${videoId}`, err);
    return null;
  }
}
