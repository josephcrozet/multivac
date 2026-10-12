import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Curriculum } from '../src/database.js';

const LESSON_NAMES = ['The Java Platform', 'Your First Program', 'Variables and Data Types', 'Operators and Expressions'];

const curriculum: Curriculum = {
  name: 'Java',
  type: 'programming',
  difficulty_level: 'beginner',
  parts: [1, 2, 3].map((pn) => ({
    name: `Part ${pn}`,
    difficulty: pn as 1 | 2 | 3,
    chapters: [1, 2, 3, 4].map((cn) => ({
      name: pn === 1 && cn === 1 ? 'Getting Started with Java' : `Chapter ${pn}.${cn}`,
      lessons: [1, 2, 3, 4].map((ln) => ({
        name: pn === 1 && cn === 1 ? LESSON_NAMES[ln - 1] : `Lesson ${pn}.${cn}.${ln}`,
        concepts: [{ name: `Concept ${pn}.${cn}.${ln}` }],
      })),
    })),
  })),
};

test('chapter progress view', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-progress-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  database.createTutorial(curriculum);
  database.startTutorial();
  const chapterId = database.getCurrentPosition()!.current_chapter!.id;
  const view = () => database.getChapterProgress(chapterId)!;
  const lineFor = (label: string) => view().split('\n').find((l) => l.includes(label))!;

  await t.test('a fresh chapter marks its first lesson up next, with no bars', () => {
    const lines = view().split('\n');
    assert.equal(lines[0], 'PART I · Chapter 1: Getting Started with Java');
    assert.match(lineFor('Lesson 1:'), /^ {2}► Lesson 1: The Java Platform +◄── up next$/);
    assert.ok(!view().includes('█'));
    assert.match(lineFor('Mock Interview'), /^ {2}○ Mock Interview$/);
  });

  await t.test('up next follows completion, not the position pointer', () => {
    database.completeLesson();
    database.advancePosition();
    database.completeLesson(); // lesson 2 done; the pointer has not moved past it yet
    assert.equal(database.getCurrentPosition()!.current_lesson!.name, 'Your First Program');
    assert.equal(
      view(),
      [
        'PART I · Chapter 1: Getting Started with Java',
        '  ✓ Lesson 1: The Java Platform           ██████████ 100%',
        '  ✓ Lesson 2: Your First Program          ██████████ 100%',
        '  ► Lesson 3: Variables and Data Types    ◄── up next',
        '  ○ Lesson 4: Operators and Expressions',
        '  ○ Mock Interview',
      ].join('\n'),
    );
  });

  await t.test('bars and the up-next marker line up in one column', () => {
    const columns = view()
      .split('\n')
      .slice(1)
      .map((l) => Math.max(l.indexOf('█'), l.indexOf('◄')))
      .filter((c) => c !== -1);
    assert.equal(new Set(columns).size, 1);
  });

  await t.test('with every lesson done, the mock interview is up next', () => {
    database.advancePosition();
    database.completeLesson();
    database.advancePosition();
    database.completeLesson();
    assert.match(lineFor('Mock Interview'), /^ {2}► Mock Interview +◄── up next$/);
  });

  await t.test('once the interview is logged, nothing is up next', () => {
    database.logInterviewResult(chapterId, 36, 40, 'ok');
    assert.ok(!view().includes('up next'));
    assert.match(lineFor('Mock Interview'), /^ {2}✓ Mock Interview$/);
  });

  await t.test('an unknown chapter returns null', () => {
    assert.equal(database.getChapterProgress(999999), null);
  });
});
