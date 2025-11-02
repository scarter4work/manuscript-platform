// Series Manager
// Core logic for managing book series, reading orders, bundles, and cross-promotion

import { randomUUID } from 'crypto';

/**
 * Series status types
 */
export const SERIES_STATUS = {
  ONGOING: 'ongoing',
  COMPLETE: 'complete',
  HIATUS: 'hiatus',
  PLANNED: 'planned',
};

/**
 * Book types within a series
 */
export const BOOK_TYPES = {
  MAIN: 'main',
  PREQUEL: 'prequel',
  SEQUEL: 'sequel',
  NOVELLA: 'novella',
  SHORT_STORY: 'short_story',
  COMPANION: 'companion',
};

/**
 * Bundle types
 */
export const BUNDLE_TYPES = {
  BOX_SET: 'box_set',
  OMNIBUS: 'omnibus',
  COLLECTION: 'collection',
  STARTER_PACK: 'starter_pack',
};

/**
 * Create a new book series
 * @param {Object} env - Cloudflare environment bindings
 * @param {number} userId - User ID
 * @param {Object} seriesData - Series information
 * @returns {Object} Created series
 */
export async function createSeries(env, userId, seriesData) {
  const seriesId = `series_${randomUUID()}`;

  const {
    seriesName,
    seriesDescription = null,
    genre = null,
    seriesStatus = SERIES_STATUS.ONGOING,
    totalPlannedBooks = null,
    seriesTagline = null,
    keywords = null,
    categories = null,
  } = seriesData;

  await env.DB.prepare(
    `INSERT INTO series (
      id, user_id, series_name, series_description, genre, series_status,
      total_planned_books, series_tagline, keywords, categories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    seriesId,
    userId,
    seriesName,
    seriesDescription,
    genre,
    seriesStatus,
    totalPlannedBooks,
    seriesTagline,
    keywords,
    categories
  ).run();

  // Get created series
  const series = await env.DB.prepare(
    'SELECT * FROM series WHERE id = ?'
  ).bind(seriesId).first();

  return series;
}

/**
 * Get series by ID
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {number} userId - User ID (for authorization)
 * @returns {Object|null} Series data with books
 */
export async function getSeries(env, seriesId, userId = null) {
  let query = 'SELECT * FROM series_overview WHERE id = ?';
  const params = [seriesId];

  if (userId !== null) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const series = await env.DB.prepare(query).bind(...params).first();

  if (!series) {
    return null;
  }

  // Get books in series
  const books = await env.DB.prepare(
    `SELECT * FROM series_books_ordered WHERE series_id = ? ORDER BY book_number`
  ).bind(seriesId).all();

  series.books = books.results || [];

  // Get reading orders
  const readingOrders = await env.DB.prepare(
    'SELECT * FROM series_reading_orders WHERE series_id = ? ORDER BY is_default DESC, order_name'
  ).bind(seriesId).all();

  series.readingOrders = readingOrders.results || [];

  // Get bundles
  const bundles = await env.DB.prepare(
    'SELECT * FROM series_bundles WHERE series_id = ? ORDER BY created_at DESC'
  ).bind(seriesId).all();

  series.bundles = bundles.results || [];

  return series;
}

/**
 * List all series for a user
 * @param {Object} env - Cloudflare environment bindings
 * @param {number} userId - User ID
 * @param {Object} options - Filtering options
 * @returns {Array} List of series
 */
export async function listUserSeries(env, userId, options = {}) {
  const { status = null, genre = null, limit = 50, offset = 0 } = options;

  let query = 'SELECT * FROM series_overview WHERE user_id = ?';
  const params = [userId];

  if (status) {
    query += ' AND series_status = ?';
    params.push(status);
  }

  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await env.DB.prepare(query).bind(...params).all();

  return result.results || [];
}

/**
 * Update series information
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {number} userId - User ID (for authorization)
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated series
 */
export async function updateSeries(env, seriesId, userId, updates) {
  const allowedFields = [
    'series_name', 'series_description', 'genre', 'series_status',
    'total_planned_books', 'series_tagline', 'keywords', 'categories',
    'series_cover_image_key', 'amazon_series_page_url', 'goodreads_series_url',
    'bookbub_series_url',
  ];

  const updateFields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  // Add updated_at
  updateFields.push('updated_at = ?');
  values.push(Math.floor(Date.now() / 1000));

  // Add WHERE clause params
  values.push(seriesId, userId);

  const query = `UPDATE series SET ${updateFields.join(', ')} WHERE id = ? AND user_id = ?`;

  await env.DB.prepare(query).bind(...values).run();

  return await getSeries(env, seriesId, userId);
}

/**
 * Delete a series
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {number} userId - User ID (for authorization)
 * @returns {boolean} Success status
 */
export async function deleteSeries(env, seriesId, userId) {
  const result = await env.DB.prepare(
    'DELETE FROM series WHERE id = ? AND user_id = ?'
  ).bind(seriesId, userId).run();

  return result.changes > 0;
}

/**
 * Add a manuscript to a series
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {string} manuscriptId - Manuscript ID
 * @param {Object} bookData - Book information (book_number, book_type, etc.)
 * @returns {Object} Series manuscript entry
 */
export async function addManuscriptToSeries(env, seriesId, manuscriptId, bookData) {
  const entryId = `sm_${randomUUID()}`;

  const {
    bookNumber,
    bookType = BOOK_TYPES.MAIN,
    readingOrderNote = null,
    publicationDate = null,
    isPublished = 0,
    preOrderDate = null,
    includeInBackmatter = 1,
    includeSampleChapter = 0,
  } = bookData;

  await env.DB.prepare(
    `INSERT INTO series_manuscripts (
      id, series_id, manuscript_id, book_number, book_type, reading_order_note,
      publication_date, is_published, pre_order_date, include_in_backmatter,
      include_sample_chapter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    entryId,
    seriesId,
    manuscriptId,
    bookNumber,
    bookType,
    readingOrderNote,
    publicationDate,
    isPublished,
    preOrderDate,
    includeInBackmatter,
    includeSampleChapter
  ).run();

  const entry = await env.DB.prepare(
    'SELECT * FROM series_manuscripts WHERE id = ?'
  ).bind(entryId).first();

  return entry;
}

/**
 * Remove a manuscript from a series
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {string} manuscriptId - Manuscript ID
 * @returns {boolean} Success status
 */
export async function removeManuscriptFromSeries(env, seriesId, manuscriptId) {
  const result = await env.DB.prepare(
    'DELETE FROM series_manuscripts WHERE series_id = ? AND manuscript_id = ?'
  ).bind(seriesId, manuscriptId).run();

  return result.changes > 0;
}

/**
 * Update manuscript position in series
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {string} manuscriptId - Manuscript ID
 * @param {Object} updates - Fields to update
 * @returns {Object} Updated entry
 */
export async function updateSeriesManuscript(env, seriesId, manuscriptId, updates) {
  const allowedFields = [
    'book_number', 'book_type', 'reading_order_note', 'publication_date',
    'is_published', 'pre_order_date', 'include_in_backmatter', 'include_sample_chapter',
  ];

  const updateFields = [];
  const values = [];

  Object.entries(updates).forEach(([key, value]) => {
    if (allowedFields.includes(key)) {
      updateFields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (updateFields.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(seriesId, manuscriptId);

  const query = `UPDATE series_manuscripts SET ${updateFields.join(', ')} WHERE series_id = ? AND manuscript_id = ?`;

  await env.DB.prepare(query).bind(...values).run();

  const entry = await env.DB.prepare(
    'SELECT * FROM series_manuscripts WHERE series_id = ? AND manuscript_id = ?'
  ).bind(seriesId, manuscriptId).first();

  return entry;
}

/**
 * Create a series bundle (box set, omnibus, etc.)
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {Object} bundleData - Bundle information
 * @returns {Object} Created bundle
 */
export async function createSeriesBundle(env, seriesId, bundleData) {
  const bundleId = `bundle_${randomUUID()}`;

  const {
    bundleName,
    bundleDescription = null,
    bundleType = BUNDLE_TYPES.BOX_SET,
    includedBookNumbers, // Array of book numbers
    bundlePriceEbook = null,
    bundlePricePaperback = null,
    discountPercentage = null,
    isPublished = 0,
    publicationDate = null,
  } = bundleData;

  // Convert array to JSON string
  const includedBookNumbersJson = JSON.stringify(includedBookNumbers);

  await env.DB.prepare(
    `INSERT INTO series_bundles (
      id, series_id, bundle_name, bundle_description, bundle_type,
      included_book_numbers, bundle_price_ebook, bundle_price_paperback,
      discount_percentage, is_published, publication_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    bundleId,
    seriesId,
    bundleName,
    bundleDescription,
    bundleType,
    includedBookNumbersJson,
    bundlePriceEbook,
    bundlePricePaperback,
    discountPercentage,
    isPublished,
    publicationDate
  ).run();

  const bundle = await env.DB.prepare(
    'SELECT * FROM series_bundles WHERE id = ?'
  ).bind(bundleId).first();

  // Parse JSON field
  if (bundle && bundle.included_book_numbers) {
    bundle.included_book_numbers = JSON.parse(bundle.included_book_numbers);
  }

  return bundle;
}

/**
 * Create a custom reading order for a series
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {Object} orderData - Reading order information
 * @returns {Object} Created reading order
 */
export async function createReadingOrder(env, seriesId, orderData) {
  const orderId = `ro_${randomUUID()}`;

  const {
    orderName,
    orderDescription = null,
    isDefault = 0,
    bookOrder, // Array of book numbers in order
  } = orderData;

  // Convert array to JSON string
  const bookOrderJson = JSON.stringify(bookOrder);

  await env.DB.prepare(
    `INSERT INTO series_reading_orders (
      id, series_id, order_name, order_description, is_default, book_order
    ) VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    orderId,
    seriesId,
    orderName,
    orderDescription,
    isDefault,
    bookOrderJson
  ).run();

  const readingOrder = await env.DB.prepare(
    'SELECT * FROM series_reading_orders WHERE id = ?'
  ).bind(orderId).first();

  // Parse JSON field
  if (readingOrder && readingOrder.book_order) {
    readingOrder.book_order = JSON.parse(readingOrder.book_order);
  }

  return readingOrder;
}

/**
 * Calculate read-through rate for a series
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @returns {Object} Read-through statistics
 */
export async function calculateReadThroughRate(env, seriesId) {
  // Get analytics data
  const analytics = await env.DB.prepare(
    `SELECT
      SUM(book_1_sales) AS total_book_1_sales,
      SUM(book_2_sales) AS total_book_2_sales,
      AVG(read_through_rate) AS avg_read_through_rate
    FROM series_analytics
    WHERE series_id = ?`
  ).bind(seriesId).first();

  if (!analytics || !analytics.total_book_1_sales) {
    return {
      book1Sales: 0,
      book2Sales: 0,
      readThroughRate: 0,
      message: 'Insufficient data to calculate read-through rate',
    };
  }

  const book1Sales = analytics.total_book_1_sales || 0;
  const book2Sales = analytics.total_book_2_sales || 0;
  const readThroughRate = book1Sales > 0 ? (book2Sales / book1Sales) * 100 : 0;

  return {
    book1Sales: book1Sales,
    book2Sales: book2Sales,
    readThroughRate: parseFloat(readThroughRate.toFixed(2)),
    interpretation: getReadThroughInterpretation(readThroughRate),
  };
}

/**
 * Get interpretation of read-through rate
 */
function getReadThroughInterpretation(rate) {
  if (rate >= 70) {
    return 'Excellent! Your readers are highly engaged with the series.';
  } else if (rate >= 50) {
    return 'Good. Most readers are continuing with the series.';
  } else if (rate >= 30) {
    return 'Fair. Consider improving Book 1 hook or Book 2 marketing.';
  } else if (rate > 0) {
    return 'Low. Review Book 1 ending and Book 2 premise to improve continuity.';
  }
  return 'No data available yet.';
}

/**
 * Generate backmatter for a book in a series
 * Includes "Books in this series" and "Read next" sections
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @param {number} currentBookNumber - Current book number
 * @returns {string} Formatted backmatter text
 */
export async function generateSeriesBackmatter(env, seriesId, currentBookNumber) {
  const series = await getSeries(env, seriesId);

  if (!series) {
    throw new Error('Series not found');
  }

  const books = series.books.filter(b => b.include_in_backmatter === 1);

  let backmatter = `\n\n--- BOOKS IN THE ${series.series_name.toUpperCase()} SERIES ---\n\n`;

  if (series.series_description) {
    backmatter += `${series.series_description}\n\n`;
  }

  // List all books in order
  books.forEach(book => {
    const isCurrent = book.book_number === currentBookNumber;
    const isNext = book.book_number === currentBookNumber + 1 || book.book_number === currentBookNumber + 0.5;

    let bookLine = `Book ${book.book_number}: ${book.manuscript_title}`;

    if (isCurrent) {
      bookLine += ' (You just finished this!)';
    } else if (isNext) {
      bookLine += ' ← READ NEXT!';
    } else if (book.is_published) {
      bookLine += ' (Available now)';
    } else if (book.pre_order_date) {
      bookLine += ' (Available for pre-order)';
    } else {
      bookLine += ' (Coming soon)';
    }

    backmatter += `${bookLine}\n`;

    if (book.reading_order_note) {
      backmatter += `   ${book.reading_order_note}\n`;
    }
  });

  // Add "Read Next" section
  const nextBook = books.find(b =>
    b.book_number > currentBookNumber && b.book_number < currentBookNumber + 1
  ) || books.find(b => b.book_number === currentBookNumber + 1);

  if (nextBook) {
    backmatter += `\n\nREADY FOR MORE?\n\n`;
    backmatter += `Continue the adventure with "${nextBook.manuscript_title}"!\n\n`;

    if (nextBook.is_published) {
      backmatter += `Available now on Amazon, Apple Books, and all major retailers.\n`;
    } else if (nextBook.pre_order_date) {
      backmatter += `Pre-order now to get it on release day!\n`;
    } else {
      backmatter += `Join my newsletter to be notified when it's released.\n`;
    }
  }

  // Add bundle info if available
  const publishedBundles = series.bundles.filter(b => b.is_published === 1);
  if (publishedBundles.length > 0) {
    backmatter += `\n\nSAVE MONEY WITH BUNDLES\n\n`;
    publishedBundles.forEach(bundle => {
      const bundleBooks = JSON.parse(bundle.included_book_numbers);
      backmatter += `${bundle.bundle_name} - Books ${bundleBooks.join(', ')}\n`;
      if (bundle.discount_percentage) {
        backmatter += `Save ${bundle.discount_percentage}% when you buy the bundle!\n`;
      }
      backmatter += `\n`;
    });
  }

  return backmatter;
}

/**
 * Get series performance metrics
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @returns {Object} Performance metrics
 */
export async function getSeriesPerformance(env, seriesId) {
  const performance = await env.DB.prepare(
    'SELECT * FROM series_performance WHERE series_id = ?'
  ).bind(seriesId).first();

  const readThrough = await calculateReadThroughRate(env, seriesId);

  return {
    ...performance,
    readThrough,
  };
}

/**
 * Generate series marketing copy
 * @param {Object} env - Cloudflare environment bindings
 * @param {string} seriesId - Series ID
 * @returns {Object} Marketing copy variations
 */
export async function generateSeriesMarketingCopy(env, seriesId) {
  const series = await getSeries(env, seriesId);

  if (!series) {
    throw new Error('Series not found');
  }

  const totalBooks = series.total_books_written;
  const publishedBooks = series.total_books_published;

  const copy = {
    shortTagline: series.series_tagline || `The ${series.series_name} series`,

    mediumPitch: `${series.series_description || 'An epic series'} ${publishedBooks} books available now${series.series_status === 'complete' ? ' - complete series!' : '!'} ${series.series_tagline ? `"${series.series_tagline}"` : ''}`,

    longPitch: `\n${series.series_name}\n${'-'.repeat(series.series_name.length)}\n\n${series.series_description || 'Discover this exciting series.'}\n\nWith ${publishedBooks} books available and ${series.series_status === 'complete' ? 'the series complete' : `more coming soon`}, dive into a world of ${series.genre || 'adventure'}.\n\n${series.series_tagline ? `"${series.series_tagline}"\n\n` : ''}Perfect for fans of ${series.genre || 'great storytelling'}.`,

    bingeReadPitch: publishedBooks >= 3
      ? `🔥 BINGE-WORTHY ALERT! ${publishedBooks} books waiting for you in The ${series.series_name} series. ${series.series_status === 'complete' ? 'Complete series - read it all now!' : 'Start your marathon today!'}`
      : null,

    completeSeries: series.series_status === 'complete'
      ? `✅ COMPLETE SERIES - No waiting for the next book! All ${publishedBooks} books in The ${series.series_name} are ready for you.`
      : null,
  };

  return copy;
}

export default {
  createSeries,
  getSeries,
  listUserSeries,
  updateSeries,
  deleteSeries,
  addManuscriptToSeries,
  removeManuscriptFromSeries,
  updateSeriesManuscript,
  createSeriesBundle,
  createReadingOrder,
  calculateReadThroughRate,
  generateSeriesBackmatter,
  getSeriesPerformance,
  generateSeriesMarketingCopy,
  SERIES_STATUS,
  BOOK_TYPES,
  BUNDLE_TYPES,
};
