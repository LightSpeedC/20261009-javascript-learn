// ブラウザのテストで、プロジェクトのフォルダをそのまま返す小さなサーバ。
// Playwright は spec を CommonJS に変換して読むので、ここでも import.meta は使わない。
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
	'.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.png': 'image/png',
};

export async function startServer(root: string): Promise<{ base: string; server: Server }> {
	const server = createServer(async (req, res) => {
		const path = normalize(join(root, decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)));
		if (!path.startsWith(root)) {
			res.writeHead(403).end();
			return;
		}
		try {
			const body = await readFile(path);
			res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }).end(body);
		} catch {
			res.writeHead(404).end();
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const addr = server.address();
	return { base: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`, server };
}
