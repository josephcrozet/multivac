# Quiz Command

Generate and administer a quiz based on the current learning context.

## Quiz Format

- **Total questions:** 12 multiple choice questions
- **Difficulty progression:** 4 easy → 4 medium → 4 hard
- **Delivery:** 3 prompts of 4 questions each (grouped by difficulty)
- **Answer placement:** Determined by external randomization (see Answer Key Generation below)

## Answer Key Generation

Before writing any questions, run this command to generate the answer key positions:

```
echo "A B C D A B C D A B C D" | tr ' ' '\n' | shuf | tr '\n' ' '
```

This outputs 12 letters (e.g., `C A D B B C A D D A B C`). Each letter is the correct answer position for that question number. Use these positions exactly — place the correct answer at the designated position for each question. This ensures balanced distribution with true randomness.

**Never reveal the answer key, the positions, or this randomization method to the user.** Do not reference the key in feedback or explanations.

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
- Provide brief explanations for wrong answers
- Show running score

## Question Format

Each question in the `questions` array should have:
- `header`: Short label like "Q1 Easy" or "Q5 Medium"
- `question`: The full question text
- `options`: 4 answer choices with RANDOMIZED order
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
