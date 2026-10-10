// 23 章のハンズオンの完成形（ToDo）を、実際に操作して確かめる。
// examples.spec.ts は最初の出力しか見ないため、宿題の完成形が本当に動くかをここで見る。
import { test, expect, type FrameLocator, type Page } from '@playwright/test';
import type { Server } from 'node:http';
import { join } from 'node:path';
import { startServer } from '../helpers/static-server.ts';

const root = join(__dirname, '..', '..');
let server: Server;
let base = '';

test.beforeAll(async () => {
	({ server, base } = await startServer(root));
});
test.afterAll(() => {
	server.close();
});

async function runFinalApp(page: Page): Promise<FrameLocator> {
	const block = page.locator('.example[data-run="dom"]').last();
	await block.locator('.b-run').click();
	await expect(block.locator('.console')).toHaveAttribute('data-state', 'done', { timeout: 8000 });
	return block.frameLocator('.example-frame');
}

test('23 章の完成形は、追加 ・ 完了 ・ 削除ができ、実行し直しても中身が残る', async ({ page }) => {
	await page.goto(`${base}/docs/${encodeURIComponent('23-ハンズオン.html')}`);
	let app = await runFinalApp(page);
	await expect(app.locator('#summary')).toHaveText('残り 1 件 / 全 2 件');

	await app.locator('#title').fill('傘を持つ');
	await app.locator('#title').press('Enter');
	await expect(app.locator('#summary')).toHaveText('残り 2 件 / 全 3 件');
	await expect(app.locator('#list li span').last()).toHaveText('傘を持つ');

	// 空の入力は足さない
	await app.locator('#title').fill('   ');
	await app.locator('#title').press('Enter');
	await expect(app.locator('#summary')).toHaveText('残り 2 件 / 全 3 件');

	// 1 件目を済にする
	await app.locator('#list li').first().locator('input[type=checkbox]').click();
	await expect(app.locator('#summary')).toHaveText('残り 1 件 / 全 3 件');
	await expect(app.locator('#list li').first()).toHaveClass(/done/);

	// 2 件目（資料を読む）を削除する
	await app.locator('#list li').nth(1).locator('button.delete').click();
	await expect(app.locator('#list li span')).toHaveText(['牛乳を買う', '傘を持つ']);

	// 実行し直しても、保存した中身から始まる
	app = await runFinalApp(page);
	await expect(app.locator('#list li span')).toHaveText(['牛乳を買う', '傘を持つ']);
	await expect(app.locator('#summary')).toHaveText('残り 1 件 / 全 2 件');

	// 済んだものを消す ・ 最初の状態に戻す
	await app.locator('#clear').click();
	await expect(app.locator('#list li span')).toHaveText(['傘を持つ']);
	await app.locator('#reset').click();
	await expect(app.locator('#summary')).toHaveText('残り 1 件 / 全 2 件');
});
