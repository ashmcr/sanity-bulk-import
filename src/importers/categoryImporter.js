import { validators, ValidationError } from '../utils/validation.js';
import logger from '../utils/logger.js';
import sanityClient from '../utils/sanityClient.js';
import config from '../utils/config.js';

class CategoryImporter {
  constructor() {
    this.type = 'category';
    this.requiredFields = ['title'];
  }

  async validateReference(referenceId, type = 'listing') {
    try {
      const doc = await sanityClient.fetch(
        `*[_type == $type && _id == $id][0]`,
        { type, id: referenceId }
      );
      
      if (!doc) {
        throw new ValidationError(
          `Referenced ${type} with ID ${referenceId} not found`,
          'featuredListing',
          referenceId
        );
      }
      
      return {
        _type: 'reference',
        _ref: referenceId
      };
    } catch (error) {
      throw new ValidationError(
        `Failed to validate reference: ${error.message}`,
        'featuredListing',
        referenceId
      );
    }
  }

  async validate(data) {
    try {
      // Validate required fields
      this.requiredFields.forEach(field => {
        validators.required(data[field], field);
      });

      // Validate and transform color
      if (data.color) {
        data.color = validators.hexColor(data.color, 'color');
      }

      // Generate slug from title
      data.slug = validators.generateSlug(data.title, 'title');

      // Validate featured listing reference if provided
      if (data.featuredListing) {
        data.featuredListing = await this.validateReference(data.featuredListing);
      }

      return {
        _type: this.type,
        title: data.title,
        slug: data.slug,
        description: data.description,
        color: data.color,
        featuredListing: data.featuredListing
      };
    } catch (error) {
      logger.error('Category validation failed', {
        data,
        error: error.message,
        field: error.field
      });
      throw error;
    }
  }

  async import(categories) {
    const { import: importConfig } = config.get();
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    logger.info('Starting category import', { count: categories.length });

    for (let i = 0; i < categories.length; i += importConfig.batchSize) {
      const batch = categories.slice(i, i + importConfig.batchSize);
      
      try {
        const validatedBatch = await Promise.all(
          batch.map(category => this.validate(category))
        );

        const transaction = sanityClient.createTransaction();

        validatedBatch.forEach(doc => {
          transaction.create(doc);
        });

        await transaction.commit();

        results.success += batch.length;
        logger.info('Batch import successful', {
          processed: i + batch.length,
          total: categories.length
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

    logger.info('Category import completed', results);
    return results;
  }
}

export default new CategoryImporter(); 