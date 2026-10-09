// docs/js/inspect.js が、Node の console.log と同じ文字列を作ることを確かめる。
// ブラウザで「実行」したときの表示が、資料に載せた Node の出力と食い違わないようにするため。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { format, inspect } from 'node:util';
import vm from 'node:vm';

type Jsl = { inspect: (v: unknown) => string; formatArgs: (a: unknown[]) => string };

function load(): Jsl {
	const src = readFileSync(join(import.meta.dirname, '..', 'docs', 'js', 'inspect.js'), 'utf8');
	const ctx: { self: Record<string, unknown> } = { self: {} };
	vm.runInNewContext(src, ctx);
	return ctx.self.JslInspect as Jsl;
}

// vm の中で値を作ると、配列やオブジェクトの判定が Node 側と別の世界になる。
// そこで値は式の文字列で持ち、inspect.js と同じ世界で作る。
// 値そのものを外へ持ち出すと Bun では Symbol が undefined になるため、Node の inspect も中で呼ぶ。
function inBoth(expr: string): { mine: string; node: string } {
	const src = readFileSync(join(import.meta.dirname, '..', 'docs', 'js', 'inspect.js'), 'utf8');
	const ctx: { self: Record<string, unknown>; nodeInspect: typeof inspect; mine?: string; node?: string } = { self: {}, nodeInspect: inspect };
	vm.createContext(ctx);
	vm.runInContext(src, ctx);
	vm.runInContext(`const value = (${expr}); mine = self.JslInspect.inspect(value); node = nodeInspect(value);`, ctx);
	return { mine: ctx.mine as string, node: ctx.node as string };
}

const VALUES = [
	'1', '-0', '1.5', 'NaN', 'Infinity', '10n', 'true', 'undefined', 'null', '"abc"', `"it's"`, `"a\\nb"`, 'Symbol("s")',
	'[]', '{}', '[1, 2, 3]', '["a", "b"]', '[1, "a", { b: [1, { c: { d: 1 } }] }]',
	'[undefined, null]', '[ , 1]', 'new Array(3)',
	'{ name: "Alice", age: 20 }', '{ name: "Alice", age: 20, city: "Tokyo", hobby: ["read", "run"], x: 1 }',
	'{ "a-b": 1, 2: 3 }', '{ f() {} }', '{ a: { b: { c: {} } } }', '[[[[1]]]]',
	'Array.from({ length: 10 }, (_, i) => i + 1)', 'Array.from({ length: 30 }, (_, i) => i)',
	'["apple", "banana", "cherry", "durian", "elderberry", "fig", "grape"]',
	'Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i))',
	'Array.from({ length: 120 }, (_, i) => i)',
	'new Map([[1, "x"], ["k", { a: 1 }]])', 'new Set([1, 2, 3])', 'new Map()', 'new Set()',
	'function f() {}', '() => 1', 'async function g() {}', 'function* h() {}', 'class A {}', 'class B extends Array {}',
	'new (class P { constructor() { this.x = 1; } })()', 'Object.create(null)', 'new Date(0)', '/ab+c/gi',
	'{ get v() { return 1; }, set v(x) {} }', '{ get only() { return 1; } }',
	'[1.5, NaN, Infinity, -0]', '{ s: "x".repeat(20), t: "y".repeat(20), u: "z".repeat(20) }',
	'[{ id: 1, name: "A" }, { id: 2, name: "B" }, { id: 3, name: "C" }]',
	'{ list: [1, 2, 3], nested: { deep: { deeper: { deepest: 1 } } } }',
];

for (const expr of VALUES) {
	test(`inspect.js は Node と同じ形で表示する: ${expr}`, () => {
		const { mine, node } = inBoth(expr);
		assert.equal(mine, node);
	});
}

test('inspect.js は循環参照を Node と同じく <ref *1> と [Circular *1] で表す', () => {
	const { mine, node } = inBoth('(() => { const o = { a: 1 }; o.self = o; return o; })()');
	assert.equal(mine, node);
});

test('formatArgs は文字列をそのまま、それ以外を inspect して空白でつなぐ', () => {
	const jsl = load();
	assert.equal(jsl.formatArgs(['a', 1, 'b', true]), format('a', 1, 'b', true));
	assert.equal(jsl.formatArgs(['%s は %d 歳', 'Alice', 20]), format('%s は %d 歳', 'Alice', 20));
	assert.equal(jsl.formatArgs(['100%']), format('100%'));
	assert.equal(jsl.formatArgs([]), format());
});
