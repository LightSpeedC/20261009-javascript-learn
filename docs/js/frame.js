/*
 * 第2部の DOM の例（data-run="dom"）を動かす iframe の中で、最初に読み込む。
 * console の出力と、捕まえられなかったエラーを postMessage でページ（runner.js）へ送る。
 * Worker と違ってページと同じ流れで動くので、無限ループを書くとページごと固まる。
 */
(function () {
	'use strict';
	const send = (msg) => parent.postMessage(Object.assign({ jsl: true }, msg), '*');
	const native = {
		setTimeout: window.setTimeout.bind(window),
		clearTimeout: window.clearTimeout.bind(window),
		setInterval: window.setInterval.bind(window),
		clearInterval: window.clearInterval.bind(window),
		fetch: window.fetch ? window.fetch.bind(window) : null,
	};
	// 動いているタイマーと、返事を待っている通信の数。両方 0 が続いたら、例の実行が終わったとみなす
	const timers = new Set();
	let pending = 0;
	// 例のスクリプトが最後まで進んだか（一番外側の await で CDN を読み込む例があるため）。エラーで止まったときも立てる
	window.__jslMainDone = false;
	let groupIndent = '';
	const counts = new Map();

	window.setTimeout = function (fn, ms, ...args) {
		const id = native.setTimeout(() => {
			timers.delete(id);
			if (typeof fn === 'function') fn(...args);
		}, ms);
		timers.add(id);
		return id;
	};
	window.clearTimeout = function (id) {
		timers.delete(id);
		native.clearTimeout(id);
	};
	window.setInterval = function (fn, ms, ...args) {
		const id = native.setInterval(() => {
			if (typeof fn === 'function') fn(...args);
		}, ms);
		timers.add(id);
		return id;
	};
	window.clearInterval = function (id) {
		timers.delete(id);
		native.clearInterval(id);
	};
	if (native.fetch) {
		window.fetch = function (...args) {
			pending++;
			const p = native.fetch(...args);
			p.then(() => pending--, () => pending--);
			return p;
		};
	}

	function out(level, text) {
		const lines = String(text).split('\n').map((l) => groupIndent + l).join('\n');
		send({ type: 'log', level, text: lines });
	}
	const fmt = (args) => window.JslInspect.formatArgs(args);
	const c = {
		log: (...a) => out('log', fmt(a)),
		info: (...a) => out('log', fmt(a)),
		debug: (...a) => out('log', fmt(a)),
		warn: (...a) => out('warn', fmt(a)),
		error: (...a) => out('error', fmt(a)),
		dir: (v) => out('log', window.JslInspect.inspect(v)),
		table: (...a) => out('log', fmt(a)),
		assert: (cond, ...a) => {
			if (!cond) out('error', a.length ? 'Assertion failed: ' + fmt(a) : 'Assertion failed');
		},
		count: (label = 'default') => {
			const n = (counts.get(label) || 0) + 1;
			counts.set(label, n);
			out('log', label + ': ' + n);
		},
		group: (...a) => {
			if (a.length) out('log', fmt(a));
			groupIndent += '  ';
		},
		groupEnd: () => {
			groupIndent = groupIndent.slice(2);
		},
	};
	window.console = Object.assign(Object.create(window.console), c);

	function describeError(e) {
		if (e instanceof Error || (e && typeof e === 'object' && 'name' in e && 'message' in e)) {
			return e.name + ': ' + e.message;
		}
		return window.JslInspect.inspect(e);
	}
	window.addEventListener('error', (ev) => {
		// 画像などの読み込みの失敗は対象外（ev.error が無く、target が要素）
		if (ev.target && ev.target !== window) return;
		ev.preventDefault();
		window.__jslMainDone = true;
		out('error', 'Uncaught ' + (ev.error !== undefined && ev.error !== null ? describeError(ev.error) : ev.message));
	}, true);
	window.addEventListener('unhandledrejection', (ev) => {
		ev.preventDefault();
		out('error', 'Uncaught (in promise) ' + describeError(ev.reason));
	});

	// 画面の高さを親に伝えて、iframe の高さを合わせてもらう
	function reportHeight() {
		send({ type: 'height', value: document.documentElement.scrollHeight });
	}
	window.addEventListener('load', reportHeight);
	if (window.ResizeObserver) {
		document.addEventListener('DOMContentLoaded', () => new ResizeObserver(reportHeight).observe(document.body));
	}

	// 例のスクリプトの後に呼ばれる。タイマーと通信が 0 の状態が続いたら終わりとみなす
	window.__jslStart = function () {
		let idle = 0;
		const tick = () => {
			idle = window.__jslMainDone && timers.size === 0 && pending === 0 ? idle + 1 : 0;
			if (idle >= 4) {
				reportHeight();
				send({ type: 'done' });
			} else {
				native.setTimeout(tick, 50);
			}
		};
		native.setTimeout(tick, 50);
	};
})();
