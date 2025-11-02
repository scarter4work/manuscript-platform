// Queue consumer for async manuscript analysis
// This runs each analysis job in the background

import { DevelopmentalAgent } from './developmental-agent.js';
import { LineEditingAgent } from './line-editing-agent.js';
import { CopyEditingAgent } from './copy-editing-agent.js';

export default {
  async queue(batch, env) {
    console.log(`Processing ${batch.messages.length} queued analysis jobs`);
    
    for (const message of batch.messages) {
      try {
        const { manuscriptKey, genre, styleGuide, reportId } = message.body;
        
        console.log(`Starting analysis for ${manuscriptKey}`);
        
        // Update status to "running"
        await updateStatus(env, reportId, 'running', 0, 'Starting analysis...');
        
        // Run developmental analysis (33%)
        console.log('Running developmental analysis...');
        const devAgent = new DevelopmentalAgent(env);
        const devAnalysis = await devAgent.analyze(manuscriptKey, genre || 'general');
        await updateStatus(env, reportId, 'running', 33, 'Developmental analysis complete');
        
        // Run line editing analysis (66%)
        console.log('Running line editing analysis...');
        const lineAgent = new LineEditingAgent(env);
        const lineAnalysis = await lineAgent.analyze(manuscriptKey, genre || 'general');
        await updateStatus(env, reportId, 'running', 66, 'Line editing analysis complete');
        
        // Run copy editing analysis (100%)
        console.log('Running copy editing analysis...');
        const copyAgent = new CopyEditingAgent(env);
        const copyAnalysis = await copyAgent.analyze(manuscriptKey, styleGuide || 'chicago');
        await updateStatus(env, reportId, 'complete', 100, 'All analyses complete!');
        
        console.log(`Analysis complete for ${manuscriptKey}`);
        message.ack();
        
      } catch (error) {
        console.error('Queue processing error:', error);
        await updateStatus(env, message.body.reportId, 'error', 0, error.message);
        message.retry();
      }
    }
  }
};

async function updateStatus(env, reportId, status, progress, message) {
  const statusData = {
    status: status,
    progress: progress,
    message: message,
    timestamp: new Date().toISOString()
  };
  
  await env.MANUSCRIPTS_RAW.put(
    `status:${reportId}`,
    JSON.stringify(statusData),
    {
      expirationTtl: 60 * 60 * 24 * 7 // 7 days
    }
  );
}
