/*
 * 資料の例に「実行」ボタンを付ける。
 *   <div class="example" data-run="worker"> … ブラウザの Worker で実際に実行する（第1部）
 *   <div class="example" data-run="dom">    … iframe の中に HTML を置き、画面と console を見せる（第2部）
 *   <div class="example" data-run="node">   … Node.js で実行した結果（記録）を表示する
 *   <div class="example" data-run="file">   … 置いておくだけのファイル。ボタンは付けない
 * 例の中の <pre class="output"> は、記録した出力。JavaScript が動かない環境（Markdown 等）ではそのまま見える。
 */
(function () {
	'use strict';

	const TIME_LIMIT_MS = 5000;
	// ファイルを直接開いたとき（file://）。Worker を作れず、fetch も使えない
	const FILE_MODE = location.protocol === 'file:';
	const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
	const workerUrl = new URL('worker.js', scriptUrl);
	const inspectUrl = new URL('inspect.js', scriptUrl).href;
	const frameUrl = new URL('frame.js', scriptUrl).href;
	// 例を動かす iframe には sandbox を付けない。localStorage と fetch の例のために、ページと同じオリジンが要る。
	// sandbox で同じオリジンとスクリプトの両方を許すと、中から sandbox を外せて守りにならない（Console にもそう警告が出る）
	// iframe に使ってよいと渡す機能（20 章のカメラ ・ 動画の再生、19 章のコピー）。そのブラウザが知らない名前を書くと
	// Console に警告が出るので、知っているものだけにする。調べる仕組み（document.featurePolicy）は Chromium だけが持つので、
	// 無いブラウザ（Firefox など）には camera だけを渡す
	const FRAME_ALLOW = (() => {
		const wanted = ['camera', 'autoplay', 'clipboard-write'];
		const policy = document.featurePolicy;
		const known = policy && typeof policy.features === 'function' ? policy.features() : ['camera'];
		return wanted.filter((name) => known.includes(name)).join('; ');
	})();

	const KEYWORDS = new Set(('await break case catch class const continue debugger default delete do else export extends ' +
		'false finally for from function if import in instanceof let new null of return static super switch this throw true ' +
		'try typeof undefined var void while with yield async get set').split(' '));
	const CODE_PATTERN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`)|(\b(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)n?\b)|([A-Za-z_$][\w$]*)/g;
	const HTML_PATTERN = /(&lt;!--[\s\S]*?--&gt;)|(&lt;\/?[A-Za-z][\w-]*|\/?&gt;)|("[^"]*")/g;

	function escapeHtml(s) {
		return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// コードに色を付ける。資料の読みやすさのためだけの簡易なもの
	function highlight(code) {
		let html = '';
		let last = 0;
		CODE_PATTERN.lastIndex = 0;
		let m;
		while ((m = CODE_PATTERN.exec(code)) !== null) {
			html += escapeHtml(code.slice(last, m.index));
			const text = escapeHtml(m[0]);
			if (m[1]) html += '<span class="tk-com">' + text + '</span>';
			else if (m[2]) html += '<span class="tk-str">' + text + '</span>';
			else if (m[3]) html += '<span class="tk-num">' + text + '</span>';
			else if (KEYWORDS.has(m[4])) html += '<span class="tk-key">' + text + '</span>';
			else html += text;
			last = CODE_PATTERN.lastIndex;
		}
		return html + escapeHtml(code.slice(last));
	}
	function highlightHtml(code) {
		return escapeHtml(code).replace(HTML_PATTERN, (all, com, tag, str) => {
			if (com) return '<span class="tk-com">' + all + '</span>';
			if (tag) return '<span class="tk-key">' + all + '</span>';
			return '<span class="tk-str">' + all + '</span>';
		});
	}

	function button(label, cls) {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'run-btn ' + cls;
		b.textContent = label;
		return b;
	}

	// 例 1 つ分の部品（ボタンの列と、結果の欄）を作る
	function makeParts(ex) {
		const bar = document.createElement('div');
		bar.className = 'run-bar';
		const panel = document.createElement('div');
		panel.className = 'console is-hidden';
		const head = document.createElement('div');
		head.className = 'console-head';
		const body = document.createElement('div');
		body.className = 'console-body';
		panel.append(head, body);
		const outputPre = ex.querySelector('pre.output');
		if (outputPre) outputPre.classList.add('is-hidden');
		const codes = [...ex.querySelectorAll('pre:not(.output) > code')];
		codes[codes.length - 1].parentElement.after(bar);
		bar.after(panel);
		function line(text, level) {
			const div = document.createElement('div');
			div.className = 'line ' + level;
			div.textContent = text;
			body.append(div);
		}
		return { bar, panel, head, body, outputPre, codes, line };
	}

	// 「✎ 書き換える」「↺ 元に戻す」。書き換えている間は、コードの代わりに入力欄を見せる
	function makeEditors(parts) {
		const editBtn = button('✎ 書き換える', 'b-edit');
		const resetBtn = button('↺ 元に戻す', 'b-reset is-hidden');
		parts.bar.append(editBtn, resetBtn);
		const originals = parts.codes.map((c) => c.textContent);
		let editors = null;
		editBtn.addEventListener('click', () => {
			editors = parts.codes.map((c, i) => {
				const ta = document.createElement('textarea');
				ta.className = 'code-editor';
				ta.spellcheck = false;
				ta.value = originals[i];
				ta.rows = Math.max(3, originals[i].split('\n').length + 1);
				c.parentElement.classList.add('is-hidden');
				c.parentElement.after(ta);
				return ta;
			});
			editors[editors.length - 1].focus();
			editBtn.classList.add('is-hidden');
			resetBtn.classList.remove('is-hidden');
		});
		resetBtn.addEventListener('click', () => {
			for (const ta of editors) ta.remove();
			for (const c of parts.codes) c.parentElement.classList.remove('is-hidden');
			editors = null;
			editBtn.classList.remove('is-hidden');
			resetBtn.classList.add('is-hidden');
		});
		// 言語ごとの、いまのコード
		return () => {
			const result = { javascript: '', html: '', css: '' };
			parts.codes.forEach((c, i) => {
				const lang = (c.className.match(/language-(\w+)/) || [])[1];
				if (lang in result) result[lang] += (editors ? editors[i].value : originals[i]) + '\n';
			});
			return result;
		};
	}

	function setupWorker(ex) {
		const parts = makeParts(ex);
		const { bar, panel, head, body, line } = parts;
		const runBtn = button('▶ 実行', 'b-run');
		bar.prepend(runBtn);
		const current = makeEditors(parts);
		const stopBtn = button('■ 止める', 'b-stop is-hidden');
		bar.append(stopBtn);

		let worker = null;
		let frame = null;
		let limitTimer = null;
		function finish(note) {
			if (worker) worker.terminate();
			worker = null;
			if (frame) frame.remove();
			frame = null;
			clearTimeout(limitTimer);
			if (body.childElementCount === 0) line('（出力なし）', 'note');
			if (note) line(note, 'note');
			panel.dataset.state = 'done';
			runBtn.disabled = false;
			stopBtn.classList.add('is-hidden');
		}
		stopBtn.addEventListener('click', () => finish('（止めました）'));
		runBtn.addEventListener('click', () => {
			body.textContent = '';
			panel.classList.remove('is-hidden');
			panel.dataset.state = 'running';
			runBtn.disabled = true;
			head.textContent = 'ブラウザで実行した結果';
			stopBtn.classList.remove('is-hidden');
			limitTimer = setTimeout(() => finish('（' + TIME_LIMIT_MS / 1000 + ' 秒たったので止めました）'), TIME_LIMIT_MS);
			if (FILE_MODE) {
				// file:// のページからは Worker を作れないので、見えない iframe の中で実行する。
				// ページと同じ流れで動くため、無限ループを書くとページごと固まる
				head.textContent = 'ブラウザで実行した結果（file:// で開いているため、Worker ではなく iframe で実行）';
				frame = document.createElement('iframe');
				frame.className = 'is-hidden';
				const js = current().javascript.replace(/<\/script/gi, '<\\/script');
				frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8">' +
					'<script src="' + inspectUrl + '"></script><script src="' + frameUrl + '"></script></head><body>' +
					'<script>' + js + '</script>' +
					'<script>window.__jslMainDone = true; window.__jslStart();</script></body></html>';
				const thisFrame = frame;
				const onMessage = (ev) => {
					if (frame !== thisFrame) {
						window.removeEventListener('message', onMessage);
						return;
					}
					if (ev.source !== frame.contentWindow || !ev.data || !ev.data.jsl) return;
					if (ev.data.type === 'log') line(ev.data.text, ev.data.level);
					else if (ev.data.type === 'done') {
						window.removeEventListener('message', onMessage);
						finish(null);
					}
				};
				window.addEventListener('message', onMessage);
				panel.append(frame);
				return;
			}
			try {
				worker = new Worker(workerUrl);
			} catch (e) {
				line('実行できませんでした: ' + e.message, 'error');
				finish(null);
				return;
			}
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
			worker.postMessage({ code: current().javascript });
		});
	}

	function setupNode(ex) {
		const parts = makeParts(ex);
		const { bar, panel, head, body, line, outputPre } = parts;
		const recorded = outputPre ? outputPre.textContent : '';
		const runBtn = button('▶ 実行（記録を表示）', 'b-run');
		bar.append(runBtn);
		runBtn.addEventListener('click', () => {
			body.textContent = '';
			panel.classList.remove('is-hidden');
			panel.dataset.state = 'running';
			runBtn.disabled = true;
			const file = ex.querySelector('.filename');
			head.textContent = 'Node.js で実行した結果（記録）  > node ' + (file ? file.textContent.trim() : 'main.mjs');
			setTimeout(() => {
				for (const l of recorded.replace(/\n$/, '').split('\n')) line(l, 'log');
				panel.dataset.state = 'done';
				runBtn.disabled = false;
			}, 350);
		});
	}

	function setupDom(ex) {
		const parts = makeParts(ex);
		const { bar, panel, head, body, line } = parts;
		const runBtn = button('▶ 実行', 'b-run');
		bar.prepend(runBtn);
		const current = makeEditors(parts);
		const screen = document.createElement('div');
		screen.className = 'frame-box';
		head.after(screen);
		let frame = null;

		window.addEventListener('message', (ev) => {
			if (!frame || ev.source !== frame.contentWindow || !ev.data || !ev.data.jsl) return;
			const msg = ev.data;
			if (msg.type === 'log') {
				const note = body.querySelector('.line.note');
				if (note) note.remove();
				line(msg.text, msg.level);
			} else if (msg.type === 'height') {
				frame.style.height = Math.min(Math.max(msg.value, 40), 900) + 'px';
			} else if (msg.type === 'done') {
				if (body.childElementCount === 0) line('（console への出力なし）', 'note');
				panel.dataset.state = 'done';
			}
		});

		runBtn.addEventListener('click', () => {
			const code = current();
			body.textContent = '';
			panel.classList.remove('is-hidden');
			panel.dataset.state = 'running';
			head.textContent = 'ブラウザで実行した結果（上が画面、下が console）';
			if (frame) frame.remove();
			frame = document.createElement('iframe');
			frame.className = 'example-frame';
			frame.title = '例の画面';
			if (FRAME_ALLOW) frame.setAttribute('allow', FRAME_ALLOW);
			// 例のコードの中の </script> で、外側の <script> が閉じてしまわないようにする
			const js = code.javascript.replace(/<\/script/gi, '<\\/script');
			frame.srcdoc = '<!doctype html><html lang="ja"><head><meta charset="utf-8">' +
				'<style>body{font-family:"Segoe UI","Yu Gothic UI","Meiryo",sans-serif;font-size:15px;line-height:1.6;margin:12px;color:#1c2330;background:#ffffff;}' +
				code.css + '</style>' +
				'<script src="' + inspectUrl + '"></script><script src="' + frameUrl + '"></script>' +
				'</head><body>' + code.html +
				'<script type="module">' + js + '\n;window.__jslMainDone = true;</script>' +
				'<script type="module">window.__jslStart();</script>' +
				'</body></html>';
			screen.append(frame);
		});
	}

	function init() {
		for (const code of document.querySelectorAll('pre > code.language-javascript')) {
			code.innerHTML = highlight(code.textContent);
		}
		for (const code of document.querySelectorAll('pre > code.language-html')) {
			code.innerHTML = highlightHtml(code.textContent);
		}
		for (const ex of document.querySelectorAll('.example[data-run]')) {
			const kind = ex.dataset.run;
			if (!ex.querySelector('pre:not(.output) > code')) continue;
			if (kind === 'worker') setupWorker(ex);
			else if (kind === 'node') setupNode(ex);
			else if (kind === 'dom') setupDom(ex);
		}
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
