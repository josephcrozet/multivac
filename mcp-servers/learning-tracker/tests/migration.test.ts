import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs from 'sql.js';

// A database written by schema version 1, before the section pointer existed: its progress
// table has no current_section column. Only the tables the migration touches or the test
// reads are created here; the server creates the rest as it would for any database.
const VERSION_1_SCHEMA = `
  CREATE TABLE schema_version (version INTEGER NOT NULL);
  INSERT INTO schema_version (version) VALUES (1);
  CREATE TABLE tutorials (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT,
    type TEXT DEFAULT 'general', difficulty_level TEXT DEFAULT 'beginner', completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')), completed_at TEXT, preferences TEXT DEFAULT '{}'
  );
  CREATE TABLE parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tutorial_id INTEGER NOT NULL, name TEXT NOT NULL,
    difficulty INTEGER NOT NULL, completed INTEGER DEFAULT 0, sort_order INTEGER NOT NULL
  );
  CREATE TABLE chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, part_id INTEGER NOT NULL, name TEXT NOT NULL,
    description TEXT, completed INTEGER DEFAULT 0, sort_order INTEGER NOT NULL
  );
  CREATE TABLE lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, chapter_id INTEGER NOT NULL, name TEXT NOT NULL,
    description TEXT, completed INTEGER DEFAULT 0, sort_order INTEGER NOT NULL
  );
  CREATE TABLE progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tutorial_id INTEGER NOT NULL UNIQUE, current_lesson_id INTEGER,
    status TEXT DEFAULT 'not_started', started_at TEXT, updated_at TEXT DEFAULT (datetime('now'))
  );
  INSERT INTO tutorials (name, type) VALUES ('Old Tutorial', 'programming');
  INSERT INTO parts (tutorial_id, name, difficulty, sort_order) VALUES (1, 'Part', 1, 1);
  INSERT INTO chapters (part_id, name, sort_order) VALUES (1, 'Chapter', 1);
  INSERT INTO lessons (chapter_id, name, sort_order) VALUES (1, 'Lesson', 1);
  INSERT INTO progress (tutorial_id, current_lesson_id, status) VALUES (1, 1, 'in_progress');
`;

test('a schema version 1 database gains the section pointer', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-migration-test-'));
  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  const SQL = await initSqlJs();
  const old = new SQL.Database();
  old.exec(VERSION_1_SCHEMA);
  writeFileSync(join(tmpDir, 'learning.db'), Buffer.from(old.export()));

  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  await t.test('the lesson in progress reads as on its theory', () => {
    const pos = database.getCurrentPosition()!;
    assert.equal(pos.current_lesson!.name, 'Lesson');
    assert.equal(pos.current_section, 'theory');
  });

  await t.test('the pointer moves and is saved, at schema version 2', () => {
    assert.equal(database.advanceSection()!.current_section, 'exercise');
    const saved = new SQL.Database(readFileSync(join(tmpDir, 'learning.db')));
    assert.deepEqual(saved.exec('SELECT current_section FROM progress')[0].values, [['exercise']]);
    assert.deepEqual(saved.exec('SELECT version FROM schema_version')[0].values, [[2]]);
  });
});
