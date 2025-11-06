/**
 * Sales & Royalty Tracking Handlers
 * API endpoints for sales analytics, royalty tracking, and performance metrics
 */

/**
 * GET /manuscripts/:id/sales
 * Get sales data for a manuscript with optional date range and filters
 */
export async function handleGetManuscriptSales(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date'); // Unix timestamp
    const endDate = url.searchParams.get('end_date');
    const platform = url.searchParams.get('platform');
    const format = url.searchParams.get('format');
    const groupBy = url.searchParams.get('group_by') || 'day'; // 'day', 'week', 'month'

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build query with filters
    let query = `
      SELECT * FROM sales_data
      WHERE manuscript_id = ? AND user_id = ?
    `;
    const params = [manuscriptId, userId];

    if (startDate) {
      query += ` AND sale_date >= ?`;
      params.push(parseInt(startDate));
    }

    if (endDate) {
      query += ` AND sale_date <= ?`;
      params.push(parseInt(endDate));
    }

    if (platform) {
      query += ` AND platform = ?`;
      params.push(platform);
    }

    if (format) {
      query += ` AND format = ?`;
      params.push(format);
    }

    query += ` ORDER BY sale_date DESC LIMIT 1000`;

    const salesData = await env.DB.prepare(query).bind(...params).all();

    // Calculate summary statistics
    const summary = {
      totalUnits: 0,
      totalRevenue: 0,
      totalRoyalties: 0,
      totalKenpPages: 0,
      totalKenpRevenue: 0,
      byPlatform: {},
      byFormat: {},
      byCountry: {}
    };

    salesData.results.forEach(sale => {
      summary.totalUnits += sale.units_sold;
      summary.totalRevenue += sale.revenue;
      summary.totalRoyalties += sale.royalty_earned;
      summary.totalKenpPages += sale.kenp_pages_read || 0;
      summary.totalKenpRevenue += sale.kenp_revenue || 0;

      // Platform breakdown
      if (!summary.byPlatform[sale.platform]) {
        summary.byPlatform[sale.platform] = {
          units: 0,
          revenue: 0,
          royalties: 0
        };
      }
      summary.byPlatform[sale.platform].units += sale.units_sold;
      summary.byPlatform[sale.platform].revenue += sale.revenue;
      summary.byPlatform[sale.platform].royalties += sale.royalty_earned;

      // Format breakdown
      if (!summary.byFormat[sale.format]) {
        summary.byFormat[sale.format] = { units: 0, revenue: 0 };
      }
      summary.byFormat[sale.format].units += sale.units_sold;
      summary.byFormat[sale.format].revenue += sale.revenue;

      // Country breakdown
      if (sale.country_code) {
        if (!summary.byCountry[sale.country_code]) {
          summary.byCountry[sale.country_code] = { units: 0, revenue: 0 };
        }
        summary.byCountry[sale.country_code].units += sale.units_sold;
        summary.byCountry[sale.country_code].revenue += sale.revenue;
      }
    });

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscript.id,
        title: manuscript.title
      },
      sales: salesData.results || [],
      summary,
      count: salesData.results?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting manuscript sales:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get sales data',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/royalties
 * Get royalty data for a manuscript
 */
export async function handleGetManuscriptRoyalties(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get royalty data from sales
    const royaltyData = await env.DB.prepare(`
      SELECT
        platform,
        SUM(royalty_earned) as total_royalties,
        SUM(revenue) as total_revenue,
        AVG(royalty_rate) as avg_royalty_rate,
        COUNT(*) as transaction_count
      FROM sales_data
      WHERE manuscript_id = ? AND user_id = ?
      GROUP BY platform
    `).bind(manuscriptId, userId).all();

    // Get payment history for this user
    const payments = await env.DB.prepare(`
      SELECT * FROM royalty_payments
      WHERE user_id = ?
      ORDER BY payment_date DESC
      LIMIT 50
    `).bind(userId).all();

    // Calculate totals
    const totalEarned = royaltyData.results?.reduce(
      (sum, row) => sum + (row.total_royalties || 0),
      0
    ) || 0;

    const totalPaid = payments.results?.filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0) || 0;

    const pendingPayment = payments.results?.filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + p.amount, 0) || 0;

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscript.id,
        title: manuscript.title
      },
      royalties: {
        totalEarned,
        totalPaid,
        pendingPayment,
        unpaidBalance: totalEarned - totalPaid,
        byPlatform: royaltyData.results || []
      },
      payments: payments.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting manuscript royalties:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get royalty data',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/bestseller-rank
 * Get bestseller rank history for a manuscript
 */
export async function handleGetBestsellerRank(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const sinceTimestamp = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get rank history
    const rankHistory = await env.DB.prepare(`
      SELECT * FROM bestseller_ranks
      WHERE manuscript_id = ? AND tracked_at >= ?
      ORDER BY tracked_at DESC
      LIMIT 500
    `).bind(manuscriptId, sinceTimestamp).all();

    // Get current (most recent) rank
    const currentRank = await env.DB.prepare(`
      SELECT * FROM bestseller_ranks
      WHERE manuscript_id = ?
      ORDER BY tracked_at DESC
      LIMIT 1
    `).bind(manuscriptId).first();

    // Calculate statistics
    const overallRanks = rankHistory.results
      ?.map(r => r.overall_rank)
      .filter(r => r != null) || [];

    const stats = {
      currentOverallRank: currentRank?.overall_rank,
      bestOverallRank: overallRanks.length > 0 ? Math.min(...overallRanks) : null,
      avgOverallRank: overallRanks.length > 0
        ? Math.round(overallRanks.reduce((a, b) => a + b, 0) / overallRanks.length)
        : null,
      trackingDays: days,
      dataPoints: rankHistory.results?.length || 0
    };

    return new Response(JSON.stringify({
      success: true,
      manuscript: {
        id: manuscript.id,
        title: manuscript.title
      },
      currentRank,
      rankHistory: rankHistory.results || [],
      stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting bestseller rank:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get bestseller rank data',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /manuscripts/:id/sales/export
 * Export sales data as CSV
 */
export async function handleExportSales(request, env) {
  const { manuscriptId } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build query
    let query = `
      SELECT * FROM sales_data
      WHERE manuscript_id = ? AND user_id = ?
    `;
    const params = [manuscriptId, userId];

    if (startDate) {
      query += ` AND sale_date >= ?`;
      params.push(parseInt(startDate));
    }

    if (endDate) {
      query += ` AND sale_date <= ?`;
      params.push(parseInt(endDate));
    }

    query += ` ORDER BY sale_date DESC`;

    const salesData = await env.DB.prepare(query).bind(...params).all();

    // Generate CSV
    const headers = [
      'Sale Date',
      'Platform',
      'Format',
      'Units Sold',
      'List Price',
      'Revenue',
      'Royalty Rate',
      'Royalty Earned',
      'Currency',
      'Country',
      'KENP Pages',
      'KENP Revenue',
      'Source'
    ];

    let csv = headers.join(',') + '\n';

    salesData.results?.forEach(sale => {
      const row = [
        new Date(sale.sale_date * 1000).toISOString().split('T')[0],
        sale.platform,
        sale.format,
        sale.units_sold,
        sale.list_price || '',
        sale.revenue,
        (sale.royalty_rate * 100).toFixed(0) + '%',
        sale.royalty_earned,
        sale.currency,
        sale.country_code || '',
        sale.kenp_pages_read || 0,
        sale.kenp_revenue || 0,
        sale.source || ''
      ];
      csv += row.join(',') + '\n';
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="sales-${manuscript.title.replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.csv"`
      }
    });
  } catch (error) {
    console.error('Error exporting sales:', error);
    return new Response(JSON.stringify({
      error: 'Failed to export sales data',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /dashboard/sales-overview
 * Multi-book sales dashboard
 */
export async function handleSalesOverview(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get('days') || '30');
    const sinceTimestamp = Math.floor(Date.now() / 1000) - (days * 24 * 60 * 60);

    // Get sales overview from view
    const overview = await env.DB.prepare(`
      SELECT * FROM sales_overview
      WHERE user_id = ?
    `).bind(userId).all();

    // Get recent activity
    const recentActivity = await env.DB.prepare(`
      SELECT * FROM recent_sales_activity
      WHERE user_id = ?
    `).bind(userId).all();

    // Get platform performance
    const platformPerformance = await env.DB.prepare(`
      SELECT * FROM platform_performance
      WHERE user_id = ?
    `).bind(userId).all();

    // Get sales trend (last 30 days, grouped by day)
    const salesTrend = await env.DB.prepare(`
      SELECT
        DATE(sale_date, 'unixepoch') as sale_day,
        SUM(units_sold) as units,
        SUM(revenue) as revenue,
        SUM(royalty_earned) as royalties
      FROM sales_data
      WHERE user_id = ? AND sale_date >= ?
      GROUP BY sale_day
      ORDER BY sale_day ASC
    `).bind(userId, sinceTimestamp).all();

    // Calculate totals
    const totals = {
      allTimeUnits: overview.results?.reduce((sum, book) => sum + book.total_units_sold, 0) || 0,
      allTimeRevenue: overview.results?.reduce((sum, book) => sum + book.total_revenue, 0) || 0,
      allTimeRoyalties: overview.results?.reduce((sum, book) => sum + book.total_royalties, 0) || 0,
      last30DaysUnits: recentActivity.results?.reduce((sum, row) => sum + row.units_sold_30d, 0) || 0,
      last30DaysRevenue: recentActivity.results?.reduce((sum, row) => sum + row.revenue_30d, 0) || 0,
      last30DaysRoyalties: recentActivity.results?.reduce((sum, row) => sum + row.royalties_30d, 0) || 0,
      booksPublished: overview.results?.length || 0
    };

    return new Response(JSON.stringify({
      success: true,
      overview: overview.results || [],
      recentActivity: recentActivity.results || [],
      platformPerformance: platformPerformance.results || [],
      salesTrend: salesTrend.results || [],
      totals,
      periodDays: days
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting sales overview:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get sales overview',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /dashboard/royalty-summary
 * Royalty summary across all books
 */
export async function handleRoyaltySummary(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Get royalty payment summary
    const paymentSummary = await env.DB.prepare(`
      SELECT * FROM royalty_payment_summary
      WHERE user_id = ?
    `).bind(userId).all();

    // Get pending payments
    const pendingPayments = await env.DB.prepare(`
      SELECT * FROM royalty_payments
      WHERE user_id = ? AND status = 'pending'
      ORDER BY expected_payment_date ASC
    `).bind(userId).all();

    // Get recent payments
    const recentPayments = await env.DB.prepare(`
      SELECT * FROM royalty_payments
      WHERE user_id = ? AND status = 'paid'
      ORDER BY payment_date DESC
      LIMIT 10
    `).bind(userId).all();

    // Calculate totals
    const totalEarned = paymentSummary.results?.reduce(
      (sum, platform) => sum + platform.total_paid,
      0
    ) || 0;

    const totalPending = pendingPayments.results?.reduce(
      (sum, payment) => sum + payment.amount,
      0
    ) || 0;

    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalEarned,
        totalPending,
        byPlatform: paymentSummary.results || []
      },
      pendingPayments: pendingPayments.results || [],
      recentPayments: recentPayments.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting royalty summary:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get royalty summary',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * GET /platforms/connections
 * Get connected platforms status
 */
export async function handleGetPlatformConnections(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const connections = await env.DB.prepare(`
      SELECT
        id,
        platform,
        status,
        platform_username,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        next_sync_at,
        connected_at
      FROM platform_connections
      WHERE user_id = ?
    `).bind(userId).all();

    return new Response(JSON.stringify({
      success: true,
      connections: connections.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error getting platform connections:', error);
    return new Response(JSON.stringify({
      error: 'Failed to get platform connections',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /platforms/:platform/connect
 * Connect a publishing platform
 */
export async function handleConnectPlatform(request, env) {
  const { platform } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { apiKey, apiSecret, accessToken, refreshToken } = body;

    // In production, encrypt credentials before storage
    // For now, we'll store them (this is a placeholder)

    const connectionId = `conn-${crypto.randomUUID()}`;
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT OR REPLACE INTO platform_connections (
        id, user_id, platform, status,
        api_key_encrypted, api_secret_encrypted,
        access_token_encrypted, refresh_token_encrypted,
        connected_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      connectionId,
      userId,
      platform,
      'connected',
      apiKey || null,
      apiSecret || null,
      accessToken || null,
      refreshToken || null,
      now,
      now
    ).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Connected to ${platform}`,
      connectionId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error connecting platform:', error);
    return new Response(JSON.stringify({
      error: 'Failed to connect platform',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /platforms/:platform/sync
 * Trigger data sync from a platform
 */
export async function handleSyncPlatform(request, env) {
  const { platform } = request.params;
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Check if platform is connected
    const connection = await env.DB.prepare(`
      SELECT * FROM platform_connections
      WHERE user_id = ? AND platform = ? AND status = 'connected'
    `).bind(userId, platform).first();

    if (!connection) {
      return new Response(JSON.stringify({
        error: 'Platform not connected',
        message: `Please connect ${platform} before syncing`
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // In production, trigger actual sync job
    // For now, return placeholder response

    await env.DB.prepare(`
      UPDATE platform_connections
      SET last_sync_at = ?, last_sync_status = 'success'
      WHERE id = ?
    `).bind(Math.floor(Date.now() / 1000), connection.id).run();

    return new Response(JSON.stringify({
      success: true,
      message: `Sync triggered for ${platform}`,
      note: 'Platform sync functionality will be implemented with actual API integrations'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error syncing platform:', error);
    return new Response(JSON.stringify({
      error: 'Failed to sync platform',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * POST /sales/seed
 * Seed sample sales data for testing (development only)
 */
export async function handleSeedSalesData(request, env) {
  const userId = request.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { manuscriptId } = body;

    // Verify manuscript ownership
    const manuscript = await env.DB.prepare(
      'SELECT * FROM manuscripts WHERE id = ? AND user_id = ?'
    ).bind(manuscriptId, userId).first();

    if (!manuscript) {
      return new Response(JSON.stringify({
        error: 'Manuscript not found or access denied'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate sample sales data for the last 30 days
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

    const platforms = ['kdp', 'draft2digital', 'ingramspark'];
    const formats = ['ebook', 'paperback'];
    const countries = ['US', 'UK', 'CA', 'AU', 'DE'];

    let salesCreated = 0;

    // Create 100 random sales entries
    for (let i = 0; i < 100; i++) {
      const saleId = `sale-${crypto.randomUUID()}`;
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      const format = formats[Math.floor(Math.random() * formats.length)];
      const country = countries[Math.floor(Math.random() * countries.length)];

      const saleDate = thirtyDaysAgo + Math.floor(Math.random() * (30 * 24 * 60 * 60));
      const units = Math.floor(Math.random() * 5) + 1;

      // Generate realistic pricing
      const listPrice = format === 'ebook' ? 4.99 : 14.99;
      const royaltyRate = platform === 'kdp' && format === 'ebook' ? 0.70 : 0.60;
      const revenue = listPrice * units;
      const royaltyEarned = revenue * royaltyRate;

      await env.DB.prepare(`
        INSERT INTO sales_data (
          id, manuscript_id, user_id, sale_date, platform, format,
          units_sold, list_price, revenue, royalty_earned, royalty_rate,
          currency, country_code, marketplace, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        saleId, manuscriptId, userId, saleDate, platform, format,
        units, listPrice, revenue, royaltyEarned, royaltyRate,
        'USD', country, `amazon.${country.toLowerCase()}`, 'organic', now
      ).run();

      salesCreated++;
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Created ${salesCreated} sample sales entries`,
      manuscriptId,
      note: 'Sample data for testing purposes only'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error seeding sales data:', error);
    return new Response(JSON.stringify({
      error: 'Failed to seed sales data',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
