/*
 * 資料の例を実行する Web Worker。ページとは別のスレッドで動くので、無限ループでも資料は固まらない。
 * console の出力と、捕まえられなかったエラーを postMessage でページ（runner.js）へ送る。
 */
'use strict';
importScripts('inspect.js');

(function () {
	const send = (msg) => self.postMessage(msg);
	const native = {
		setTimeout: self.setTimeout.bind(self),
		clearTimeout: self.clearTimeout.bind(self),
		setInterval: self.setInterval.bind(self),
		clearInterval: self.clearInterval.bind(self),
	};
	// 動いているタイマ。0 になったら、例の実行が終わったとみなす
	const timers = new Set();
	let groupIndent = '';
	const counts = new Map();
	const timeLabels = new Map();

	self.setTimeout = function (fn, ms, ...args) {
		const id = native.setTimeout(() => {
			timers.delete(id);
			if (typeof fn === 'function') fn(...args);
		}, ms);
		timers.add(id);
		return id;
	};
	self.clearTimeout = function (id) {
		timers.delete(id);
		native.clearTimeout(id);
	};
	self.setInterval = function (fn, ms, ...args) {
		const id = native.setInterval(() => {
			if (typeof fn === 'function') fn(...args);
		}, ms);
		timers.add(id);
		return id;
	};
	self.clearInterval = function (id) {
		timers.delete(id);
		native.clearInterval(id);
	};

	function out(level, text) {
		const lines = String(text).split('\n').map((l) => groupIndent + l).join('\n');
		send({ type: 'log', level, text: lines });
	}
	const fmt = (args) => self.JslInspect.formatArgs(args);
	const c = {
		log: (...a) => out('log', fmt(a)),
		info: (...a) => out('log', fmt(a)),
		debug: (...a) => out('log', fmt(a)),
		warn: (...a) => out('warn', fmt(a)),
		error: (...a) => out('error', fmt(a)),
		dir: (v) => out('log', self.JslInspect.inspect(v)),
		table: (...a) => out('log', fmt(a)),
		trace: (...a) => out('log', 'Trace: ' + fmt(a)),
		assert: (cond, ...a) => {
			if (!cond) out('error', a.length ? 'Assertion failed: ' + fmt(a) : 'Assertion failed');
		},
		count: (label = 'default') => {
			const n = (counts.get(label) || 0) + 1;
			counts.set(label, n);
			out('log', label + ': ' + n);
		},
		countReset: (label = 'default') => counts.delete(label),
		group: (...a) => {
			if (a.length) out('log', fmt(a));
			groupIndent += '  ';
		},
		groupEnd: () => {
			groupIndent = groupIndent.slice(2);
		},
		time: (label = 'default') => timeLabels.set(label, performance.now()),
		timeEnd: (label = 'default') => {
			const start = timeLabels.get(label);
			if (start === undefined) return;
			timeLabels.delete(label);
			out('log', label + ': ' + (performance.now() - start).toFixed(3) + 'ms');
		},
	};
	c.groupCollapsed = c.group;
	self.console = c;

	function describeError(e) {
		if (e instanceof Error || (e && typeof e === 'object' && 'name' in e && 'message' in e && 'stack' in e)) {
			return e.name + ': ' + e.message;
		}
		return self.JslInspect.inspect(e);
	}
	function reportError(e, inPromise) {
		out('error', (inPromise ? 'Uncaught (in promise) ' : 'Uncaught ') + describeError(e));
	}

	self.addEventListener('error', (ev) => {
		ev.preventDefault();
		reportError(ev.error !== undefined ? ev.error : ev.message, false);
	});
	self.addEventListener('unhandledrejection', (ev) => {
		ev.preventDefault();
		reportError(ev.reason, true);
	});

	// タイマが 0 の状態が続いたら終わりとみなして知らせる
	function watchIdle() {
		let idle = 0;
		const tick = () => {
			idle = timers.size === 0 ? idle + 1 : 0;
			if (idle >= 2) send({ type: 'done' });
			else native.setTimeout(tick, 30);
		};
		native.setTimeout(tick, 30);
	}

	self.onmessage = (ev) => {
		self.onmessage = null;
		try {
			(0, eval)(ev.data.code);
		} catch (e) {
			reportError(e, false);
		}
		watchIdle();
	};
})();
