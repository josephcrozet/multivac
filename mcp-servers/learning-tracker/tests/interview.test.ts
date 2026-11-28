import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import initSqlJs from 'sql.js';
import type { Curriculum } from '../src/database.js';
import { interviewPlan, interviewScores } from './helpers.js';

// Two one-lesson chapters, so every lesson ends its chapter.
const curriculum: Curriculum = {
  name: 'Interview Test',
  type: 'programming',
  difficulty_level: 'beginner',
  parts: [
    {
      name: 'Part One',
      difficulty: 1,
      chapters: [1, 2].map((n) => ({ name: `Chapter ${n}`, lessons: [{ name: `Lesson ${n}`, concepts: [{ name: `Concept ${n}` }] }] })),
    },
  ],
};

test('the mock interview is planned, scored per answer, and retaken', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-interview-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');
  const SQL = await initSqlJs();
  // The interview rows as saved to disk, which is what survives an interruption.
  const savedProgress = () => {
    const saved = new SQL.Database(readFileSync(join(tmpDir, 'learning.db')));
    return saved.exec('SELECT chapter_id, scores, best_score FROM interview_progress')[0]?.values ?? [];
  };
  const answer = (scores: number[]) => scores.forEach((score, i) => database.logInterviewAnswer(i + 1, score));

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  database.createTutorial(curriculum);
  database.startTutorial();

  await t.test('no interview is due until the chapter\'s last lesson is completed', () => {
    assert.throws(() => database.getInterview(), /isn't completed yet/);
    assert.throws(() => database.planInterview(interviewPlan), /isn't completed yet/);
    database.advanceSection();
    database.advanceSection();
    database.logQuizResult(12, 12, []);
    database.advanceSection();
    database.completeLesson();
  });

  await t.test('a new interview has no plan, scores, or best', () => {
    const state = database.getInterview();
    assert.equal(state.plan, null);
    assert.deepEqual(state.scores, []);
    assert.equal(state.answered, 0);
    assert.equal(state.finished, false);
    assert.equal(state.best_score, null);
    assert.equal(state.resolved, false);
  });

  await t.test('a plan has exactly 8 slots, each with a category and a concept', () => {
    assert.throws(() => database.planInterview(interviewPlan.slice(0, 7)), /exactly 8 slots/);
    const noConcepts = interviewPlan.map((slot, i) => (i === 3 ? { ...slot, concepts: [] } : slot));
    assert.throws(() => database.planInterview(noConcepts), /Slot 4 needs/);
    const noCategory = interviewPlan.map((slot, i) => (i === 0 ? { ...slot, category: ' ' } : slot));
    assert.throws(() => database.planInterview(noCategory), /Slot 1 needs/);
  });

  await t.test('nothing is scored or resolved before there is a plan', () => {
    assert.throws(() => database.logInterviewAnswer(1, 5), /no plan yet/);
    assert.throws(() => database.retakeInterview(), /no finished interview/);
    assert.throws(() => database.logInterviewResult(), /No interview attempt has finished/);
  });

  await t.test('the plan is stored, and a second one is refused', () => {
    const state = database.planInterview(interviewPlan);
    assert.deepEqual(state.plan, interviewPlan);
    assert.throws(() => database.planInterview(interviewPlan), /already has a plan/);
  });

  await t.test('answers are scored in order, as whole numbers from 0 to 5', () => {
    assert.throws(() => database.logInterviewAnswer(2, 5), /in order\. The next is question 1/);
    assert.throws(() => database.logInterviewAnswer(1, 6), /whole number from 0 to 5/);
    assert.throws(() => database.logInterviewAnswer(1, 2.5), /whole number from 0 to 5/);
    answer([4, 3, 5]);
    assert.throws(() => database.logInterviewAnswer(3, 5), /Question 3 is already scored\. The next is question 4/);
  });

  await t.test('an interrupted interview resumes from its saved plan and scores', () => {
    const state = database.getInterview();
    assert.equal(state.answered, 3);
    assert.deepEqual(state.scores, [4, 3, 5]);
    assert.deepEqual(state.plan, interviewPlan);
    assert.deepEqual(savedProgress(), [[state.chapter_id, '[4,3,5]', null]]);
  });

  await t.test('a retake waits until every question is scored, and so does the result', () => {
    assert.throws(() => database.retakeInterview(), /on question 4 of 8/);
    assert.throws(() => database.logInterviewResult(), /No interview attempt has finished/);
  });

  await t.test('scoring the last question finishes the attempt and sets the best', () => {
    for (const [i, score] of [2, 3, 4, 5, 1].entries()) database.logInterviewAnswer(i + 4, score);
    const state = database.getInterview();
    assert.equal(state.finished, true);
    assert.equal(state.best_score, 27);
    assert.throws(() => database.logInterviewAnswer(9, 5), /Every question is already scored/);
    assert.throws(() => database.planInterview(interviewPlan), /already has a plan/);
  });

  await t.test('a retake clears the plan and scores and keeps the best', () => {
    const state = database.retakeInterview();
    assert.equal(state.plan, null);
    assert.deepEqual(state.scores, []);
    assert.equal(state.best_score, 27);
    assert.throws(() => database.retakeInterview(), /no finished interview/);
  });

  await t.test('a lower retake keeps the earlier best, and a higher one replaces it', () => {
    database.planInterview(interviewPlan);
    answer(interviewScores(20));
    assert.equal(database.getInterview().best_score, 27);
    database.retakeInterview();
    database.planInterview(interviewPlan);
    answer(interviewScores(33));
    assert.equal(database.getInterview().best_score, 33);
  });

  await t.test('resolving mid-retake records the best and drops the unfinished attempt', () => {
    database.retakeInterview();
    database.planInterview(interviewPlan);
    answer([5, 5]);
    const result = database.logInterviewResult('kept the best');
    assert.equal(result.score, 33);
    assert.equal(result.total, 40);
    assert.deepEqual(savedProgress(), []);
    const state = database.getInterview();
    assert.equal(state.resolved, true);
    assert.deepEqual(state.result, { score: 33, total: 40 });
    assert.equal(state.best_score, 33);
    assert.equal(state.plan, null);
    assert.deepEqual(database.getChapter(state.chapter_id)!.interview, { score: 33, total: 40 });
  });

  await t.test('a resolved interview is closed', () => {
    assert.throws(() => database.planInterview(interviewPlan), /already resolved/);
    assert.throws(() => database.retakeInterview(), /already resolved/);
    assert.throws(() => database.logInterviewAnswer(1, 5), /already resolved/);
    assert.throws(() => database.logInterviewResult(), /already resolved/);
    assert.equal(database.advancePosition()!.advanced, true);
  });

  await t.test('reset clears an interview in progress', () => {
    database.advanceSection();
    database.advanceSection();
    database.logQuizResult(12, 12, []);
    database.advanceSection();
    database.completeLesson();
    database.planInterview(interviewPlan);
    answer([5]);
    assert.equal(savedProgress().length, 1);
    database.resetProgress();
    assert.deepEqual(savedProgress(), []);
  });
});
