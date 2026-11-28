import type { database as Database, InterviewSlot } from '../src/database.js';

// A valid 8-slot interview plan.
export const interviewPlan: InterviewSlot[] = ['Write', 'Implement', 'Create', 'Design', 'Debug', 'Refactor', 'Test', 'Explain']
  .map((category) => ({ category, concepts: ['A concept'] }));

// Eight question scores (0–5 each) that add up to the given total, out of 40.
export function interviewScores(total: number): number[] {
  return Array.from({ length: 8 }, (_, i) => Math.max(0, Math.min(5, total - 5 * i)));
}

// Run the current chapter's mock interview to the given total and resolve it.
export function runInterview(database: typeof Database, total: number, notes?: string) {
  database.planInterview(interviewPlan);
  interviewScores(total).forEach((score, i) => database.logInterviewAnswer(i + 1, score));
  return database.logInterviewResult(notes);
}
