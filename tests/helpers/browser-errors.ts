// 資料に載せたエラーの文面は V8（Chrome ・ Edge ・ Node.js）のもの。Firefox は同じエラーを別の文面で出す。
// ブラウザのテストでは、載せた行か、この表で対になる Firefox の行のどちらかが出れば一致とみなす。
// Firefox の文面は、Firefox で実際に実行して出たものを写した。資料に例を足して食い違ったら、ここに足す。
// 1 行ずつの対にするのは、同じ V8 の文面でも、Firefox では変数名が入って行ごとに変わるため。
const FIREFOX: [v8: string, firefox: string][] = [
	// 03 ・ 05 章: const への入れ直し
	["Uncaught TypeError: Assignment to constant variable.", "Uncaught TypeError: invalid assignment to const 'price'"],
	["Uncaught TypeError: Assignment to constant variable.", "Uncaught TypeError: invalid assignment to const 'cart'"],
	// 03 ・ 07 ・ 08 章: undefined のプロパティを読む
	["Uncaught TypeError: Cannot read properties of undefined (reading 'address')", "Uncaught TypeError: can't access property \"address\", item.shop is undefined"],
	["Uncaught TypeError: Cannot read properties of undefined (reading 'count')", "Uncaught TypeError: can't access property \"count\", this is undefined"],
	["Uncaught TypeError: Cannot read properties of undefined (reading 'label')", "Uncaught TypeError: can't access property \"label\", this is undefined"],
	// 06 ・ 07 章: 宣言より前に使う
	["Uncaught ReferenceError: Cannot access 'half' before initialization", "Uncaught ReferenceError: can't access lexical declaration 'half' before initialization"],
	["Uncaught ReferenceError: Cannot access 'b' before initialization", "Uncaught ReferenceError: can't access lexical declaration 'b' before initialization"],
	// 07 章: strict モードで宣言の無い変数に入れる
	["Uncaught ReferenceError: total is not defined", "Uncaught ReferenceError: assignment to undeclared variable total"],
	// 08 章: クラスの外から private フィールドを使う ・ super の前に this を使う
	["Uncaught SyntaxError: Private field '#balance' must be declared in an enclosing class", "Uncaught SyntaxError: reference to undeclared private field or method #balance"],
	["Uncaught ReferenceError: Must call super constructor in derived class before accessing 'this' or returning from derived constructor", "Uncaught ReferenceError: must call super constructor before using 'this' in derived class constructor"],
	// 10 章: 受け取ったエラーの表示
	["TypeError: Cannot read properties of null (reading 'length')", "TypeError: can't access property \"length\" of null"],
	["SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)", "SyntaxError: JSON.parse: expected property name or '}' at line 1 column 2 of the JSON data"],
	["RangeError: Invalid array length", "RangeError: invalid array length"],
];

// 出た出力のうち、表で対になる行を、載せた行に置き換えて返す。比べるのは呼ぶ側
// （置き換えた結果を載せた出力と比べると、食い違ったときに差分がそのまま見える）
export function asV8(actual: string, expected: string, browserName: string): string {
	if (browserName !== 'firefox') return actual;
	const want = expected.split('\n');
	return actual
		.split('\n')
		.map((line, i) => (FIREFOX.some(([v8, ff]) => v8 === want[i] && ff === line) ? want[i] : line))
		.join('\n');
}
