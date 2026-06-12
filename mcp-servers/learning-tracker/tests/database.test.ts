import { test } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Curriculum } from '../src/database.js';

function makeFullCurriculum(): Curriculum {
  return {
    name: 'Test Tutorial',
    type: 'programming',
    difficulty_level: 'beginner',
    parts: [1, 2, 3].map((pn) => ({
      name: `Part ${pn} Topic`,
      difficulty: pn as 1 | 2 | 3,
      chapters: [1, 2, 3, 4].map((cn) => ({
        name: `Chapter ${pn}.${cn}`,
        lessons: [1, 2, 3, 4].map((ln) => ({
          name: `Lesson ${pn}.${cn}.${ln}`,
          concepts: [{ name: `Concept ${pn}.${cn}.${ln}.1` }],
        })),
      })),
    })),
  };
}

test('curriculum tree lifecycle', async (t) => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'multivac-test-'));
  process.env.MULTIVAC_DATA_DIR = tmpDir;
  const { database } = await import('../src/database.js');

  t.after(() => rmSync(tmpDir, { recursive: true, force: true }));

  let initialFileContent = '';

  await t.test('createTutorial returns a Tutorial with the right shape', () => {
    const tutorial = database.createTutorial(makeFullCurriculum());
    assert.equal(tutorial.name, 'Test Tutorial');
    assert.equal(tutorial.type, 'programming');
    assert.equal(tutorial.difficulty_level, 'beginner');
  });

  await t.test('createTutorial writes curriculum.md to DATA_DIR', () => {
    assert.ok(existsSync(join(tmpDir, 'curriculum.md')));
    initialFileContent = readFileSync(join(tmpDir, 'curriculum.md'), 'utf-8');
  });

  await t.test('curriculum.md content matches getCurriculumTree output', () => {
    assert.equal(initialFileContent, database.getCurriculumTree());
  });

  await t.test('getCurriculumTree returns a string', () => {
    assert.equal(typeof database.getCurriculumTree(), 'string');
  });

  await t.test('tree starts with the tutorial title header', () => {
    const tree = database.getCurriculumTree()!;
    assert.ok(tree.startsWith('Test Tutorial - Full Curriculum'));
  });

  await t.test('tree includes PART I, II, III headers', () => {
    const tree = database.getCurriculumTree()!;
    assert.ok(tree.includes('PART I:'));
    assert.ok(tree.includes('PART II:'));
    assert.ok(tree.includes('PART III:'));
  });

  await t.test('tree contains 12 chapter lines', () => {
    const tree = database.getCurriculumTree()!;
    const chapterLines = tree.split('\n').filter((l) => /Chapter \d+:/.test(l));
    assert.equal(chapterLines.length, 12);
  });

  await t.test('tree contains 48 lesson lines', () => {
    const tree = database.getCurriculumTree()!;
    const lessonLines = tree.split('\n').filter((l) => /Lesson \d+:/.test(l));
    assert.equal(lessonLines.length, 48);
  });

  await t.test('tree contains 12 Mock Interview lines', () => {
    const tree = database.getCurriculumTree()!;
    const interviewLines = tree.split('\n').filter((l) => l.includes('Mock Interview'));
    assert.equal(interviewLines.length, 12);
  });

  await t.test('tree contains 3 Capstone Project lines', () => {
    const tree = database.getCurriculumTree()!;
    const capstoneLines = tree.split('\n').filter((l) => l.includes('Capstone Project'));
    assert.equal(capstoneLines.length, 3);
  });

  await t.test('tree includes the legend line', () => {
    const tree = database.getCurriculumTree()!;
    assert.ok(tree.includes('Legend: ✓ completed  ► current  ○ upcoming  ◆ capstone'));
  });

  await t.test('all 48 lessons are initially marked ○', () => {
    const tree = database.getCurriculumTree()!;
    const lessonLines = tree.split('\n').filter((l) => /Lesson \d+:/.test(l));
    assert.ok(lessonLines.every((l) => l.includes('○')));
  });

  await t.test('all 12 interviews are initially marked ○', () => {
    const tree = database.getCurriculumTree()!;
    const interviewLines = tree.split('\n').filter((l) => l.includes('Mock Interview'));
    assert.ok(interviewLines.every((l) => l.includes('○')));
  });

  await t.test('all 3 capstones are initially marked ◆', () => {
    const tree = database.getCurriculumTree()!;
    const capstoneLines = tree.split('\n').filter((l) => l.includes('Capstone Project'));
    assert.ok(capstoneLines.every((l) => l.includes('◆')));
  });

  await t.test('after startTutorial, first lesson shows ► and YOU ARE HERE', () => {
    database.startTutorial();
    const tree = database.getCurriculumTree()!;
    const line = tree.split('\n').find((l) => l.includes('Lesson 1.1.1'))!;
    assert.ok(line.includes('►'));
    assert.ok(line.includes('YOU ARE HERE'));
  });

  await t.test('getCurrentPosition exposes type and difficulty_level for mode/level-calibrated teaching after recovery', () => {
    const pos = database.getCurrentPosition()!;
    assert.equal(pos.type, 'programming');
    assert.equal(pos.difficulty_level, 'beginner');
    assert.equal(pos.current_lesson!.name, 'Lesson 1.1.1');
  });

  await t.test('after startTutorial, other lessons remain ○ without YOU ARE HERE', () => {
    const tree = database.getCurriculumTree()!;
    const line = tree.split('\n').find((l) => l.includes('Lesson 1.1.2'))!;
    assert.ok(line.includes('○'));
    assert.ok(!line.includes('YOU ARE HERE'));
  });

  await t.test('after advancePosition, completed lesson is marked ✓', () => {
    database.advancePosition();
    const tree = database.getCurriculumTree()!;
    const line = tree.split('\n').find((l) => l.includes('Lesson 1.1.1'))!;
    assert.ok(line.includes('✓'));
  });

  await t.test('after advancePosition, next lesson is marked ►', () => {
    const tree = database.getCurriculumTree()!;
    const line = tree.split('\n').find((l) => l.includes('Lesson 1.1.2'))!;
    assert.ok(line.includes('►'));
  });

  await t.test('curriculum.md is write-once: byte-identical to initial snapshot', () => {
    const fileContent = readFileSync(join(tmpDir, 'curriculum.md'), 'utf-8');
    assert.equal(fileContent, initialFileContent);
  });

  await t.test('curriculum.md diverges from live tree once progress has advanced', () => {
    const fileContent = readFileSync(join(tmpDir, 'curriculum.md'), 'utf-8');
    assert.notEqual(fileContent, database.getCurriculumTree());
  });

  // --- Boundary facts + derived chapter/part completion ---

  let ch11Id = 0;
  let part1Id = 0;

  await t.test('boundary facts: a mid-chapter lesson is neither chapter-end nor part-end', () => {
    const pos = database.getCurrentPosition()!; // at Lesson 1.1.2 from the lifecycle above
    assert.equal(pos.current_lesson!.name, 'Lesson 1.1.2');
    assert.equal(pos.is_chapter_end, false);
    assert.equal(pos.is_part_end, false);
    assert.equal(pos.interview_logged, false);
    assert.equal(pos.capstone_logged, false);
    ch11Id = pos.current_chapter!.id;
    part1Id = pos.current_part!.id;
  });

  await t.test('boundary facts: last lesson of a non-final chapter is chapter-end, not part-end', () => {
    let g = 0;
    while (database.getCurrentPosition()!.current_lesson!.name !== 'Lesson 1.1.4' && g++ < 100) database.advancePosition();
    const pos = database.getCurrentPosition()!;
    assert.equal(pos.is_chapter_end, true);
    assert.equal(pos.is_part_end, false);
  });

  await t.test('chapter completion derives from lessons + interview log, not a stored flag', () => {
    database.advancePosition(); // complete Lesson 1.1.4 -> chapter 1.1 lessons all done, pointer to 1.2.1
    assert.equal(database.getChapter(ch11Id)!.chapter.completed, false); // no interview yet
    database.logInterviewResult(ch11Id, 32, 40, 'ok');
    assert.equal(database.getChapter(ch11Id)!.chapter.completed, true);
  });

  await t.test('part-end is detected at the final lesson of the final chapter of a part', () => {
    let g = 0;
    while (database.getCurrentPosition()!.current_lesson!.name !== 'Lesson 1.4.4' && g++ < 100) database.advancePosition();
    const pos = database.getCurrentPosition()!;
    assert.equal(pos.is_chapter_end, true);
    assert.equal(pos.is_part_end, true);
  });

  await t.test('part completion derives from all chapters complete + capstone log', () => {
    database.advancePosition(); // complete Lesson 1.4.4, pointer leaves part 1
    for (const ch of database.getPart(part1Id)!.chapters) {
      database.logInterviewResult(ch.id, 32, 40, 'ok'); // every chapter in part 1 interviewed
    }
    assert.equal(database.getPart(part1Id)!.part.completed, false); // capstone still missing
    database.logCapstoneResult(part1Id, true, 'done');
    assert.equal(database.getPart(part1Id)!.part.completed, true);
  });
});
