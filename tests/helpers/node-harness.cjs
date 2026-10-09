// 資料の例（data-run="worker"）を、Node で実際に動かすための外枠。
// ブラウザの worker.js と同じく、コードを間接 eval でグローバルに実行し、
// 捕まえられなかったエラーを「Uncaught 名前: メッセージ」の 1 行で出す。
'use strict';
const util = require('node:util');
const fs = require('node:fs');

const describe = (e) => (e instanceof Error ? e.name + ': ' + e.message : util.inspect(e));
// 標準エラーに出すと標準出力との順序が保証されないので、すべて標準出力にまとめる
console.error = console.warn = console.info = console.debug = console.log;
process.on('uncaughtException', (e) => console.log('Uncaught ' + describe(e)));
process.on('unhandledRejection', (e) => console.log('Uncaught (in promise) ' + describe(e)));

const code = fs.readFileSync(process.argv[2], 'utf8');
try {
	(0, eval)(code);
} catch (e) {
	console.log('Uncaught ' + describe(e));
}
