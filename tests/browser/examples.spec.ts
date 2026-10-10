// 資料の「実行」ボタンを、実際のブラウザ（Chromium ・ Firefox）で押して、載せた出力と一致することを確かめる。
// examples.test.ts は Node で確かめるが、こちらは Worker ・ inspect.js ・ runner.js を通した表示を見る。
// エラーの文面は、載せた V8 のものか、Firefox の対の文面のどちらかが出れば一致とみなす（browser-errors.ts）。
// 実行: tools/40_test/run-tests.ps1（PlayWright 共有環境の playwright-test を使う）
import { test, expect } from '@playwright/test';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { examplesOf, pages } from '../helpers/examples.ts';
import { startServer } from '../helpers/static-server.ts';
import { asV8 } from '../helpers/browser-errors.ts';

// Playwright は spec を CommonJS に変換して読むので、import.meta ではなく __dirname を使う
const root = join(__dirname, '..', '..');
const docsDir = join(root, 'docs');
let server: Server;
let base = '';

test.beforeAll(async () => {
	({ server, base } = await startServer(root));
});
test.afterAll(() => {
	server.close();
});

// JSL_NET=0 のときは、外の CDN から読み込む例を飛ばす
const skipNet = process.env.JSL_NET === '0';

// Console に出ても資料の不具合ではないもの。ページ ・ ブラウザ ・ 文面で絞り、理由を添える
const KNOWN_CONSOLE: { page: string; browser?: string; text: RegExp; why: string }[] = [
	// わざと 404 を受け取る例。ブラウザが読み込みの失敗を Console に記録する
	{ page: '18-通信.html', browser: 'chromium', text: /^error: Failed to load resource: the server responded with a status of 404/, why: '404 を受け取る例' },
	// テストのブラウザは GPU を持たず、3D をソフトウェアで描くため、描画の速さについての知らせが出る
	{ page: '20-描画とメディア.html', browser: 'chromium', text: /^warning: \[\.WebGL-[0-9a-fx]+\]GL Driver Message .*GPU stall due to ReadPixels/, why: 'テスト環境の GPU' },
	// 受け手のいない失敗を見せる例。Firefox は Worker の中の失敗を、受け取って止めても Console に記録する
	{ page: '11-非同期.html', browser: 'firefox', text: /^error: \[JavaScript Error: "Error: 読み込み失敗"/, why: '受け手のいない失敗を見せる例' },
];
function unknownConsole(messages: string[], page: string, browserName: string): string[] {
	return messages.filter((m) => !KNOWN_CONSOLE.some((k) => k.page === page && (!k.browser || k.browser === browserName) && k.text.test(m)));
}

for (const page of pages(docsDir)) {
	const runnable = examplesOf(docsDir, page).filter((e) => e.run !== 'file');
	if (runnable.length === 0) continue;
	test(`${page} の実行ボタンは、載せた出力と同じ結果を表示する`, async ({ page: p, browserName }) => {
		test.setTimeout(30000 + runnable.length * 8000);
		// 例の出力は runner.js が受け取って画面に出すので、ブラウザの Console には何も出ないはず。出たものは資料の不具合
		const warnings: string[] = [];
		p.on('console', (m) => {
			if (m.type() === 'warning' || m.type() === 'error') warnings.push(`${m.type()}: ${m.text()}`);
		});
		p.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
		await p.goto(`${base}/docs/${encodeURIComponent(page)}`);
		const blocks = p.locator('.example[data-run="worker"], .example[data-run="node"], .example[data-run="dom"]');
		await expect(blocks).toHaveCount(runnable.length);
		// 置いておくだけのファイル（data-run="file"）には、実行ボタンを付けない
		await expect(p.locator('.example[data-run="file"] .run-btn')).toHaveCount(0);
		for (let i = 0; i < runnable.length; i++) {
			if (skipNet && runnable[i].net) continue;
			const block = blocks.nth(i);
			await block.locator('.b-run').click();
			const panel = block.locator('.console');
			await expect(panel).toHaveAttribute('data-state', 'done', { timeout: runnable[i].net ? 20000 : 8000 });
			const lines = await panel.locator('.line:not(.note)').allTextContents();
			// DOM の例は、console に何も出さないものがある。そのときは出力欄を載せず、エラーも出ないことを確かめる
			const expected = runnable[i].expected ?? '';
			expect.soft(asV8(lines.join('\n'), expected, browserName), `${page} の例 ${runnable[i].index + 1}`).toBe(expected);
		}
		expect.soft(unknownConsole(warnings, page, browserName), `${page} の Console の警告とエラー`).toEqual([]);
	});
}
