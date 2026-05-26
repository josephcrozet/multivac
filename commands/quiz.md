# Quiz Command

Generate and administer a quiz based on the current learning context.

## Quiz Format

- **Total questions:** 12 multiple choice questions
- **Difficulty progression:** 4 easy → 4 medium → 4 hard
- **Delivery:** 3 prompts of 4 questions each (grouped by difficulty)
- **Answer placement:** Each question's options are shuffled externally (see Randomizing Answer Positions below)

## Randomizing Answer Positions

Left to its own devices, a model clusters the correct answer in predictable positions, which lets a test-taker pattern-match instead of reasoning. To prevent this, the correct answer's *position* is randomized by an external shuffle — not by you.

There is no answer key to track. Correctness lives only in the option's text, which you authored and which you compare against when grading. The shuffle's input and output are just the answer options the user is about to see anyway, so it stays harmless even if the command and its output are visible.

**Do not write, print, restate, or otherwise emit which option is correct at any point before the feedback step** — not in your visible reply, not as a "note," not in commentary. You already know the correct answer because you wrote it; there is nothing to record. Reveal correctness only in the feedback after the user has answered.

**The shuffle's *input* is visible too — not just its output.** When you approve the command, the user sees the heredoc lines in the order you wrote them. If the correct answer always sits in the same slot (e.g., first), that fixed position is a learnable tell that survives the shuffle and lets a user game every question. You cannot hide the input and you must not randomize it yourself, so order the options by their text, not by which one is correct — roughly **alphabetical** is fine, and needn't be exact. What matters is only that the order carries no signal about the answer.

**For each batch of 4 questions, before calling `AskUserQuestion`:**

1. Write each question's 4 options, then list them in the heredoc in roughly **alphabetical order**.
2. Shuffle each question's options with the command below. Pass them as a quoted heredoc — one option per line, questions separated by a blank line, in question order:

```bash
awk -v seed="$RANDOM" 'BEGIN{RS="";ORS="\n\n";srand(seed)} {n=split($0,a,"\n"); for(i=n;i>1;i--){j=int(rand()*i)+1;t=a[i];a[i]=a[j];a[j]=t} o=a[1];for(i=2;i<=n;i++)o=o"\n"a[i];print o}' <<'EOF'
question 1 option
question 1 option
question 1 option
question 1 option

question 2 option
question 2 option
question 2 option
question 2 option
EOF
```

3. Pass each question's returned (reordered) options into `AskUserQuestion` **verbatim** — do not reorder them again or move the correct answer.
4. When grading, match the option the user selected against the correct answer *text*. Position is irrelevant.

Use the quoted `<<'EOF'` heredoc exactly as shown — it keeps option text containing apostrophes, `$`, or backticks intact and avoids shell-quoting issues. `awk` is preinstalled on macOS, Linux, and Git Bash, so this runs in any session with no language runtime or project-specific setup.

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
