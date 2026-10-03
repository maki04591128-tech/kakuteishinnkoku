// スタンドアロン版ビルド用の`@/lib/authUi`差し替え実装(next.config.tsのresolveAlias経由)。
// パスワード認証(`@/lib/auth/`・`@/app/login/`)はスタンドアロン版では技術的に動作しない
// (README「現在の最優先事項」フェーズ4の決定)ため、ログアウトボタンは常に非表示にする。
export function LogoutButton() {
  return null;
}
