import { validators, ValidationError } from '../utils/validation.js';
import logger from '../utils/logger.js';
import sanityClient from '../utils/sanityClient.js';
import config from '../utils/config.js';
import imageHandler from '../utils/imageHandler.js';

class ListingImporter {
  constructor() {
    this.type = 'listing';
    this.requiredFields = ['title', 'email'];
  }

  async validateCategories(categoryIds) {
    if (!categoryIds || !categoryIds.length) return [];

    const validCategories = await Promise.all(
      categoryIds.map(async (id) => {
        try {
          const category = await sanityClient.fetch(
            '*[_type == "category" && _id == $id][0]',
            { id }
          );

          if (!category) {
            throw new Error(`Category ${id} not found`);
          }

          return {
            _type: 'reference',
            _ref: id
          };
        } catch (error) {
          logger.warn(`Invalid category reference: ${id}`, { error: error.message });
          return null;
        }
      })
    );

    return validCategories.filter(Boolean);
  }

  async validate(data) {
    try {
      // Validate required fields
      this.requiredFields.forEach(field => {
        validators.required(data[field], field);
      });

      // Validate and transform email
      data.email = validators.email(data.email, 'email');

      // Validate URLs
      if (data.websiteUrl) {
        data.websiteUrl = validators.url(data.websiteUrl, 'websiteUrl');
      }
      if (data.instagramUrl) {
        data.instagramUrl = validators.url(data.instagramUrl, 'instagramUrl');
      }

      // Generate slug from title
      data.slug = validators.generateSlug(data.title, 'title');

      // Validate and transform categories
      const categories = await this.validateCategories(data.categories);

      // Validate and transform tags
      const tags = validators.array(data.tags, 'tags');

      // Handle image uploads
      let galleryImages = [];
      if (data.galleryImages && data.galleryImages.length) {
        const { successful, failed } = await imageHandler.uploadMultipleImages(
          data.galleryImages
        );
        
        if (failed.length > 0) {
          logger.warn('Some images failed to upload', { 
            listingTitle: data.title, 
            failedImages: failed 
          });
        }
        
        galleryImages = successful;
      }

      return {
        _type: this.type,
        title: data.title,
        slug: data.slug,
        description: data.description,
        email: data.email,
        websiteUrl: data.websiteUrl,
        instagramUrl: data.instagramUrl,
        galleryImages,
        categories,
        tags
      };
    } catch (error) {
      logger.error('Listing validation failed', {
        data,
        error: error.message,
        field: error.field
      });
      throw error;
    }
  }

  async import(listings) {
    const { import: importConfig } = config.get();
    const results = {
      success: 0,
      failed: 0,
      errors: [],
      failedImages: []
    };

    logger.info('Starting listing import', { count: listings.length });

    for (let i = 0; i < listings.length; i += importConfig.batchSize) {
      const batch = listings.slice(i, i + importConfig.batchSize);
      
      try {
        const validatedBatch = await Promise.all(
          batch.map(listing => this.validate(listing))
        );

        const transaction = sanityClient.createTransaction();

        validatedBatch.forEach(doc => {
          transaction.create(doc);
        });

        await transaction.commit();

        results.success += batch.length;
        logger.info('Batch import successful', {
          processed: i + batch.length,
          total: listings.length
        });
      } catch (error) {
        results.failed += batch.length;
        results.errors.push({
          batch: i / importConfig.batchSize,
          error: error.message
        });

        logger.error('Batch import failed', {
          batchIndex: i / importConfig.batchSize,
          error: error.message
        });
      }
    }

    logger.info('Listing import completed', results);
    return results;
  }
}

export default new ListingImporter(); 