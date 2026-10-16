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

test('the server over stdio', async (t) => {
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
  const toolResult = (r: Response) => JSON.parse(r.result!.content[0].text) as Record<string, unknown>;

  await send('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '0' },
  });
  server.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

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
