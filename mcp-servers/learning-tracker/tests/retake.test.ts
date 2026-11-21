import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Curriculum } from '../src/database.js';

const curriculum: Curriculum = {
  name: 'Retakes',
  type: 'programming',
  difficulty_level: 'beginner',
  parts: [{ name: 'Part', difficulty: 1, chapters: [{ name: 'Chapter', lessons: [{ name: 'Lesson', concepts: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }] }] }],
};

test('quiz retakes', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-retake-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  database.createTutorial(curriculum);
  database.startTutorial();
  database.advanceSection();
  database.advanceSection();
  const lessonId = database.getCurrentPosition()!.current_lesson!.id;
  const [a, b] = database.getLesson(lessonId)!.lesson.concepts;
  const quiz = () => database.getLesson(lessonId)!.lesson.quiz;

  await t.test('the first result is not a retake', () => {
    assert.equal(database.logQuizResult(6, 12, [a.id]).retake, false);
    assert.deepEqual(quiz(), { score: 6, total: 12 });
  });

  await t.test('a better retake raises the score', () => {
    const result = database.logQuizResult(10, 12, [b.id]);
    assert.equal(result.retake, true);
    assert.deepEqual(quiz(), { score: 10, total: 12 });
  });

  await t.test('a worse retake leaves the best score in place', () => {
    database.logQuizResult(4, 12, []);
    assert.deepEqual(quiz(), { score: 10, total: 12 });
  });

  await t.test('concepts missed in any attempt are each queued for review', () => {
    database.advanceSection();
    database.completeLesson();
    assert.deepEqual(database.getReviewQueue()!.queue.map((q) => q.concept.id), [a.id, b.id]);
  });

  await t.test('the lesson counts once, at its best score', () => {
    const stats = database.getStats()!;
    assert.equal(stats.tutorial.average_quiz_score, Math.round((10 / 12) * 100 * 10) / 10);
    assert.equal(stats.score.breakdown.quizzes, 10);
  });
});
