/**
 * `wa-sqlite/src/examples/AccessHandlePoolVFS.js`用の最小限のアンビエント型宣言。
 *
 * `MemoryVFS.js`(フェーズ0-2から使用)と異なり、このファイルはprivateな
 * クラスフィールド(`#directoryPath`等)を使っており、`allowJs`経由の型推論が
 * 効かず`tsc --noEmit`が`TS7016`(暗黙のany)で失敗するため、このファイルで
 * 実際に使うAPI(コンストラクタと`isReady`)のみを宣言する。
 */
declare module "wa-sqlite/src/examples/AccessHandlePoolVFS.js" {
  export class AccessHandlePoolVFS {
    constructor(directoryPath: string);
    readonly isReady: Promise<void>;
  }
}
