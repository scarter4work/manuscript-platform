// Cover Generation Agent
// Generates actual cover images using AI (DALL-E 3) based on cover design briefs
// This creates professional cover options that authors can download and use

import OpenAI from 'openai';
import {
  validateRequiredFields,
  storeAsset
} from './agent-utils.js';
import { logCost } from './cost-utils.js';

export class CoverGenerationAgent {
  constructor(env) {
    this.env = env;
    this.openaiApiKey = env.OPENAI_API_KEY;
    this.agentName = 'CoverGenerationAgent';
  }

  /**
   * Generate actual cover images from a cover design brief
   *
   * @param {string} manuscriptKey - R2 storage key for the manuscript
   * @param {Object} coverBrief - Cover design brief from CoverDesignAgent
   * @param {string} title - Book title for text overlay
   * @param {string} authorName - Author name for text overlay
   * @param {number} numVariations - Number of variations to generate (default: 3)
   * @param {string} userId - User ID for cost tracking
   * @param {string} manuscriptId - Manuscript ID for cost tracking
   * @returns {Promise<Object>} Generated cover images with URLs
   * @throws {Error} If API key is missing or generation fails
   */
  async generate(manuscriptKey, coverBrief, title, authorName, numVariations = 3, userId = null, manuscriptId = null) {
    console.log(`${this.agentName}: Starting generation for ${manuscriptKey}`);

    // Store for cost tracking
    this.userId = userId;
    this.manuscriptId = manuscriptId;

    // Ensure API key is available
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured in environment variables');
    }

    // Validate cover brief
    validateRequiredFields(
      coverBrief,
      ['visualConcept', 'colorPalette', 'aiArtPrompts'],
      'Cover Brief'
    );

    // Validate number of variations (limit to 5 for cost control)
    numVariations = Math.min(Math.max(numVariations, 1), 5);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: this.openaiApiKey
    });

    // Generate cover variations
    const coverImages = [];
    const errors = [];

    for (let i = 0; i < numVariations; i++) {
      try {
        console.log(`${this.agentName}: Generating variation ${i + 1}/${numVariations}`);

        // Create prompt based on cover brief
        const prompt = this.buildImagePrompt(coverBrief, title, authorName, i);

        // Generate image with DALL-E 3
        const image = await this.generateImage(openai, prompt);

        // Store image in R2
        const storedImage = await this.storeImage(manuscriptKey, image, i);

        coverImages.push(storedImage);

        // Small delay between requests to avoid rate limiting
        if (i < numVariations - 1) {
          await this.sleep(2000); // 2 second delay
        }
      } catch (error) {
        console.error(`${this.agentName}: Failed to generate variation ${i + 1}:`, error);
        errors.push({
          variation: i + 1,
          error: error.message
        });
      }
    }

    // Check if we generated at least one image
    if (coverImages.length === 0) {
      throw new Error(`Failed to generate any cover images. Errors: ${JSON.stringify(errors)}`);
    }

    // Prepare result
    const result = {
      manuscriptKey,
      title,
      authorName,
      coverImages,
      requested: numVariations,
      generated: coverImages.length,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    };

    // Store metadata in R2
    await storeAsset(
      this.env.MANUSCRIPTS_PROCESSED,
      manuscriptKey,
      'cover-images',
      result
    );

    return result;
  }

  /**
   * Build DALL-E 3 prompt from cover brief
   * @private
   */
  buildImagePrompt(coverBrief, title, authorName, variationIndex) {
    const { visualConcept, colorPalette, moodAtmosphere, designElements, aiArtPrompts } = coverBrief;

    // Use the pre-generated DALL-E prompt as base
    let basePrompt = aiArtPrompts.dalle || aiArtPrompts.midjourney || '';

    // For variations, slightly modify the prompt
    const variationPrompts = [
      `Professional book cover design. ${basePrompt}`,
      `Bestselling book cover art style. ${basePrompt}`,
      `Award-winning book cover design. ${basePrompt}`,
      `Premium book cover illustration. ${basePrompt}`,
      `High-end publishing book cover. ${basePrompt}`
    ];

    let prompt = variationPrompts[variationIndex % variationPrompts.length];

    // Add title and author name to the image
    prompt += ` Include the book title "${title}" prominently at the top in bold, elegant typography.`;
    prompt += ` Include the author name "${authorName}" at the bottom in a complementary font.`;

    // Add color guidance
    if (colorPalette.overall) {
      prompt += ` Color scheme: ${colorPalette.overall}.`;
    }

    // Add mood
    if (moodAtmosphere) {
      prompt += ` Mood: ${moodAtmosphere}.`;
    }

    // Add composition guidance
    if (visualConcept.composition) {
      prompt += ` Composition: ${visualConcept.composition}.`;
    }

    // Add design elements
    if (designElements && designElements.length > 0) {
      prompt += ` Include: ${designElements.slice(0, 2).join(', ')}.`;
    }

    // Ensure it looks like a book cover
    prompt += ' Professional book cover format, suitable for Amazon KDP. High quality, print-ready design.';

    return prompt;
  }

  /**
   * Generate a single image with DALL-E 3
   * @private
   */
  async generateImage(openai, prompt) {
    const startTime = Date.now();

    try {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1792', // Portrait orientation, closest to book cover ratio
        quality: 'hd', // High quality for cover images
        response_format: 'url' // Get URL to download image
      });

      const duration = Date.now() - startTime;

      // Extract image URL
      const imageUrl = response.data[0].url;
      const revisedPrompt = response.data[0].revised_prompt;

      // Track cost (DALL-E 3 HD pricing: $0.080 per image for 1024x1792)
      await this.trackCost(0.080, prompt, revisedPrompt);

      return {
        url: imageUrl,
        prompt: prompt,
        revisedPrompt: revisedPrompt,
        model: 'dall-e-3',
        size: '1024x1792',
        quality: 'hd',
        duration: duration
      };

    } catch (error) {
      console.error(`${this.agentName}: Image generation failed:`, error);
      throw new Error(`DALL-E 3 generation failed: ${error.message}`);
    }
  }

  /**
   * Download and store image in R2
   * @private
   */
  async storeImage(manuscriptKey, imageData, variationIndex) {
    try {
      // Download the image from DALL-E URL
      const imageResponse = await fetch(imageData.url);
      if (!imageResponse.ok) {
        throw new Error(`Failed to download image: ${imageResponse.statusText}`);
      }

      const imageBuffer = await imageResponse.arrayBuffer();

      // Generate R2 key
      const processedKey = manuscriptKey.replace('MANUSCRIPTS_RAW', 'PROCESSED');
      const imageKey = `${processedKey}-cover-variation-${variationIndex + 1}.png`;

      // Store in R2
      await this.env.MANUSCRIPTS_PROCESSED.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: 'image/png'
        },
        customMetadata: {
          manuscriptKey: manuscriptKey,
          variation: String(variationIndex + 1),
          model: imageData.model,
          size: imageData.size,
          timestamp: new Date().toISOString()
        }
      });

      // Return stored image info
      return {
        variationNumber: variationIndex + 1,
        r2Key: imageKey,
        originalUrl: imageData.url,
        prompt: imageData.prompt,
        revisedPrompt: imageData.revisedPrompt,
        size: imageData.size,
        quality: imageData.quality,
        duration: imageData.duration
      };

    } catch (error) {
      console.error(`${this.agentName}: Failed to store image:`, error);
      throw error;
    }
  }

  /**
   * Track cost of image generation
   * @private
   */
  async trackCost(costUSD, prompt, revisedPrompt) {
    try {
      await logCost(this.env, {
        userId: this.userId,
        manuscriptId: this.manuscriptId,
        costCenter: 'openai_api',
        featureName: 'cover_generation',
        operation: 'generate_cover_image',
        costUSD: costUSD,
        metadata: {
          model: 'dall-e-3',
          size: '1024x1792',
          quality: 'hd',
          promptLength: prompt.length,
          revisedPromptLength: revisedPrompt?.length || 0
        }
      });
    } catch (error) {
      console.error(`${this.agentName}: Failed to track cost:`, error);
      // Don't throw - cost tracking failure shouldn't break image generation
    }
  }

  /**
   * Sleep utility for rate limiting
   * @private
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
