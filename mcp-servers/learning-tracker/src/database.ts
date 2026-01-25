import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

// Data directory must be set via MULTIVAC_DATA_DIR environment variable
// This is set by the local .claude/settings.json in each tutorial project
const DATA_DIR = process.env.MULTIVAC_DATA_DIR;
if (!DATA_DIR) {
  throw new Error(
    'MULTIVAC_DATA_DIR environment variable not set. ' +
    'This MCP server should be configured via a tutorial project created with the `multivac` command.'
  );
}
const DB_PATH = join(DATA_DIR, 'learning.db');

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS tutorials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutorial_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
    completed INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    completed INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS concepts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS review_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutorial_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    added_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
    UNIQUE(tutorial_id, lesson_id)
  );

  CREATE TABLE IF NOT EXISTS quiz_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    missed_concepts TEXT,
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS interview_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chapter_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    notes TEXT,
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS capstone_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    part_id INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    notes TEXT,
    completed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tutorial_id INTEGER NOT NULL UNIQUE,
    current_lesson_id INTEGER,
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    started_at TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tutorial_id) REFERENCES tutorials(id) ON DELETE CASCADE,
    FOREIGN KEY (current_lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_parts_tutorial ON parts(tutorial_id);
  CREATE INDEX IF NOT EXISTS idx_chapters_part ON chapters(part_id);
  CREATE INDEX IF NOT EXISTS idx_lessons_chapter ON lessons(chapter_id);
  CREATE INDEX IF NOT EXISTS idx_concepts_lesson ON concepts(lesson_id);
  CREATE INDEX IF NOT EXISTS idx_review_queue_tutorial ON review_queue(tutorial_id);
  CREATE INDEX IF NOT EXISTS idx_review_queue_position ON review_queue(tutorial_id, position);
`);

// Types
export interface Tutorial {
  id: number;
  name: string;
  description: string | null;
  completed: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface Part {
  id: number;
  tutorial_id: number;
  name: string;
  difficulty: 1 | 2 | 3;
  completed: boolean;
  sort_order: number;
}

export interface Chapter {
  id: number;
  part_id: number;
  name: string;
  description: string | null;
  completed: boolean;
  sort_order: number;
}

export interface Lesson {
  id: number;
  chapter_id: number;
  name: string;
  description: string | null;
  completed: boolean;
  sort_order: number;
}

export interface Concept {
  id: number;
  lesson_id: number;
  name: string;
  description: string | null;
}

export interface ReviewQueueItem {
  id: number;
  tutorial_id: number;
  lesson_id: number;
  position: number;
  added_at: string;
}

export interface QuizResult {
  id: number;
  lesson_id: number;
  score: number;
  total: number;
  missed_concepts: string | null;
  completed_at: string;
}

export interface InterviewResult {
  id: number;
  chapter_id: number;
  score: number;
  total: number;
  notes: string | null;
  completed_at: string;
}

export interface CapstoneResult {
  id: number;
  part_id: number;
  completed: boolean;
  notes: string | null;
  completed_at: string;
}

export interface Progress {
  id: number;
  tutorial_id: number;
  current_lesson_id: number | null;
  status: 'not_started' | 'in_progress' | 'completed';
  started_at: string | null;
  updated_at: string;
}

// Curriculum structure for creating tutorials
export interface CurriculumLesson {
  name: string;
  description?: string;
  concepts: { name: string; description?: string }[];
}

export interface CurriculumChapter {
  name: string;
  description?: string;
  lessons: CurriculumLesson[];
}

export interface CurriculumPart {
  name: string;
  difficulty: 1 | 2 | 3;
  chapters: CurriculumChapter[];
}

export interface Curriculum {
  name: string;
  description?: string;
  parts: CurriculumPart[];
}

// Helper to get the tutorial ID (there's only one per project database)
function getTutorialId(): number | null {
  const tutorial = db.prepare('SELECT id FROM tutorials LIMIT 1').get() as { id: number } | undefined;
  return tutorial?.id ?? null;
}

// Database operations
export const database = {
  // Tutorial operations
  createTutorial(curriculum: Curriculum): Tutorial {
    const insertTutorial = db.prepare(
      'INSERT INTO tutorials (name, description) VALUES (?, ?)'
    );
    const insertPart = db.prepare(
      'INSERT INTO parts (tutorial_id, name, difficulty, sort_order) VALUES (?, ?, ?, ?)'
    );
    const insertChapter = db.prepare(
      'INSERT INTO chapters (part_id, name, description, sort_order) VALUES (?, ?, ?, ?)'
    );
    const insertLesson = db.prepare(
      'INSERT INTO lessons (chapter_id, name, description, sort_order) VALUES (?, ?, ?, ?)'
    );
    const insertConcept = db.prepare(
      'INSERT INTO concepts (lesson_id, name, description) VALUES (?, ?, ?)'
    );
    const insertProgress = db.prepare(
      'INSERT INTO progress (tutorial_id, status) VALUES (?, ?)'
    );

    const transaction = db.transaction(() => {
      const tutorialResult = insertTutorial.run(curriculum.name, curriculum.description || null);
      const tutorialId = tutorialResult.lastInsertRowid as number;

      for (let pi = 0; pi < curriculum.parts.length; pi++) {
        const part = curriculum.parts[pi];
        const partResult = insertPart.run(tutorialId, part.name, part.difficulty, pi + 1);
        const partId = partResult.lastInsertRowid as number;

        for (let ci = 0; ci < part.chapters.length; ci++) {
          const chapter = part.chapters[ci];
          const chapterResult = insertChapter.run(partId, chapter.name, chapter.description || null, ci + 1);
          const chapterId = chapterResult.lastInsertRowid as number;

          for (let lsi = 0; lsi < chapter.lessons.length; lsi++) {
            const lesson = chapter.lessons[lsi];
            const lessonResult = insertLesson.run(chapterId, lesson.name, lesson.description || null, lsi + 1);
            const lessonId = lessonResult.lastInsertRowid as number;

            for (const concept of lesson.concepts) {
              insertConcept.run(lessonId, concept.name, concept.description || null);
            }
          }
        }
      }

      insertProgress.run(tutorialId, 'not_started');

      return db.prepare('SELECT * FROM tutorials WHERE id = ?').get(tutorialId) as Tutorial;
    });

    return transaction();
  },

  getTutorial(): {
    tutorial: Tutorial;
    parts: (Part & {
      chapters: (Chapter & {
        lessons: (Lesson & {
          concepts: Concept[];
          quiz_result: QuizResult | null;
        })[];
        interview_result: InterviewResult | null;
      })[];
      capstone_result: CapstoneResult | null;
    })[];
    progress: Progress | null;
    stats: {
      total_lessons: number;
      completed_lessons: number;
      total_concepts: number;
      average_quiz_score: number | null;
      total_interviews: number;
      completed_interviews: number;
      average_interview_score: number | null;
    };
  } | null {
    const tutorialId = getTutorialId();
    if (!tutorialId) return null;

    const tutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(tutorialId) as Tutorial;
    const parts = db.prepare('SELECT * FROM parts WHERE tutorial_id = ? ORDER BY sort_order').all(tutorialId) as Part[];

    const result = {
      tutorial,
      parts: parts.map(part => {
        const chapters = db.prepare('SELECT * FROM chapters WHERE part_id = ? ORDER BY sort_order').all(part.id) as Chapter[];
        const capstoneResult = db.prepare('SELECT * FROM capstone_results WHERE part_id = ? ORDER BY completed_at DESC LIMIT 1').get(part.id) as CapstoneResult | undefined;

        return {
          ...part,
          completed: !!part.completed,
          chapters: chapters.map(chapter => {
            const lessons = db.prepare('SELECT * FROM lessons WHERE chapter_id = ? ORDER BY sort_order').all(chapter.id) as Lesson[];
            const interviewResult = db.prepare('SELECT * FROM interview_results WHERE chapter_id = ? ORDER BY completed_at DESC LIMIT 1').get(chapter.id) as InterviewResult | undefined;

            return {
              ...chapter,
              completed: !!chapter.completed,
              lessons: lessons.map(lesson => {
                const concepts = db.prepare('SELECT * FROM concepts WHERE lesson_id = ?').all(lesson.id) as Concept[];
                const quizResult = db.prepare('SELECT * FROM quiz_results WHERE lesson_id = ? ORDER BY completed_at DESC LIMIT 1').get(lesson.id) as QuizResult | undefined;

                return {
                  ...lesson,
                  completed: !!lesson.completed,
                  concepts,
                  quiz_result: quizResult || null
                };
              }),
              interview_result: interviewResult || null
            };
          }),
          capstone_result: capstoneResult || null
        };
      }),
      progress: db.prepare('SELECT * FROM progress WHERE tutorial_id = ?').get(tutorialId) as Progress | null,
      stats: this.getTutorialStats(tutorialId)
    };

    return result;
  },

  getTutorialStats(tutorialId: number): {
    total_lessons: number;
    completed_lessons: number;
    total_concepts: number;
    average_quiz_score: number | null;
    total_interviews: number;
    completed_interviews: number;
    average_interview_score: number | null;
  } {
    const lessonStats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN l.completed = 1 THEN 1 ELSE 0 END) as completed
      FROM lessons l
      JOIN chapters c ON l.chapter_id = c.id
      JOIN parts p ON c.part_id = p.id
      WHERE p.tutorial_id = ?
    `).get(tutorialId) as { total: number; completed: number };

    const conceptStats = db.prepare(`
      SELECT COUNT(*) as total
      FROM concepts co
      JOIN lessons l ON co.lesson_id = l.id
      JOIN chapters c ON l.chapter_id = c.id
      JOIN parts p ON c.part_id = p.id
      WHERE p.tutorial_id = ?
    `).get(tutorialId) as { total: number };

    const quizAvg = db.prepare(`
      SELECT AVG(CAST(qr.score AS FLOAT) / qr.total * 100) as avg_score
      FROM quiz_results qr
      JOIN lessons l ON qr.lesson_id = l.id
      JOIN chapters c ON l.chapter_id = c.id
      JOIN parts p ON c.part_id = p.id
      WHERE p.tutorial_id = ?
    `).get(tutorialId) as { avg_score: number | null };

    const interviewStats = db.prepare(`
      SELECT
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT ir.chapter_id) as completed,
        AVG(CAST(ir.score AS FLOAT) / ir.total * 100) as avg_score
      FROM chapters c
      JOIN parts p ON c.part_id = p.id
      LEFT JOIN interview_results ir ON c.id = ir.chapter_id
      WHERE p.tutorial_id = ?
    `).get(tutorialId) as { total: number; completed: number; avg_score: number | null };

    return {
      total_lessons: lessonStats.total,
      completed_lessons: lessonStats.completed,
      total_concepts: conceptStats.total,
      average_quiz_score: quizAvg.avg_score ? Math.round(quizAvg.avg_score * 10) / 10 : null,
      total_interviews: interviewStats.total,
      completed_interviews: interviewStats.completed,
      average_interview_score: interviewStats.avg_score ? Math.round(interviewStats.avg_score * 10) / 10 : null
    };
  },

  getCurrentPosition(): {
    tutorial_name: string;
    current_lesson: Lesson | null;
    current_chapter: Chapter | null;
    current_part: Part | null;
    position: { part: number; chapter: number; lesson: number } | null;
    is_chapter_start: boolean;
  } | null {
    const tutorialId = getTutorialId();
    if (!tutorialId) return null;

    const tutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(tutorialId) as Tutorial;

    const progress = db.prepare('SELECT * FROM progress WHERE tutorial_id = ?').get(tutorialId) as Progress | undefined;

    if (!progress || !progress.current_lesson_id) {
      // Find first lesson
      const firstLesson = db.prepare(`
        SELECT l.*, c.part_id, c.sort_order as chapter_order, p.sort_order as part_order
        FROM lessons l
        JOIN chapters c ON l.chapter_id = c.id
        JOIN parts p ON c.part_id = p.id
        WHERE p.tutorial_id = ?
        ORDER BY p.sort_order, c.sort_order, l.sort_order
        LIMIT 1
      `).get(tutorialId) as (Lesson & { part_id: number; chapter_order: number; part_order: number }) | undefined;

      if (!firstLesson) return { tutorial_name: tutorial.name, current_lesson: null, current_chapter: null, current_part: null, position: null, is_chapter_start: false };

      const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(firstLesson.chapter_id) as Chapter;
      const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(firstLesson.part_id) as Part;

      return {
        tutorial_name: tutorial.name,
        current_lesson: firstLesson,
        current_chapter: chapter,
        current_part: part,
        position: { part: firstLesson.part_order, chapter: firstLesson.chapter_order, lesson: firstLesson.sort_order },
        is_chapter_start: firstLesson.sort_order === 1
      };
    }

    const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(progress.current_lesson_id) as Lesson | undefined;
    if (!lesson) return { tutorial_name: tutorial.name, current_lesson: null, current_chapter: null, current_part: null, position: null, is_chapter_start: false };

    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(lesson.chapter_id) as Chapter;
    const part = db.prepare('SELECT * FROM parts WHERE id = ?').get(chapter.part_id) as Part;

    return {
      tutorial_name: tutorial.name,
      current_lesson: lesson,
      current_chapter: chapter,
      current_part: part,
      position: { part: part.sort_order, chapter: chapter.sort_order, lesson: lesson.sort_order },
      is_chapter_start: lesson.sort_order === 1
    };
  },

  advancePosition(): {
    previous_lesson: Lesson | null;
    new_lesson: Lesson | null;
    chapter_completed: boolean;
    part_completed: boolean;
    tutorial_completed: boolean;
  } | null {
    const tutorialId = getTutorialId();
    if (!tutorialId) return null;

    const currentPos = this.getCurrentPosition();
    if (!currentPos || !currentPos.current_lesson) {
      return { previous_lesson: null, new_lesson: null, chapter_completed: false, part_completed: false, tutorial_completed: false };
    }

    const previousLesson = currentPos.current_lesson;

    // Add completed lesson to review queue
    this.addToReviewQueue(tutorialId, previousLesson.id);

    // Find next lesson
    const nextLesson = db.prepare(`
      SELECT l.*, c.part_id, c.sort_order as chapter_order, p.sort_order as part_order
      FROM lessons l
      JOIN chapters c ON l.chapter_id = c.id
      JOIN parts p ON c.part_id = p.id
      WHERE p.tutorial_id = ?
        AND (
          (p.sort_order = ? AND c.sort_order = ? AND l.sort_order > ?)
          OR (p.sort_order = ? AND c.sort_order > ?)
          OR (p.sort_order > ?)
        )
      ORDER BY p.sort_order, c.sort_order, l.sort_order
      LIMIT 1
    `).get(
      tutorialId,
      currentPos.position!.part, currentPos.position!.chapter, currentPos.position!.lesson,
      currentPos.position!.part, currentPos.position!.chapter,
      currentPos.position!.part
    ) as (Lesson & { part_id: number; chapter_order: number; part_order: number }) | undefined;

    const chapterCompleted = !nextLesson || nextLesson.chapter_id !== previousLesson.chapter_id;
    const partCompleted = !nextLesson || nextLesson.part_id !== currentPos.current_part!.id;
    const tutorialCompleted = !nextLesson;

    // Update progress
    if (nextLesson) {
      db.prepare(`
        UPDATE progress SET current_lesson_id = ?, status = 'in_progress', updated_at = datetime('now')
        WHERE tutorial_id = ?
      `).run(nextLesson.id, tutorialId);
    } else {
      db.prepare(`
        UPDATE progress SET status = 'completed', updated_at = datetime('now')
        WHERE tutorial_id = ?
      `).run(tutorialId);
      db.prepare(`
        UPDATE tutorials SET completed = 1, completed_at = datetime('now')
        WHERE id = ?
      `).run(tutorialId);
    }

    // Mark previous lesson as completed
    db.prepare('UPDATE lessons SET completed = 1 WHERE id = ?').run(previousLesson.id);

    // Check and update chapter completion
    if (chapterCompleted && currentPos.current_chapter) {
      db.prepare('UPDATE chapters SET completed = 1 WHERE id = ?').run(currentPos.current_chapter.id);
    }

    // Check and update part completion
    if (partCompleted && currentPos.current_part) {
      db.prepare('UPDATE parts SET completed = 1 WHERE id = ?').run(currentPos.current_part.id);
    }

    return {
      previous_lesson: previousLesson,
      new_lesson: nextLesson || null,
      chapter_completed: chapterCompleted,
      part_completed: partCompleted,
      tutorial_completed: tutorialCompleted
    };
  },

  // Review queue operations
  addToReviewQueue(tutorialId: number, lessonId: number): void {
    // Get the max position
    const maxPos = db.prepare(
      'SELECT MAX(position) as max_pos FROM review_queue WHERE tutorial_id = ?'
    ).get(tutorialId) as { max_pos: number | null };

    const newPosition = (maxPos.max_pos ?? 0) + 1;

    // Insert or update (in case lesson is already in queue, move to end)
    db.prepare(`
      INSERT INTO review_queue (tutorial_id, lesson_id, position, added_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(tutorial_id, lesson_id) DO UPDATE SET
        position = excluded.position,
        added_at = excluded.added_at
    `).run(tutorialId, lessonId, newPosition);
  },

  getReviewQueue(): {
    lesson: Lesson;
    concepts: Concept[];
    queue_position: number;
  }[] | null {
    const tutorialId = getTutorialId();
    if (!tutorialId) return null;

    const queueItems = db.prepare(`
      SELECT rq.*, l.name as lesson_name, l.description as lesson_description,
             l.chapter_id, l.sort_order as lesson_sort_order, l.completed as lesson_completed
      FROM review_queue rq
      JOIN lessons l ON rq.lesson_id = l.id
      WHERE rq.tutorial_id = ?
      ORDER BY rq.position ASC
    `).all(tutorialId) as (ReviewQueueItem & {
      lesson_name: string;
      lesson_description: string | null;
      chapter_id: number;
      lesson_sort_order: number;
      lesson_completed: number;
    })[];

    return queueItems.map(item => {
      const concepts = db.prepare('SELECT * FROM concepts WHERE lesson_id = ?').all(item.lesson_id) as Concept[];
      return {
        lesson: {
          id: item.lesson_id,
          chapter_id: item.chapter_id,
          name: item.lesson_name,
          description: item.lesson_description,
          completed: !!item.lesson_completed,
          sort_order: item.lesson_sort_order
        },
        concepts,
        queue_position: item.position
      };
    });
  },

  logReviewResult(lessonId: number, correct: boolean): { removed: boolean; new_position: number | null } | null {
    const tutorialId = getTutorialId();
    if (!tutorialId) return null;

    if (correct) {
      // Remove from queue
      db.prepare('DELETE FROM review_queue WHERE tutorial_id = ? AND lesson_id = ?').run(tutorialId, lessonId);
      return { removed: true, new_position: null };
    } else {
      // Move to end of queue
      const maxPos = db.prepare(
        'SELECT MAX(position) as max_pos FROM review_queue WHERE tutorial_id = ?'
      ).get(tutorialId) as { max_pos: number | null };

      const newPosition = (maxPos.max_pos ?? 0) + 1;

      db.prepare('UPDATE review_queue SET position = ? WHERE tutorial_id = ? AND lesson_id = ?')
        .run(newPosition, tutorialId, lessonId);

      return { removed: false, new_position: newPosition };
    }
  },

  // Reset all progress while keeping the curriculum structure
  resetProgress(): boolean {
    const tutorialId = getTutorialId();
    if (!tutorialId) return false;

    db.transaction(() => {
      // Reset progress table
      db.prepare(`
        UPDATE progress
        SET current_lesson_id = NULL, status = 'not_started', started_at = NULL, updated_at = datetime('now')
        WHERE tutorial_id = ?
      `).run(tutorialId);

      // Clear tutorial completion
      db.prepare('UPDATE tutorials SET completed = 0, completed_at = NULL WHERE id = ?').run(tutorialId);

      // Clear part completion
      db.prepare('UPDATE parts SET completed = 0 WHERE tutorial_id = ?').run(tutorialId);

      // Clear chapter completion
      db.prepare(`
        UPDATE chapters SET completed = 0
        WHERE part_id IN (SELECT id FROM parts WHERE tutorial_id = ?)
      `).run(tutorialId);

      // Clear lesson completion
      db.prepare(`
        UPDATE lessons SET completed = 0
        WHERE chapter_id IN (
          SELECT c.id FROM chapters c
          JOIN parts p ON c.part_id = p.id
          WHERE p.tutorial_id = ?
        )
      `).run(tutorialId);

      // Clear review queue
      db.prepare('DELETE FROM review_queue WHERE tutorial_id = ?').run(tutorialId);

      // Clear quiz results
      db.prepare(`
        DELETE FROM quiz_results
        WHERE lesson_id IN (
          SELECT ls.id FROM lessons ls
          JOIN chapters c ON ls.chapter_id = c.id
          JOIN parts p ON c.part_id = p.id
          WHERE p.tutorial_id = ?
        )
      `).run(tutorialId);

      // Clear interview results
      db.prepare(`
        DELETE FROM interview_results
        WHERE chapter_id IN (
          SELECT c.id FROM chapters c
          JOIN parts p ON c.part_id = p.id
          WHERE p.tutorial_id = ?
        )
      `).run(tutorialId);

      // Clear capstone results
      db.prepare(`
        DELETE FROM capstone_results
        WHERE part_id IN (SELECT id FROM parts WHERE tutorial_id = ?)
      `).run(tutorialId);
    })();

    return true;
  },

  logQuizResult(lessonId: number, score: number, total: number, missedConceptIds: number[]): QuizResult {
    const result = db.prepare(`
      INSERT INTO quiz_results (lesson_id, score, total, missed_concepts)
      VALUES (?, ?, ?, ?)
    `).run(lessonId, score, total, JSON.stringify(missedConceptIds));

    return db.prepare('SELECT * FROM quiz_results WHERE id = ?').get(result.lastInsertRowid) as QuizResult;
  },

  logInterviewResult(chapterId: number, score: number, total: number, notes?: string): InterviewResult {
    const result = db.prepare(`
      INSERT INTO interview_results (chapter_id, score, total, notes)
      VALUES (?, ?, ?, ?)
    `).run(chapterId, score, total, notes || null);

    return db.prepare('SELECT * FROM interview_results WHERE id = ?').get(result.lastInsertRowid) as InterviewResult;
  },

  logCapstoneResult(partId: number, completed: boolean, notes?: string): CapstoneResult {
    const result = db.prepare(`
      INSERT INTO capstone_results (part_id, completed, notes)
      VALUES (?, ?, ?)
    `).run(partId, completed ? 1 : 0, notes || null);

    return db.prepare('SELECT * FROM capstone_results WHERE id = ?').get(result.lastInsertRowid) as CapstoneResult;
  },

  // Start a tutorial (set progress to in_progress and set current lesson to first)
  startTutorial(): Progress | null {
    const tutorialId = getTutorialId();
    if (!tutorialId) return null;

    const firstLesson = db.prepare(`
      SELECT l.id
      FROM lessons l
      JOIN chapters c ON l.chapter_id = c.id
      JOIN parts p ON c.part_id = p.id
      WHERE p.tutorial_id = ?
      ORDER BY p.sort_order, c.sort_order, l.sort_order
      LIMIT 1
    `).get(tutorialId) as { id: number } | undefined;

    if (!firstLesson) {
      throw new Error(`Tutorial ${tutorialId} has no lessons`);
    }

    db.prepare(`
      UPDATE progress
      SET current_lesson_id = ?, status = 'in_progress', started_at = datetime('now'), updated_at = datetime('now')
      WHERE tutorial_id = ?
    `).run(firstLesson.id, tutorialId);

    return db.prepare('SELECT * FROM progress WHERE tutorial_id = ?').get(tutorialId) as Progress;
  }
};

export default database;
