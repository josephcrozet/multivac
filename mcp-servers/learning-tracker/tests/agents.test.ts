import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Claude Code registers a subagent from its file's frontmatter, and skips the file without an
// error when that frontmatter is missing or malformed: the agent just isn't there. This checks the
// fields it requires, so a typo fails CI instead of breaking interviews silently.
const agentsDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'agents');

test('the interview-author subagent is registered', async (t) => {
  const text = readFileSync(join(agentsDir, 'interview-author.md'), 'utf-8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);

  await t.test('the file opens with a frontmatter block', () => {
    assert.ok(match, 'frontmatter must start on the first line and close with ---');
  });

  const fields = Object.fromEntries(
    match![1].split('\n').map((line) => line.match(/^([a-zA-Z]+):\s*(.*)$/)).filter(Boolean).map((m) => [m![1], m![2].trim()])
  );

  await t.test('its name is interview-author', () => {
    // The orchestrator spawns it by this name; a name with ":" or a leading "-" isn't registered.
    assert.equal(fields.name, 'interview-author');
  });

  await t.test('it has a description', () => {
    assert.ok(fields.description && fields.description.length > 0);
  });

  await t.test('its tools let it run code, use files, and check sources', () => {
    const tools = (fields.tools ?? '').split(',').map((tool) => tool.trim());
    for (const tool of ['Bash', 'Read', 'Write', 'WebSearch']) assert.ok(tools.includes(tool), `missing ${tool}`);
  });
});
