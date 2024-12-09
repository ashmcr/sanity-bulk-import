import { createClient } from '@sanity/client';
import config from './config.js';
import logger from './logger.js';

class SanityClientError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SanityClientError';
  }
}

class SanityClientManager {
  constructor() {
    this.initializeClient();
  }

  initializeClient() {
    try {
      const { sanity } = config.get();
      
      // Validate required configuration
      this.validateConfig(sanity);

      this.client = createClient({
        projectId: sanity.projectId,
        dataset: sanity.dataset,
        token: sanity.token,
        apiVersion: sanity.apiVersion,
        useCdn: false,
        timeout: 60000
      });

      // Test the connection
      this.validateConnection();

      logger.info('Sanity client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Sanity client:', error);
      throw new SanityClientError(`Sanity client initialization failed: ${error.message}`);
    }
  }

  validateConfig(config) {
    const requiredFields = {
      projectId: 'SANITY_PROJECT_ID',
      dataset: 'SANITY_DATASET',
      token: 'SANITY_AUTH_TOKEN',
      apiVersion: 'SANITY_API_VERSION'
    };

    for (const [field, envVar] of Object.entries(requiredFields)) {
      if (!config[field]) {
        throw new SanityClientError(
          `Missing required Sanity configuration: ${envVar} environment variable is not set`
        );
      }
    }
  }

  async validateConnection() {
    try {
      // Attempt to fetch a single document to validate connection
      await this.client.fetch('*[_type == "system"][0]');
      logger.debug('Successfully validated Sanity connection');
    } catch (error) {
      throw new SanityClientError(
        `Failed to connect to Sanity: ${error.message}. Please check your credentials and network connection.`
      );
    }
  }

  async createTransaction() {
    return this.client.transaction();
  }

  async fetch(query, params) {
    try {
      return await this.client.fetch(query, params);
    } catch (error) {
      logger.error('Sanity query failed:', { query, params, error: error.message });
      throw new SanityClientError(`Failed to execute Sanity query: ${error.message}`);
    }
  }

  async create(document, options = {}) {
    try {
      return await this.client.create(document, options);
    } catch (error) {
      logger.error('Failed to create document:', { document, error: error.message });
      throw new SanityClientError(`Failed to create document: ${error.message}`);
    }
  }

  async createOrReplace(document, options = {}) {
    try {
      return await this.client.createOrReplace(document, options);
    } catch (error) {
      logger.error('Failed to create or replace document:', { document, error: error.message });
      throw new SanityClientError(`Failed to create or replace document: ${error.message}`);
    }
  }

  async patch(documentId, operations) {
    try {
      return await this.client.patch(documentId).set(operations).commit();
    } catch (error) {
      logger.error('Failed to patch document:', { documentId, operations, error: error.message });
      throw new SanityClientError(`Failed to patch document: ${error.message}`);
    }
  }

  async delete(documentId) {
    try {
      return await this.client.delete(documentId);
    } catch (error) {
      logger.error('Failed to delete document:', { documentId, error: error.message });
      throw new SanityClientError(`Failed to delete document: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
const sanityClient = new SanityClientManager();
export default sanityClient; 