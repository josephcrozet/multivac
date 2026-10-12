import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Curriculum } from '../src/database.js';

// A tutorial-wide 0% average needs every result to be 0, so this runs against its own
// database rather than the main suite's, which accumulates real scores along the way.
const curriculum: Curriculum = {
  name: 'Stats Tutorial',
  type: 'programming',
  difficulty_level: 'beginner',
  parts: [
    {
      name: 'Part One',
      difficulty: 1,
      chapters: [
        {
          name: 'Chapter One',
          lessons: [{ name: 'Lesson One', concepts: [{ name: 'Concept One' }] }],
        },
      ],
    },
  ],
};

test('a real 0% average reads as 0, not as no data', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-stats-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  database.createTutorial(curriculum);
  const part = database.getStats()!.parts[0];
  const chapter = database.getPart(part.part_id)!.chapters[0];

  await t.test('averages are null before any result is recorded', () => {
    const stats = database.getStats()!;
    assert.equal(stats.tutorial.average_quiz_score, null);
    assert.equal(stats.tutorial.average_interview_score, null);
    assert.equal(stats.parts[0].average_quiz_score, null);
    assert.equal(stats.parts[0].average_interview_score, null);
  });

  await t.test('once every result is 0, every average reads 0', () => {
    database.logQuizResult(chapter.lessons[0].id, 0, 12, []);
    database.logInterviewResult(chapter.id, 0, 40, 'all skipped');

    const stats = database.getStats()!;
    assert.equal(stats.tutorial.average_quiz_score, 0);
    assert.equal(stats.tutorial.average_interview_score, 0);
    assert.equal(stats.parts[0].average_quiz_score, 0);
    assert.equal(stats.parts[0].average_interview_score, 0);

    // get_tutorial computes its stats separately, so check that path too.
    const { stats: tutorialStats } = database.getTutorial()!;
    assert.equal(tutorialStats.average_quiz_score, 0);
    assert.equal(tutorialStats.average_interview_score, 0);
  });
});
