# Async Processing & Queue Architecture (MAN-11)

## Overview

The Manuscript Platform uses **Cloudflare Queues** for asynchronous processing of long-running operations. Queues enable background processing without blocking user requests, avoiding the 10ms CPU limit for Workers.

**Queues**:
- `manuscript-analysis-queue`: Core analysis (developmental, line, copy editing)
- `asset-generation-queue`: Marketing asset generation

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER REQUEST                             │
│  POST /manuscripts (upload manuscript)                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    WORKER (Main Router)                         │
│  1. Store file in R2 (MANUSCRIPTS_RAW)                          │
│  2. Create manuscript record in D1                              │
│  3. Enqueue analysis job → ANALYSIS_QUEUE                       │
│  4. Return 202 Accepted with reportId                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              ANALYSIS QUEUE CONSUMER                            │
│  (Runs in background, no CPU limit)                            │
│                                                                 │
│  Sequential Processing:                                         │
│  1. Developmental Agent (3-5 min)                              │
│  2. Line Editing Agent (4-6 min)                               │
│  3. Copy Editing Agent (3-5 min)                               │
│                                                                 │
│  Total Duration: 10-15 minutes                                 │
│  Status updates written to R2 every step                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│   ANALYSIS COMPLETE → Enqueue Asset Generation                  │
│   ASSET_QUEUE.send({ manuscriptKey, reportId, genre })         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           ASSET GENERATION QUEUE CONSUMER                       │
│  (Runs in parallel for faster completion)                      │
│                                                                 │
│  Parallel Processing (7 agents):                               │
│  - Book Description Agent                                      │
│  - Keyword Agent                                               │
│  - Category Agent                                              │
│  - Author Bio Agent                                            │
│  - Back Matter Agent                                           │
│  - Cover Design Agent                                          │
│  - Series Description Agent                                    │
│                                                                 │
│  Total Duration: ~2-3 minutes                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND POLLING                             │
│  GET /manuscripts/:id/analysis-status                          │
│  Polls every 5 seconds until status = 'complete'               │
│  Fetches results from R2 when done                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Queue Configuration

### wrangler.toml

```toml
# Analysis Queue Producer
[[queues.producers]]
queue = "manuscript-analysis-queue"
binding = "ANALYSIS_QUEUE"

# Analysis Queue Consumer
[[queues.consumers]]
queue = "manuscript-analysis-queue"
max_batch_size = 1              # Process one manuscript at a time
max_batch_timeout = 60          # Wait up to 60 seconds before processing
max_retries = 3                 # Retry failed jobs up to 3 times
dead_letter_queue = "manuscript-analysis-dlq"  # Failed jobs go here

# Asset Generation Queue Producer
[[queues.producers]]
queue = "asset-generation-queue"
binding = "ASSET_QUEUE"

# Asset Generation Queue Consumer
[[queues.consumers]]
queue = "asset-generation-queue"
max_batch_size = 1
max_batch_timeout = 60
max_retries = 2                 # Fewer retries (faster failure)
dead_letter_queue = "asset-generation-dlq"
```

### Configuration Parameters

**max_batch_size**: Number of messages to process at once
- Set to 1 for manuscript analysis (each takes 10-15 minutes)
- Could increase for shorter jobs

**max_batch_timeout**: Wait time before processing incomplete batch
- Set to 60 seconds (balance between latency and batching)

**max_retries**: Automatic retry attempts on failure
- Analysis queue: 3 retries (transient Claude API errors)
- Asset queue: 2 retries (faster failure detection)

**dead_letter_queue**: Where permanently failed jobs go
- Requires manual intervention to process
- Monitor DLQ depth as an alert metric

---

## Message Formats

### Analysis Queue Message

```json
{
  "manuscriptKey": "userId/manuscriptId/filename.txt",
  "genre": "thriller",
  "styleGuide": "chicago",
  "reportId": "short-id-12345"
}
```

**Fields**:
- `manuscriptKey`: R2 path to raw manuscript file
- `genre`: Used by analysis agents for context
- `styleGuide`: Chicago Manual of Style, AP, or custom
- `reportId`: Short ID for status tracking (shown to user)

### Asset Generation Queue Message

```json
{
  "manuscriptKey": "userId/manuscriptId/filename.txt",
  "reportId": "short-id-12345",
  "genre": "thriller",
  "authorData": {
    "name": "Jane Doe",
    "previousBooks": ["Book 1", "Book 2"]
  },
  "seriesData": {
    "seriesName": "My Series",
    "bookNumber": 2
  }
}
```

**Fields**:
- `manuscriptKey`, `reportId`, `genre`: Same as analysis message
- `authorData`: Optional author info for bio generation
- `seriesData`: Optional series info for series description

---

## Queue Consumer Patterns

### Pattern 1: Sequential Processing (Analysis Queue)

**When**: Tasks must run in order, each depends on previous output

```javascript
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { manuscriptKey, genre, reportId } = message.body;

        // Step 1: Developmental Analysis
        await updateStatus(env, reportId, { progress: 5 });
        const devAnalysis = await devAgent.analyze(manuscriptKey, genre);

        // Step 2: Line Editing (uses dev analysis results)
        await updateStatus(env, reportId, { progress: 33 });
        const lineAnalysis = await lineAgent.analyze(manuscriptKey, genre);

        // Step 3: Copy Editing (uses both previous results)
        await updateStatus(env, reportId, { progress: 66 });
        const copyAnalysis = await copyAgent.analyze(manuscriptKey, styleGuide);

        // Mark complete
        await updateStatus(env, reportId, { status: 'complete', progress: 100 });

        // Chain next queue
        await env.ASSET_QUEUE.send({ manuscriptKey, reportId, genre });

        message.ack();  // Acknowledge successful processing
      } catch (error) {
        console.error('Processing error:', error);
        message.retry();  // Retry automatically
      }
    }
  }
};
```

**Benefits**:
- Simple error handling (retry entire job)
- Easy progress tracking
- Each agent can use previous results

**Trade-offs**:
- Slower (sequential, not parallel)
- Single failure retries entire sequence

---

### Pattern 2: Parallel Processing (Asset Generation Queue)

**When**: Tasks are independent, can run concurrently

```javascript
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        const { manuscriptKey, reportId, genre, authorData } = message.body;

        // Load shared input (dev analysis)
        const devAnalysis = await loadAnalysis(env, manuscriptKey);

        // Run all 7 agents in parallel
        const [
          bookDescription,
          keywords,
          categories,
          authorBio,
          backMatter,
          coverDesign,
          seriesDesc
        ] = await Promise.all([
          bookDescAgent.generate(manuscriptKey, devAnalysis, genre),
          keywordAgent.generate(devAnalysis, genre),
          categoryAgent.generate(devAnalysis, genre),
          authorBioAgent.generate(authorData),
          backMatterAgent.generate(authorData),
          coverDesignAgent.generate(devAnalysis, genre),
          seriesDescAgent.generate(devAnalysis, seriesData)
        ]);

        // Store all results
        await storeAssets(env, manuscriptKey, { bookDescription, keywords, ... });

        message.ack();
      } catch (error) {
        console.error('Asset generation error:', error);
        message.retry();
      }
    }
  }
};
```

**Benefits**:
- 7x faster than sequential (2-3 min vs 15-20 min)
- Independent failures don't affect others
- Better resource utilization

**Trade-offs**:
- Higher memory usage (7 concurrent API calls)
- More complex error handling

---

## Status Updates

### Status Storage

**Location**: R2 bucket (`MANUSCRIPTS_PROCESSED`)

**Key Pattern**: `{reportId}-status.json`

**Example Status Object**:
```json
{
  "status": "processing",
  "progress": 33,
  "message": "Developmental analysis complete. Starting line editing...",
  "currentStep": "line-editing",
  "timestamp": "2025-10-28T12:34:56.789Z",
  "completedAt": null,
  "error": null
}
```

### Status Values

- `queued`: Message enqueued, waiting to be processed
- `processing`: Consumer actively working on job
- `complete`: All steps finished successfully
- `failed`: Unrecoverable error, check `error` field

### Update Function

```javascript
async function updateStatus(env, reportId, updates) {
  const key = `${reportId}-status.json`;

  // Get existing status
  const existing = await env.MANUSCRIPTS_PROCESSED.get(key, 'json') || {};

  // Merge updates
  const newStatus = {
    ...existing,
    ...updates,
    timestamp: new Date().toISOString()
  };

  // Save back to R2
  await env.MANUSCRIPTS_PROCESSED.put(key, JSON.stringify(newStatus), {
    httpMetadata: { contentType: 'application/json' }
  });
}
```

---

## Error Handling & Retries

### Automatic Retries

Cloudflare Queues automatically retries failed messages based on `max_retries` config:

```javascript
try {
  await processMessage(message);
  message.ack();  // Success
} catch (error) {
  console.error('Error:', error);
  message.retry();  // Automatic retry (up to max_retries)
}
```

**Retry Delays**: Exponential backoff
- 1st retry: ~1 minute
- 2nd retry: ~5 minutes
- 3rd retry: ~15 minutes

### Dead Letter Queue

After `max_retries` exhausted, message moves to DLQ:

**DLQ Names**:
- `manuscript-analysis-dlq`
- `asset-generation-dlq`

**Monitoring**:
```bash
wrangler queues consumer worker list manuscript-analysis-queue
```

**Manual Reprocessing**:
1. Inspect DLQ message
2. Fix underlying issue (e.g., API key, quota)
3. Re-enqueue message manually

### Error Types

**Transient Errors** (retry automatically):
- Claude API rate limits (429)
- Network timeouts
- Temporary service outages

**Permanent Errors** (fail immediately):
- Invalid manuscript format
- Missing API keys
- Malformed message payload

**Best Practice**: Detect permanent errors early to avoid wasting retries:

```javascript
if (!env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY not set');
  await updateStatus(env, reportId, { status: 'failed', error: 'API key missing' });
  message.ack();  // Don't retry
  return;
}
```

---

## Monitoring & Observability

### Key Metrics

1. **Queue Depth**: Number of messages waiting
   ```bash
   wrangler queues list
   ```

2. **Processing Time**: Time from enqueue to ack
   - Target: <15 minutes for analysis
   - Target: <3 minutes for assets

3. **Failure Rate**: Failed messages / total messages
   - Target: <1% failure rate

4. **DLQ Size**: Number of permanently failed jobs
   - Alert if DLQ depth > 10

### Cloudflare Analytics

**Dashboard Metrics**:
- Messages sent/received per minute
- Average processing time
- Error rate
- Consumer worker invocations

### Custom Logging

```javascript
console.log(`[Queue Consumer] Processing ${manuscriptKey}`);
console.log(`[Queue Consumer] Step 1 complete: ${duration}ms`);
console.error(`[Queue Consumer] Error:`, error);
```

**Log Search**: Cloudflare Dashboard → Workers → Logs

---

## Scaling

### Current Limits

**Free Tier**:
- 10,000 messages per day
- 100 concurrent consumer workers

**Current Usage** (~50 manuscripts/day):
- Analysis queue: 50 messages/day
- Asset queue: 50 messages/day
- **Total**: 100 messages/day (1% of free tier)

### Scaling Strategy

**At 1,000 manuscripts/day**:
- 2,000 messages/day (20% of free tier)
- Increase `max_batch_size` to 5 for asset generation
- Keep sequential processing for analysis (quality > speed)

**At 10,000+ manuscripts/day**:
- Upgrade to paid tier (unlimited messages)
- Consider splitting analysis into separate queues per agent
- Implement priority queuing (paid users first)

---

## Performance Optimization

### 1. Reduce Status Update Frequency

**Current**: Update every 5% progress

**Optimization**: Update only on major milestones (0%, 33%, 66%, 100%)

**Benefit**: Fewer R2 writes, faster processing

### 2. Cache Analysis Results

**Problem**: Same manuscript analyzed multiple times

**Solution**: Hash manuscript content, cache results by hash

```javascript
const hash = await calculateHash(manuscriptContent);
const cached = await env.CACHE_KV.get(`analysis:${hash}`);
if (cached) return JSON.parse(cached);
```

### 3. Parallel Agent Processing

**Current**: Developmental → Line → Copy (sequential)

**Future**: Run all 3 in parallel, merge results

**Trade-off**: Higher memory, risk of API rate limits

---

## Cost Analysis

### Per Manuscript

**Queue Operations**:
- Enqueue analysis: Free
- Enqueue assets: Free
- 2 consumer invocations: Free (within limits)

**Storage Operations** (status updates):
- ~10 R2 writes per manuscript
- Cost: ~$0.0001 (negligible)

**Total Queue Cost**: $0 (within free tier)

### AI API Costs

Actual costs are in API calls, not queuing:
- Claude API: $5-8 per manuscript
- DALL-E 3: $0.24 per manuscript
- **Total**: ~$8.24 per manuscript

---

## Testing

### Local Testing

**Miniflare** (local D1/R2/Queues simulation):

```bash
npm run dev
```

**Send Test Message**:
```javascript
await env.ANALYSIS_QUEUE.send({
  manuscriptKey: 'test/123/sample.txt',
  genre: 'thriller',
  styleGuide: 'chicago',
  reportId: 'test-report-123'
});
```

### Integration Testing

```javascript
describe('Analysis Queue Consumer', () => {
  it('should process manuscript analysis', async () => {
    const message = {
      body: {
        manuscriptKey: 'test/123/sample.txt',
        genre: 'thriller',
        reportId: 'test-123'
      },
      ack: jest.fn(),
      retry: jest.fn()
    };

    await queueConsumer.queue({ messages: [message] }, env);

    expect(message.ack).toHaveBeenCalled();

    // Verify status updates
    const status = await env.MANUSCRIPTS_PROCESSED.get('test-123-status.json', 'json');
    expect(status.status).toBe('complete');
  });
});
```

---

## Troubleshooting

### Issue: Messages stuck in queue

**Symptoms**: Queue depth increasing, no processing

**Diagnosis**:
```bash
wrangler queues consumer worker list manuscript-analysis-queue
```

**Solutions**:
- Check consumer worker is deployed
- Check for errors in worker logs
- Verify queue binding in wrangler.toml

---

### Issue: Analysis never completes

**Symptoms**: Status stuck at "processing", never reaches "complete"

**Diagnosis**:
1. Check R2 for status file: `{reportId}-status.json`
2. Check worker logs for errors
3. Check DLQ for failed messages

**Solutions**:
- Claude API key missing/invalid
- Manuscript file not found in R2
- Consumer worker crashed (check logs)

---

### Issue: High DLQ depth

**Symptoms**: Many messages in dead letter queue

**Diagnosis**:
```bash
wrangler queues consumer worker dead-letter manuscript-analysis-queue
```

**Common Causes**:
- API quota exceeded
- Invalid message format
- Missing environment variables

**Solutions**:
- Fix root cause
- Manually reprocess DLQ messages
- Consider increasing `max_retries` for transient errors

---

## Future Enhancements

### 1. Priority Queuing (MAN-54)
- Separate queues for free vs paid users
- Paid users processed first
- Free tier rate-limited to prevent abuse

### 2. Real-Time Progress (MAN-55)
- WebSocket/SSE for live updates
- Replace polling with push notifications
- Better UX for long-running jobs

### 3. Queue Analytics Dashboard (MAN-56)
- Custom metrics
- Processing time percentiles (p50, p95, p99)
- Cost per message
- Failure rate trends

### 4. Smart Retries (MAN-57)
- Detect permanent vs transient errors
- Different retry strategies per error type
- Exponential backoff with jitter

---

## References

- [Cloudflare Queues Documentation](https://developers.cloudflare.com/queues/)
- [Queue Best Practices](https://developers.cloudflare.com/queues/platform/best-practices/)
- [Workers CPU Limits](https://developers.cloudflare.com/workers/platform/limits/)

---

**Last Updated**: 2025-10-28
**Author**: System Documentation (MAN-11)
**Version**: 1.0
