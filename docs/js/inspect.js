/*
 * 値を Node.js の console.log と同じ形の文字列にする。
 * ブラウザの Worker（worker.js）と、テスト（tests/inspect.test.ts）の両方から読み込む。
 * Node の util.inspect（lib/internal/util/inspect.js）のうち、資料の例で使う範囲だけを写している。
 */
(function (root) {
	'use strict';

	const BREAK_LENGTH = 80;
	const DEPTH = 2;
	const COMPACT = 3;
	const MAX_ARRAY = 100;
	const IDENTIFIER = /^[a-zA-Z_][a-zA-Z_0-9]*$/;
	const META = { 8: '\\b', 9: '\\t', 10: '\\n', 11: '\\x0B', 12: '\\f', 13: '\\r', 92: '\\\\' };

	function strEscape(str) {
		let quote = "'";
		if (str.includes("'")) {
			if (!str.includes('"')) quote = '"';
			else if (!str.includes('`') && !str.includes('${')) quote = '`';
		}
		let out = '';
		for (const ch of str) {
			const code = ch.charCodeAt(0);
			if (ch === quote) out += '\\' + ch;
			else if (META[code] !== undefined && ch.length === 1) out += META[code];
			else if (code < 0x20 || code === 0x7f) out += '\\x' + code.toString(16).toUpperCase().padStart(2, '0');
			else out += ch;
		}
		return quote + out + quote;
	}

	function formatNumber(n) {
		return Object.is(n, -0) ? '-0' : String(n);
	}

	function formatPrimitive(value) {
		switch (typeof value) {
			case 'string': return strEscape(value);
			case 'number': return formatNumber(value);
			case 'bigint': return value + 'n';
			case 'boolean': return String(value);
			case 'undefined': return 'undefined';
			case 'symbol': return value.toString();
		}
		return String(value);
	}

	function isClass(fn) {
		try {
			return Function.prototype.toString.call(fn).startsWith('class');
		} catch (e) {
			return false;
		}
	}

	function formatFunction(fn) {
		if (isClass(fn)) {
			const proto = Object.getPrototypeOf(fn);
			let s = '[class ' + (fn.name || '(anonymous)');
			if (proto && proto.name) s += ' extends ' + proto.name;
			return s + ']';
		}
		const tag = Object.prototype.toString.call(fn).slice(8, -1);
		let type = 'Function';
		if (tag === 'AsyncFunction' || tag === 'GeneratorFunction' || tag === 'AsyncGeneratorFunction') type = tag;
		return fn.name ? '[' + type + ': ' + fn.name + ']' : '[' + type + ' (anonymous)]';
	}

	function constructorName(obj) {
		let proto = Object.getPrototypeOf(obj);
		while (proto !== null) {
			const desc = Object.getOwnPropertyDescriptor(proto, 'constructor');
			if (desc && typeof desc.value === 'function' && desc.value.name !== '') return desc.value.name;
			proto = Object.getPrototypeOf(proto);
		}
		return null;
	}

	function formatKey(key, enumerable) {
		if (typeof key === 'symbol') return '[' + key.toString() + ']';
		if (!enumerable) return '[' + key + ']';
		return IDENTIFIER.test(key) ? key : strEscape(key);
	}

	function formatProperty(ctx, obj, key, recurseTimes, isArrayItem) {
		const desc = Object.getOwnPropertyDescriptor(obj, key) || { value: obj[key], enumerable: true };
		let str;
		if (desc.value !== undefined || !('get' in desc || 'set' in desc)) {
			ctx.indentationLvl += 2;
			str = formatValue(ctx, desc.value, recurseTimes);
			ctx.indentationLvl -= 2;
		} else if (desc.get !== undefined) {
			str = desc.set !== undefined ? '[Getter/Setter]' : '[Getter]';
		} else {
			str = desc.set !== undefined ? '[Setter]' : 'undefined';
		}
		if (isArrayItem) return str;
		return formatKey(key, desc.enumerable) + ': ' + str;
	}

	function isBelowBreakLength(ctx, output, start) {
		let total = output.length + start;
		if (total + output.length > BREAK_LENGTH) return false;
		for (const s of output) {
			total += s.length;
			if (total > BREAK_LENGTH) return false;
		}
		return true;
	}

	function groupArrayElements(ctx, output, value) {
		let totalLength = 0;
		let maxLength = 0;
		let outputLength = output.length;
		if (value !== undefined && value.length > MAX_ARRAY && outputLength > MAX_ARRAY) outputLength--;
		const separatorSpace = 2;
		const dataLen = new Array(outputLength);
		for (let i = 0; i < outputLength; i++) {
			const len = output[i].length;
			dataLen[i] = len;
			totalLength += len + separatorSpace;
			if (maxLength < len) maxLength = len;
		}
		const actualMax = maxLength + separatorSpace;
		if (actualMax * 3 + ctx.indentationLvl < BREAK_LENGTH &&
			(totalLength / actualMax > 5 || maxLength <= 6)) {
			const averageBias = Math.sqrt(actualMax - totalLength / output.length);
			const biasedMax = Math.max(actualMax - 3 - averageBias, 1);
			const columns = Math.min(
				Math.round(Math.sqrt(2.5 * biasedMax * outputLength) / biasedMax),
				Math.floor((BREAK_LENGTH - ctx.indentationLvl) / actualMax),
				COMPACT * 4,
				15,
			);
			if (columns <= 1) return output;
			const tmp = [];
			const maxLineLength = [];
			for (let i = 0; i < columns; i++) {
				let lineLength = 0;
				for (let j = i; j < output.length; j += columns) {
					if (dataLen[j] > lineLength) lineLength = dataLen[j];
				}
				maxLineLength.push(lineLength + separatorSpace);
			}
			let padStart = true;
			if (value !== undefined) {
				for (let i = 0; i < output.length; i++) {
					if (typeof value[i] !== 'number' && typeof value[i] !== 'bigint') {
						padStart = false;
						break;
					}
				}
			}
			for (let i = 0; i < outputLength; i += columns) {
				const max = Math.min(i + columns, outputLength);
				let str = '';
				let j = i;
				for (; j < max - 1; j++) {
					const cell = output[j] + ', ';
					str += padStart ? cell.padStart(maxLineLength[j - i]) : cell.padEnd(maxLineLength[j - i]);
				}
				if (padStart) {
					str += output[j].padStart(maxLineLength[j - i] - separatorSpace);
				} else {
					str += output[j];
				}
				tmp.push(str);
			}
			if (outputLength < output.length) tmp.push(output[outputLength]);
			output = tmp;
		}
		return output;
	}

	function reduceToSingleString(ctx, output, braces, isArrayType, recurseTimes, value) {
		const entries = output.length;
		if (isArrayType && entries > 6) output = groupArrayElements(ctx, output, value);
		if (ctx.currentDepth - recurseTimes < COMPACT && entries === output.length) {
			const start = output.length + ctx.indentationLvl + braces[0].length + 10;
			if (isBelowBreakLength(ctx, output, start)) {
				const joined = output.join(', ');
				if (!joined.includes('\n')) return braces[0] + ' ' + joined + ' ' + braces[1];
			}
		}
		const indentation = '\n' + ' '.repeat(ctx.indentationLvl);
		return braces[0] + indentation + '  ' + output.join(',' + indentation + '  ') + indentation + braces[1];
	}

	function formatArrayItems(ctx, arr, recurseTimes) {
		const output = [];
		const len = arr.length;
		const shown = Math.min(len, MAX_ARRAY);
		let i = 0;
		while (i < shown) {
			if (!Object.prototype.hasOwnProperty.call(arr, i)) {
				let empty = 0;
				while (i < len && !Object.prototype.hasOwnProperty.call(arr, i)) {
					empty++;
					i++;
				}
				output.push('<' + empty + ' empty item' + (empty > 1 ? 's' : '') + '>');
				continue;
			}
			output.push(formatProperty(ctx, arr, i, recurseTimes, true));
			i++;
		}
		if (len > shown) {
			const rest = len - shown;
			output.push('... ' + rest + ' more item' + (rest > 1 ? 's' : ''));
		}
		return output;
	}

	function ownKeys(obj, skipIndex) {
		const keys = Object.keys(obj).filter((k) => !(skipIndex && /^(0|[1-9][0-9]*)$/.test(k)));
		for (const sym of Object.getOwnPropertySymbols(obj)) {
			if (Object.prototype.propertyIsEnumerable.call(obj, sym)) keys.push(sym);
		}
		return keys;
	}

	function prefix(name, fallback, size) {
		if (name === null) return '[' + fallback + (size !== undefined ? '(' + size + ')' : '') + ': null prototype] ';
		if (name !== fallback) return name + (size !== undefined ? '(' + size + ')' : '') + ' [' + fallback + '] ';
		return name + (size !== undefined ? '(' + size + ')' : '') + ' ';
	}

	function formatValue(ctx, value, recurseTimes) {
		if (value === null) return 'null';
		if (typeof value !== 'object' && typeof value !== 'function') return formatPrimitive(value);
		if (typeof value === 'function') {
			const base = formatFunction(value);
			const keys = ownKeys(value, false);
			if (keys.length === 0) return base;
			return formatRaw(ctx, value, recurseTimes, keys, base);
		}
		if (ctx.seen.includes(value)) {
			ctx.circular = true;
			return '[Circular *1]';
		}
		return formatRaw(ctx, value, recurseTimes, null, null);
	}

	function formatRaw(ctx, value, recurseTimes, fnKeys, fnBase) {
		const name = typeof value === 'function' ? 'Function' : constructorName(value);
		const tag = Object.prototype.toString.call(value).slice(8, -1);
		let braces;
		let isArrayType = false;
		let keys;
		let items = null;

		if (fnBase !== null) {
			keys = fnKeys;
			braces = [fnBase + ' {', '}'];
		} else if (Array.isArray(value)) {
			isArrayType = true;
			keys = ownKeys(value, true);
			const p = name === 'Array' ? '' : prefix(name, 'Array', value.length);
			braces = [p + '[', ']'];
			if (value.length === 0 && keys.length === 0) return braces[0] + ']';
			items = 'array';
		} else if (value instanceof Map || tag === 'Map') {
			keys = ownKeys(value, false);
			braces = [prefix(name, 'Map', value.size) + '{', '}'];
			if (value.size === 0 && keys.length === 0) return braces[0] + '}';
			items = 'map';
		} else if (value instanceof Set || tag === 'Set') {
			keys = ownKeys(value, false);
			braces = [prefix(name, 'Set', value.size) + '{', '}'];
			if (value.size === 0 && keys.length === 0) return braces[0] + '}';
			isArrayType = true;
			items = 'set';
		} else if (value instanceof Date || tag === 'Date') {
			return isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
		} else if (value instanceof RegExp || tag === 'RegExp') {
			return String(value);
		} else if (value instanceof Error || tag === 'Error') {
			return '[' + (value.name || 'Error') + ': ' + value.message + ']';
		} else if (value instanceof Promise || tag === 'Promise') {
			return 'Promise { <状態はブラウザでは見えません> }';
		} else {
			keys = ownKeys(value, false);
			let p = '';
			if (name === null) p = '[Object: null prototype] ';
			else if (name !== 'Object') p = name + ' ';
			if (tag !== 'Object' && tag !== name) p = (name === null ? '' : p) + '[' + tag + '] ';
			braces = [p + '{', '}'];
			if (keys.length === 0) return p + '{}';
		}

		if (recurseTimes > DEPTH) {
			if (Array.isArray(value)) return '[Array]';
			return '[' + (name === null ? 'Object: null prototype' : name) + ']';
		}
		recurseTimes += 1;
		ctx.seen.push(value);
		ctx.currentDepth = recurseTimes;
		let output = [];
		if (items === 'array') {
			output = formatArrayItems(ctx, value, recurseTimes);
		} else if (items === 'map') {
			ctx.indentationLvl += 2;
			for (const [k, v] of value) {
				output.push(formatValue(ctx, k, recurseTimes) + ' => ' + formatValue(ctx, v, recurseTimes));
			}
			ctx.indentationLvl -= 2;
		} else if (items === 'set') {
			ctx.indentationLvl += 2;
			for (const v of value) output.push(formatValue(ctx, v, recurseTimes));
			ctx.indentationLvl -= 2;
		}
		for (const key of keys) output.push(formatProperty(ctx, value, key, recurseTimes, false));
		ctx.seen.pop();
		return reduceToSingleString(ctx, output, braces, isArrayType, recurseTimes, items === 'array' ? value : undefined);
	}

	function inspect(value) {
		const ctx = { seen: [], indentationLvl: 0, currentDepth: 0, circular: false };
		const s = formatValue(ctx, value, 0);
		return ctx.circular ? '<ref *1> ' + s : s;
	}

	// console.log(a, b, ...) の引数をまとめて 1 行にする。先頭が文字列なら %s などを解釈する
	function formatArgs(args) {
		if (args.length === 0) return '';
		let i = 0;
		let out = '';
		if (typeof args[0] === 'string' && args.length > 1 && args[0].includes('%')) {
			const fmt = args[0];
			i = 1;
			for (let p = 0; p < fmt.length; p++) {
				const ch = fmt[p];
				if (ch !== '%' || p + 1 >= fmt.length) {
					out += ch;
					continue;
				}
				const spec = fmt[p + 1];
				if (spec === '%') {
					out += '%';
					p++;
					continue;
				}
				if (i >= args.length || !'sdifjoOc'.includes(spec)) {
					out += ch;
					continue;
				}
				const a = args[i++];
				p++;
				if (spec === 's') out += typeof a === 'string' ? a : (typeof a === 'object' && a !== null ? inspect(a) : formatPrimitive(a));
				else if (spec === 'd' || spec === 'i') {
					const n = typeof a === 'bigint' ? a : (spec === 'i' ? parseInt(a) : Number(a));
					out += typeof n === 'bigint' ? n + 'n' : formatNumber(n);
				} else if (spec === 'f') out += formatNumber(parseFloat(a));
				else if (spec === 'j') out += JSON.stringify(a);
				else if (spec === 'o' || spec === 'O') out += inspect(a);
			}
		}
		for (; i < args.length; i++) {
			const a = args[i];
			if (out !== '' || i > 0) out += ' ';
			out += typeof a === 'string' ? a : inspect(a);
		}
		return out;
	}

	root.JslInspect = { inspect, formatArgs };
})(typeof self !== 'undefined' ? self : globalThis);
