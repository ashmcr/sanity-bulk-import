import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

class Config {
  constructor() {
    this.loadEnvironmentVariables();
    this.loadConfigFile();
    this.validate();
  }

  loadEnvironmentVariables() {
    dotenv.config();
    
    this.env = {
      sanity: {
        projectId: process.env.SANITY_PROJECT_ID,
        dataset: process.env.SANITY_DATASET,
        token: process.env.SANITY_AUTH_TOKEN,
        apiVersion: process.env.SANITY_API_VERSION
      },
      logLevel: process.env.LOG_LEVEL || 'info'
    };
  }

  loadConfigFile() {
    const configPath = path.resolve(__dirname, '../../config/default.json');
    
    try {
      const configFile = fs.readFileSync(configPath, 'utf8');
      this.settings = JSON.parse(configFile);
    } catch (error) {
      throw new ConfigurationError(`Failed to load config file: ${error.message}`);
    }
  }

  validate() {
    // Validate required environment variables
    const requiredEnvVars = [
      ['sanity.projectId', this.env.sanity.projectId],
      ['sanity.dataset', this.env.sanity.dataset],
      ['sanity.token', this.env.sanity.token],
      ['sanity.apiVersion', this.env.sanity.apiVersion]
    ];

    for (const [name, value] of requiredEnvVars) {
      if (!value) {
        throw new ConfigurationError(`Missing required environment variable: ${name}`);
      }
    }

    // Validate config file settings
    const required = {
      'import.batchSize': this.settings.import?.batchSize,
      'import.maxRetries': this.settings.import?.maxRetries,
      'logging.directory': this.settings.logging?.directory
    };

    for (const [path, value] of Object.entries(required)) {
      if (value === undefined) {
        throw new ConfigurationError(`Missing required configuration: ${path}`);
      }
    }
  }

  get() {
    return {
      sanity: this.env.sanity,
      logLevel: this.env.logLevel,
      import: this.settings.import,
      logging: this.settings.logging,
      api: this.settings.api
    };
  }
}

// Create and export a singleton instance
const config = new Config();
export default config; 