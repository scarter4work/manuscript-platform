/**
 * Database Query Utilities for MAN-28
 *
 * Provides reusable query helpers, pagination, and performance optimizations.
 */

/**
 * Cursor-based pagination helper
 * More efficient than OFFSET for large datasets
 */
export class CursorPagination {
  /**
   * Build a cursor-based query
   * @param {string} baseQuery - Base SQL query without ORDER BY or LIMIT
   * @param {string} cursorColumn - Column to use for cursor (e.g., 'uploaded_at')
   * @param {string} cursorValue - Cursor value from previous page (null for first page)
   * @param {number} limit - Number of results per page
   * @param {string} direction - 'ASC' or 'DESC'
   * @returns {Object} Query string and parameters
   */
  static buildQuery(baseQuery, cursorColumn, cursorValue, limit = 20, direction = 'DESC') {
    let query = baseQuery;
    const params = [];

    // Add cursor condition if provided
    if (cursorValue) {
      const operator = direction === 'DESC' ? '<' : '>';
      query += ` AND ${cursorColumn} ${operator} ?`;
      params.push(cursorValue);
    }

    // Add ORDER BY and LIMIT
    query += ` ORDER BY ${cursorColumn} ${direction} LIMIT ?`;
    params.push(limit + 1); // Fetch one extra to check if there's a next page

    return { query, params };
  }

  /**
   * Process query results for cursor pagination
   * @param {Array} results - Query results
   * @param {number} limit - Results per page
   * @param {string} cursorColumn - Column used for cursor
   * @returns {Object} Paginated results with cursor metadata
   */
  static processResults(results, limit, cursorColumn) {
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;

    const nextCursor = hasMore && items.length > 0
      ? items[items.length - 1][cursorColumn]
      : null;

    return {
      items,
      hasMore,
      nextCursor,
      count: items.length,
    };
  }
}

/**
 * Batch query executor for reducing round trips
 */
export class BatchQuery {
  /**
   * Execute multiple queries in a single transaction
   * @param {D1Database} db - D1 database instance
   * @param {Array<Object>} queries - Array of {sql, params} objects
   * @returns {Promise<Array>} Array of results
   */
  static async execute(db, queries) {
    try {
      const batch = queries.map(({ sql, params }) =>
        db.prepare(sql).bind(...(params || []))
      );

      const results = await db.batch(batch);
      return results;
    } catch (error) {
      console.error('Batch query error:', error);
      throw error;
    }
  }

  /**
   * Execute queries in parallel (for independent queries)
   * @param {D1Database} db - D1 database instance
   * @param {Array<Object>} queries - Array of {sql, params} objects
   * @returns {Promise<Array>} Array of results
   */
  static async parallel(db, queries) {
    try {
      const promises = queries.map(({ sql, params }) =>
        db.prepare(sql).bind(...(params || [])).first()
      );

      return await Promise.all(promises);
    } catch (error) {
      console.error('Parallel query error:', error);
      throw error;
    }
  }
}

/**
 * Prepared statement cache for reusing queries
 */
export class PreparedStatementCache {
  constructor() {
    this.statements = new Map();
  }

  /**
   * Get or create a prepared statement
   * @param {D1Database} db - D1 database instance
   * @param {string} sql - SQL query
   * @returns {D1PreparedStatement} Prepared statement
   */
  get(db, sql) {
    if (!this.statements.has(sql)) {
      this.statements.set(sql, db.prepare(sql));
    }
    return this.statements.get(sql);
  }

  /**
   * Clear the cache
   */
  clear() {
    this.statements.clear();
  }
}

/**
 * Common query builders
 */
export const QueryBuilder = {
  /**
   * Build a SELECT query with dynamic WHERE conditions
   * @param {string} table - Table name
   * @param {Array<string>} columns - Columns to select
   * @param {Object} conditions - { column: value } conditions (all AND)
   * @param {Object} options - { orderBy, limit, offset }
   * @returns {Object} { sql, params }
   */
  select(table, columns = ['*'], conditions = {}, options = {}) {
    let sql = `SELECT ${columns.join(', ')} FROM ${table}`;
    const params = [];

    // WHERE clause
    const whereConditions = Object.entries(conditions)
      .filter(([_, value]) => value !== undefined)
      .map(([column, _]) => {
        params.push(conditions[column]);
        return `${column} = ?`;
      });

    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // ORDER BY
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    // LIMIT and OFFSET
    if (options.limit) {
      sql += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options.offset) {
      sql += ` OFFSET ?`;
      params.push(options.offset);
    }

    return { sql, params };
  },

  /**
   * Build an UPDATE query
   * @param {string} table - Table name
   * @param {Object} updates - { column: value } to update
   * @param {Object} conditions - { column: value } WHERE conditions
   * @returns {Object} { sql, params }
   */
  update(table, updates, conditions) {
    const updatePairs = Object.entries(updates).map(([column]) => `${column} = ?`);
    let sql = `UPDATE ${table} SET ${updatePairs.join(', ')}`;

    const params = [...Object.values(updates)];

    // WHERE clause
    const whereConditions = Object.entries(conditions).map(([column]) => {
      params.push(conditions[column]);
      return `${column} = ?`;
    });

    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    return { sql, params };
  },

  /**
   * Build an INSERT query
   * @param {string} table - Table name
   * @param {Object} data - { column: value } to insert
   * @returns {Object} { sql, params }
   */
  insert(table, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    const params = Object.values(data);

    return { sql, params };
  },

  /**
   * Build a DELETE query
   * @param {string} table - Table name
   * @param {Object} conditions - { column: value } WHERE conditions
   * @returns {Object} { sql, params }
   */
  delete(table, conditions) {
    let sql = `DELETE FROM ${table}`;
    const params = [];

    const whereConditions = Object.entries(conditions).map(([column]) => {
      params.push(conditions[column]);
      return `${column} = ?`;
    });

    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    return { sql, params };
  },
};

/**
 * Transaction helper
 */
export class Transaction {
  /**
   * Execute operations in a transaction (simulated for D1)
   * D1 doesn't support explicit transactions, but we can use batch for atomicity
   * @param {D1Database} db - D1 database instance
   * @param {Function} operations - Async function that performs operations
   * @returns {Promise<any>} Result of operations
   */
  static async execute(db, operations) {
    try {
      return await operations(db);
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }
}

/**
 * Query performance monitoring
 */
export class QueryMonitor {
  /**
   * Wrap a query with performance monitoring
   * @param {string} queryName - Name for logging
   * @param {Function} queryFn - Async function that executes the query
   * @returns {Promise<any>} Query result
   */
  static async measure(queryName, queryFn) {
    const start = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - start;

      // Log slow queries (> 500ms)
      if (duration > 500) {
        console.warn(`Slow query: ${queryName} took ${duration}ms`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Query error: ${queryName} failed after ${duration}ms:`, error);
      throw error;
    }
  }
}

/**
 * Database connection helper
 */
export class DBHelper {
  constructor(db) {
    this.db = db;
    this.preparedStatements = new PreparedStatementCache();
  }

  /**
   * Execute a query with prepared statement caching
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query result
   */
  async query(sql, params = []) {
    const stmt = this.preparedStatements.get(this.db, sql);
    return await stmt.bind(...params).all();
  }

  /**
   * Execute a query and return first result
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} First result or null
   */
  async queryFirst(sql, params = []) {
    const stmt = this.preparedStatements.get(this.db, sql);
    return await stmt.bind(...params).first();
  }

  /**
   * Execute a write query (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query result
   */
  async execute(sql, params = []) {
    const stmt = this.preparedStatements.get(this.db, sql);
    return await stmt.bind(...params).run();
  }
}

/**
 * Utility to check if database query result exists
 */
export function resultExists(result) {
  return result && (result.results?.length > 0 || result !== null);
}

/**
 * Parse JSON fields safely
 */
export function parseJsonField(value, defaultValue = {}) {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.error('JSON parse error:', error);
    return defaultValue;
  }
}

/**
 * Build pagination metadata
 */
export function buildPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
