/**
 * Social Media Marketing Content Generator
 * Generates platform-specific social media posts, email templates,
 * content calendar, trailer scripts, and reader magnets
 * Issue #45: https://github.com/scarter4work/manuscript-platform/issues/45
 */

import Anthropic from '@anthropic-ai/sdk';
import { callClaudeWithCostTracking } from '../utils/agent-utils.js';

/**
 * Platform specifications and best practices
 */
export const PLATFORM_SPECS = {
  twitter: {
    name: 'Twitter/X',
    charLimit: 280,
    hashtagLimit: 3,
    tone: 'Concise, punchy, conversational',
    bestPractices: 'Use threads for longer content, ask questions, use trending hashtags',
    optimalTimes: 'Weekdays 9am-3pm EST'
  },
  facebook: {
    name: 'Facebook',
    charLimit: 2000,
    hashtagLimit: 5,
    tone: 'Engaging, storytelling, community-focused',
    bestPractices: 'Ask questions, encourage comments, use Facebook Live for launches',
    optimalTimes: 'Weekdays 1pm-4pm EST, weekends 12pm-1pm'
  },
  instagram: {
    name: 'Instagram',
    charLimit: 2200,
    hashtagLimit: 30,
    tone: 'Visual-first, aesthetic, inspirational',
    bestPractices: 'High-quality images, Stories for behind-the-scenes, Reels for reach',
    optimalTimes: 'Weekdays 11am-2pm EST, evenings 7pm-9pm'
  },
  tiktok: {
    name: 'TikTok',
    charLimit: 300,
    hashtagLimit: 5,
    tone: 'Trendy, authentic, entertaining',
    bestPractices: 'Jump on trends, use trending audio, show personality, short videos 15-60sec',
    optimalTimes: 'Weekdays 6am-10am, 7pm-11pm EST'
  },
  linkedin: {
    name: 'LinkedIn',
    charLimit: 3000,
    hashtagLimit: 5,
    tone: 'Professional, authoritative, educational',
    bestPractices: 'Industry insights, writing craft tips, professional author brand',
    optimalTimes: 'Weekdays 7am-9am, 12pm-2pm EST'
  }
};

/**
 * Post types and their characteristics
 */
export const POST_TYPES = {
  announcement: {
    name: 'Book Announcement',
    purpose: 'Announce book release or pre-order',
    cta: 'Pre-order now, Add to TBR, Coming soon'
  },
  character_spotlight: {
    name: 'Character Spotlight',
    purpose: 'Introduce compelling characters',
    cta: 'Meet the characters, Get to know'
  },
  quote: {
    name: 'Quote Graphic',
    purpose: 'Share compelling quotes from manuscript',
    cta: 'Read more, Available now'
  },
  behind_scenes: {
    name: 'Behind-the-Scenes',
    purpose: 'Author journey, writing process',
    cta: 'Follow my journey, Learn more'
  },
  engagement_question: {
    name: 'Reader Engagement',
    purpose: 'Ask questions, polls, discussions',
    cta: 'Comment below, Tell me, What do you think'
  },
  countdown: {
    name: 'Launch Countdown',
    purpose: 'Build anticipation for release',
    cta: 'X days until launch, Mark your calendar'
  },
  review_request: {
    name: 'Review Request',
    purpose: 'Encourage reviews after launch',
    cta: 'Leave a review, Rate on Amazon'
  }
};

/**
 * Generate complete marketing kit
 * @param {Object} options - Generation options
 * @param {string} options.manuscriptId - Manuscript ID
 * @param {string} options.title - Book title
 * @param {string} options.author - Author name
 * @param {string} options.genre - Book genre
 * @param {string} options.synopsis - Short synopsis (250 words)
 * @param {string} options.targetAudience - Target reader demographics
 * @param {string} options.tone - Marketing tone (professional, casual, humorous, dramatic)
 * @param {string} options.launchDate - Optional launch date
 * @param {Object} env - Environment bindings
 * @returns {Promise<Object>} Complete marketing kit
 */
export async function generateMarketingKit(options, env) {
  const {
    manuscriptId,
    title,
    author,
    genre = 'general',
    synopsis,
    targetAudience = '',
    tone = 'professional',
    launchDate
  } = options;

  if (!title || !author) {
    throw new Error('Title and author are required');
  }

  if (!synopsis) {
    throw new Error('Synopsis is required for marketing generation');
  }

  const results = {
    kitId: crypto.randomUUID(),
    manuscriptId,
    title,
    author,
    genre,
    tone,
    socialPosts: {},
    emailTemplate: null,
    contentCalendar: [],
    trailerScript: null,
    readerMagnets: [],
    totalCost: 0,
    generatedAt: new Date().toISOString()
  };

  // Generate social media posts for each platform
  for (const platform of ['twitter', 'facebook', 'instagram', 'tiktok', 'linkedin']) {
    const posts = await generatePlatformPosts({
      platform,
      title,
      author,
      genre,
      synopsis,
      tone,
      targetAudience
    }, env);

    results.socialPosts[platform] = posts;
    results.totalCost += posts.cost || 0;
  }

  // Generate launch email template
  const emailTemplate = await generateLaunchEmail({
    title,
    author,
    genre,
    synopsis,
    tone,
    launchDate
  }, env);

  results.emailTemplate = emailTemplate;
  results.totalCost += emailTemplate.cost || 0;

  // Generate 30-day content calendar
  const calendar = await generateContentCalendar({
    title,
    author,
    genre,
    socialPosts: results.socialPosts,
    launchDate
  }, env);

  results.contentCalendar = calendar.items;
  results.totalCost += calendar.cost || 0;

  // Generate book trailer script
  const trailerScript = await generateTrailerScript({
    title,
    author,
    genre,
    synopsis,
    tone
  }, env);

  results.trailerScript = trailerScript;
  results.totalCost += trailerScript.cost || 0;

  // Generate reader magnet ideas
  const readerMagnets = await generateReaderMagnets({
    title,
    author,
    genre,
    synopsis
  }, env);

  results.readerMagnets = readerMagnets.ideas;
  results.totalCost += readerMagnets.cost || 0;

  return results;
}

/**
 * Generate social media posts for a specific platform
 */
async function generatePlatformPosts(params, env) {
  const { platform, title, author, genre, synopsis, tone, targetAudience } = params;
  const spec = PLATFORM_SPECS[platform];

  const prompt = `You are a book marketing expert specializing in social media for authors. Generate 4-5 engaging social media posts for ${spec.name}.

BOOK DETAILS:
Title: ${title}
Author: ${author}
Genre: ${genre}
Synopsis: ${synopsis}
Target Audience: ${targetAudience || 'General readers'}

PLATFORM: ${spec.name}
- Character Limit: ${spec.charLimit}
- Hashtag Limit: ${spec.hashtagLimit}
- Tone: ${spec.tone}
- Best Practices: ${spec.bestPractices}
- Optimal Posting Times: ${spec.optimalTimes}

MARKETING TONE: ${tone}

POST TYPES TO GENERATE:
1. Book Announcement Post - Announce the book release/pre-order
2. Character Spotlight Post - Highlight a compelling character or story element
3. Quote Graphic Post - Share a compelling quote (suggest what quote to use)
4. Behind-the-Scenes Post - Share the author's writing journey or inspiration
5. Engagement Question Post - Ask readers a question to spark discussion

REQUIREMENTS:
- Stay within character limit for ${spec.name}
- Use appropriate hashtags (${spec.hashtagLimit} max)
- Include clear call-to-action (pre-order, add to TBR, comment, share)
- Match ${tone} tone
- Platform-appropriate style (${spec.tone})
- Suggest image/visual to accompany each post
- Make posts engaging and shareable

Return JSON format:
{
  "posts": [
    {
      "type": "announcement",
      "text": "Post text with hashtags",
      "hashtags": ["hashtag1", "hashtag2"],
      "imageSuggestion": "Description of recommended image",
      "engagementHook": "What makes this post engaging",
      "characterCount": 250
    }
  ]
}`;

  const response = await callClaudeWithCostTracking(
    env,
    [{ role: 'user', content: prompt }],
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.8
    },
    'social-media-generation',
    null,
    {
      operation: 'social_posts_generation',
      platform,
      genre
    }
  );

  // Parse JSON response
  const jsonText = response.content[0].text.trim();
  const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const parsed = JSON.parse(cleanJson);

  return {
    platform,
    posts: parsed.posts || [],
    cost: response.cost,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens
  };
}

/**
 * Generate launch announcement email template
 */
async function generateLaunchEmail(params, env) {
  const { title, author, genre, synopsis, tone, launchDate } = params;

  const prompt = `You are a book marketing expert. Generate a professional launch announcement email for a book newsletter.

BOOK DETAILS:
Title: ${title}
Author: ${author}
Genre: ${genre}
Synopsis: ${synopsis}
Launch Date: ${launchDate || 'Coming soon'}

TONE: ${tone}

EMAIL REQUIREMENTS:
- Subject line (compelling, 50 characters max)
- Preview text (90 characters max)
- Email body (HTML-friendly format with clear sections)
- Sections:
  1. Exciting opening hook
  2. Book description (engaging, not just synopsis)
  3. What makes this book special
  4. Call-to-action (pre-order links, launch day reminder)
  5. Social media links
  6. Sign-off
- Include placeholder links: [PRE-ORDER LINK], [AMAZON LINK], [GOODREADS LINK]
- Keep total length 400-600 words
- Professional but warm tone
- Mobile-friendly (short paragraphs)

Return JSON format:
{
  "subjectLine": "Subject line text",
  "previewText": "Preview text",
  "emailBody": "Full email body in HTML-friendly markdown",
  "wordCount": 500
}`;

  const response = await callClaudeWithCostTracking(
    env,
    [{ role: 'user', content: prompt }],
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.7
    },
    'email-template-generation',
    null,
    {
      operation: 'launch_email_generation',
      genre
    }
  );

  const jsonText = response.content[0].text.trim();
  const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const parsed = JSON.parse(cleanJson);

  return {
    ...parsed,
    cost: response.cost,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens
  };
}

/**
 * Generate 30-day content calendar
 */
async function generateContentCalendar(params, env) {
  const { title, author, genre, socialPosts, launchDate } = params;

  const prompt = `You are a book marketing strategist. Generate a 30-day content calendar for a book launch campaign.

BOOK: ${title} by ${author}
GENRE: ${genre}
LAUNCH DATE: ${launchDate || 'Day 15 (midpoint)'}

AVAILABLE CONTENT:
- ${Object.keys(socialPosts).length} platforms with 4-5 posts each
- Launch email template
- Potential for Stories, Lives, blog posts

CALENDAR REQUIREMENTS:
- 30 days of daily activities
- Mix of: social posts, engagement activities, email sends, Stories/Reels, live events
- Build anticipation leading to launch day (Day 15)
- Maintain momentum post-launch
- Vary platforms (don't overpost to same platform)
- Include engagement activities: polls, Q&A, giveaways, behind-the-scenes
- Specify time of day: morning, afternoon, evening
- Mark high-priority activities

Return JSON with 30 items:
{
  "calendar": [
    {
      "day": 1,
      "platform": "instagram",
      "activityType": "post",
      "description": "Share cover reveal",
      "timeOfDay": "afternoon",
      "priority": "high"
    }
  ]
}`;

  const response = await callClaudeWithCostTracking(
    env,
    [{ role: 'user', content: prompt }],
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 3000,
      temperature: 0.7
    },
    'content-calendar-generation',
    null,
    {
      operation: 'content_calendar_generation',
      genre
    }
  );

  const jsonText = response.content[0].text.trim();
  const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const parsed = JSON.parse(cleanJson);

  return {
    items: parsed.calendar || [],
    cost: response.cost,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens
  };
}

/**
 * Generate book trailer script/storyboard
 */
async function generateTrailerScript(params, env) {
  const { title, author, genre, synopsis, tone } = params;

  const prompt = `You are a video marketing expert for books. Generate a 60-90 second book trailer script with visual storyboard.

BOOK DETAILS:
Title: ${title}
Author: ${author}
Genre: ${genre}
Synopsis: ${synopsis}

TONE: ${tone}

TRAILER REQUIREMENTS:
- Duration: 60-90 seconds (150-200 words for voiceover)
- Hook viewers in first 5 seconds
- Build intrigue without spoiling plot
- End with strong call-to-action
- ${genre}-appropriate atmosphere and pacing
- Include visual suggestions for each scene
- Background music suggestions
- Text overlays at key moments

STRUCTURE:
1. Hook (0-5 seconds) - Grab attention
2. Setup (5-20 seconds) - Introduce world/character
3. Conflict (20-45 seconds) - Build tension
4. Climax hint (45-60 seconds) - Tease resolution
5. Call-to-action (60-90 seconds) - Book title, author, availability

Return JSON format:
{
  "script": "Full voiceover script with timing notes",
  "scenes": [
    {
      "timestamp": "0:00-0:05",
      "voiceover": "Text to be spoken",
      "visual": "Visual description",
      "textOverlay": "Optional text on screen",
      "musicCue": "Music/sound suggestion"
    }
  ],
  "duration": "90 seconds",
  "wordCount": 180
}`;

  const response = await callClaudeWithCostTracking(
    env,
    [{ role: 'user', content: prompt }],
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.8
    },
    'trailer-script-generation',
    null,
    {
      operation: 'trailer_script_generation',
      genre
    }
  );

  const jsonText = response.content[0].text.trim();
  const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const parsed = JSON.parse(cleanJson);

  return {
    ...parsed,
    cost: response.cost,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens
  };
}

/**
 * Generate reader magnet ideas
 */
async function generateReaderMagnets(params, env) {
  const { title, author, genre, synopsis } = params;

  const prompt = `You are a book marketing strategist. Generate 5 creative reader magnet (lead magnet) ideas to build an email list for this book.

BOOK DETAILS:
Title: ${title}
Author: ${author}
Genre: ${genre}
Synopsis: ${synopsis}

READER MAGNET IDEAS NEEDED:
Generate 5 different types of free content offers that would appeal to readers:
1. Bonus content (deleted scene, character backstory, epilogue)
2. Exclusive material (map, artwork, character guide)
3. Related short story (prequel, side character story)
4. Educational content (if applicable - e.g., historical notes for historical fiction)
5. Interactive content (quiz, character personality test, reading guide)

For each idea, provide:
- Magnet type
- Title of the magnet
- Description (what it contains)
- Why readers would want it
- Estimated length/scope
- How to create it (brief production notes)

Return JSON format:
{
  "magnets": [
    {
      "type": "bonus_scene",
      "title": "The Deleted First Chapter",
      "description": "Original opening chapter from ${author}'s early draft",
      "appeal": "Why readers want this",
      "length": "3000 words",
      "productionNotes": "How to create this"
    }
  ]
}`;

  const response = await callClaudeWithCostTracking(
    env,
    [{ role: 'user', content: prompt }],
    {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.8
    },
    'reader-magnets-generation',
    null,
    {
      operation: 'reader_magnets_generation',
      genre
    }
  );

  const jsonText = response.content[0].text.trim();
  const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
  const parsed = JSON.parse(cleanJson);

  return {
    ideas: parsed.magnets || [],
    cost: response.cost,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens
  };
}

/**
 * Generate hashtag strategy for a genre
 */
export function generateHashtagStrategy(genre, platform) {
  // Genre-specific hashtags
  const genreHashtags = {
    thriller: ['#ThrillerBooks', '#PsychologicalThriller', '#Suspense', '#CrimeFiction', '#ThrillerReads'],
    mystery: ['#MysteryBooks', '#CozyMystery', '#Detective', '#Whodunit', '#MysteryLovers'],
    romance: ['#RomanceBooks', '#BookstagramRomance', '#RomCom', '#ContemporaryRomance', '#LoveStory'],
    fantasy: ['#FantasyBooks', '#EpicFantasy', '#FantasyReads', '#MagicBooks', '#FantasyWorld'],
    'sci-fi': ['#SciFiBooks', '#ScienceFiction', '#SciFiReads', '#SpaceOpera', '#Dystopian'],
    horror: ['#HorrorBooks', '#HorrorFiction', '#CreepyReads', '#HorrorCommunity', '#Spooky'],
    literary: ['#LiteraryFiction', '#BookClub', '#LitFic', '#ContemporaryFiction', '#Books'],
    general: ['#AmReading', '#Bookstagram', '#BookLovers', '#NewRelease', '#IndieAuthor']
  };

  // Platform-specific trending hashtags
  const platformHashtags = {
    instagram: ['#Bookstagram', '#BookstagramCommunity', '#InstaBooks', '#Bookish'],
    tiktok: ['#BookTok', '#BookTokCommunity', '#BookRecommendations', '#ReadingList'],
    twitter: ['#AmReading', '#BookTwitter', '#WritingCommunity', '#AuthorLife'],
    facebook: ['#BookLovers', '#ReadingCommunity', '#Readers'],
    linkedin: ['#Publishing', '#AuthorBrand', '#BookMarketing', '#WritingLife']
  };

  const genreTags = genreHashtags[genre] || genreHashtags.general;
  const platformTags = platformHashtags[platform] || [];

  return {
    genre: genreTags,
    platform: platformTags,
    community: ['#IndieAuthor', '#AuthorsOfInstagram', '#WritersOfInstagram', '#NewRelease'],
    trending: [] // Could be populated by API call to trending hashtags
  };
}
