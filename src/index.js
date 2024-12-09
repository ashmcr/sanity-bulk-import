import { program } from 'commander';
import path from 'path';
import logger from './utils/logger.js';
import config from './utils/config.js';
import { transformer } from './scripts/transform.js';
import { backupTool } from './scripts/backup.js';
import categoryImporter from './importers/categoryImporter.js';
import listingImporter from './importers/listingImporter.js';

class ImportManager {
  constructor() {
    this.supportedTypes = ['category', 'listing'];
  }

  validateType(type) {
    if (!this.supportedTypes.includes(type)) {
      throw new Error(`Unsupported import type: ${type}. Supported types: ${this.supportedTypes.join(', ')}`);
    }
  }

  getImporter(type) {
    switch (type) {
      case 'category':
        return categoryImporter;
      case 'listing':
        return listingImporter;
      default:
        throw new Error(`No importer found for type: ${type}`);
    }
  }

  async import(inputPath, type, options = {}) {
    try {
      // Validate import type
      this.validateType(type);
      
      // Create backup if requested
      if (options.backup) {
        logger.info('Creating backup before import');
        await backupTool.backup();
      }

      // Transform input data
      logger.info('Transforming input data', { inputPath, type });
      const transformedData = await transformer.transform(inputPath, type);

      // Get appropriate importer
      const importer = this.getImporter(type);

      // Perform import
      logger.info('Starting import process', { 
        type,
        recordCount: transformedData.length 
      });

      const results = await importer.import(transformedData);

      // Log results
      logger.info('Import completed', { 
        type,
        success: results.success,
        failed: results.failed,
        total: transformedData.length
      });

      return results;
    } catch (error) {
      logger.error('Import failed', {
        error: error.message,
        type,
        inputPath
      });
      throw error;
    }
  }
}

// Set up command line interface
program
  .name('sanity-bulk-import')
  .description('Bulk import tool for Sanity.io')
  .version('1.0.0');

program
  .command('import <type> <input>')
  .description('Import data into Sanity')
  .option('-b, --backup', 'Create backup before import', false)
  .option('-d, --dry-run', 'Validate without importing', false)
  .option('-r, --resume', 'Resume from last checkpoint', false)
  .option('-c, --continue-on-error', 'Continue processing on batch failure', false)
  .action(async (type, input, options) => {
    try {
      const manager = new ImportManager();
      
      // Log startup information
      logger.info('Starting import process', {
        type,
        input: path.basename(input),
        options
      });

      // Load and log configuration
      const configuration = config.get();
      logger.info('Configuration loaded', {
        dataset: configuration.sanity.dataset,
        batchSize: configuration.import.batchSize
      });

      if (options.dryRun) {
        // Only transform and validate data
        logger.info('Performing dry run');
        const transformedData = await transformer.transform(input, type);
        const importer = manager.getImporter(type);
        
        // Validate each record
        for (const record of transformedData) {
          await importer.validate(record);
        }
        
        logger.info('Dry run completed successfully', {
          validRecords: transformedData.length
        });
      } else {
        // Perform actual import
        const results = await manager.import(input, type, options);
        
        // Display results summary
        console.log('\nImport Summary:');
        console.table({
          'Total Records': results.success + results.failed,
          'Successful': results.success,
          'Failed': results.failed,
          'Success Rate': `${((results.success / (results.success + results.failed)) * 100).toFixed(1)}%`
        });

        if (results.errors.length > 0) {
          console.log('\nErrors encountered:');
          console.table(results.errors);
        }
      }
    } catch (error) {
      logger.error('Application error', { error: error.message });
      console.error('\nError:', error.message);
      process.exit(1);
    }
  });

program
  .command('backup')
  .description('Create a backup of the current dataset')
  .action(async () => {
    try {
      await backupTool.backup();
    } catch (error) {
      logger.error('Backup failed', { error: error.message });
      process.exit(1);
    }
  });

program
  .command('validate <type> <input>')
  .description('Validate input data without importing')
  .action(async (type, input) => {
    try {
      const manager = new ImportManager();
      manager.validateType(type);

      logger.info('Validating input data', { type, input });
      const transformedData = await transformer.transform(input, type);
      const importer = manager.getImporter(type);

      const validationResults = {
        total: transformedData.length,
        valid: 0,
        invalid: 0,
        errors: []
      };

      for (const [index, record] of transformedData.entries()) {
        try {
          await importer.validate(record);
          validationResults.valid++;
        } catch (error) {
          validationResults.invalid++;
          validationResults.errors.push({
            index,
            error: error.message,
            record
          });
        }
      }

      console.log('\nValidation Results:');
      console.table({
        'Total Records': validationResults.total,
        'Valid Records': validationResults.valid,
        'Invalid Records': validationResults.invalid
      });

      if (validationResults.errors.length > 0) {
        console.log('\nValidation Errors:');
        console.table(
          validationResults.errors.map(({ index, error }) => ({
            Record: index + 1,
            Error: error
          }))
        );
      }
    } catch (error) {
      logger.error('Validation failed', { error: error.message });
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(); 