// docs/samples に置いた、読者が手元で動かすファイルを確かめる。
// 資料のページに載せたコードと、ダウンロードして使うファイルが食い違わないようにするため。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { examplesOf } from './helpers/examples.ts';

const docsDir = join(import.meta.dirname, '..', 'docs');
const webDir = join(docsDir, 'samples', 'web');

test('14 章に載せた serve.mjs ・ main.js は、docs/samples/web のファイルと同じ', () => {
	const examples = examplesOf(docsDir, '14-ブラウザで動かす.html');
	for (const name of ['serve.mjs', 'main.js']) {
		const ex = examples.find((e) => e.filename === name);
		assert.ok(ex, `${name} の例がありません`);
		assert.equal(ex.code.trimEnd(), readFileSync(join(webDir, name), 'utf8').trimEnd());
	}
});

test('serve.mjs は index.html と main.js を正しい種類で返し、フォルダの外は返さない', async () => {
	const child = spawn('node', ['serve.mjs'], { cwd: webDir, env: { ...process.env, PORT: '0' } });
	try {
		const line = await new Promise<string>((resolve, reject) => {
			child.stdout.setEncoding('utf8');
			child.stdout.once('data', (d: string) => resolve(d));
			child.once('error', reject);
			setTimeout(() => reject(new Error('起動しません')), 10000);
		});
		const port = /localhost:(\d+)/.exec(line)?.[1];
		assert.ok(port, `待ち受けの表示がありません: ${line}`);
		const top = await fetch(`http://localhost:${port}/`);
		assert.equal(top.status, 200);
		assert.equal(top.headers.get('content-type'), 'text/html; charset=utf-8');
		assert.match(await top.text(), /<button id="change">/);
		const js = await fetch(`http://localhost:${port}/main.js`);
		assert.equal(js.headers.get('content-type'), 'text/javascript; charset=utf-8');
		const missing = await fetch(`http://localhost:${port}/nothing.txt`);
		assert.equal(missing.status, 404);
		const outside = await fetch(`http://localhost:${port}/..%2F..%2FREADME.html`);
		assert.notEqual(outside.status, 200);
	} finally {
		child.kill();
	}
});
