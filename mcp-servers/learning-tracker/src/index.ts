#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import database, { Curriculum, Preferences } from './database.js';

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

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
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
        description: 'Get complete tutorial details including structure, progress, and statistics. Returns { tutorial: null } if no tutorial exists yet. Use this when you need full stats (progress screen, certificate). For quick checks (status, type, difficulty), use get_tutorial_metadata instead.',
        inputSchema: {
          type: 'object',
          properties: {},
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
        description: 'Get user preferences (book, language). Lightweight call — use this instead of get_tutorial when you only need to check a setting.',
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
        description: 'Get the current position in the tutorial (current lesson, chapter, and part). Also indicates if this is the start of a new chapter (for triggering reviews).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'advance_position',
        description: 'Move to the next lesson in the tutorial. Marks the current lesson as completed, updates chapter/part completion status, and adds the lesson to the review queue.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'log_quiz_result',
        description: 'Record the result of a lesson quiz.',
        inputSchema: {
          type: 'object',
          properties: {
            lesson_id: {
              type: 'number',
              description: 'ID of the lesson',
            },
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
              description: 'IDs of concepts the user got wrong',
            },
          },
          required: ['lesson_id', 'score', 'total', 'missed_concept_ids'],
        },
      },
      {
        name: 'log_interview_result',
        description: 'Record the result of a chapter mock interview.',
        inputSchema: {
          type: 'object',
          properties: {
            chapter_id: {
              type: 'number',
              description: 'ID of the chapter',
            },
            score: {
              type: 'number',
              description: 'Score achieved',
            },
            total: {
              type: 'number',
              description: 'Total possible score',
            },
            notes: {
              type: 'string',
              description: 'Optional notes about the interview performance',
            },
          },
          required: ['chapter_id', 'score', 'total'],
        },
      },
      {
        name: 'log_capstone_result',
        description: 'Record the completion of a part capstone project.',
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
        description: 'Get lessons in the review queue. Each lesson has multiple concepts; pick one concept per lesson for review questions. Use at the start of chapters to review previous material. For completed tutorials, auto-replenishes with all 48 lessons if queue is empty.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of lessons to return. Use 4 for standard review sessions.',
            },
          },
        },
      },
      {
        name: 'log_review_result',
        description: 'Record the result of reviewing a lesson. If correct, removes from queue. If incorrect, moves to end of queue for later review.',
        inputSchema: {
          type: 'object',
          properties: {
            lesson_id: {
              type: 'number',
              description: 'ID of the lesson being reviewed',
            },
            correct: {
              type: 'boolean',
              description: 'Whether the user answered correctly',
            },
          },
          required: ['lesson_id', 'correct'],
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
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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

      case 'advance_position': {
        const result = database.advancePosition();
        if (!result) return noTutorialError();
        return jsonResponse({ success: true, ...result });
      }

      case 'log_quiz_result': {
        const { lesson_id, score, total, missed_concept_ids } = args as {
          lesson_id: number;
          score: number;
          total: number;
          missed_concept_ids: number[];
        };
        const result = database.logQuizResult(lesson_id, score, total, missed_concept_ids);
        return jsonResponse({ success: true, message: `Quiz result logged: ${score}/${total}`, result });
      }

      case 'log_interview_result': {
        const { chapter_id, score, total, notes } = args as {
          chapter_id: number;
          score: number;
          total: number;
          notes?: string;
        };
        const result = database.logInterviewResult(chapter_id, score, total, notes);
        return jsonResponse({ success: true, message: `Interview result logged: ${score}/${total}`, result });
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
          message: `Capstone result logged: ${completed ? 'completed' : 'incomplete'}`,
          result,
        });
      }

      case 'get_review_queue': {
        const { limit } = args as { limit?: number };
        const result = database.getReviewQueue(limit);
        if (!result) return noTutorialError();
        return jsonResponse({
          success: true,
          count: result.queue.length,
          total_in_queue: result.total_in_queue,
          queue_replenished: result.queue_replenished,
          queue: result.queue,
          instructions: 'For each lesson in the queue, randomly pick ONE concept and ask a review question about it.',
        });
      }

      case 'log_review_result': {
        const { lesson_id, correct } = args as {
          lesson_id: number;
          correct: boolean;
        };
        const result = database.logReviewResult(lesson_id, correct);
        if (!result) return noTutorialError();
        return jsonResponse({
          success: true,
          message: correct
            ? 'Correct! Lesson removed from review queue.'
            : 'Incorrect. Lesson moved to end of queue for later review.',
          ...result,
        });
      }

      case 'reset_progress': {
        const success = database.resetProgress();
        if (!success) return noTutorialError();
        return jsonResponse({ success: true, message: 'Progress reset. Tutorial is ready to start from the beginning.' });
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ success: false, error: message });
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Learning Tracker MCP server running on stdio');
}

main().catch(console.error);
