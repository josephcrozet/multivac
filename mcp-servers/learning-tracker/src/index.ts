#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import database, { Curriculum } from './database.js';

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
        description: 'Create a new tutorial curriculum with levels, modules, lessons, and concepts. Use this when setting up a new learning path.',
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
            levels: {
              type: 'array',
              description: 'Array of 3 levels (Beginner, Intermediate, Advanced)',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  difficulty: { type: 'number', enum: [1, 2, 3] },
                  modules: {
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
                required: ['name', 'difficulty', 'modules'],
              },
            },
          },
          required: ['name', 'levels'],
        },
      },
      {
        name: 'get_tutorial',
        description: 'Get complete tutorial details including structure, progress, and statistics. Returns { tutorial: null } if no tutorial exists yet.',
        inputSchema: {
          type: 'object',
          properties: {},
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
        description: 'Get the current position in the tutorial (current lesson, module, and level). Also indicates if this is the start of a new module (for triggering reviews).',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'advance_position',
        description: 'Move to the next lesson in the tutorial. Marks the current lesson as completed, updates module/level completion status, and adds the lesson to the review queue.',
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
        description: 'Record the result of a module mock interview.',
        inputSchema: {
          type: 'object',
          properties: {
            module_id: {
              type: 'number',
              description: 'ID of the module',
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
          required: ['module_id', 'score', 'total'],
        },
      },
      {
        name: 'log_capstone_result',
        description: 'Record the completion of a level capstone project.',
        inputSchema: {
          type: 'object',
          properties: {
            level_id: {
              type: 'number',
              description: 'ID of the level',
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
          required: ['level_id', 'completed'],
        },
      },
      {
        name: 'get_review_queue',
        description: 'Get lessons in the review queue. Each lesson has multiple concepts; pick one concept per lesson for review questions. Use at the start of modules to review previous material.',
        inputSchema: {
          type: 'object',
          properties: {},
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
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Tutorial "${tutorial.name}" created successfully`,
                tutorial_id: tutorial.id,
                tutorial,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_tutorial': {
        const tutorial_id = database.getActiveTutorialId();
        if (!tutorial_id) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  tutorial: null,
                }, null, 2),
              },
            ],
          };
        }
        const data = database.getTutorial(tutorial_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                ...data,
              }, null, 2),
            },
          ],
        };
      }

      case 'start_tutorial': {
        const tutorial_id = database.getActiveTutorialId();
        if (!tutorial_id) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No tutorial exists in this project yet. Create one first.',
                }, null, 2),
              },
            ],
          };
        }
        const progress = database.startTutorial(tutorial_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Tutorial started',
                progress,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_current_position': {
        const tutorial_id = database.getActiveTutorialId();
        if (!tutorial_id) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No tutorial exists in this project yet. Create one first.',
                }, null, 2),
              },
            ],
          };
        }
        const position = database.getCurrentPosition(tutorial_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                ...position,
              }, null, 2),
            },
          ],
        };
      }

      case 'advance_position': {
        const tutorial_id = database.getActiveTutorialId();
        if (!tutorial_id) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No tutorial exists in this project yet. Create one first.',
                }, null, 2),
              },
            ],
          };
        }
        const result = database.advancePosition(tutorial_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                ...result,
              }, null, 2),
            },
          ],
        };
      }

      case 'log_quiz_result': {
        const { lesson_id, score, total, missed_concept_ids } = args as {
          lesson_id: number;
          score: number;
          total: number;
          missed_concept_ids: number[];
        };
        const result = database.logQuizResult(lesson_id, score, total, missed_concept_ids);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Quiz result logged: ${score}/${total}`,
                result,
              }, null, 2),
            },
          ],
        };
      }

      case 'log_interview_result': {
        const { module_id, score, total, notes } = args as {
          module_id: number;
          score: number;
          total: number;
          notes?: string;
        };
        const result = database.logInterviewResult(module_id, score, total, notes);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Interview result logged: ${score}/${total}`,
                result,
              }, null, 2),
            },
          ],
        };
      }

      case 'log_capstone_result': {
        const { level_id, completed, notes } = args as {
          level_id: number;
          completed: boolean;
          notes?: string;
        };
        const result = database.logCapstoneResult(level_id, completed, notes);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Capstone result logged: ${completed ? 'completed' : 'incomplete'}`,
                result,
              }, null, 2),
            },
          ],
        };
      }

      case 'get_review_queue': {
        const tutorial_id = database.getActiveTutorialId();
        if (!tutorial_id) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No tutorial exists in this project yet. Create one first.',
                }, null, 2),
              },
            ],
          };
        }
        const queue = database.getReviewQueue(tutorial_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: queue.length,
                queue,
                instructions: 'For each lesson in the queue, randomly pick ONE concept and ask a review question about it.',
              }, null, 2),
            },
          ],
        };
      }

      case 'log_review_result': {
        const tutorial_id = database.getActiveTutorialId();
        if (!tutorial_id) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'No tutorial exists in this project yet. Create one first.',
                }, null, 2),
              },
            ],
          };
        }
        const { lesson_id, correct } = args as {
          lesson_id: number;
          correct: boolean;
        };
        const result = database.logReviewResult(tutorial_id, lesson_id, correct);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: correct
                  ? 'Correct! Lesson removed from review queue.'
                  : 'Incorrect. Lesson moved to end of queue for later review.',
                ...result,
              }, null, 2),
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: message,
          }, null, 2),
        },
      ],
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Learning Tracker MCP server running on stdio');
}

main().catch(console.error);
