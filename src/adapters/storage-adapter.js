/**
 * Backblaze B2 adapter that provides R2-compatible API
 * Wraps AWS S3 SDK to match Cloudflare R2 interface
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';

class StorageAdapter {
  constructor(config) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true, // Required for B2 compatibility
    });

    this.buckets = config.buckets;
  }

  /**
   * Get bucket wrapper (R2-compatible interface)
   * @param {string} bucketName - Name of the bucket
   * @returns {Bucket}
   */
  bucket(bucketName) {
    return new Bucket(this.client, bucketName);
  }

  /**
   * Get bucket by key (convenience method)
   * @param {string} key - Bucket key (manuscripts_raw, manuscripts_processed, marketing_assets, backups)
   * @returns {Bucket}
   */
  getBucket(key) {
    const bucketName = this.buckets[key];
    if (!bucketName) {
      throw new Error(`Unknown bucket key: ${key}`);
    }
    return this.bucket(bucketName);
  }
}

class Bucket {
  constructor(client, bucketName) {
    this.client = client;
    this.bucketName = bucketName;
  }

  /**
   * Put an object in the bucket (R2-compatible)
   * @param {string} key - Object key
   * @param {Buffer|string|ReadableStream} value - Object data
   * @param {Object} options - Additional options
   * @returns {Promise<void>}
   */
  async put(key, value, options = {}) {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: value,
        ContentType: options.httpMetadata?.contentType || 'application/octet-stream',
        Metadata: options.customMetadata || {},
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Storage put error:', error);
      throw new Error(`Failed to put object ${key}: ${error.message}`);
    }
  }

  /**
   * Get an object from the bucket (R2-compatible)
   * @param {string} key - Object key
   * @returns {Promise<R2Object|null>}
   */
  async get(key) {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      // Convert stream to buffer for compatibility
      const chunks = [];
      for await (const chunk of response.Body) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);

      return {
        key,
        version: response.VersionId || '',
        size: response.ContentLength,
        etag: response.ETag,
        httpMetadata: {
          contentType: response.ContentType,
          contentDisposition: response.ContentDisposition,
          contentEncoding: response.ContentEncoding,
          contentLanguage: response.ContentLanguage,
        },
        customMetadata: response.Metadata || {},
        uploaded: new Date(response.LastModified),
        body,
        bodyUsed: false,
        arrayBuffer: async () => body,
        text: async () => body.toString('utf-8'),
        json: async () => JSON.parse(body.toString('utf-8')),
        blob: async () => new Blob([body]),
      };
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error('Storage get error:', error);
      throw new Error(`Failed to get object ${key}: ${error.message}`);
    }
  }

  /**
   * Delete an object from the bucket (R2-compatible)
   * @param {string} key - Object key
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
    } catch (error) {
      console.error('Storage delete error:', error);
      throw new Error(`Failed to delete object ${key}: ${error.message}`);
    }
  }

  /**
   * Head an object (get metadata without body) (R2-compatible)
   * @param {string} key - Object key
   * @returns {Promise<R2Object|null>}
   */
  async head(key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        key,
        version: response.VersionId || '',
        size: response.ContentLength,
        etag: response.ETag,
        httpMetadata: {
          contentType: response.ContentType,
          contentDisposition: response.ContentDisposition,
          contentEncoding: response.ContentEncoding,
          contentLanguage: response.ContentLanguage,
        },
        customMetadata: response.Metadata || {},
        uploaded: new Date(response.LastModified),
      };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }
      console.error('Storage head error:', error);
      throw new Error(`Failed to head object ${key}: ${error.message}`);
    }
  }

  /**
   * List objects in the bucket (R2-compatible)
   * @param {Object} options - List options
   * @returns {Promise<R2Objects>}
   */
  async list(options = {}) {
    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: options.prefix || '',
        MaxKeys: options.limit || 1000,
        ContinuationToken: options.cursor,
        Delimiter: options.delimiter,
      });

      const response = await this.client.send(command);

      const objects = (response.Contents || []).map(item => ({
        key: item.Key,
        version: '',
        size: item.Size,
        etag: item.ETag,
        uploaded: new Date(item.LastModified),
      }));

      return {
        objects,
        truncated: response.IsTruncated || false,
        cursor: response.NextContinuationToken,
        delimitedPrefixes: response.CommonPrefixes?.map(p => p.Prefix) || [],
      };
    } catch (error) {
      console.error('Storage list error:', error);
      throw new Error(`Failed to list objects: ${error.message}`);
    }
  }
}

/**
 * Create storage adapter instance
 * @param {Object} env - Environment variables
 * @returns {StorageAdapter}
 */
export function createStorageAdapter(env) {
  const config = {
    endpoint: env.B2_ENDPOINT?.trim(),
    region: env.B2_REGION?.trim(),
    accessKeyId: env.B2_ACCESS_KEY_ID?.trim(),
    secretAccessKey: env.B2_SECRET_ACCESS_KEY?.trim(),
    buckets: {
      manuscripts_raw: env.B2_BUCKET_MANUSCRIPTS_RAW?.trim(),
      manuscripts_processed: env.B2_BUCKET_MANUSCRIPTS_PROCESSED?.trim(),
      marketing_assets: env.B2_BUCKET_MARKETING_ASSETS?.trim(),
      backups: env.B2_BUCKET_BACKUPS?.trim(),
    }
  };

  // Validate configuration
  const envVarMap = {
    endpoint: 'B2_ENDPOINT',
    region: 'B2_REGION',
    accessKeyId: 'B2_ACCESS_KEY_ID',
    secretAccessKey: 'B2_SECRET_ACCESS_KEY'
  };

  for (const key in envVarMap) {
    if (!config[key]) {
      throw new Error(`${envVarMap[key]} environment variable is required`);
    }
  }

  // Debug: Log masked credentials (first 4 chars only for security)
  console.log('[StorageAdapter] B2 Configuration:');
  console.log(`  Endpoint: ${config.endpoint}`);
  console.log(`  Region: ${config.region}`);
  console.log(`  Access Key ID: ${config.accessKeyId?.substring(0, 4)}... (length: ${config.accessKeyId?.length})`);
  console.log(`  Secret Key: ${config.secretAccessKey ? `***set*** (length: ${config.secretAccessKey.length})` : '***missing***'}`);

  // Enhanced diagnostics for credential issues
  if (config.accessKeyId) {
    const keyId = config.accessKeyId;
    console.log('[StorageAdapter] Access Key ID Diagnostics:');
    console.log(`  First 8 chars: "${keyId.substring(0, 8)}"`);
    console.log(`  Last 8 chars: "${keyId.substring(keyId.length - 8)}"`);
    console.log(`  Contains spaces: ${keyId.includes(' ')}`);
    console.log(`  Contains newlines: ${keyId.includes('\n') || keyId.includes('\r')}`);
    console.log(`  Contains tabs: ${keyId.includes('\t')}`);

    // Check for non-printable characters
    const nonPrintable = keyId.split('').filter(char => {
      const code = char.charCodeAt(0);
      return code < 32 || code > 126;
    });
    if (nonPrintable.length > 0) {
      console.log(`  Non-printable chars: ${nonPrintable.length} found`);
      console.log(`  Char codes: ${nonPrintable.map(c => c.charCodeAt(0)).join(', ')}`);
    }

    // Expected B2 S3-compatible key format: 25 chars starting with '000' or '005'
    if (keyId.length !== 25) {
      console.log(`  ⚠ WARNING: Expected length 25, got ${keyId.length}`);
    }
    if (!keyId.startsWith('000') && !keyId.startsWith('005')) {
      console.log(`  ⚠ WARNING: Expected prefix '000' or '005', got '${keyId.substring(0, 3)}'`);
    }
  }

  return new StorageAdapter(config);
}

export default StorageAdapter;
