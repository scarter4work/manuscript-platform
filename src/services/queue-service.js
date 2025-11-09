/**
 * Redis-based Queue Service
 * Replaces Cloudflare Queue bindings with Redis-backed job queue
 *
 * Features:
 * - Job persistence (Redis hashes)
 * - Automatic retries with exponential backoff
 * - Delayed/scheduled jobs (Redis sorted sets)
 * - Dead letter queue for failed jobs
 * - Job state tracking (pending, processing, completed, failed)
 *
 * Redis Data Structures:
 * - queue:{name}:pending (list) - Jobs waiting to be processed
 * - queue:{name}:processing (list) - Jobs currently being processed
 * - queue:{name}:delayed (sorted set) - Jobs scheduled for future processing
 * - queue:{name}:failed (list) - Jobs that exceeded max retries
 * - queue:{name}:job:{id} (hash) - Job data and metadata
 */

import crypto from 'crypto';

class QueueService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.maxRetries = 3;
    this.retryDelays = [5000, 30000, 300000]; // 5s, 30s, 5min
  }

  /**
   * Send a job to the queue (replaces env.QUEUE.send('analysis', ))
   * @param {string} queueName - Queue name (e.g., 'analysis', 'asset-generation')
   * @param {object} jobData - Job payload
   * @param {object} options - Optional: { delay: ms, maxRetries: number }
   * @returns {Promise<string>} Job ID
   */
  async send(queueName, jobData, options = {}) {
    const jobId = crypto.randomUUID();
    const timestamp = Date.now();

    // Store job data in Redis hash
    const jobKey = `queue:${queueName}:job:${jobId}`;
    await this.redis.hSet(jobKey, {
      id: jobId,
      data: JSON.stringify(jobData),
      status: 'pending',
      attempts: '0',
      maxRetries: String(options.maxRetries || this.maxRetries),
      createdAt: String(timestamp),
      updatedAt: String(timestamp),
    });

    // Set TTL for job data (7 days)
    await this.redis.expire(jobKey, 60 * 60 * 24 * 7);

    if (options.delay && options.delay > 0) {
      // Delayed job: Add to sorted set with score = timestamp + delay
      const processAt = timestamp + options.delay;
      await this.redis.zAdd(`queue:${queueName}:delayed`, {
        score: processAt,
        value: jobId,
      });
      console.log(`[Queue] Job ${jobId} scheduled for ${new Date(processAt).toISOString()}`);
    } else {
      // Immediate job: Add to pending list
      await this.redis.rPush(`queue:${queueName}:pending`, jobId);
      console.log(`[Queue] Job ${jobId} queued to ${queueName}`);
    }

    return jobId;
  }

  /**
   * Get the next job from the queue (blocking pop with timeout)
   * @param {string} queueName - Queue name
   * @param {number} timeout - Block timeout in seconds (default: 5)
   * @returns {Promise<object|null>} Job object or null if timeout
   */
  async getNextJob(queueName, timeout = 5) {
    // First, check for delayed jobs that are ready to process
    await this.processDelayedJobs(queueName);

    // Blocking pop from pending queue (BRPOPLPUSH for reliability)
    const result = await this.redis.brPopLPush(
      `queue:${queueName}:pending`,
      `queue:${queueName}:processing`,
      timeout
    );

    if (!result) {
      return null; // Timeout, no jobs available
    }

    const jobId = result;
    const jobKey = `queue:${queueName}:job:${jobId}`;

    // Get job data
    const jobHash = await this.redis.hGetAll(jobKey);
    if (!jobHash || !jobHash.data) {
      console.error(`[Queue] Job ${jobId} not found in Redis`);
      await this.redis.lRem(`queue:${queueName}:processing`, 0, jobId);
      return null;
    }

    // Update job status
    await this.redis.hSet(jobKey, {
      status: 'processing',
      attempts: String(parseInt(jobHash.attempts || '0') + 1),
      updatedAt: String(Date.now()),
    });

    return {
      id: jobId,
      data: JSON.parse(jobHash.data),
      attempts: parseInt(jobHash.attempts || '0') + 1,
      maxRetries: parseInt(jobHash.maxRetries || String(this.maxRetries)),
    };
  }

  /**
   * Mark a job as completed
   * @param {string} queueName - Queue name
   * @param {string} jobId - Job ID
   * @param {object} result - Job result (optional)
   */
  async completeJob(queueName, jobId, result = null) {
    const jobKey = `queue:${queueName}:job:${jobId}`;

    // Update job status
    await this.redis.hSet(jobKey, {
      status: 'completed',
      completedAt: String(Date.now()),
      updatedAt: String(Date.now()),
      result: result ? JSON.stringify(result) : '',
    });

    // Remove from processing list
    await this.redis.lRem(`queue:${queueName}:processing`, 0, jobId);

    // Delete job data after 24 hours (keep for debugging)
    await this.redis.expire(jobKey, 60 * 60 * 24);

    console.log(`[Queue] Job ${jobId} completed`);
  }

  /**
   * Mark a job as failed and retry or move to dead letter queue
   * @param {string} queueName - Queue name
   * @param {string} jobId - Job ID
   * @param {Error} error - Error object
   */
  async failJob(queueName, jobId, error) {
    const jobKey = `queue:${queueName}:job:${jobId}`;
    const jobHash = await this.redis.hGetAll(jobKey);

    if (!jobHash || !jobHash.data) {
      console.error(`[Queue] Job ${jobId} not found for failure handling`);
      await this.redis.lRem(`queue:${queueName}:processing`, 0, jobId);
      return;
    }

    const attempts = parseInt(jobHash.attempts || '0');
    const maxRetries = parseInt(jobHash.maxRetries || String(this.maxRetries));

    console.error(`[Queue] Job ${jobId} failed (attempt ${attempts}/${maxRetries}):`, error.message);

    // Update job with error info
    await this.redis.hSet(jobKey, {
      status: 'failed',
      lastError: error.message,
      lastErrorAt: String(Date.now()),
      updatedAt: String(Date.now()),
    });

    // Remove from processing list
    await this.redis.lRem(`queue:${queueName}:processing`, 0, jobId);

    if (attempts < maxRetries) {
      // Retry with exponential backoff
      const delayIndex = Math.min(attempts - 1, this.retryDelays.length - 1);
      const delay = this.retryDelays[delayIndex];
      const processAt = Date.now() + delay;

      await this.redis.zAdd(`queue:${queueName}:delayed`, {
        score: processAt,
        value: jobId,
      });

      await this.redis.hSet(jobKey, {
        status: 'retrying',
        retryAt: String(processAt),
      });

      console.log(`[Queue] Job ${jobId} will retry in ${delay}ms (attempt ${attempts + 1}/${maxRetries})`);
    } else {
      // Max retries exceeded: Move to dead letter queue
      await this.redis.rPush(`queue:${queueName}:failed`, jobId);
      await this.redis.hSet(jobKey, {
        status: 'dead',
        failedAt: String(Date.now()),
      });

      // Keep failed jobs for 7 days for investigation
      await this.redis.expire(jobKey, 60 * 60 * 24 * 7);

      console.error(`[Queue] Job ${jobId} moved to dead letter queue after ${maxRetries} failures`);
    }
  }

  /**
   * Process delayed jobs that are ready to run
   * @param {string} queueName - Queue name
   */
  async processDelayedJobs(queueName) {
    const now = Date.now();
    const delayedKey = `queue:${queueName}:delayed`;

    // Get all jobs with score <= now (ready to process)
    const readyJobs = await this.redis.zRangeByScore(delayedKey, 0, now);

    if (readyJobs.length === 0) {
      return;
    }

    console.log(`[Queue] Processing ${readyJobs.length} delayed jobs for ${queueName}`);

    for (const jobId of readyJobs) {
      // Move from delayed to pending
      await this.redis.zRem(delayedKey, jobId);
      await this.redis.rPush(`queue:${queueName}:pending`, jobId);

      // Update job status
      const jobKey = `queue:${queueName}:job:${jobId}`;
      await this.redis.hSet(jobKey, {
        status: 'pending',
        updatedAt: String(Date.now()),
      });
    }
  }

  /**
   * Get queue statistics
   * @param {string} queueName - Queue name
   * @returns {Promise<object>} Queue stats
   */
  async getStats(queueName) {
    const [pending, processing, delayed, failed] = await Promise.all([
      this.redis.lLen(`queue:${queueName}:pending`),
      this.redis.lLen(`queue:${queueName}:processing`),
      this.redis.zCard(`queue:${queueName}:delayed`),
      this.redis.lLen(`queue:${queueName}:failed`),
    ]);

    return {
      pending,
      processing,
      delayed,
      failed,
      total: pending + processing + delayed + failed,
    };
  }

  /**
   * Purge a queue (removes all jobs)
   * @param {string} queueName - Queue name
   */
  async purge(queueName) {
    const keys = [
      `queue:${queueName}:pending`,
      `queue:${queueName}:processing`,
      `queue:${queueName}:delayed`,
      `queue:${queueName}:failed`,
    ];

    for (const key of keys) {
      await this.redis.del(key);
    }

    console.log(`[Queue] Purged queue: ${queueName}`);
  }
}

/**
 * Create a queue service instance
 * @param {object} redisClient - Redis client (from env.REDIS)
 * @returns {QueueService}
 */
export function createQueueService(redisClient) {
  return new QueueService(redisClient);
}

export default QueueService;
