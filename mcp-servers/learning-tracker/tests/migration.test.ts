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
  CREATE TABLE concepts (id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT);
  INSERT INTO concepts (lesson_id, name) VALUES (1, 'A'), (1, 'B'), (1, 'C');
  CREATE TABLE quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT, lesson_id INTEGER NOT NULL, score INTEGER NOT NULL, total INTEGER NOT NULL,
    missed_concepts TEXT, completed_at TEXT DEFAULT (datetime('now'))
  );
  INSERT INTO quiz_results (lesson_id, score, total, missed_concepts) VALUES (1, 9, 12, '[2]');
  -- The version 1 review queue: one row per lesson.
  CREATE TABLE review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tutorial_id INTEGER NOT NULL, lesson_id INTEGER NOT NULL,
    position INTEGER NOT NULL, added_at TEXT DEFAULT (datetime('now')), UNIQUE(tutorial_id, lesson_id)
  );
  INSERT INTO review_queue (tutorial_id, lesson_id, position) VALUES (1, 1, 1);
`;

test('a schema version 1 database gains the section pointer, the final score, and a per-concept review queue', async (t) => {
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

  await t.test('the pointer moves and is saved, at schema version 4', () => {
    assert.equal(database.advanceSection()!.current_section, 'exercise');
    const saved = new SQL.Database(readFileSync(join(tmpDir, 'learning.db')));
    assert.deepEqual(saved.exec('SELECT current_section FROM progress')[0].values, [['exercise']]);
    assert.deepEqual(saved.exec('SELECT version FROM schema_version')[0].values, [[4]]);
    // Migration 2 -> 3 added the frozen final score, empty until the tutorial is completed.
    assert.deepEqual(saved.exec('SELECT final_score FROM tutorials')[0].values, [[null]]);
  });

  await t.test('the queued lesson becomes its missed concept', () => {
    // Migration 3 -> 4: Lesson's quiz missed concept B, so B is what it queues for review.
    const { queue } = database.getReviewQueue()!;
    assert.deepEqual(queue.map((q) => q.concept.name), ['B']);
    assert.equal(queue[0].lesson.name, 'Lesson');
  });
});
