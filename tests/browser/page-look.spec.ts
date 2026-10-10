// 資料の各ページを開いたときの見た目の崩れと、Console の警告 ・ エラーを確かめる。ブラウザごとに流す。
//   - パソコンの幅とスマートフォンの幅で、ページが横にはみ出さない（はみ出すと、ページ全体が横に動く）
//   - 開いただけで、Console に警告もエラーも出ない
// JSL_SHOTS=1 を付けると、ページ全体のスクリーンショットを tmp/shots/<ブラウザ>/ に残す。目で見比べるときに使う
import { test, expect } from '@playwright/test';
import type { Server } from 'node:http';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startServer } from '../helpers/static-server.ts';

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

const targets = [
	'README.html',
	...readdirSync(docsDir)
		.filter((f) => /^(\d\d|A\d|ZZ)-.+\.html$/.test(f))
		.map((f) => `docs/${f}`),
];
const widths = [
	{ name: 'パソコン', width: 1280, height: 900 },
	{ name: 'スマートフォン', width: 375, height: 800 },
];

for (const target of targets) {
	test(`${target} は、どの幅でも横にはみ出さず、開いても Console に警告もエラーも出ない`, async ({ page: p, browserName }) => {
		const warnings: string[] = [];
		p.on('console', (m) => {
			if (m.type() === 'warning' || m.type() === 'error') warnings.push(`${m.type()}: ${m.text()}`);
		});
		p.on('pageerror', (e) => warnings.push(`pageerror: ${e.message}`));
		for (const w of widths) {
			await p.setViewportSize({ width: w.width, height: w.height });
			await p.goto(`${base}/${target.split('/').map(encodeURIComponent).join('/')}`);
			await p.waitForLoadState('load');
			const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
			expect.soft(over, `${target}（${w.name}の幅 ${w.width}px）で横にはみ出した幅`).toBeLessThanOrEqual(0);
			if (process.env.JSL_SHOTS === '1') {
				const name = target.replace(/^docs\//, '').replace(/\.html$/, '');
				await p.screenshot({ path: join(root, 'tmp', 'shots', browserName, `${name}-${w.width}.png`), fullPage: true });
			}
		}
		expect.soft(warnings, `${target} の Console の警告とエラー`).toEqual([]);
	});
}
