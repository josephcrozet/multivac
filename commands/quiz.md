# Quiz Command

Generate and administer a quiz based on the current learning context.

## Quiz Format

- **Total questions:** 12 multiple choice questions
- **Difficulty progression:** 4 easy → 4 medium → 4 hard
- **Delivery:** 3 prompts of 4 questions each (grouped by difficulty)
- **Answer placement:** Options ordered by text, not by correctness (see Answer Order below)

## Answer Order

Left to its own devices, a model places the correct answer in a predictable slot — often the same position every time — which lets a test-taker pattern-match instead of reasoning. To prevent this, order each question's options by their **text, not by which one is correct**: numbers ascending, everything else alphabetical. Because the order comes from the options themselves, the correct answer falls in a different place from question to question and its position carries no signal — no shuffling or answer key needed.

The ordering needn't be exact (don't fuss over case or punctuation); it only has to be independent of correctness. Present the options in that order directly in `AskUserQuestion`.

Correctness lives only in the option's *text*, which you authored. When the user answers, grade by matching their selection against the correct text — position is irrelevant.

**Do not write, print, restate, or otherwise emit which option is correct before the feedback step** — not in your visible reply, not as a "note," not in commentary. You already know the correct answer because you wrote it; there is nothing to record. Reveal correctness only in the feedback after the user has answered.

## Writing the Options

A multiple-choice item is only as good as its distractors. The most common surface tell is that the correct answer is the longest, the most hedged, or the most fully-fleshed-out option — letting the user pick it without engaging with the content.

**Commit to each distractor**: same level of detail and confidence as the correct answer. No softening, qualifying, or hedging that signals "this one's wrong" — that telegraphing is the long-answer tell in reverse.

Good distractors force the user to engage with the material. They should be options a learner could plausibly consider — real adjacent concepts, plausibly-formed terms, common misconceptions.

Length parity is a soft target: slight variation is fine. What matters is no consistent pattern of the correct answer being the longest.

For numeric or ordered values (numbers, dates, versions), the parallel rule applies: no consistent pattern of the correct value sitting in the middle of the sorted list.

`AskUserQuestion` requires a `description` for every option, but the labels are the answers — the user should be able to identify the correct one from the labels alone. Write each description as a parallel paraphrase of the option's content — same tone, same confidence — without naming what the option refers to or whether it's correct.

## Determining Quiz Content

Base the quiz on the current context:
- If discussing a specific topic, quiz on that topic
- If working through a lesson or tutorial, quiz on recent material
- If no clear context, use `AskUserQuestion` to ask what topic to quiz on

## Question Delivery

Use `AskUserQuestion` with **4 questions per call** (3 calls total):

### Prompt 1: Easy Questions (1-4)
Ask all 4 easy questions in a single `AskUserQuestion` call with 4 questions.

### Prompt 2: Medium Questions (5-8)
After receiving answers, provide feedback on Easy questions, then ask all 4 medium questions.

### Prompt 3: Hard Questions (9-12)
After receiving answers, provide feedback on Medium questions, then ask all 4 hard questions.

### After Each Prompt
- Show which questions were correct/incorrect
- Provide brief explanations for all answers (correct and incorrect)
- Show running score

## Question Format

Each question in the `questions` array should have:
- `header`: Short label like "Q1 Easy" or "Q5 Medium"
- `question`: The full question text
- `options`: 4 answer choices ordered by text, not by correctness (see Answer Order)
- `multiSelect`: false

## After All Questions

1. Display results summary:
   - Final score (X/12) and percentage
   - Breakdown by difficulty (Easy: X/4, Medium: X/4, Hard: X/4)
   - Questions answered incorrectly (list them)
   - Concepts that need review
   - Encouragement based on performance

2. Offer to explain any concepts the user struggled with

## Difficulty Guidelines

**Easy (1-4):** Direct recall, basic definitions, simple identification
**Medium (5-8):** Application, understanding relationships, predicting outcomes
**Hard (9-12):** Analysis, edge cases, combining multiple concepts, debugging scenarios

## Example Call

```
AskUserQuestion with questions array:
[
  {header: "Q1 Easy", question: "What keyword defines a function in Python?", options: [...]},
  {header: "Q2 Easy", question: "What does HTML stand for?", options: [...]},
  {header: "Q3 Easy", question: "How many bits in a byte?", options: [...]},
  {header: "Q4 Easy", question: "What symbol starts a comment in Python?", options: [...]}
]
```

User can tab between questions and submit all 4 at once.
