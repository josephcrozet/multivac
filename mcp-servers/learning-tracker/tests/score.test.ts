import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Curriculum } from '../src/database.js';

// A full-size tutorial (3 parts × 4 chapters × 4 lessons), since the score's maximum of 2000 and
// its rank thresholds assume one.
const curriculum: Curriculum = {
  name: 'Score Test',
  type: 'programming',
  difficulty_level: 'beginner',
  parts: [1, 2, 3].map((pn) => ({
    name: `Part ${pn}`,
    difficulty: pn as 1 | 2 | 3,
    chapters: [1, 2, 3, 4].map((cn) => ({
      name: `Chapter ${pn}.${cn}`,
      lessons: [1, 2, 3, 4].map((ln) => ({ name: `Lesson ${pn}.${cn}.${ln}`, concepts: [{ name: `Concept ${pn}.${cn}.${ln}` }] })),
    })),
  })),
};

test('the final score and rank', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-score-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  database.createTutorial(curriculum);

  // Play the whole tutorial through the real flow with the given results, from the start. `quiz`
  // is the score out of 12 for every lesson, or a function of the lesson's index (0–47).
  type Results = { quiz: number | ((lesson: number) => number); interview: number; capstones: boolean; clearQueue: boolean };
  const playThrough = ({ quiz, interview, capstones, clearQueue }: Results) => {
    database.resetProgress();
    let lesson = 0;
    for (let guard = 0; guard < 200; guard++) {
      const pos = database.getCurrentPosition()!;
      if (!pos.current_lesson!.completed) {
        database.advanceSection();
        database.advanceSection();
        database.logQuizResult(typeof quiz === 'number' ? quiz : quiz(lesson), 12, []);
        database.completeLesson();
        lesson++;
        continue;
      }
      if (pos.is_chapter_end && !pos.interview_resolved) database.logInterviewResult(pos.current_chapter!.id, interview, 40);
      if (pos.is_part_end && !pos.capstone_resolved) database.logCapstoneResult(pos.current_part!.id, capstones);
      // The final review comes before the last advance, which completes the tutorial and freezes
      // the score.
      if (clearQueue && pos.is_part_end && pos.position!.part === 3) {
        for (const item of database.getReviewQueue(48)!.queue) database.logReviewResult(item.lesson.id, true);
      }
      if (database.advancePosition()!.tutorial_completed) break;
    }
    return database.getStats()!.score;
  };

  await t.test('a perfect run scores the full 2000 and ranks S+', () => {
    const score = playThrough({ quiz: 12, interview: 40, capstones: true, clearQueue: true });
    assert.deepEqual(score.breakdown, { quizzes: 576, interviews: 480, chapters: 144, capstones: 600, review: 200 });
    assert.equal(score.points, 2000);
    assert.equal(score.max, 2000);
    assert.equal(score.rank, 'S+');
  });

  await t.test('one quiz answer short of perfect is an S, not S+', () => {
    const score = playThrough({ quiz: (lesson) => (lesson === 0 ? 11 : 12), interview: 40, capstones: true, clearQueue: true });
    assert.equal(score.points, 1999);
    assert.equal(score.rank, 'S');
  });

  await t.test('perfect answers with every capstone skipped and no reviews is a B', () => {
    const score = playThrough({ quiz: 12, interview: 40, capstones: false, clearQueue: false });
    // All 48 lessons are left in the review queue: 200 - 4 × 48 = 8.
    assert.deepEqual(score.breakdown, { quizzes: 576, interviews: 480, chapters: 144, capstones: 0, review: 8 });
    assert.equal(score.points, 1208);
    assert.equal(score.rank, 'B');
  });

  await t.test('the lowest score for a finished tutorial is 152, an E', () => {
    const score = playThrough({ quiz: 0, interview: 0, capstones: false, clearQueue: false });
    assert.deepEqual(score.breakdown, { quizzes: 0, interviews: 0, chapters: 144, capstones: 0, review: 8 });
    assert.equal(score.points, 152);
    assert.equal(score.rank, 'E');
  });

  await t.test('ranks follow the point thresholds', () => {
    const cases: [Results, number, string][] = [
      [{ quiz: 9, interview: 30, capstones: true, clearQueue: true }, 432 + 360 + 144 + 600 + 200, 'A'], // 1736
      [{ quiz: 6, interview: 20, capstones: true, clearQueue: true }, 288 + 240 + 144 + 600 + 200, 'B'], // 1472
      [{ quiz: 2, interview: 10, capstones: true, clearQueue: true }, 96 + 120 + 144 + 600 + 200, 'C'], // 1160
      [{ quiz: 6, interview: 10, capstones: false, clearQueue: true }, 288 + 120 + 144 + 0 + 200, 'D'], // 752
    ];
    for (const [results, points, rank] of cases) {
      const score = playThrough(results);
      assert.equal(score.points, points);
      assert.equal(score.rank, rank, `${points} points`);
    }
  });
});
