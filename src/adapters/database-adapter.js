/**
 * PostgreSQL adapter that provides D1-compatible API
 * Wraps pg client to match Cloudflare D1 interface
 */

import pkg from 'pg';
const { Pool } = pkg;

class DatabaseAdapter {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  /**
   * Prepare a SQL statement (D1-compatible interface)
   * @param {string} query - SQL query with ? placeholders
   * @returns {PreparedStatement}
   */
  prepare(query) {
    // Convert ? placeholders to $1, $2, etc. for PostgreSQL
    let paramIndex = 1;
    const pgQuery = query.replace(/\?/g, () => `$${paramIndex++}`);

    return new PreparedStatement(this.pool, pgQuery);
  }

  /**
   * Execute multiple statements in a batch (D1-compatible)
   * @param {Array} statements - Array of prepared statements
   * @returns {Promise<Array>}
   */
  async batch(statements) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const results = [];

      for (const stmt of statements) {
        const result = await stmt._execute(client);
        results.push(result);
      }

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a raw SQL statement
   * @param {string} sql - Raw SQL query
   * @returns {Promise<Object>}
   */
  async exec(sql) {
    const client = await this.pool.connect();

    try {
      const result = await client.query(sql);
      return {
        success: true,
        results: [{
          success: true,
          meta: {
            rows_read: result.rowCount || 0,
            rows_written: result.rowCount || 0,
          }
        }]
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    } finally {
      client.release();
    }
  }

  /**
   * Close all database connections
   */
  async close() {
    await this.pool.end();
  }
}

class PreparedStatement {
  constructor(pool, query) {
    this.pool = pool;
    this.query = query;
    this.params = [];
  }

  /**
   * Bind parameters to the statement
   * @param {...any} params - Parameters to bind
   * @returns {PreparedStatement}
   */
  bind(...params) {
    this.params = params;
    return this;
  }

  /**
   * Execute and return first row (D1-compatible)
   * @returns {Promise<Object|null>}
   */
  async first(colName) {
    const result = await this._executeQuery();

    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // If colName specified, return just that column value
    if (colName) {
      return row[colName] !== undefined ? row[colName] : null;
    }

    return row;
  }

  /**
   * Execute and return all rows (D1-compatible)
   * @returns {Promise<Object>}
   */
  async all() {
    const result = await this._executeQuery();

    return {
      success: true,
      results: result.rows || [],
      meta: {
        rows_read: result.rowCount || 0,
        rows_written: result.rowCount || 0,
        duration: 0, // PostgreSQL doesn't provide this by default
      }
    };
  }

  /**
   * Execute statement without returning rows (D1-compatible)
   * @returns {Promise<Object>}
   */
  async run() {
    const result = await this._executeQuery();

    return {
      success: true,
      meta: {
        changes: result.rowCount || 0,
        last_row_id: result.rows && result.rows[0] ? result.rows[0].id : undefined,
        rows_read: result.rowCount || 0,
        rows_written: result.rowCount || 0,
      }
    };
  }

  /**
   * Internal: Execute query with pg client
   * @param {Object} client - Optional pg client (for transactions)
   * @returns {Promise<Object>}
   */
  async _executeQuery(client) {
    const useClient = client || this.pool;

    try {
      const result = await useClient.query(this.query, this.params);
      return result;
    } catch (error) {
      console.error('Database query error:', error);
      console.error('Query:', this.query);
      console.error('Params:', this.params);
      throw error;
    }
  }

  /**
   * Internal: Execute for batch operations
   * @param {Object} client - pg client
   * @returns {Promise<Object>}
   */
  async _execute(client) {
    return await this.run();
  }
}

/**
 * Create database adapter instance
 * @param {Object} env - Environment variables
 * @returns {DatabaseAdapter}
 */
export function createDatabaseAdapter(env) {
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return new DatabaseAdapter(connectionString);
}

export default DatabaseAdapter;
