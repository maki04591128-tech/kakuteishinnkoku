// 自宅サーバー版のデフォルト実装。スタンドアロン版ビルド(`BUILD_TARGET=standalone`)では
// next.config.tsのresolveAlias設定により`authUi.standalone.tsx`に差し替えられ、この
// ファイル(とその依存先の`@/lib/auth/`・`@/app/login/`)はビルド対象に含まれない。
import { isAuthEnabled } from "@/lib/auth/session";
import { logout } from "@/app/login/actions";

export function LogoutButton() {
  if (!isAuthEnabled()) return null;
  return (
    <form action={logout}>
      <button type="submit" className="text-sm text-neutral-500 hover:underline">
        ログアウト
      </button>
    </form>
  );
}
