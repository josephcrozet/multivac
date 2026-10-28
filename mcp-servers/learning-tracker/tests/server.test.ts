import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

// Drives the real server over stdio, the way an MCP client does, so the request handling
// in index.ts is covered and not just the database layer underneath it.
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

type Response = { id: number; result?: { content: { text: string }[] }; error?: unknown };

// Starts a server with its own data directory. `send` makes one request and resolves with its
// reply; `notify` sends a notification. Each connection is pinned to one protocol era, so a test of
// another era starts its own server.
function startServer(t: { after: (fn: () => void) => void }) {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-server-test-'));
  const server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: packageRoot,
    env: { ...process.env, MULTIVAC_DATA_DIR: tmpDir },
    stdio: ['pipe', 'pipe', 'ignore'],
  });

  t.after(() => {
    server.kill();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const pending = new Map<number, (r: Response) => void>();
  createInterface({ input: server.stdout! }).on('line', (line) => {
    const message = JSON.parse(line) as Response;
    pending.get(message.id)?.(message);
  });

  let nextId = 1;
  const send = (method: string, params?: Record<string, unknown>) => {
    const id = nextId++;
    const reply = new Promise<Response>((resolve, reject) => {
      pending.set(id, resolve);
      setTimeout(() => reject(new Error(`no reply to ${method} within 10s`)), 10_000).unref();
    });
    server.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id, method, ...(params && { params }) }) + '\n');
    return reply;
  };
  const notify = (method: string) => server.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n');
  return { send, notify };
}

const toolResult = (r: Response) => JSON.parse(r.result!.content[0].text) as Record<string, unknown>;

test('the server over stdio, for a 2025-era client', async (t) => {
  const { send, notify } = startServer(t);

  await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  notify('notifications/initialized');

  const created = await send('tools/call', {
    name: 'create_tutorial',
    arguments: {
      name: 'Server Test',
      type: 'programming',
      difficulty_level: 'beginner',
      parts: [{ name: 'Part', difficulty: 1, chapters: [{ name: 'Chapter', lessons: [{ name: 'Lesson', concepts: [{ name: 'Concept' }] }] }] }],
    },
  });
  assert.equal(toolResult(created).success, true);

  await t.test('a tool whose parameters are all optional works when arguments is left out', async () => {
    const reply = await send('tools/call', { name: 'get_review_queue' });
    assert.equal(reply.error, undefined);
    assert.equal(toolResult(reply).success, true);
  });

  await t.test('a tool with a required parameter fails cleanly when arguments is left out', async () => {
    const result = toolResult(await send('tools/call', { name: 'get_lesson' }));
    assert.equal(result.success, false);
    assert.doesNotMatch(String(result.error), /destructure/);
  });
});

test('the server over stdio, on the 2026-07-28 protocol revision', async (t) => {
  const { send } = startServer(t);
  // A 2026-07-28 client opens with server/discover instead of initialize, and every request
  // carries its protocol version and client identity in _meta.
  const _meta = {
    'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    'io.modelcontextprotocol/clientInfo': { name: 'test', version: '0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };

  await t.test('server/discover offers the 2026-07-28 revision', async () => {
    const reply = await send('server/discover', { _meta });
    assert.equal(reply.error, undefined);
    assert.ok((reply.result as unknown as { supportedVersions: string[] }).supportedVersions.includes('2026-07-28'));
  });

  await t.test('a tool call is served on that revision', async () => {
    const reply = await send('tools/call', { name: 'get_tutorial_metadata', arguments: {}, _meta });
    assert.equal(reply.error, undefined);
    assert.equal(toolResult(reply).success, true);
  });
});
