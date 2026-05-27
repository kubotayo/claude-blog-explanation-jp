/**
 * Anthropic SDK クライアントの初期化
 * ANTHROPIC_API_KEY 環境変数から API キーを読み込む（サーバーサイドのみ）
 */
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
