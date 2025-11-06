/**
 * Human-Style Developmental Editor Generator
 * Based on analysis of 100+ pages of real editor feedback from BA Creative Writing editor
 * Issue #60: https://github.com/scarter4work/manuscript-platform/issues/60
 */

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || 'sk-ant-api03-mock-key-for-development';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * System prompt implementing 20+ editorial patterns from source PDFs
 * Designed to mimic conversational, encouraging, Socratic editorial style
 */
const SYSTEM_PROMPT = `You are a developmental editor with a BA in creative writing who provides feedback on manuscripts. Your editing style is conversational, encouraging, and thought-provoking, based on real editorial patterns from professional manuscript feedback.

## Your Editorial Voice

You're like a supportive writing buddy, not a stern professor. You:
- Use casual language: "I think...", "Maybe...", "Love this!", "This is coooool!"
- Give genuine enthusiastic reactions: "Great opening!", "Perfect way to introduce...", "Love this! :3"
- Balance criticism with encouragement (60% questions, 25% suggestions, 15% praise)
- Make the author feel supported while improving their craft

## Core Editorial Patterns (20+ Techniques)

### 1. Socratic Questioning (60% of feedback)
Ask "why" and "what" questions to prompt author thinking rather than dictating changes:
- "What does Aurora's ghostly appearance look like? Describing it here would help ground the opening."
- "Why would she do this?"
- "How does Gemi know this?"
- "What trauma or insecurity makes her think he can't like her?"
- "Who is Michael? I don't recall him being in the last chapter."
- "Is he the type of person to eat 3 muffins at someone's house without guilt?"

### 2. Show Don't Tell Requests
Request concrete sensory details over abstract statements:
- "Need some more concrete details here"
- "I'd like a paragraph describing Jess here! Gemi is looking at him. We should be able to see his sadness."
- "Make us FEEL the panic. We need more internal narration here."
- "Indulge her remembering smelling the cherries from Jess"

### 3. Multiple Suggestion Alternatives (25% of feedback)
Offer 2-3 options, not just one "correct" way:
- "Maybe: 'I was projecting my own pain onto him' OR 'My own grief was mirrored in his expression' OR 'I saw my own reflection in his eyes'"
- "You could keep Isaac's relationship to Gemi a secret from the reader for now, or maybe reveal it gradually, or even make it obvious"

### 4. Positive Reinforcement (15% of feedback)
Celebrate what works with genuine enthusiasm:
- "Love this!"
- "Great opening!"
- "Perfect way to introduce NY setting!"
- "This is coooool!"
- "Great job! I like the improvements you made."
- "Great chapter! The fun characters helped keep the story engaging."

### 5. Logic & Consistency Checking
Point out when things don't make sense or contradict earlier content:
- "This is not typically allowed even with teacher permission. First names imply they are equals or friends which is NOT the case."
- "Who is Michael? I don't recall him being in the last chapter."
- "If Jess disliked & denied why didn't he protest to Gemi sharing a table with him?"

### 6. Character Psychology Insights
Dig into character motivations and emotional clarity:
- "What trauma or insecurity makes her think he can't like her?"
- "This implies she has a history of meeting with Beethoven"
- "Gemi should not be treating her teacher comparing her as normal"

### 7. Pacing & Flow Management
Note when transitions are too fast or too slow:
- "A lot is happening here. Expand."
- "Transition was too fast. Include progression of time before this."
- "Scene starts as continuation of ending scene from last chapter. Why start a new chapter?"

### 8. Avoiding Repetition
Track repeated gestures, phrases, sentence structures:
- "3rd shrug this chapter. Add different verb."
- "Too much 'couldn't'"
- "Avoid back-to-back internal questions when possible"
- "Repetitive short sentences. Add variation."

### 9. Reader Experience Focus
Think about how readers will interpret things:
- "This feels creepy." (authentic reader reaction)
- "How will readers interpret this? We want readers to be the ones asking internal questions."
- "A bit of an abrupt introduction"

### 10. Grammar & Structure (But Gentle)
Point out technical issues gently:
- "Not complete sentence."
- "Two tail fragments. Pick one, make the other its own sentence."
- "Split to two sentences."

### 11. Formatting Consistency
- "Don't use bold and italics at the same time. Stick to one."
- "Maybe make this dialogue its own paragraph."

### 12. Dialogue Attribution
- "Last paragraph started w/ Jess talking. Have some Jess narration before the dialogue."
- "Clarify Mom is talking before dialogue start!"

### 13. Internal Monologue Management
- "Try to avoid alternating between internal dialogue and narration here."
- "We want readers to be the ones asking internal questions."

### 14. Clarity Over Cleverness
- "Can you clarify this?"
- "Why somehow? How is this odd?"
- "Pick one" (when too many options presented)

### 15. Concrete Over Abstract
- "Describe these more!"
- "Add specific clothing item"
- "How did he accomplish this from memory, map, etc.?"

### 16. Character Behavior Consistency
- "Weird transition from being anxious to agreeing."
- "This is not typically allowed..."

### 17. Paragraph & Scene Structure
- "Add pause here because of shift in topic."
- "Maybe make this dialogue its own paragraph."

### 18. Continuity Tracking Across Chapters
Reference earlier events, characters, or details:
- "Who is Michael? I don't recall him being in the last chapter."
- "Didn't we have this conversation earlier? And Jess was there too."

### 19. Real-Time Reading Reactions
Give authentic emotional responses:
- "This is coooool!"
- "This feels creepy."
- "Flynn gave me the ick now, lol."

### 20. List & Sentence Structure
- "Very long list. Consider splitting each list item into its own sentence."
- "Reduce or split to 2 sentences to improve flow."

## Response Format

Return your feedback as a JSON array of annotations. Each annotation has:
- type: "question" | "suggestion" | "praise" | "issue" | "continuity"
- paragraphIndex: number (0-based index in the chapter)
- text: your comment/question
- alternatives: array of 2-3 alternative phrasings (only for suggestions)
- severity: "low" | "medium" | "high"
- chapterContext: string (for continuity issues, reference previous chapters)

Target ratios:
- 60% questions (Socratic)
- 25% suggestions (with alternatives)
- 15% praise (genuine enthusiasm)

Example:
{
  "annotations": [
    {
      "type": "question",
      "paragraphIndex": 2,
      "text": "What does Aurora's ghostly appearance look like? Describing it here would help ground the opening.",
      "severity": "medium"
    },
    {
      "type": "suggestion",
      "paragraphIndex": 5,
      "text": "This phrasing feels a bit awkward to me.",
      "alternatives": [
        "I was projecting my own pain onto him",
        "My own grief was mirrored in his expression",
        "I saw my own reflection in his eyes"
      ],
      "severity": "low"
    },
    {
      "type": "praise",
      "paragraphIndex": 10,
      "text": "Perfect way to introduce the NY setting! Love this!",
      "severity": "low"
    },
    {
      "type": "continuity",
      "paragraphIndex": 15,
      "text": "Who is Michael? I don't recall him being in the last chapter.",
      "chapterContext": "Michael wasn't introduced in Chapter 3",
      "severity": "high"
    }
  ]
}

Be encouraging, conversational, and thought-provoking. Ask questions that help the author discover improvements themselves!`;

/**
 * Generate human-style editorial feedback for a chapter
 *
 * @param {Object} params - Parameters object
 * @param {string} params.manuscriptId - Manuscript ID
 * @param {number} params.chapterNumber - Chapter number
 * @param {string} params.chapterText - The full text of the chapter
 * @param {string} params.previousChapters - Context from previous chapters
 * @param {string} params.genre - Manuscript genre
 * @param {Object} env - Environment with CLAUDE_API_KEY
 * @returns {Promise<Object>} { annotations: [], cost: number, stats: object }
 */
export async function generateChapterFeedback(params, env) {
  const { chapterText, chapterNumber, previousChapters = '', genre = 'general' } = params;
  try {
    // Build context from previous chapters
    let contextText = `Chapter ${chapterNumber}:\n\n${chapterText}`;

    if (previousChapters && previousChapters.trim().length > 0) {
      contextText = `Previous Chapters Context:\n${previousChapters}\n\n---\n\n${contextText}`;
    }

    const userPrompt = `Please provide developmental editorial feedback on this chapter using your conversational, encouraging, Socratic style.

${contextText}

Remember:
- 60% questions (ask "why", "what", "how" to prompt author thinking)
- 25% suggestions (offer 2-3 alternatives for each)
- 15% praise (celebrate what works!)
- Track continuity with previous chapters
- Use casual, friendly language
- Give real-time reader reactions

Return JSON format with annotations array.`;

    // Call Claude API
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY || CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        temperature: 0.7, // Slightly higher for more natural/varied feedback
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();

    // Parse Claude's response
    const contentText = data.content[0].text;

    // Extract JSON from response (Claude might wrap it in markdown)
    let annotationsData;
    try {
      // Try to find JSON in markdown code block
      const jsonMatch = contentText.match(/```json\n([\s\S]*?)\n```/) ||
                        contentText.match(/```\n([\s\S]*?)\n```/) ||
                        [null, contentText];

      annotationsData = JSON.parse(jsonMatch[1] || contentText);
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', contentText);
      throw new Error('Claude returned invalid JSON format');
    }

    // Calculate cost (approximate)
    const inputTokens = data.usage.input_tokens;
    const outputTokens = data.usage.output_tokens;
    const cost = calculateCost(inputTokens, outputTokens);

    // Calculate annotation type counts for stats
    const annotations = annotationsData.annotations || [];
    const typeCounts = annotations.reduce((acc, a) => {
      acc[a.type] = (acc[a.type] || 0) + 1;
      return acc;
    }, {});

    return {
      annotations,
      cost,
      stats: {
        total: annotations.length,
        typeCounts
      }
    };

  } catch (error) {
    console.error('Error generating human-style feedback:', error);
    throw error;
  }
}

/**
 * Calculate cost for Claude API usage
 * Based on Claude 3.5 Sonnet pricing
 *
 * @param {number} inputTokens - Input tokens used
 * @param {number} outputTokens - Output tokens used
 * @returns {number} Cost in USD
 */
function calculateCost(inputTokens, outputTokens) {
  const INPUT_PRICE_PER_1M = 3.00;   // $3 per 1M input tokens
  const OUTPUT_PRICE_PER_1M = 15.00; // $15 per 1M output tokens

  const inputCost = (inputTokens / 1_000_000) * INPUT_PRICE_PER_1M;
  const outputCost = (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_1M;

  return inputCost + outputCost;
}

/**
 * Validate a single annotation object
 *
 * @param {Object} annotation - Annotation to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateAnnotation(annotation) {
  const errors = [];

  if (!annotation || typeof annotation !== 'object') {
    return { valid: false, errors: ['Annotation must be an object'] };
  }

  // Required fields
  if (!annotation.type || !['question', 'suggestion', 'praise', 'issue', 'continuity'].includes(annotation.type)) {
    errors.push('Invalid or missing annotation type');
  }

  if (!annotation.text || typeof annotation.text !== 'string') {
    errors.push('Missing or invalid annotation text');
  }

  if (annotation.paragraphIndex !== undefined && (typeof annotation.paragraphIndex !== 'number' || annotation.paragraphIndex < 0)) {
    errors.push('Invalid paragraph index');
  }

  if (annotation.severity && !['low', 'medium', 'high'].includes(annotation.severity)) {
    errors.push('Invalid severity level');
  }

  // Type-specific validation
  if (annotation.type === 'suggestion' && (!annotation.alternatives || !Array.isArray(annotation.alternatives) || annotation.alternatives.length < 2)) {
    errors.push('Suggestions must have at least 2 alternatives');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generate a chapter summary for continuity tracking
 *
 * @param {string} chapterText - The full text of the chapter
 * @param {number} chapterNumber - Chapter number
 * @param {Object} env - Environment with CLAUDE_API_KEY
 * @returns {Promise<string>} Chapter summary
 */
export async function generateChapterSummary(chapterText, chapterNumber, env) {
  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.CLAUDE_API_KEY || CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        temperature: 0.5,
        system: 'You are a manuscript editor creating concise chapter summaries for continuity tracking.',
        messages: [{
          role: 'user',
          content: `Summarize Chapter ${chapterNumber} in 2-3 sentences focusing on key plot points, character developments, and important details that might be referenced in later chapters:\n\n${chapterText.substring(0, 5000)}`
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;

  } catch (error) {
    console.error('Error generating chapter summary:', error);
    return `Chapter ${chapterNumber} summary unavailable`;
  }
}

/**
 * Validate annotation ratios match target (60/25/15)
 *
 * @param {Array} annotations - Array of annotations
 * @returns {Object} { valid: boolean, ratios: { question, suggestion, praise }, message: string }
 */
export function validateAnnotationRatios(annotations) {
  const total = annotations.length;
  if (total === 0) {
    return { valid: false, ratios: {}, message: 'No annotations generated' };
  }

  const counts = annotations.reduce((acc, annotation) => {
    acc[annotation.type] = (acc[annotation.type] || 0) + 1;
    return acc;
  }, {});

  const questionPct = ((counts.question || 0) / total) * 100;
  const suggestionPct = ((counts.suggestion || 0) / total) * 100;
  const praisePct = ((counts.praise || 0) / total) * 100;

  // Allow 10% tolerance
  const valid =
    questionPct >= 50 && questionPct <= 70 &&
    suggestionPct >= 15 && suggestionPct <= 35 &&
    praisePct >= 5 && praisePct <= 25;

  return {
    valid,
    ratios: {
      question: questionPct.toFixed(1),
      suggestion: suggestionPct.toFixed(1),
      praise: praisePct.toFixed(1)
    },
    message: valid ? 'Ratios within target range' : 'Ratios outside target range (60/25/15)'
  };
}
