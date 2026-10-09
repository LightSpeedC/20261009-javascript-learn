// 資料の「実行」ボタンを、実際のブラウザ（Chromium）で押して、載せた出力と一致することを確かめる。
// examples.test.ts は Node で確かめるが、こちらは Worker ・ inspect.js ・ runner.js を通した表示を見る。
// 実行: tools/40_test/run-tests.ps1（PlayWright 共有環境の playwright-test を使う）
import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { examplesOf, pages } from '../helpers/examples.ts';

// Playwright は spec を CommonJS に変換して読むので、import.meta ではなく __dirname を使う
const root = join(__dirname, '..', '..');
const docsDir = join(root, 'docs');
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
let server: Server;
let base = '';

test.beforeAll(async () => {
	server = createServer(async (req, res) => {
		const path = normalize(join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)));
		if (!path.startsWith(root)) {
			res.writeHead(403).end();
			return;
		}
		try {
			const body = await readFile(path);
			res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
		} catch {
			res.writeHead(404).end();
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const addr = server.address();
	base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
test.afterAll(() => {
	server.close();
});

for (const page of pages(docsDir)) {
	const runnable = examplesOf(docsDir, page).filter((e) => e.run !== 'file');
	if (runnable.length === 0) continue;
	test(`${page} の実行ボタンは、載せた出力と同じ結果を表示する`, async ({ page: p }) => {
		test.setTimeout(30000 + runnable.length * 6000);
		await p.goto(`${base}/docs/${encodeURIComponent(page)}`);
		const blocks = p.locator('.example[data-run="worker"], .example[data-run="node"]');
		await expect(blocks).toHaveCount(runnable.length);
		for (let i = 0; i < runnable.length; i++) {
			const block = blocks.nth(i);
			await block.locator('.b-run').click();
			const panel = block.locator('.console');
			await expect(panel).toHaveAttribute('data-state', 'done', { timeout: 8000 });
			const lines = await panel.locator('.line:not(.note)').allTextContents();
			expect.soft(lines.join('\n'), `${page} の例 ${runnable[i].index + 1}`).toBe(runnable[i].expected);
		}
	});
}
