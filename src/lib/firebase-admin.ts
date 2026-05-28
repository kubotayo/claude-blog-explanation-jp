/**
 * Firebase Admin SDK の初期化モジュール（サーバーサイド専用）
 * API Routes やバッチ処理からのみ使用する。
 * Admin SDK はセキュリティルールをバイパスするため、
 * クライアントサイドには絶対にインポートしないこと。
 */
import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";

/** Admin SDK アプリインスタンス（重複初期化を防ぐためシングルトン管理） */
let adminApp: App;
let adminDb: Firestore;

function getAdminApp(): App {
  if (adminApp) return adminApp;

  // すでに初期化済みのアプリがあれば再利用する
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  // FIREBASE_ADMIN_CREDENTIAL 環境変数から サービスアカウント認証情報を読み込む
  const credentialJson = process.env.FIREBASE_ADMIN_CREDENTIAL;
  if (!credentialJson) {
    throw new Error("FIREBASE_ADMIN_CREDENTIAL 環境変数が設定されていません");
  }

  const credential = JSON.parse(credentialJson);
  // Vercel 環境変数経由でエスケープされた \\n を実際の改行文字に戻す
  if (credential.private_key) {
    credential.private_key = credential.private_key.replace(/\\n/g, "\n");
  }
  adminApp = initializeApp({ credential: cert(credential) });
  return adminApp;
}

/** Admin SDK の Firestore インスタンスを返す */
export function getAdminDb(): Firestore {
  if (adminDb) return adminDb;
  adminDb = getFirestore(getAdminApp());
  return adminDb;
}
