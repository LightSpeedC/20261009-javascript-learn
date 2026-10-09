/*
 * 資料の例に「実行」ボタンを付ける。
 *   <div class="example" data-run="worker"> … ブラウザの Worker で実際に実行する
 *   <div class="example" data-run="node">   … Node.js で実行した結果（記録）を表示する
 * 例の中の <pre class="output"> は、記録した出力。JavaScript が動かない環境（Markdown 等）ではそのまま見える。
 */
(function () {
	'use strict';

	const TIME_LIMIT_MS = 5000;
	const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
	const workerUrl = new URL('worker.js', scriptUrl);

	const KEYWORDS = new Set(('await break case catch class const continue debugger default delete do else export extends ' +
		'false finally for from function if import in instanceof let new null of return static super switch this throw true ' +
		'try typeof undefined var void while with yield async get set').split(' '));
	const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`)|(\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)n?\b)|([A-Za-z_$][\w$]*)/g;

	function escapeHtml(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// コードに色を付ける。資料の読みやすさのためだけの簡易なもの
	function highlight(code) {
		let html = '';
		let last = 0;
		TOKEN.lastIndex = 0;
		let m;
		while ((m = TOKEN.exec(code)) !== null) {
			html += escapeHtml(code.slice(last, m.index));
			const text = escapeHtml(m[0]);
			if (m[1]) html += '<span class="tk-com">' + text + '</span>';
			else if (m[2]) html += '<span class="tk-str">' + text + '</span>';
			else if (m[3]) html += '<span class="tk-num">' + text + '</span>';
			else if (KEYWORDS.has(m[4])) html += '<span class="tk-key">' + text + '</span>';
			else html += text;
			last = TOKEN.lastIndex;
		}
		return html + escapeHtml(code.slice(last));
	}

	function button(label, cls) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'run-btn ' + cls;
		b.textContent = label;
		return b;
	}

	function setupExample(ex) {
		const kind = ex.dataset.run;
		const codeEl = ex.querySelector('pre:not(.output) > code');
		const outputPre = ex.querySelector('pre.output');
		if (!codeEl) return;
		const original = codeEl.textContent;
		const recorded = outputPre ? outputPre.textContent : '';
		if (outputPre) outputPre.classList.add('is-hidden');

		const bar = document.createElement('div');
		bar.className = 'run-bar';
		const panel = document.createElement('div');
		panel.className = 'console is-hidden';
		const head = document.createElement('div');
		head.className = 'console-head';
		const body = document.createElement('div');
		body.className = 'console-body';
		panel.append(head, body);

		const runBtn = button(kind === 'node' ? '▶ 実行（記録を表示）' : '▶ 実行', 'b-run');
		bar.append(runBtn);
		let editor = null;
		let stopBtn = null;
		let editBtn = null;
		let resetBtn = null;
		if (kind === 'worker') {
			editBtn = button('✎ 書き換える', 'b-edit');
			resetBtn = button('↺ 元に戻す', 'b-reset is-hidden');
			stopBtn = button('■ 止める', 'b-stop is-hidden');
			bar.append(editBtn, resetBtn, stopBtn);
		}
		const pre = codeEl.parentElement;
		pre.after(bar);
		(outputPre || bar).after(panel);
		if (outputPre) bar.after(outputPre);

		function line(text, level) {
			const div = document.createElement('div');
			div.className = 'line ' + level;
			div.textContent = text;
			body.append(div);
		}
		function currentCode() {
			return editor ? editor.value : original;
		}

		if (editBtn) {
			editBtn.addEventListener('click', () => {
				if (editor) return;
				editor = document.createElement('textarea');
				editor.className = 'code-editor';
				editor.spellcheck = false;
				editor.value = original;
				editor.rows = Math.max(3, original.split('\n').length + 1);
				pre.classList.add('is-hidden');
				pre.after(editor);
				editor.focus();
				editBtn.classList.add('is-hidden');
				resetBtn.classList.remove('is-hidden');
			});
			resetBtn.addEventListener('click', () => {
				if (!editor) return;
				editor.remove();
				editor = null;
				pre.classList.remove('is-hidden');
				editBtn.classList.remove('is-hidden');
				resetBtn.classList.add('is-hidden');
			});
		}

		let worker = null;
		let limitTimer = null;
		function finish(note) {
			if (worker) worker.terminate();
			worker = null;
			clearTimeout(limitTimer);
			if (body.childElementCount === 0) line('（出力なし）', 'note');
			if (note) line(note, 'note');
			panel.dataset.state = 'done';
			runBtn.disabled = false;
			if (stopBtn) stopBtn.classList.add('is-hidden');
		}

		if (stopBtn) stopBtn.addEventListener('click', () => finish('（止めました）'));

		runBtn.addEventListener('click', () => {
			body.textContent = '';
			panel.classList.remove('is-hidden');
			panel.dataset.state = 'running';
			runBtn.disabled = true;
			if (kind === 'node') {
				const file = ex.querySelector('.filename');
				head.textContent = 'Node.js で実行した結果（記録）  > node ' + (file ? file.textContent.trim() : 'main.mjs');
				setTimeout(() => {
					for (const l of recorded.replace(/\n$/, '').split('\n')) line(l, 'log');
					finish(null);
				}, 350);
				return;
			}
			head.textContent = 'ブラウザで実行した結果';
			try {
				worker = new Worker(workerUrl);
			} catch (e) {
				line('実行できませんでした。ファイルを直接開いている（file://）場合は、ローカルサーバー経由で開いてください。', 'error');
				finish(null);
				return;
			}
			stopBtn.classList.remove('is-hidden');
			worker.onmessage = (ev) => {
				const msg = ev.data;
				if (msg.type === 'log') line(msg.text, msg.level);
				else if (msg.type === 'done') finish(null);
			};
			worker.onerror = (ev) => {
				ev.preventDefault();
				line('実行できませんでした: ' + (ev.message || 'Worker を起動できません'), 'error');
				finish(null);
			};
			limitTimer = setTimeout(() => finish('（' + TIME_LIMIT_MS / 1000 + ' 秒たったので止めました）'), TIME_LIMIT_MS);
			worker.postMessage({ code: currentCode() });
		});
	}

	function init() {
		for (const code of document.querySelectorAll('pre > code.language-javascript')) {
			code.innerHTML = highlight(code.textContent);
		}
		for (const ex of document.querySelectorAll('.example[data-run]')) setupExample(ex);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
