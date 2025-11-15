// Competitive Analysis & Market Positioning Handlers
// Issue #57 - Comp title analysis, author platform tracking, marketing hooks

// ============================================================================
// Comparable Titles Handlers
// ============================================================================

/**
import crypto from 'crypto';

 * Analyze manuscript and suggest comparable titles using AI
 * POST /manuscripts/:id/comp-titles/analyze
 */
export async function handleAnalyzeCompTitles(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const manuscriptId = request.params.manuscriptId;
    const body = await request.json();

    // Get manuscript details
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build AI prompt for comp title analysis
    const prompt = `Analyze this manuscript and suggest 5-7 comparable titles that would help position this book in the market.

Manuscript Title: ${manuscript.title}
Genre: ${manuscript.genre}
Synopsis: ${manuscript.synopsis || 'No synopsis available'}
Word Count: ${manuscript.word_count || 'Unknown'}

For each comparable title, provide:
1. Title and author name
2. Why it's comparable (plot, themes, tone, audience)
3. Similarity score (0.0-1.0, how similar it is)
4. Cover style description
5. Marketing approach used

Format your response as a JSON array of objects with these fields:
- comp_title
- comp_author
- why_comparable
- similarity_score
- cover_style
- marketing_approach

Focus on commercially successful titles published in the last 5 years that share this manuscript's appeal.`;

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.statusText}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const compTitles = JSON.parse(jsonMatch[0]);

    // Store comp titles in database
    const insertedIds = [];
    for (const comp of compTitles) {
      const compId = `comp-${crypto.randomUUID()}`;
      await env.DB.prepare(`
        INSERT INTO comp_titles (
          id, manuscript_id, user_id, comp_title, comp_author,
          similarity_score, why_comparable, cover_style, marketing_approach,
          data_source, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai_suggested', unixepoch())
      `).bind(
        compId, manuscriptId, userId, comp.comp_title, comp.comp_author,
        comp.similarity_score, comp.why_comparable, comp.cover_style,
        comp.marketing_approach
      ).run();

      insertedIds.push(compId);
    }

    return new Response(JSON.stringify({
      success: true,
      comp_titles: compTitles,
      count: compTitles.length,
      inserted_ids: insertedIds,
      cost: {
        input_tokens: claudeData.usage.input_tokens,
        output_tokens: claudeData.usage.output_tokens,
        estimated_cost: (claudeData.usage.input_tokens * 0.000003 + claudeData.usage.output_tokens * 0.000015).toFixed(4)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error analyzing comp titles:', error);
    return new Response(JSON.stringify({
      error: 'Failed to analyze comp titles',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get comparable titles for a manuscript
 * GET /manuscripts/:id/comp-titles
 */
export async function handleGetCompTitles(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const manuscriptId = request.params.manuscriptId;

    const compTitles = await env.DB.prepare(`
      SELECT * FROM comp_titles
      WHERE manuscript_id = ? AND user_id = ? AND is_active = 1
      ORDER BY similarity_score DESC
    `).bind(manuscriptId, userId).all();

    return new Response(JSON.stringify({
      success: true,
      comp_titles: compTitles.results,
      count: compTitles.results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting comp titles:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get comp titles',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Add a manual comp title
 * POST /manuscripts/:id/comp-titles
 */
export async function handleAddCompTitle(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const manuscriptId = request.params.manuscriptId;
    const body = await request.json();

    const compId = `comp-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO comp_titles (
        id, manuscript_id, user_id, comp_title, comp_author,
        comp_asin, comp_isbn, similarity_score, why_comparable,
        amazon_sales_rank, price, avg_rating, review_count,
        data_source, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', unixepoch())
    `).bind(
      compId, manuscriptId, userId, body.comp_title, body.comp_author,
      body.comp_asin || null, body.comp_isbn || null,
      body.similarity_score || null, body.why_comparable || null,
      body.amazon_sales_rank || null, body.price || null,
      body.avg_rating || null, body.review_count || null
    ).run();

    return new Response(JSON.stringify({
      success: true,
      comp_id: compId
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding comp title:', error);
    return new Response(JSON.stringify({
      error: 'Failed to add comp title',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Delete a comp title
 * DELETE /comp-titles/:id
 */
export async function handleDeleteCompTitle(request, env) {
  const userId = request.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const compId = request.params.compId;

    await env.DB.prepare(
      'UPDATE comp_titles SET is_active = 0 WHERE id = ? AND user_id = ?'
    ).bind(compId, userId).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting comp title:', error);
    return new Response(JSON.stringify({
      error: 'Failed to delete comp title',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// Marketing Hooks Handlers
// ============================================================================

/**
 * Generate marketing hooks for a manuscript
 * POST /manuscripts/:id/marketing-hooks/generate
 */
export async function handleGenerateMarketingHooks(request, env) {
  const userId = request.user?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const manuscriptId = request.params.manuscriptId;

    // Get manuscript details
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build AI prompt for marketing hooks
    const prompt = `Generate compelling marketing hooks for this manuscript. Create 2-3 variations for each hook type.

Manuscript Title: ${manuscript.title}
Genre: ${manuscript.genre}
Synopsis: ${manuscript.synopsis || 'No synopsis available'}

Generate these hook types:
1. **Elevator Pitch** (30-second pitch, 50-75 words)
2. **Logline** (One compelling sentence)
3. **Tagline** (5-10 word catchy phrase)
4. **Unique Selling Proposition** (What makes it unique, 30-50 words)
5. **Comparable Titles** ("For fans of X meets Y")
6. **Hook Sentence** (Opening hook for marketing, 15-25 words)
7. **Back Cover Copy** (150-200 words)
8. **Social Media Bio** (Author bio for social, 50-100 words)
9. **Reader Promise** (What readers will get, 25-40 words)

Format as JSON array with objects containing:
- hook_type (use snake_case: elevator_pitch, logline, etc.)
- hook_text
- effectiveness_score (0.0-1.0)
- target_audience (who this hook targets)
- variation_number (1, 2, or 3)`;

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.statusText}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const hooks = JSON.parse(jsonMatch[0]);

    // Store hooks in database
    const insertedIds = [];
    for (const hook of hooks) {
      const hookId = `hook-${crypto.randomUUID()}`;
      await env.DB.prepare(`
        INSERT INTO marketing_hooks (
          id, manuscript_id, user_id, hook_type, hook_text,
          effectiveness_score, target_audience, variation_number,
          model_used, generated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'claude-sonnet-4', unixepoch())
      `).bind(
        hookId, manuscriptId, userId, hook.hook_type, hook.hook_text,
        hook.effectiveness_score, hook.target_audience, hook.variation_number
      ).run();

      insertedIds.push(hookId);
    }

    return new Response(JSON.stringify({
      success: true,
      hooks: hooks,
      count: hooks.length,
      inserted_ids: insertedIds,
      cost: {
        input_tokens: claudeData.usage.input_tokens,
        output_tokens: claudeData.usage.output_tokens,
        estimated_cost: (claudeData.usage.input_tokens * 0.000003 + claudeData.usage.output_tokens * 0.000015).toFixed(4)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating marketing hooks:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate marketing hooks',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get marketing hooks for a manuscript
 * GET /manuscripts/:id/marketing-hooks
 */
export async function handleGetMarketingHooks(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  try {
    const manuscriptId = request.params.manuscriptId;

    const hooks = await env.DB.prepare(`
      SELECT * FROM marketing_hooks
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY hook_type, effectiveness_score DESC, variation_number
    `).bind(manuscriptId, userId).all();

    // Group by hook type
    const groupedHooks = {};
    for (const hook of hooks.results) {
      if (!groupedHooks[hook.hook_type]) {
        groupedHooks[hook.hook_type] = [];
      }
      groupedHooks[hook.hook_type].push(hook);
    }

    return new Response(JSON.stringify({
      success: true,
      hooks: groupedHooks,
      total_count: hooks.results.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting marketing hooks:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get marketing hooks',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Mark a hook as used in marketing
 * PATCH /marketing-hooks/:id/mark-used
 */
export async function handleMarkHookUsed(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  try {
    const hookId = request.params.hookId;
    const body = await request.json();

    await env.DB.prepare(`
      UPDATE marketing_hooks
      SET used_in_marketing = ?, user_rating = ?
      WHERE id = ? AND user_id = ?
    `).bind(
      body.used ? 1 : 0,
      body.rating || null,
      hookId,
      userId
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error marking hook as used:', error);
    return new Response(JSON.stringify({
      error: 'Failed to mark hook as used',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// Author Platform Handlers
// ============================================================================

/**
 * Get author's platform presence
 * GET /author/platform
 */
export async function handleGetAuthorPlatform(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }


  try {
    const platforms = await env.DB.prepare(`
      SELECT * FROM author_platform
      WHERE user_id = ? AND is_active = 1
      ORDER BY platform_type
    `).bind(userId).all();

    // Get platform summary
    const summary = await env.DB.prepare(`
      SELECT * FROM author_platform_summary WHERE user_id = ?
    `).bind(userId).first();

    return new Response(JSON.stringify({
      success: true,
      platforms: platforms.results,
      summary: summary || {
        total_platforms: 0,
        total_followers: 0,
        total_subscribers: 0,
        avg_engagement: 0
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting author platform:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get author platform',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Add a platform to author profile
 * POST /author/platform
 */
export async function handleAddAuthorPlatform(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  try {
    const body = await request.json();

    const platformId = `platform-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO author_platform (
        id, user_id, platform_type, platform_name, url, username,
        follower_count, subscriber_count, engagement_rate,
        verified, post_frequency, last_post_date,
        monetized, monthly_revenue, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      platformId, userId, body.platform_type, body.platform_name || null,
      body.url || null, body.username || null,
      body.follower_count || 0, body.subscriber_count || 0,
      body.engagement_rate || null, body.verified ? 1 : 0,
      body.post_frequency || null, body.last_post_date || null,
      body.monetized ? 1 : 0, body.monthly_revenue || null
    ).run();

    return new Response(JSON.stringify({
      success: true,
      platform_id: platformId
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding author platform:', error);
    return new Response(JSON.stringify({
      error: 'Failed to add author platform',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Update a platform entry
 * PATCH /author/platform/:id
 */
export async function handleUpdateAuthorPlatform(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  try {
    const platformId = request.params.platformId;
    const body = await request.json();

    await env.DB.prepare(`
      UPDATE author_platform SET
        follower_count = COALESCE(?, follower_count),
        subscriber_count = COALESCE(?, subscriber_count),
        engagement_rate = COALESCE(?, engagement_rate),
        post_frequency = COALESCE(?, post_frequency),
        last_post_date = COALESCE(?, last_post_date),
        monetized = COALESCE(?, monetized),
        monthly_revenue = COALESCE(?, monthly_revenue),
        last_updated = unixepoch()
      WHERE id = ? AND user_id = ?
    `).bind(
      body.follower_count || null,
      body.subscriber_count || null,
      body.engagement_rate || null,
      body.post_frequency || null,
      body.last_post_date || null,
      body.monetized !== undefined ? (body.monetized ? 1 : 0) : null,
      body.monthly_revenue || null,
      platformId,
      userId
    ).run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating author platform:', error);
    return new Response(JSON.stringify({
      error: 'Failed to update author platform',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Calculate author platform score
 * POST /author/platform/calculate-score
 */
export async function handleCalculatePlatformScore(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }


  try {
    // Get all active platforms
    const platforms = await env.DB.prepare(`
      SELECT * FROM author_platform WHERE user_id = ? AND is_active = 1
    `).bind(userId).all();

    // Calculate scores
    let socialMediaScore = 0;
    let emailListScore = 0;
    let websiteTrafficScore = 0;
    let engagementScore = 0;
    let totalFollowers = 0;
    let totalSubscribers = 0;

    for (const platform of platforms.results) {
      totalFollowers += platform.follower_count || 0;
      totalSubscribers += platform.subscriber_count || 0;

      // Social media score (max 100)
      if (['twitter', 'facebook', 'instagram', 'tiktok', 'youtube'].includes(platform.platform_type)) {
        socialMediaScore += Math.min((platform.follower_count || 0) / 1000, 20);
        if (platform.verified) socialMediaScore += 10;
      }

      // Email list score (max 100)
      if (platform.platform_type === 'email_list') {
        emailListScore = Math.min((platform.subscriber_count || 0) / 500, 100);
      }

      // Engagement score
      if (platform.engagement_rate) {
        engagementScore += platform.engagement_rate * 100;
      }
    }

    socialMediaScore = Math.min(socialMediaScore, 100);
    engagementScore = Math.min(engagementScore / platforms.results.length, 100);

    const overallScore = Math.round(
      (socialMediaScore * 0.3 + emailListScore * 0.3 + engagementScore * 0.4)
    );

    // Store score
    const scoreId = `score-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO author_platform_scores (
        id, user_id, overall_score, social_media_score, email_list_score,
        engagement_score, total_followers, total_subscribers, score_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `).bind(
      scoreId, userId, overallScore, Math.round(socialMediaScore),
      Math.round(emailListScore), Math.round(engagementScore),
      totalFollowers, totalSubscribers
    ).run();

    return new Response(JSON.stringify({
      success: true,
      score: {
        overall_score: overallScore,
        social_media_score: Math.round(socialMediaScore),
        email_list_score: Math.round(emailListScore),
        engagement_score: Math.round(engagementScore),
        total_followers: totalFollowers,
        total_subscribers: totalSubscribers
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error calculating platform score:', error);
    return new Response(JSON.stringify({
      error: 'Failed to calculate platform score',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// Market Positioning Report Handlers
// ============================================================================

/**
 * Generate comprehensive market positioning report
 * POST /manuscripts/:id/market-report/generate
 */
export async function handleGenerateMarketReport(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  try {
    const manuscriptId = request.params.manuscriptId;

    // Get manuscript and comp titles
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({ error: 'Manuscript not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const compTitles = await env.DB.prepare(`
      SELECT * FROM comp_titles
      WHERE manuscript_id = ? AND is_active = 1
      ORDER BY similarity_score DESC LIMIT 5
    `).bind(manuscriptId).all();

    // Build comprehensive prompt
    const compTitlesText = compTitles.results.map(ct =>
      `- ${ct.comp_title} by ${ct.comp_author} (Sales Rank: ${ct.amazon_sales_rank || 'Unknown'}, Price: $${ct.price || 'Unknown'})`
    ).join('\n');

    const prompt = `Generate a comprehensive market positioning report for this manuscript.

Manuscript: ${manuscript.title}
Genre: ${manuscript.genre}
Word Count: ${manuscript.word_count || 'Unknown'}
Synopsis: ${manuscript.synopsis || 'No synopsis available'}

Comparable Titles:
${compTitlesText || 'No comp titles identified yet'}

Provide analysis in these areas:
1. **Genre Trends** - Current trends in ${manuscript.genre}, reader demand, market direction
2. **Market Saturation** - How crowded is this market, opportunities and challenges
3. **Pricing Analysis** - Recommended pricing based on comps ($2.99, $4.99, $9.99, etc.)
4. **Unique Angle** - How to position this book to stand out
5. **Target Demographics** - Age, gender, interests, reading habits (as JSON object)
6. **Marketing Channels** - Best platforms (Amazon ads, BookBub, social media, etc.)
7. **Launch Strategy** - Recommended launch approach
8. **Financial Projections** - Estimated sales rank, monthly sales, monthly revenue

Format as JSON with these fields:
- genre_trends (string)
- market_saturation (string)
- pricing_analysis (string)
- unique_angle (string)
- target_demographics (JSON object)
- marketing_channels (string)
- platform_priorities (string)
- launch_strategy (string)
- estimated_sales_rank (integer)
- estimated_monthly_sales (integer)
- estimated_monthly_revenue (number)
- confidence_score (0.0-1.0)`;

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 6000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!claudeResponse.ok) {
      throw new Error(`Claude API error: ${claudeResponse.statusText}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0].text;

    // Extract JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response');
    }

    const report = JSON.parse(jsonMatch[0]);

    // Store report
    const reportId = `report-${crypto.randomUUID()}`;
    await env.DB.prepare(`
      INSERT INTO market_positioning_reports (
        id, manuscript_id, user_id, genre_trends, market_saturation,
        pricing_analysis, unique_angle, target_demographics,
        marketing_channels, platform_priorities, launch_strategy,
        estimated_sales_rank, estimated_monthly_sales, estimated_monthly_revenue,
        model_used, confidence_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'claude-sonnet-4', ?)
    `).bind(
      reportId, manuscriptId, userId, report.genre_trends, report.market_saturation,
      report.pricing_analysis, report.unique_angle,
      JSON.stringify(report.target_demographics),
      report.marketing_channels, report.platform_priorities, report.launch_strategy,
      report.estimated_sales_rank, report.estimated_monthly_sales,
      report.estimated_monthly_revenue, report.confidence_score
    ).run();

    return new Response(JSON.stringify({
      success: true,
      report: report,
      report_id: reportId,
      cost: {
        input_tokens: claudeData.usage.input_tokens,
        output_tokens: claudeData.usage.output_tokens,
        estimated_cost: (claudeData.usage.input_tokens * 0.000003 + claudeData.usage.output_tokens * 0.000015).toFixed(4)
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating market report:', error);
    return new Response(JSON.stringify({
      error: 'Failed to generate market report',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Get latest market report for manuscript
 * GET /manuscripts/:id/market-report
 */
export async function handleGetMarketReport(request, env) {
    const userId = request.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  try {
    const manuscriptId = request.params.manuscriptId;

    const report = await env.DB.prepare(`
      SELECT * FROM market_positioning_reports
      WHERE manuscript_id = ? AND user_id = ?
      ORDER BY report_date DESC LIMIT 1
    `).bind(manuscriptId, userId).first();

    if (!report) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No report found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse target_demographics JSON
    if (report.target_demographics) {
      report.target_demographics = JSON.parse(report.target_demographics);
    }

    return new Response(JSON.stringify({
      success: true,
      report: report
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting market report:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get market report',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
