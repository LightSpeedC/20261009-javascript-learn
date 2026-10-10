# JavaScript 入門 課題

> 📅 作成: 2026-10-10 / 更新: 2026-10-10

[^^](../../README.md)

1. [実行の仕組み（2 件）](#1-実行の仕組み2-件)
2. [資料とテスト（2 件）](#2-資料とテスト2-件)
3. [運用（3 件）](#3-運用3-件)

## 1. 実行の仕組み（2 件）

<details>
<summary>i261010-01 ✅ <strong>済</strong> 無限ループでページが固まる</summary>

第2部の例（iframe）と、`file://` で開いたときの第1部の例は、ページと同じ流れで動くため、時間で打ち切れない。無限ループを書くとタブごと固まる。ZZ の「実行の制約」に書いてある。

- ✅ **済** 制約として閉じた。DOM を使う例は Worker に移せず、ループの検出は大がかりで確実でもないため

</details>

<details>
<summary>i261010-02 ✅ <strong>済</strong> 値の表示が Node.js と同じにならないものがある</summary>

`docs/js/inspect.js` は、Promise の状態（`<pending>` など）とエラーのスタックを Node.js と同じには出せない。ZZ の「実行の制約」に書いてある。

- ✅ **済** 制約として閉じた。この差で出力が食い違う例はいまは無い

</details>

## 2. 資料とテスト（2 件）

<details>
<summary>i261010-03 ⚠️ <strong>着手</strong> Firefox でテストするか</summary>

ブラウザのテストは Chromium だけで流している。PlayWright の共有環境は Firefox も持つので、流すことはできるはず（未実測）。エラーの文面は V8 のものを載せているため、エラーを出す例は Firefox では食い違う見込み。

- ✅ **済** Firefox で流した。39 件中 27 件が成功、12 件が失敗。失敗は 03 ・ 05 ・ 06 ・ 07 ・ 08 ・ 10 章の 11 例（通常のページと file:// の両方）で、すべてエラーの文面の違いだけ（例: `Assignment to constant variable.` が `invalid assignment to const …` になる）。値の表示や、第2部の例の食い違いは無い
- ⬜ **未** Chromium だけを対象として閉じるか、エラーの例だけを Firefox で飛ばしてテストに加えるかを決める

</details>

<details>
<summary>i261010-04 ✅ <strong>済</strong> 付録が第1部の内容だけ</summary>

A1 逆引き ・ A2 対応表 ・ A3 落とし穴カタログは、第1部の言語の内容だけを扱う。第2部（DOM ・ イベント ・ 通信 ・ 保存）の項目が無い。

- ✅ **済** A1 逆引きに 3 章（画面 ・ イベントとフォーム ・ 通信と保存）、A3 落とし穴カタログに 2 章（画面とイベント ・ 通信と保存）を足した。A2 対応表は、Java ・ C# ・ VBA に当たるものが少ないので第1部向けのまま

</details>

## 3. 運用（3 件）

<details>
<summary>i261010-05 ✅ <strong>済</strong> check-public が runner.js の正規表現の行を誤検知する</summary>

`docs/js/runner.js` の正規表現の行が、毎回指摘に出る。中身に問題は無い。変数名 `TOKEN` の後に値が続くため、認証情報として拾われていた。

- ✅ **済** 変数名を `CODE_PATTERN` ・ `HTML_PATTERN` に変えた。check-public の指摘は 0 件

</details>

<details>
<summary>i261010-06 ✅ <strong>済</strong> html2md の更新日の警告が 16 件出続ける</summary>

第1部の 01〜13 と付録 A1〜A3 は、生成スクリプトがナビを書き換えたため、ファイルの更新時刻がヘッダの更新日より新しい。体裁だけの変更なので、更新日は変えないのが正しい。

- ✅ **済** 対応不要として閉じた。本文を書き換えて更新日を進めるまで、警告は出続ける

</details>

<details>
<summary>i261010-07 ✅ <strong>済</strong> 最近の push が公開ページに反映されたかを確かめていない</summary>

`74e237c` 以降の push（資料一覧の移動、`docs/README.html` の削除を含む）について、Pages の作り直しと公開 URL での反映を確かめていない。

- ✅ **済** Pages の作り直しは `038b58f` で built。公開 URL で README の課題の章 ・ ZZ の実行の制約 ・ 01 章の戻り先 ・ runner.js の変数名を確かめ、`docs/README.html` が 404 になることも確かめた

</details>

[^^](../../README.md)
