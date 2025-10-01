# Line Editing Agent - Documentation

## Overview

The Line Editing Agent analyzes manuscripts at the **prose level**, providing specific, actionable suggestions for improving sentence structure, word choice, and writing style.

## What It Analyzes

### 1. Prose Quality
- **Weak Words**: Identifies overused filler words (very, really, just, etc.)
- **Passive Voice**: Flags passive constructions that should be active
- **Redundancies**: Finds unnecessary repetition and wordiness
- **Adverb Overuse**: Catches excessive -ly adverbs

### 2. Sentence Structure
- **Variety**: Checks for mix of short, medium, and long sentences
- **Run-ons**: Identifies overly complex sentences
- **Fragments**: Flags incomplete sentences
- **Rhythm**: Assesses monotonous vs. varied cadence

### 3. Show vs Tell
- **Telling**: Identifies places where author tells instead of shows
- **Sensory Details**: Suggests opportunities for vivid description
- **Dialogue Attribution**: Improves dialogue tags

### 4. Word Choice
- **Weak Verbs**: Suggests stronger alternatives (walked → strode)
- **Clichés**: Identifies overused phrases
- **Vocabulary**: Flags inappropriate word choices for setting/genre

### 5. Style Consistency
- **POV Slips**: Catches point-of-view inconsistencies
- **Tense Shifts**: Identifies unintentional tense changes
- **Tone**: Flags inconsistent narrative voice

## How It Works

The agent processes manuscripts in **sections** (~800 words each) for detailed analysis:

1. **Chunk Manuscript** → Break into manageable sections
2. **Analyze Each Section** → Get specific suggestions with before/after examples
3. **Aggregate Patterns** → Identify manuscript-wide issues
4. **Prioritize Suggestions** → Sort by severity and impact
5. **Generate Report** → Comprehensive analysis with actionable fixes

## API Usage

### Trigger Analysis

```bash
POST /analyze/line-editing

Body:
{
  "manuscriptKey": "author-id/manuscript-id/filename.txt",
  "genre": "thriller"
}
```

### Get Results

```bash
GET /analysis/{manuscriptKey}

# Returns stored line editing analysis
```

## Output Structure

```json
{
  "overallAssessment": {
    "overallProseScore": 7.5,
    "summary": "Solid foundation with room for improvement...",
    "keyStrengths": [
      "Strong dialogue",
      "Varied sentence structure"
    ],
    "keyWeaknesses": [
      "passive_voice: 47 instances",
      "weak_verb: 89 instances"
    ],
    "urgentIssues": [
      "Excessive passive voice (47 instances)"
    ]
  },
  "patterns": {
    "totalSections": 5,
    "averageScore": 7.5,
    "issueTypeCounts": {
      "weak_verb": 89,
      "passive_voice": 47,
      "adverb": 34
    },
    "totalIssues": 215,
    "passiveVoiceTotal": 47,
    "adverbTotal": 34,
    "averageSentenceLengthOverall": 14.2
  },
  "topSuggestions": [
    {
      "type": "passive_voice",
      "severity": "high",
      "sectionNumber": 1,
      "wordRange": "0-800",
      "location": "paragraph 3",
      "original": "The door was opened by Sarah.",
      "suggestion": "Sarah opened the door.",
      "explanation": "Active voice is stronger and more direct"
    },
    {
      "type": "weak_verb",
      "severity": "medium",
      "sectionNumber": 1,
      "wordRange": "0-800",
      "original": "He walked quickly to the car.",
      "suggestion": "He hurried to the car.",
      "explanation": "Stronger verb eliminates need for adverb"
    }
  ],
  "sections": [
    {
      "sectionNumber": 1,
      "wordRange": "0-800",
      "overallScore": 8,
      "issues": [...],
      "strengths": ["Strong opening hook", "Good pacing"],
      "readabilityMetrics": {
        "averageSentenceLength": 15,
        "passiveVoiceCount": 8,
        "adverbCount": 12,
        "sentenceVariety": "good"
      }
    }
  ]
}
```

## Testing

### Command Line Test

```bash
# Start dev server
npx wrangler dev

# Run line editing analysis (in another terminal)
node test-line-agent.js sample-manuscript.txt thriller
```

### What to Expect

- **Processing Time**: 1-3 minutes depending on length
  - ~1 second per section
  - Sample manuscript (3000 words) = ~4 sections = ~4-8 seconds
  
- **Cost per Analysis**: 
  - Small manuscript (3000 words): ~$1-2
  - Medium manuscript (30,000 words): ~$8-12
  - Full novel (80,000 words): ~$20-30

## Comparison with Developmental Agent

| Feature | Developmental | Line Editing |
|---------|--------------|--------------|
| **Focus** | Big picture | Sentence level |
| **Analyzes** | Plot, character, structure | Prose, word choice, style |
| **Output** | Overall scores | Specific rewrites |
| **Processing** | Whole manuscript at once | Section by section |
| **Time** | 30-60 seconds | 1-3 minutes |
| **Best For** | First drafts | Polished drafts |

## Use Cases

### When to Use Line Editing Agent

✅ **After developmental edits are complete**
✅ Manuscript is structurally sound but prose needs polish
✅ Preparing for submission to agents/publishers
✅ Self-publishing and want professional-quality prose
✅ Beta readers said "story is good but writing is rough"

### When NOT to Use

❌ First draft with major plot/character issues (use Developmental Agent first)
❌ Manuscript under 1000 words (not enough data for patterns)
❌ Just need grammar/spelling check (use Copy Editing Agent instead)

## Tips for Best Results

1. **Run Developmental Agent First** - Fix big picture issues before polishing prose
2. **Process in Batches** - For very long manuscripts, consider breaking into chunks
3. **Focus on High Severity** - Start with red flags before tackling medium/low
4. **Track Patterns** - If you have 50 passive voice issues, that's your focus area
5. **Genre Matters** - Literary fiction has different expectations than thriller

## Example Workflow

```bash
# Step 1: Developmental editing
node test-dev-agent.js my-novel.txt thriller
# Review: Fix plot holes, strengthen characters, improve pacing

# Step 2: Revise based on developmental feedback
# ... make structural changes ...

# Step 3: Line editing
node test-line-agent.js my-novel-revised.txt thriller
# Review: Fix prose issues, strengthen word choice

# Step 4: Implement top 20-30 suggestions
# ... polish prose ...

# Step 5: Copy editing (coming soon)
# Final grammar, consistency, formatting check
```

## Next Steps

Want to build:
- **Copy Editing Agent** - Grammar, punctuation, consistency
- **Proofreading Agent** - Final typo catching
- **Batch Processing** - Handle full novels in chunks
- **Comparison Mode** - Before/after analysis

## Questions?

- **How many sections will my manuscript be?** → Word count ÷ 800
- **Can I adjust section size?** → Yes, edit `wordsPerSection` in code
- **Does it catch grammar errors?** → Some, but use Copy Editing Agent for thorough grammar check
- **Can it handle non-English?** → Yes, Claude supports 100+ languages

---

**Status**: ✅ Ready to use!

Test it now:
```bash
npx wrangler dev
node test-line-agent.js sample-manuscript.txt thriller
```
