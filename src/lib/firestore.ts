/**
 * Firestore CRUD 操作モジュール
 * articles コレクションと crawl_log コレクションの読み書きを担当する。
 * Server Component から使用するため、Firebase Client SDK がサーバーサイドで動く。
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Article, CrawledArticle, GeneratedArticle } from "@/types/article";

/** 重要度スコアを数値にマッピングするテーブル（降順ソートのため）
 * Firestore の文字列ソートでは S→A→B→C の順にならないので JS 側でソートする
 */
const IMPORTANCE_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };

/**
 * articles コレクションに記事を保存し、ドキュメントIDを返す
 * @param crawled クロールで取得したメタ情報
 * @param generated Claude API が生成した翻訳・解説データ
 * @returns 保存したドキュメントID
 */
export async function saveArticle(
  crawled: CrawledArticle,
  generated: GeneratedArticle
): Promise<string> {
  const articlesRef = collection(db, "articles");

  const docData = {
    // 生成コンテンツ
    japaneseTitle: generated.japaneseTitle,
    summary: generated.summary,
    detailedExplanation: generated.detailedExplanation,
    keyPointsEngineer: generated.keyPointsEngineer,
    keyPointsBusiness: generated.keyPointsBusiness,
    japanUseCases: generated.japanUseCases,
    targetAudience: generated.targetAudience,
    importanceScore: generated.importanceScore,
    importanceReason: generated.importanceReason,
    // クロールメタ情報（originalContent は保存しない）
    originalUrl: crawled.originalUrl,
    originalTitle: crawled.originalTitle,
    author: crawled.author,
    category: crawled.category,
    originalPublishedAt: crawled.originalPublishedAt
      ? Timestamp.fromDate(crawled.originalPublishedAt)
      : null,
    // システムフィールド
    status: "published",
    createdAt: Timestamp.now(),
  };

  const docRef = await addDoc(articlesRef, docData);
  return docRef.id;
}

/**
 * crawl_log に処理結果を記録する
 * ドキュメントIDは URL を base64url エンコードして使用する（URLの重複チェックのため）
 */
export async function logCrawl(
  url: string,
  articleId: string | null,
  status: "success" | "error",
  errorMessage?: string,
  retryCount?: number
): Promise<void> {
  // URLをbase64urlエンコードしてドキュメントIDとする
  const docId = Buffer.from(url).toString("base64url");
  const crawlLogRef = doc(db, "crawl_log", docId);

  await setDoc(crawlLogRef, {
    url,
    articleId: articleId ?? null,
    status,
    errorMessage: errorMessage ?? null,
    retryCount: retryCount ?? 0,
    processedAt: Timestamp.now(),
  });
}

/**
 * crawl_log から処理済みURLのセットを返す
 * 差分取得時に未処理URLのみ処理するために使用する
 */
export async function getCrawledUrls(): Promise<Set<string>> {
  const crawlLogRef = collection(db, "crawl_log");
  const snapshot = await getDocs(crawlLogRef);
  const urls = new Set<string>();

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.url) {
      urls.add(data.url as string);
    }
  });

  return urls;
}

/**
 * articles コレクションから全件取得し、importanceScore 降順（S→A→B→C）でソートして返す
 * Firestore の文字列ソートでは正しい順にならないため、JS 側でソートする
 */
export async function getArticles(): Promise<Article[]> {
  const articlesRef = collection(db, "articles");
  const snapshot = await getDocs(articlesRef);

  const articles: Article[] = snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      japaneseTitle: data.japaneseTitle,
      summary: data.summary,
      detailedExplanation: data.detailedExplanation,
      keyPointsEngineer: data.keyPointsEngineer ?? [],
      keyPointsBusiness: data.keyPointsBusiness ?? [],
      japanUseCases: data.japanUseCases,
      targetAudience: data.targetAudience ?? [],
      importanceScore: data.importanceScore,
      importanceReason: data.importanceReason,
      originalUrl: data.originalUrl,
      originalTitle: data.originalTitle,
      author: data.author,
      category: data.category,
      originalPublishedAt: data.originalPublishedAt
        ? (data.originalPublishedAt as Timestamp).toDate()
        : null,
      status: data.status,
      createdAt: (data.createdAt as Timestamp).toDate(),
    } as Article;
  });

  // importanceScore 降順（S=0, A=1, B=2, C=3）でソートし、
  // 同スコアの場合は createdAt 降順（新しい順）
  articles.sort((a, b) => {
    const scoreA = IMPORTANCE_ORDER[a.importanceScore] ?? 4;
    const scoreB = IMPORTANCE_ORDER[b.importanceScore] ?? 4;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return articles;
}

/**
 * 指定 ID の記事を1件取得する
 * @returns 記事データ、存在しない場合は null
 */
export async function getArticleById(id: string): Promise<Article | null> {
  const articleRef = doc(db, "articles", id);
  const docSnap = await getDoc(articleRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data();
  return {
    id: docSnap.id,
    japaneseTitle: data.japaneseTitle,
    summary: data.summary,
    detailedExplanation: data.detailedExplanation,
    keyPointsEngineer: data.keyPointsEngineer ?? [],
    keyPointsBusiness: data.keyPointsBusiness ?? [],
    japanUseCases: data.japanUseCases,
    targetAudience: data.targetAudience ?? [],
    importanceScore: data.importanceScore,
    importanceReason: data.importanceReason,
    originalUrl: data.originalUrl,
    originalTitle: data.originalTitle,
    author: data.author,
    category: data.category,
    originalPublishedAt: data.originalPublishedAt
      ? (data.originalPublishedAt as Timestamp).toDate()
      : null,
    status: data.status,
    createdAt: (data.createdAt as Timestamp).toDate(),
  } as Article;
}
