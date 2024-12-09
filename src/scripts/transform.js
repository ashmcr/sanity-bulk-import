import fs from 'fs/promises';
import path from 'path';
import csv from 'csv-parse';
import logger from '../utils/logger.js';
import { ValidationError } from '../utils/validation.js';

class DataTransformer {
  constructor() {
    this.supportedFormats = ['csv', 'json'];
    this.requiredListingFields = ['title', 'email'];
    this.requiredCategoryFields = ['title'];
  }

  async loadFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const extension = path.extname(filePath).toLowerCase().slice(1);

      if (!this.supportedFormats.includes(extension)) {
        throw new Error(`Unsupported file format: ${extension}`);
      }

      return { content: fileContent, format: extension };
    } catch (error) {
      logger.error('Failed to load file', { filePath, error: error.message });
      throw error;
    }
  }

  async parseCSV(content) {
    return new Promise((resolve, reject) => {
      csv.parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      }, (error, records) => {
        if (error) reject(error);
        else resolve(records);
      });
    });
  }

  parseJSON(content) {
    try {
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
  }

  validateDataStructure(data, type) {
    const requiredFields = type === 'listing' 
      ? this.requiredListingFields 
      : this.requiredCategoryFields;

    const missingFields = data.reduce((errors, item, index) => {
      const missing = requiredFields.filter(field => !item[field]);
      if (missing.length > 0) {
        errors.push({
          index,
          missingFields: missing,
          item
        });
      }
      return errors;
    }, []);

    if (missingFields.length > 0) {
      throw new ValidationError(
        'Data structure validation failed',
        'structure',
        missingFields
      );
    }
  }

  transformCategory(rawCategory) {
    return {
      title: rawCategory.title?.trim(),
      description: rawCategory.description?.trim(),
      color: rawCategory.color?.startsWith('#') 
        ? rawCategory.color 
        : `#${rawCategory.color}`,
      featuredListing: rawCategory.featured_listing_id
    };
  }

  transformListing(rawListing) {
    return {
      title: rawListing.title?.trim(),
      description: rawListing.description?.trim(),
      email: rawListing.email?.trim().toLowerCase(),
      websiteUrl: this.normalizeUrl(rawListing.website_url),
      instagramUrl: this.normalizeUrl(rawListing.instagram_url),
      galleryImages: this.parseImageUrls(rawListing.gallery_images),
      categories: this.parseCategories(rawListing.categories),
      tags: this.parseTags(rawListing.tags)
    };
  }

  normalizeUrl(url) {
    if (!url) return undefined;
    url = url.trim();
    return url.startsWith('http') ? url : `https://${url}`;
  }

  parseImageUrls(images) {
    if (!images) return [];
    if (Array.isArray(images)) return images;
    if (typeof images === 'string') {
      return images.split(/[,;\n]/)
        .map(url => url.trim())
        .filter(url => url.length > 0);
    }
    return [];
  }

  parseCategories(categories) {
    if (!categories) return [];
    if (Array.isArray(categories)) return categories;
    if (typeof categories === 'string') {
      return categories.split(/[,;\n]/)
        .map(id => id.trim())
        .filter(id => id.length > 0);
    }
    return [];
  }

  parseTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
      return tags.split(/[,;\n]/)
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0);
    }
    return [];
  }

  async transform(inputPath, type = 'listing') {
    try {
      logger.info('Starting data transformation', { inputPath, type });

      const { content, format } = await this.loadFile(inputPath);
      
      // Parse the input file
      const rawData = format === 'csv' 
        ? await this.parseCSV(content)
        : this.parseJSON(content);

      // Validate basic data structure
      this.validateDataStructure(rawData, type);

      // Transform the data
      const transformedData = rawData.map(item => 
        type === 'listing' 
          ? this.transformListing(item)
          : this.transformCategory(item)
      );

      logger.info('Data transformation completed', {
        inputRecords: rawData.length,
        outputRecords: transformedData.length
      });

      return transformedData;
    } catch (error) {
      logger.error('Data transformation failed', {
        error: error.message,
        inputPath,
        type
      });
      throw error;
    }
  }
}

// Create a CLI interface
async function main() {
  const transformer = new DataTransformer();
  
  try {
    const [,, inputPath, type = 'listing'] = process.argv;

    if (!inputPath) {
      throw new Error('Input file path is required');
    }

    const transformedData = await transformer.transform(inputPath, type);
    
    // Write the transformed data to a JSON file
    const outputPath = path.join(
      'data',
      `transformed_${type}_${new Date().toISOString()}.json`
    );
    
    await fs.writeFile(
      outputPath,
      JSON.stringify(transformedData, null, 2)
    );

    logger.info('Transformation successful', {
      inputPath,
      outputPath,
      recordCount: transformedData.length
    });
  } catch (error) {
    logger.error('Transformation failed', { error: error.message });
    process.exit(1);
  }
}

// Export both the class and the CLI function
export const transformer = new DataTransformer();
export { main };

// Run the CLI if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
} 