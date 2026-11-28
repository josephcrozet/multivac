#!/usr/bin/env node

import { Server, ProtocolError, ProtocolErrorCode, type CallToolRequest, type ListToolsResult } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import database, { INTERVIEW_TOTAL, type Curriculum, type InterviewSlot, type Preferences } from './database.js';

// Response helpers
function jsonResponse(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function noTutorialError() {
  return jsonResponse({
    success: false,
    error: 'No tutorial exists in this project yet. Create one first.',
  });
}

// Define available tools
async function listTools(): Promise<ListToolsResult> {
  return {
    tools: [
      {
        name: 'create_tutorial',
        description: 'Create a new tutorial curriculum with parts, chapters, lessons, and concepts. Use this when setting up a new learning path.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the tutorial (e.g., "Python", "JavaScript")',
            },
            description: {
              type: 'string',
              description: 'Brief description of what this tutorial covers',
            },
            type: {
              type: 'string',
              enum: ['general', 'programming'],
              description: 'Tutorial type. "programming" uses code-based interviews and test-driven capstones. "general" uses knowledge-based interviews and criteria-based capstones. Defaults to "general".',
            },
            difficulty_level: {
              type: 'string',
              enum: ['beginner', 'intermediate', 'advanced'],
              description: 'The difficulty level chosen by the user. Affects lesson depth and complexity. Defaults to "beginner".',
            },
            preferences: {
              type: 'object',
              description: 'User preferences. Defaults: { book: false, language: "en" }',
              properties: {
                book: { type: 'boolean', description: 'Save lessons to a book/ folder for offline review' },
                language: { type: 'string', description: 'Language of instruction (ISO 639-1 code). Defaults to "en".' },
                teaching_target: { type: 'array', items: { type: 'string' }, description: 'Programming tutorials only: the versions the course teaches, as chosen at setup, one entry per tool (e.g. ["Java 21 (LTS)"], or ["Kafka 4.1", "Python 3.14"]).' },
                programming_language: { type: 'string', description: 'The programming language exercises are written in, when the topic doesn\'t decide it (e.g. "Python" for a Kafka tutorial). Not the language of instruction — that is `language`.' },
                exercise_resources: { type: 'array', items: { type: 'string' }, description: 'What the learner\'s hands-on work can use beyond the toolchain (e.g. ["Docker", "GCP project", "Anthropic API key"]). Names only, never the secrets themselves.' },
              },
            },
            parts: {
              type: 'array',
              description: 'Array of 3 parts (Part I, Part II, Part III)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  difficulty: { type: 'number', enum: [1, 2, 3] },
                  chapters: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        lessons: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              name: { type: 'string' },
                              description: { type: 'string' },
                              concepts: {
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                  },
                                  required: ['name'],
                                },
                              },
                            },
                            required: ['name', 'concepts'],
                          },
                        },
                      },
                      required: ['name', 'lessons'],
                    },
                  },
                },
                required: ['name', 'difficulty', 'chapters'],
              },
            },
          },
          required: ['name', 'parts'],
        },
      },
      {
        name: 'get_tutorial',
        description: 'Get the complete tutorial payload: full nested structure (every part/chapter/lesson/concept) plus progress and stats (~13k tokens). Returns { tutorial: null } if no tutorial exists yet. NOT used in the normal lesson flow — prefer the lightweight tools: get_stats (progress/certificate numbers), get_curriculum_tree (curriculum view), get_part (one part), get_tutorial_metadata (status/type/difficulty). Reach for get_tutorial only when you need the entire payload at once: full export or debugging.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_curriculum_tree',
        description: 'Get the full curriculum as a pre-formatted ASCII tree, annotated with live progress (✓ cleared, ► current, ○ upcoming; capstones ★ cleared, ☆ skipped, ◇ upcoming). Use this for any "show me the curriculum" view (e.g., the /menu Curriculum Tree, "View curriculum" at tutorial start) instead of get_tutorial. The response is a ready-to-display string — present it verbatim, do not reformat.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_chapter_progress',
        description: 'Get one chapter\'s progress view as a pre-formatted string: each lesson (✓ done, with a progress bar), then the mock interview. The first item not yet done is marked ►, with "◄── in progress" and a partial bar if it has begun, or "◄── up next" if not. Use this for the progress view shown after a lesson and when resuming mid-chapter. The response is ready to display — present it verbatim, do not reformat. The chapter_id comes from current_chapter.id returned by get_current_position.',
        inputSchema: {
          type: 'object',
          properties: {
            chapter_id: {
              type: 'number',
              description: 'ID of the chapter to show',
            },
          },
          required: ['chapter_id'],
        },
      },
      {
        name: 'get_stats',
        description: 'Get aggregate stats for the tutorial: overall counts (lessons, concepts, interviews, capstones) and quiz/interview averages, the final score out of 2000 with its rank (S+, S, A–E) and a breakdown by source (frozen once the tutorial is completed), plus the same counts and averages per part. Lightweight — use for any screen that displays scores or progress (Part Cleared Screen, Victory Screen, Progress Screen, Certificate) instead of get_tutorial.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_part',
        description: 'Get a single part with its full structure (chapters → lessons → concepts). Use this for capstone design (synthesizing concepts from all 4 chapters in this part) instead of get_tutorial. The part_id comes from current_part.id returned by get_current_position.',
        inputSchema: {
          type: 'object',
          properties: {
            part_id: {
              type: 'number',
              description: 'ID of the part to fetch',
            },
          },
          required: ['part_id'],
        },
      },
      {
        name: 'get_chapter',
        description: "Get a single chapter with its lessons and each lesson's concepts, plus the chapter's results: average_quiz_score across its lessons and the interview score (null until each exists). Use this for the Chapter Start Screen (which needs the lesson names), for mock interview context (which needs every lesson's concepts), and for the end-of-chapter screen (which needs the results), instead of get_tutorial. The chapter_id comes from current_chapter.id returned by get_current_position.",
        inputSchema: {
          type: 'object',
          properties: {
            chapter_id: {
              type: 'number',
              description: 'ID of the chapter to fetch',
            },
          },
          required: ['chapter_id'],
        },
      },
      {
        name: 'get_lesson',
        description: "Get a single lesson with its concepts, and current_section: the section it's on (theory, exercise, quiz, or socratic), or null once it's completed; and quiz: its recorded score and total, or null if the quiz hasn't been taken. The narrowest getter — use it at the start of each lesson to ground teaching in the concepts the quiz and review queue draw on. The lesson_id comes from current_lesson.id returned by get_current_position.",
        inputSchema: {
          type: 'object',
          properties: {
            lesson_id: {
              type: 'number',
              description: 'ID of the lesson to fetch',
            },
          },
          required: ['lesson_id'],
        },
      },
      {
        name: 'get_tutorial_metadata',
        description: 'Get lightweight tutorial metadata without the full structure. Returns name, type, status, difficulty_level, and dates. Use this for quick checks like determining if tutorial is completed, what type it is, or what difficulty level was chosen. Returns null if no tutorial exists.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_preferences',
        description: 'Get user preferences (book, language, teaching_target, programming_language, exercise_resources). Lightweight call — use this instead of get_tutorial when you only need to check a setting.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'update_preferences',
        description: 'Update one or more user preferences. Merges provided values with existing preferences.',
        inputSchema: {
          type: 'object',
          properties: {
            book: { type: 'boolean', description: 'Enable/disable saving lessons to book/ folder' },
            language: { type: 'string', description: 'Language of instruction (ISO 639-1 code)' },
            teaching_target: { type: 'array', items: { type: 'string' }, description: 'Programming tutorials only: the versions the course teaches, one entry per tool. Replaces the whole list' },
            programming_language: { type: 'string', description: 'The programming language exercises are written in, when the topic doesn\'t decide it' },
            exercise_resources: { type: 'array', items: { type: 'string' }, description: 'What the learner\'s hands-on work can use beyond the toolchain. Replaces the whole list; names only, never secrets' },
          },
        },
      },
      {
        name: 'start_tutorial',
        description: 'Start the tutorial, setting it to in_progress and positioning at the first lesson.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_current_position',
        description: 'Get the current position in the tutorial (current lesson, chapter, and part, and current_section: the section the current lesson is on — theory, exercise, quiz, or socratic — or null once the lesson is completed) plus the tutorial type (programming/general) and difficulty_level (beginner/intermediate/advanced), so lessons are taught in the right mode and at the right level after compaction or clearing. Also returns boundary facts for the controller to route on: is_chapter_start (trigger reviews), is_chapter_end / is_part_end (whether this lesson ends its chapter/part), and interview_resolved / capstone_resolved (whether the chapter interview / part capstone has been recorded — done, or for the skippable capstone, skipped).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'complete_lesson',
        description: "Mark the current lesson complete and add it to the review queue. This finishes the Socratic review, the lesson's last section. Guarded: refuses (completed=false, with a reason) until the lesson reaches that section, and for a lesson already completed, which would otherwise be queued for review again. Does NOT move the pointer — any boundary work (mock interview at a chapter end, capstone at a part end) happens next, and only then is advance_position called to move on.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'advance_section',
        description: "Move the current lesson on to its next section: theory → exercise → quiz → socratic. Call it when the learner chooses to go on after the theory, the exercise, and the quiz; complete_lesson finishes the Socratic review. Guarded: refuses (advanced=false, with a reason) to leave the quiz before its result is recorded or to move past the Socratic review. Returns the new current_section.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'advance_position',
        description: 'Move the pointer to the next lesson (or mark the tutorial completed if there is none). Does not mark anything complete — the current lesson must already be completed via complete_lesson, and any chapter/part boundary work logged, before advancing. Guarded: refuses (advanced=false, with a reason) if the tutorial is already complete, if the current lesson is not completed, or — at a chapter/part end — if the interview/capstone is not yet resolved. Resolve the pending work first (complete_lesson, then run/skip the interview or capstone).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'log_quiz_result',
        description: "Record the current lesson's quiz result. The lesson stays on its quiz until the learner chooses to go on, when advance_section moves it to the Socratic review. Calling it again before the learner continues records a retake: the lesson keeps its better score, and concepts missed in any attempt stay marked for review (retake: true in the result). Guarded: refuses unless the lesson is on its quiz section (current_section from get_current_position), so once the learner has moved on the quiz is closed.",
        inputSchema: {
          type: 'object',
          properties: {
            score: {
              type: 'number',
              description: 'Number of correct answers',
            },
            total: {
              type: 'number',
              description: 'Total number of questions',
            },
            missed_concept_ids: {
              type: 'array',
              items: { type: 'number' },
              description: "IDs of the lesson's concepts the user got at least one question wrong on, as returned by get_lesson. The review queue uses them to revisit weak spots first.",
            },
          },
          required: ['score', 'total', 'missed_concept_ids'],
        },
      },
      {
        name: 'get_interview',
        description: "Get the current chapter's mock interview: plan (its 8 slots, or null until plan_interview), scores (one per answered question, in order), answered, finished (every question scored), best_score (the best total out of 40 of any finished attempt, or null), and resolved with result once log_interview_result has recorded it. Available once the chapter's last lesson is completed. Use it to start or resume an interview: with a plan and answered below 8, the interview continues from question answered + 1.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'plan_interview',
        description: "Store the plan for the current chapter's mock interview before any question is written: exactly 8 slots, in the order they'll be asked, each with the question's category (e.g. Write, Debug, Explain) and the concepts it covers. The plan holds no question text or answers. Each question is written when its slot comes up, so an interrupted interview resumes from its plan. Refused while a plan is stored (resume it, or call retake_interview once it's finished) and once the interview is resolved.",
        inputSchema: {
          type: 'object',
          properties: {
            slots: {
              type: 'array',
              description: 'The 8 planned questions, in order',
              items: {
                type: 'object',
                properties: {
                  category: { type: 'string', description: 'The question category, from the interview format' },
                  concepts: { type: 'array', items: { type: 'string' }, description: "Names of the chapter's concepts the question covers" },
                },
                required: ['category', 'concepts'],
              },
            },
          },
          required: ['slots'],
        },
      },
      {
        name: 'retake_interview',
        description: "Start the current chapter's mock interview again: clears the finished attempt's plan and scores and keeps its best total. Then call plan_interview for the new attempt. Refused unless every question of the current attempt is scored, and once the interview is resolved.",
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'log_interview_answer',
        description: "Record the score for one answered interview question, as soon as it's graded. Questions are scored in order: question must be the next unanswered one (answered + 1 from get_interview), so a repeated call is refused instead of filling the wrong slot. Scoring question 8 finishes the attempt and updates best_score. Refused without a plan, and once the interview is resolved.",
        inputSchema: {
          type: 'object',
          properties: {
            question: {
              type: 'number',
              description: 'The question number, 1–8',
            },
            score: {
              type: 'number',
              description: 'The score for the answer, a whole number from 0 to 5',
            },
          },
          required: ['question', 'score'],
        },
      },
      {
        name: 'log_interview_result',
        description: "Resolve the current chapter's mock interview with its best_score out of 40, when the learner chooses to go on. An unfinished retake is dropped, and the earlier attempt's best stands. Refused until an attempt has finished, and for an interview already resolved: a chapter holds one result.",
        inputSchema: {
          type: 'object',
          properties: {
            notes: {
              type: 'string',
              description: 'Optional notes about the interview performance',
            },
          },
        },
      },
      {
        name: 'log_capstone_result',
        description: 'Record a part capstone\'s result: completed, or skipped. A part holds one result, so a second one is refused.',
        inputSchema: {
          type: 'object',
          properties: {
            part_id: {
              type: 'number',
              description: 'ID of the part',
            },
            completed: {
              type: 'boolean',
              description: 'Whether the capstone was completed successfully',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the capstone project',
            },
          },
          required: ['part_id', 'completed'],
        },
      },
      {
        name: 'get_review_queue',
        description: "Get concepts waiting in the review queue, in queue order. Each item is one concept to ask a review question about, with the lesson it belongs to. A completed lesson queues every concept missed on its quiz, or one picked at random if none were. Use one_per_lesson for a review's first round, so it spreads across lessons. Once a completed tutorial's queue is empty, it refills with one concept from every lesson (queue_replenished).",
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of items to return. Use 4 for a review round.',
            },
            one_per_lesson: {
              type: 'boolean',
              description: "Take at most one item from each lesson: its first in queue order. Use it for a review's first round; leave it out for later rounds.",
            },
          },
        },
      },
      {
        name: 'log_review_result',
        description: 'Record the result of reviewing a concept. If correct, removes it from the queue. If incorrect, moves it to the end of the queue for later review.',
        inputSchema: {
          type: 'object',
          properties: {
            concept_id: {
              type: 'number',
              description: 'ID of the concept reviewed, from the get_review_queue item',
            },
            correct: {
              type: 'boolean',
              description: 'Whether the user answered correctly',
            },
          },
          required: ['concept_id', 'correct'],
        },
      },
      {
        name: 'reset_progress',
        description: 'Reset all progress while keeping the curriculum structure. Clears completion status, review queue, and all results (quiz, interview, capstone). Use this when the user wants to restart the same tutorial from the beginning.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
}

// Handle tool calls
async function callTool(request: CallToolRequest) {
  // A client may leave out `arguments`; treat that the same as an empty object.
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      case 'create_tutorial': {
        const curriculum = args as unknown as Curriculum;
        const tutorial = database.createTutorial(curriculum);
        return jsonResponse({
          success: true,
          message: `Tutorial "${tutorial.name}" created successfully`,
          tutorial_id: tutorial.id,
          tutorial,
        });
      }

      case 'get_tutorial': {
        const data = database.getTutorial();
        if (!data) return jsonResponse({ success: true, tutorial: null });
        return jsonResponse({ success: true, ...data });
      }

      case 'get_curriculum_tree': {
        const tree = database.getCurriculumTree();
        if (tree === null) return noTutorialError();
        return jsonResponse({ success: true, tree });
      }

      case 'get_chapter_progress': {
        const { chapter_id } = args as { chapter_id: number };
        const progress = database.getChapterProgress(chapter_id);
        if (progress === null) return jsonResponse({ success: false, error: `Chapter ${chapter_id} not found` });
        return jsonResponse({ success: true, progress });
      }

      case 'get_stats': {
        const data = database.getStats();
        if (!data) return noTutorialError();
        return jsonResponse({ success: true, ...data });
      }

      case 'get_part': {
        const { part_id } = args as { part_id: number };
        const data = database.getPart(part_id);
        if (!data) return jsonResponse({ success: false, error: `Part ${part_id} not found` });
        return jsonResponse({ success: true, ...data });
      }

      case 'get_chapter': {
        const { chapter_id } = args as { chapter_id: number };
        const data = database.getChapter(chapter_id);
        if (!data) return jsonResponse({ success: false, error: `Chapter ${chapter_id} not found` });
        return jsonResponse({ success: true, ...data });
      }

      case 'get_lesson': {
        const { lesson_id } = args as { lesson_id: number };
        const data = database.getLesson(lesson_id);
        if (!data) return jsonResponse({ success: false, error: `Lesson ${lesson_id} not found` });
        return jsonResponse({ success: true, ...data });
      }

      case 'get_tutorial_metadata': {
        const metadata = database.getTutorialMetadata();
        if (!metadata) return jsonResponse({ success: true, metadata: null });
        return jsonResponse({ success: true, ...metadata });
      }

      case 'get_preferences': {
        const preferences = database.getPreferences();
        if (!preferences) return noTutorialError();
        return jsonResponse({ success: true, ...preferences });
      }

      case 'update_preferences': {
        const updates = args as Partial<Preferences>;
        const preferences = database.updatePreferences(updates);
        if (!preferences) return noTutorialError();
        return jsonResponse({ success: true, message: 'Preferences updated', ...preferences });
      }

      case 'start_tutorial': {
        const progress = database.startTutorial();
        if (!progress) return noTutorialError();
        return jsonResponse({ success: true, message: 'Tutorial started', progress });
      }

      case 'get_current_position': {
        const position = database.getCurrentPosition();
        if (!position) return noTutorialError();
        return jsonResponse({ success: true, ...position });
      }

      case 'complete_lesson': {
        const result = database.completeLesson();
        if (!result) return noTutorialError();
        return jsonResponse({ success: true, ...result });
      }

      case 'advance_section': {
        const result = database.advanceSection();
        if (!result) return noTutorialError();
        return jsonResponse({ success: true, ...result });
      }

      case 'advance_position': {
        const result = database.advancePosition();
        if (!result) return noTutorialError();
        return jsonResponse({ success: true, ...result });
      }

      case 'log_quiz_result': {
        const { score, total, missed_concept_ids } = args as {
          score: number;
          total: number;
          missed_concept_ids: number[];
        };
        const result = database.logQuizResult(score, total, missed_concept_ids);
        const message = result.retake
          ? `Retake logged: ${score}/${total}. Best score: ${result.score}/${result.total}`
          : `Quiz result logged: ${score}/${total}`;
        return jsonResponse({ success: true, message, result });
      }

      case 'get_interview': {
        return jsonResponse({ success: true, ...database.getInterview() });
      }

      case 'plan_interview': {
        const { slots } = args as { slots: InterviewSlot[] };
        return jsonResponse({ success: true, message: 'Interview planned', ...database.planInterview(slots) });
      }

      case 'retake_interview': {
        return jsonResponse({ success: true, message: 'Retake started. Plan the new attempt next.', ...database.retakeInterview() });
      }

      case 'log_interview_answer': {
        const { question, score } = args as { question: number; score: number };
        const state = database.logInterviewAnswer(question, score);
        const message = state.finished
          ? `Question ${question} scored ${score}. Interview finished: ${state.scores.reduce((a, b) => a + b, 0)}/${INTERVIEW_TOTAL}, best ${state.best_score}/${INTERVIEW_TOTAL}`
          : `Question ${question} scored ${score}`;
        return jsonResponse({ success: true, message, ...state });
      }

      case 'log_interview_result': {
        const { notes } = args as { notes?: string };
        const result = database.logInterviewResult(notes);
        return jsonResponse({ success: true, message: `Interview result logged: ${result.score}/${result.total}`, result });
      }

      case 'log_capstone_result': {
        const { part_id, completed, notes } = args as {
          part_id: number;
          completed: boolean;
          notes?: string;
        };
        const result = database.logCapstoneResult(part_id, completed, notes);
        return jsonResponse({
          success: true,
          message: `Capstone result logged: ${completed ? 'completed' : 'skipped'}`,
          result,
        });
      }

      case 'get_review_queue': {
        const { limit, one_per_lesson } = args as { limit?: number; one_per_lesson?: boolean };
        const result = database.getReviewQueue(limit, one_per_lesson);
        if (!result) return noTutorialError();
        return jsonResponse({
          success: true,
          count: result.queue.length,
          total_in_queue: result.total_in_queue,
          queue_replenished: result.queue_replenished,
          queue: result.queue,
          instructions: "Ask one review question about each item's concept, then record it with log_review_result.",
        });
      }

      case 'log_review_result': {
        const { concept_id, correct } = args as {
          concept_id: number;
          correct: boolean;
        };
        const result = database.logReviewResult(concept_id, correct);
        if (!result) return noTutorialError();
        return jsonResponse({
          success: true,
          message: correct
            ? 'Correct! Concept removed from the review queue.'
            : 'Incorrect. Concept moved to the end of the queue for later review.',
          ...result,
        });
      }

      case 'reset_progress': {
        const success = database.resetProgress();
        if (!success) return noTutorialError();
        return jsonResponse({ success: true, message: 'Progress reset. Tutorial is ready to start from the beginning.' });
      }

      default:
        throw new ProtocolError(ProtocolErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message });
  }
}

function createServer(): Server {
  const server = new Server(
    {
      name: 'learning-tracker',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );
  server.setRequestHandler('tools/list', listTools);
  server.setRequestHandler('tools/call', callTool);
  return server;
}

// Start server. serveStdio negotiates the protocol revision per connection, so both
// 2026-07-28 clients and 2025-era clients are served.
serveStdio(createServer);
console.error('Learning Tracker MCP server running on stdio');
