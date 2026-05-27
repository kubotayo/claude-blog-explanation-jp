@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 技術スタック
- Next.js (App Router) + TypeScript + Tailwind CSS v4
- Firebase Firestore（記事データ保存）
- Anthropic SDK（claude-opus-4-7 で翻訳・解説生成）
- cheerio（claude.com/blog のクロール）

## 開発コマンド
```bash
npm run dev      # 開発サーバー起動（http://localhost:3000）
npm run build    # プロダクションビルド
npm run lint     # ESLint 実行
```

## バッチ実行
```bash
# 初回遡及取得（全件）
GCLOUD_TOKEN=$(gcloud auth print-access-token) ANTHROPIC_API_KEY=xxx NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx node scripts/seed.mjs

# 定期バッチ手動テスト
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/crawl
```

## ディレクトリ構成
- src/app/ — Next.js App Router のページ・API Routes
- src/components/ — 共通コンポーネント
- src/lib/ — Firebase・Anthropic・クロール・生成の処理
- src/types/ — 型定義
- scripts/ — 初回遡及取得スクリプト
- docs/ — 設計書（HTML）
