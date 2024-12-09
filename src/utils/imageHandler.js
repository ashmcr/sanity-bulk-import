import fetch from 'node-fetch';
import path from 'path';
import logger from './logger.js';
import sanityClient from './sanityClient.js';

class ImageHandler {
  constructor() {
    this.client = sanityClient.client;
  }

  async uploadImageFromUrl(imageUrl, options = {}) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const buffer = await response.buffer();
      const filename = path.basename(imageUrl);

      return await this.client.assets.upload('image', buffer, {
        filename,
        ...options
      });
    } catch (error) {
      logger.error('Image upload failed', { imageUrl, error: error.message });
      throw error;
    }
  }

  async uploadMultipleImages(imageUrls, options = {}) {
    const results = await Promise.allSettled(
      imageUrls.map(url => this.uploadImageFromUrl(url, options))
    );

    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => ({
        _type: 'image',
        asset: {
          _type: 'reference',
          _ref: result.value._id
        }
      }));

    const failed = results
      .filter(result => result.status === 'rejected')
      .map(result => ({
        url: imageUrls[results.indexOf(result)],
        error: result.reason.message
      }));

    if (failed.length > 0) {
      logger.warn('Some images failed to upload', { failed });
    }

    return { successful, failed };
  }
}

export default new ImageHandler(); 