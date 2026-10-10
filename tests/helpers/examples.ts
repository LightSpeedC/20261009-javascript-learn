// 資料の HTML から、実行できる例（<div class="example" data-run="…">）を取り出す。
// examples.test.ts（Node で実行）と browser/examples.spec.ts（ブラウザで実行）の両方が使う。
// Playwright は spec を CommonJS に変換して読むため、ここでは import.meta を使わず、docs の場所を引数で受け取る。
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export type Example = {
	page: string;
	index: number;
	run: 'worker' | 'node' | 'file' | 'dom';
	// 外の CDN から読み込む例（data-net="cdn"）。ネットワークが無い環境では飛ばせるようにする
	net: boolean;
	filename: string | null;
	code: string;
	expected: string | null;
};

// コードの中の < は &lt; と書く決まり。生の < があると、タグの始まりと読まれて後ろが消えることがある
export function unescapeHtml(s: string): string {
	if (s.includes('<')) throw new Error(`コードや出力の中の < は &lt; と書いてください: ${s.slice(0, 60)}`);
	return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

export function pages(docsDir: string): string[] {
	return readdirSync(docsDir).filter((f) => /^(\d\d|A\d|ZZ)-.+\.html$/.test(f)).sort();
}

export function examplesOf(docsDir: string, page: string): Example[] {
	const html = readFileSync(join(docsDir, page), 'utf8');
	// 例に限らず、ページのすべてのコードを確かめる（HTML のコードも &lt; で書く）
	for (const block of html.matchAll(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/g)) {
		if (block[1].includes('<')) throw new Error(`${page} のコードの中に生の < があります。&lt; と書いてください: ${block[1].slice(0, 60)}`);
	}
	const list: Example[] = [];
	const re = /<div class="example" data-run="(worker|node|file|dom)"( data-net="cdn")?>([\s\S]*?)<\/div>/g;
	let m: RegExpExecArray | null;
	let index = 0;
	while ((m = re.exec(html)) !== null) {
		const body = m[3];
		// 置いておくだけのファイル（data-run="file"）には package.json などの JSON もある
		const code = /<pre><code class="language-(?:javascript|json)">([\s\S]*?)<\/code><\/pre>/.exec(body);
		const out = /<pre class="output"><code class="language-text">([\s\S]*?)<\/code><\/pre>/.exec(body);
		// ファイル名は、スクリプトのすぐ上の見出し（DOM の例は HTML 側にも付くため）
		const file = /<p class="filename">([^<]*)<\/p>\s*<pre><code class="language-(?:javascript|json)">/.exec(body);
		if (!code) throw new Error(`${page} の ${index + 1} 番目の例にコードがありません`);
		list.push({
			page,
			index: index++,
			run: m[1] as Example['run'],
			net: m[2] !== undefined,
			filename: file ? unescapeHtml(file[1]).trim() : null,
			code: unescapeHtml(code[1]),
			expected: out ? unescapeHtml(out[1]).replace(/\n$/, '') : null,
		});
	}
	return list;
}
