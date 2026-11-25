import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

// Claude Code registers subagents and skills from their files' frontmatter. A subagent whose
// frontmatter is missing or malformed is skipped without an error: the agent just isn't there. A
// skill without a description gives Claude nothing to decide when to invoke it by. This checks the
// fields each one needs, so a typo fails CI instead of breaking a tutorial silently.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// The frontmatter block's fields, or null when the file doesn't open with one. It's parsed as
// strict YAML, which throws on errors that a lenient reader passes over, such as an unquoted
// value containing ": ". GitHub won't render a file like that, and other tools may misread it.
function frontmatter(path: string): Record<string, unknown> | null {
  const match = readFileSync(path, 'utf-8').match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  return parse(match[1], { strict: true, uniqueKeys: true });
}

test('the interview-author subagent is registered', async (t) => {
  let fields: Record<string, unknown> | null = null;

  await t.test('the file opens with a frontmatter block that parses as YAML', () => {
    fields = frontmatter(join(repoRoot, 'agents', 'interview-author.md'));
    assert.ok(fields, 'frontmatter must start on the first line and close with ---');
  });

  await t.test('its name is interview-author', () => {
    // The orchestrator spawns it by this name; a name with ":" or a leading "-" isn't registered.
    assert.equal(fields!.name, 'interview-author');
  });

  await t.test('it has a description', () => {
    assert.ok(typeof fields!.description === 'string' && fields!.description.length > 0);
  });

  await t.test('its tools let it run code, use files, and check sources', () => {
    const tools = String(fields!.tools ?? '').split(',').map((tool) => tool.trim());
    for (const tool of ['Bash', 'Read', 'Write', 'WebSearch']) assert.ok(tools.includes(tool), `missing ${tool}`);
  });
});

// The skills install.sh copies to ~/.claude/skills/.
for (const skill of ['quiz', 'interview', 'tutorial', 'menu']) {
  test(`the ${skill} skill is registered`, async (t) => {
    let fields: Record<string, unknown> | null = null;

    await t.test('the file opens with a frontmatter block that parses as YAML', () => {
      fields = frontmatter(join(repoRoot, 'skills', skill, 'SKILL.md'));
      assert.ok(fields, 'frontmatter must start on the first line and close with ---');
    });

    await t.test(`its name is ${skill}, matching its folder`, () => {
      assert.equal(fields!.name, skill);
    });

    await t.test('it has a description', () => {
      assert.ok(typeof fields!.description === 'string' && fields!.description.length > 0);
    });

    await t.test('Claude can invoke it', () => {
      // The session-greeting hook has Claude start the tutorial skill itself, and the quiz and
      // interview skills are meant to be picked up when a learner asks for one.
      assert.notEqual(fields!['disable-model-invocation'], true);
    });
  });
}
