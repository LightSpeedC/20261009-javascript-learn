// docs/ の資料に、機械で決まる部分を書き込む。何度実行しても同じ結果になる。
//   <!-- AUTO:nav -->   前へ・次へ・目次のバッジ（上下 2 か所）
//   <!-- AUTO:toc -->   ページ内の章の目次（section の h1 から作る）
//   /* AUTO:style */    章の色（章数で虹色を割る）と、番号の数え方
//   <!-- AUTO:list -->  docs/README.html の資料一覧（本編と付録を通しの色で並べる）
// 使い方: node tools/20_build/build-docs.ts
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const docsDir = join(import.meta.dirname, '..', '..', 'docs');

type Doc = { file: string; num: string; title: string; lead: string };

function hue(i: number, n: number): number {
	if (n <= 1) return 280;
	return Math.round((280 - (280 / (n - 1)) * i) * 10) / 10;
}
function colors(h: number): string {
	return `--accent:hsl(${h},78%,25%);--accent2:hsl(${h},58%,55%);--soft:hsl(${h},28%,95%);`;
}

function order(num: string): number {
	if (/^\d\d$/.test(num)) return Number(num);
	if (/^A\d$/.test(num)) return 100 + Number(num.slice(1));
	return 1000;
}

function partOf(num: string): string {
	if (/^A\d$/.test(num)) return '付録';
	if (num === 'ZZ') return '構成';
	return Number(num) <= 13 ? '第1部 言語編' : '第2部 ブラウザ編';
}

// 資料一覧で、部ごとに付ける見出しの説明
const PART_DESC: Record<string, string> = {
	'第1部 言語編': 'Node.js で、言語そのものを学ぶ（勉強会 第1〜4回。13 は宿題）',
	'第2部 ブラウザ編': 'ブラウザで、画面を動かす（勉強会 第5〜6回。23 は宿題）',
	'付録': '順に読まず、困ったときに引く',
};

const ICON = {
	prev: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 2.5 4.5 8l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	next: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5 11.5 8 6 13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	home: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.8 8 8 2.4 14.2 8M3.8 6.6v7h3.3V10h1.8v3.6h3.3v-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

function stripTags(s: string): string {
	return s.replace(/<[^>]+>/g, '').trim();
}

function readDoc(file: string): Doc {
	const html = readFileSync(join(docsDir, file), 'utf8');
	const title = /<div class="titlebar">[\s\S]*?<h1>([\s\S]*?)<\/h1>/.exec(html);
	const lead = /<div class="titlebar">[\s\S]*?<p class="lead">([\s\S]*?)<\/p>/.exec(html);
	if (!title) throw new Error(`タイトルバーの h1 が見つかりません: ${file}`);
	return { file, num: file.split('-')[0], title: stripTags(title[1]), lead: lead ? stripTags(lead[1]) : '' };
}

function replaceBlock(html: string, start: string, end: string, body: string, file: string, required: boolean): string {
	const re = new RegExp(escapeRe(start) + '[\\s\\S]*?' + escapeRe(end), 'g');
	if (!re.test(html)) {
		if (required) throw new Error(`${start} が見つかりません: ${file}`);
		return html;
	}
	return html.replace(re, () => start + body + end);
}
// 中身が変わらないときは書かない。更新時刻だけが進むと、html2md が更新日の警告を出すため
function writeIfChanged(path: string, html: string): void {
	if (readFileSync(path, 'utf8') !== html) writeFileSync(path, html);
}
function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
function escapeAttr(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const files = readdirSync(docsDir).filter((f) => /^(\d\d|A\d|ZZ)-.+\.html$/.test(f));
const docs = files.map(readDoc).sort((a, b) => order(a.num) - order(b.num));
const series = docs.filter((d) => d.num !== 'ZZ');
const main = series.filter((d) => /^\d\d$/.test(d.num));
const hueOf = new Map(series.map((d, i) => [d.file, hue(i, series.length)]));

function link(target: Doc, label: string, icon: string): string {
	const h = hueOf.get(target.file) ?? 280;
	return `<a class="doclink" href="${target.file}" aria-label="${label}" title="${escapeAttr(target.title)}" style="${colors(h)}">${icon}</a>`;
}
function homeLink(): string {
	return `<a class="doclink home" href="README.html" aria-label="目次" title="資料一覧">${ICON.home}</a>`;
}

for (const doc of docs) {
	const path = join(docsDir, doc.file);
	let html = readFileSync(path, 'utf8');
	const links: string[] = [];
	const mi = main.findIndex((d) => d.file === doc.file);
	if (mi > 0) links.push(link(main[mi - 1], '前へ', ICON.prev));
	if (mi >= 0 && mi < main.length - 1) links.push(link(main[mi + 1], '次へ', ICON.next));
	links.push(homeLink());
	html = replaceBlock(html, '<!-- AUTO:nav -->', '<!-- /AUTO:nav -->', `<p class="docnav">${links.join('')}</p>`, doc.file, true);

	const sections = [...html.matchAll(/<section class="(ch\d\d)" id="\1">\s*<h1>([\s\S]*?)<\/h1>/g)];
	const toc = sections.map((m) => `<li class="${m[1]}"><a href="#${m[1]}">${m[2]}</a></li>`).join('\n');
	html = replaceBlock(html, '<!-- AUTO:toc -->', '<!-- /AUTO:toc -->', `\n<nav class="toc"><ol>\n${toc}\n</ol></nav>\n`, doc.file, false);

	const n = sections.length;
	const css = sections.map((m, i) => `.${m[1]}{${colors(hue(i, n))}}`);
	css.push(`.toc ol{counter-reset:tocnum;} .toc ol li{counter-increment:tocnum;} .toc ol a::before{content:"${doc.num}." counter(tocnum) " ";}`);
	css.push(`body{counter-reset:secnum;} section h1{counter-increment:secnum;} section h1::before{content:"${doc.num}." counter(secnum) " ";}`);
	html = replaceBlock(html, '/* AUTO:style */', '/* /AUTO:style */', '\n' + css.join('\n') + '\n', doc.file, true);
	writeIfChanged(path, html);
}

// 資料一覧。docs/README.html と、トップで資料が目立つように root の README.html の両方に書く
// 部ごとに見出しを付けて分ける。カードの色は、部をまたいだ通しの色のまま
function chapterList(prefix: string): string {
	const groups = new Map<string, Doc[]>();
	for (const d of series) {
		const part = partOf(d.num);
		if (!groups.has(part)) groups.set(part, []);
		groups.get(part)!.push(d);
	}
	const blocks = [...groups].map(([part, docs]) => {
		// 部の名前（span.part）は見出しと重なるので画面では隠すが、html2md が表の 1 列目に使うため残す
		const items = docs.map((d) => `<li><a href="${prefix}${d.file}" style="${colors(hueOf.get(d.file) ?? 280)}">` +
			`<span class="part">${part}</span><span class="ttl">${d.title}</span><span class="desc">${d.lead}</span></a></li>`);
		return `<h3 class="part-head">${part}</h3>\n<p class="part-desc">${PART_DESC[part] ?? ''}</p>\n` +
			`<ul class="chapters grouped" data-columns="部,タイトル,内容">\n${items.join('\n')}\n</ul>`;
	});
	return `\n${blocks.join('\n')}\n`;
}
for (const [path, prefix, label] of [
	[join(docsDir, 'README.html'), '', 'docs/README.html'],
	[join(docsDir, '..', 'README.html'), 'docs/', 'README.html'],
]) {
	const html = readFileSync(path, 'utf8');
	writeIfChanged(path, replaceBlock(html, '<!-- AUTO:list -->', '<!-- /AUTO:list -->', chapterList(prefix), label, true));
}

console.log(`資料 ${docs.length} 件にナビ・目次・章の色を書き込みました（一覧 ${series.length} 件）`);
