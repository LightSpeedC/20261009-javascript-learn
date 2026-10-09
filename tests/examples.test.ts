// 資料に載せた例を Node で実際に動かし、載せた出力と一致することを確かめる。
// 「コードは実際に動かしてから載せる」を、書き換えのたびに機械で確かめるためのテスト。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { examplesOf, pages } from './helpers/examples.ts';

const root = join(import.meta.dirname, '..');
const docsDir = join(root, 'docs');
const harness = join(import.meta.dirname, 'helpers', 'node-harness.cjs');
// 読者が使うサンプルのデータ（docs/samples）を、そのまま作業フォルダへ写して使う
const fixture = join(docsDir, 'samples');
const work = join(root, 'tmp', 'examples');

// 資料の出力は Node.js のもの。テストを bun で流しても、例はいつも node で実行する
// （process.execPath は bun で流すと bun になり、表示もエラーの文面も変わる）
function run(args: string[], cwd: string): string {
	const r = spawnSync('node', args, { cwd, encoding: 'utf8', timeout: 15000 });
	if (r.error) throw r.error;
	return (r.stdout + r.stderr).replace(/\n$/, '');
}

for (const page of pages(docsDir)) {
	const examples = examplesOf(docsDir, page);
	if (examples.length === 0) continue;
	// Node でしか動かない例は、ページごとに作り直した作業フォルダの中で、書いてある順に実行する
	const dir = join(work, page.replace(/\.html$/, ''));
	let prepared = false;
	function prepare(): void {
		if (prepared) return;
		prepared = true;
		rmSync(dir, { recursive: true, force: true });
		mkdirSync(dir, { recursive: true });
		cpSync(fixture, dir, { recursive: true });
		for (const ex of examples) {
			if (ex.run === 'worker' || !ex.filename) continue;
			mkdirSync(dirname(join(dir, ex.filename)), { recursive: true });
			writeFileSync(join(dir, ex.filename), ex.code);
		}
	}

	for (const ex of examples) {
		if (ex.run === 'file') continue;
		const name = `${page} の例 ${ex.index + 1}${ex.filename ? `（${ex.filename}）` : ''} は載せた出力のとおりに動く`;
		test(name, () => {
			assert.notEqual(ex.expected, null, '出力（pre.output）がありません');
			if (ex.run === 'worker') {
				mkdirSync(work, { recursive: true });
				const file = join(work, `${page.replace(/\.html$/, '')}-${ex.index + 1}.js`);
				writeFileSync(file, ex.code);
				assert.equal(run([harness, file], work), ex.expected);
			} else {
				assert.ok(ex.filename, 'ファイル名（p.filename）がありません');
				prepare();
				assert.equal(run([ex.filename!], dir), ex.expected);
			}
		});
	}
}
