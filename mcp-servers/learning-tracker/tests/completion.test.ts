import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Curriculum } from '../src/database.js';

// The smallest whole tutorial: one part, one chapter, one lesson, so it can be finished quickly.
const curriculum: Curriculum = {
  name: 'Tiny',
  type: 'programming',
  difficulty_level: 'beginner',
  parts: [{ name: 'Part', difficulty: 1, chapters: [{ name: 'Chapter', lessons: [{ name: 'Lesson', concepts: [{ name: 'Concept' }] }] }] }],
};

test('completing a tutorial', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-completion-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  database.createTutorial(curriculum);
  database.startTutorial();
  database.advanceSection();
  database.advanceSection();
  database.logQuizResult(12, 12, []);
  database.advanceSection();
  database.completeLesson();
  const position = database.getCurrentPosition()!;
  database.logInterviewResult(position.current_chapter!.id, 40, 40);
  database.logCapstoneResult(position.current_part!.id, true);

  await t.test('a part holds one capstone result', () => {
    assert.throws(() => database.logCapstoneResult(position.current_part!.id, true), /already has a capstone result/);
    assert.equal(database.getStats()!.tutorial.capstones_completed, 1);
  });

  await t.test('completing a lesson again is refused and leaves the review queue alone', () => {
    const queued = database.getReviewQueue()!.total_in_queue;
    const result = database.completeLesson()!;
    assert.equal(result.completed, false);
    assert.match(result.reason ?? '', /already completed/);
    assert.equal(database.getReviewQueue()!.total_in_queue, queued);
  });

  await t.test('advancing past the last lesson marks the tutorial completed', () => {
    assert.equal(database.advancePosition()!.tutorial_completed, true);
    const metadata = database.getTutorialMetadata()!;
    assert.equal(metadata.status, 'completed');
    assert.notStrictEqual(metadata.completed_at, null);
  });

  await t.test('the tree marks a completed capstone ★, with nothing left marked current', () => {
    const tree = database.getCurriculumTree()!;
    assert.ok(tree.includes('└─ ★ Capstone Project'));
    assert.ok(!tree.includes('YOU ARE HERE'));
  });

  await t.test('the score is frozen at completion, so later reviews do not change it', () => {
    const frozen = database.getStats()!.score;
    assert.equal(frozen.breakdown.review, 196); // the one lesson is still in the queue: 200 - 4
    // A post-game review empties the queue, which would raise a live score by 4.
    const [item] = database.getReviewQueue(4)!.queue;
    database.logReviewResult(item.lesson.id, true);
    assert.deepEqual(database.getStats()!.score, frozen);
  });

  await t.test('advancing again is refused, leaving the completion as it was', () => {
    const metadata = database.getTutorialMetadata()!;
    const frozen = database.getStats()!.score;
    const result = database.advancePosition()!;
    assert.equal(result.advanced, false);
    assert.equal(result.tutorial_completed, true);
    assert.match(result.reason ?? '', /already complete/);
    assert.equal(database.getTutorialMetadata()!.completed_at, metadata.completed_at);
    // The queue emptied after completion, so completing again would raise the review points.
    assert.deepEqual(database.getStats()!.score, frozen);
  });

  await t.test('resetting progress clears the frozen score', () => {
    database.resetProgress();
    // Back to a live score: nothing earned yet, and full review points for an empty queue.
    assert.deepEqual(database.getStats()!.score.breakdown, { quizzes: 0, interviews: 0, chapters: 0, capstones: 0, review: 200 });
  });
});
