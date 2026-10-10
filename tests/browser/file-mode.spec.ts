// 資料をファイルとして直接開いた（file://）ときも、第1部の例が載せた出力のとおりに動くことを確かめる。
// file:// のページからは Worker を作れないため、runner.js は iframe で実行する。その代わりの道が正しいかを見る。
import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { examplesOf, pages } from '../helpers/examples.ts';

const docsDir = join(__dirname, '..', '..', 'docs');

for (const page of pages(docsDir)) {
	const all = examplesOf(docsDir, page).filter((e) => e.run !== 'file');
	if (!all.some((e) => e.run === 'worker')) continue;
	test(`${page} を file:// で開いても、第1部の例は載せた出力のとおりに動く`, async ({ page: p }) => {
		test.setTimeout(30000 + all.length * 6000);
		await p.goto(pathToFileURL(join(docsDir, page)).href);
		const blocks = p.locator('.example[data-run="worker"], .example[data-run="node"], .example[data-run="dom"]');
		for (let i = 0; i < all.length; i++) {
			if (all[i].run !== 'worker') continue;
			const block = blocks.nth(i);
			await block.locator('.b-run').click();
			const panel = block.locator('.console');
			await expect(panel).toHaveAttribute('data-state', 'done', { timeout: 8000 });
			await expect(panel.locator('.console-head')).toContainText('iframe');
			const lines = await panel.locator('.line:not(.note)').allTextContents();
			expect.soft(lines.join('\n'), `${page} の例 ${all[i].index + 1}`).toBe(all[i].expected);
		}
	});
}

test('file:// で開いたとき、fetch を使う例は、使えない理由を表示する', async ({ page: p }) => {
	await p.goto(pathToFileURL(join(docsDir, '18-通信.html')).href);
	const block = p.locator('.example[data-run="dom"]').first();
	await block.locator('.b-run').click();
	await expect(block.locator('.console')).toHaveAttribute('data-state', 'done', { timeout: 8000 });
	const text = (await block.locator('.line').allTextContents()).join('\n');
	expect(text).toContain('file:// で開いたページでは fetch を使えません');
	expect(text).not.toContain('Script error');
});
