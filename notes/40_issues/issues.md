# JavaScript 入門 課題

> 📅 作成: 2026-10-10 / 更新: 2026-10-10

[^^](../../README.md)

1. [実行の仕組み（2 件）](#1-実行の仕組み2-件)
2. [資料とテスト（2 件）](#2-資料とテスト2-件)
3. [運用（3 件）](#3-運用3-件)

## 1. 実行の仕組み（2 件）

<details>
<summary>i261010-01 ⬜ <strong>未</strong> 無限ループでページが固まる</summary>

第2部の例（iframe）と、`file://` で開いたときの第1部の例は、ページと同じ流れで動くため、時間で打ち切れない。無限ループを書くとタブごと固まる。ZZ の「実行の制約」に書いてある。

- ⬜ **未** 直すか（ループの検出・別の打ち切り方）、制約のまま残すかを決める

</details>

<details>
<summary>i261010-02 ⬜ <strong>未</strong> 値の表示が Node.js と同じにならないものがある</summary>

`docs/js/inspect.js` は、Promise の状態（`<pending>` など）とエラーのスタックを Node.js と同じには出せない。ZZ の「実行の制約」に書いてある。

- ⬜ **未** そうした値を出す例を、記録の表示（`data-run="node"`）にするか、表示を足すかを決める

</details>

## 2. 資料とテスト（2 件）

<details>
<summary>i261010-03 ⬜ <strong>未</strong> Firefox でテストするか</summary>

ブラウザのテストは Chromium だけで流している。PlayWright の共有環境は Firefox も持つので、流すことはできるはず（未実測）。エラーの文面は V8 のものを載せているため、エラーを出す例は Firefox では食い違う見込み。

- ⬜ **未** Firefox で流して、食い違う例の件数を数える
- ⬜ **未** 食い違う例を Firefox では飛ばすか、対象外とするかを決める

</details>

<details>
<summary>i261010-04 ⬜ <strong>未</strong> 付録が第1部の内容だけ</summary>

A1 逆引き ・ A2 対応表 ・ A3 落とし穴カタログは、第1部の言語の内容だけを扱う。第2部（DOM ・ イベント ・ 通信 ・ 保存）の項目が無い。

- ⬜ **未** 第2部の項目を足すか、付録を第1部向けと明記するかを決める

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
<summary>i261010-07 ⬜ <strong>未</strong> 最近の push が公開ページに反映されたかを確かめていない</summary>

`74e237c` 以降の push（資料一覧の移動、`docs/README.html` の削除を含む）について、Pages の作り直しと公開 URL での反映を確かめていない。

- ⬜ **未** Pages の作り直しの状態と、公開 URL で変えたファイルを確かめる

</details>

[^^](../../README.md)
