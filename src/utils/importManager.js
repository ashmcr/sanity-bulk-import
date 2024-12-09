import logger from './logger.js';
import config from './config.js';
import recoverySystem from './recoverySystem.js';
import categoryImporter from '../importers/categoryImporter.js';
import listingImporter from '../importers/listingImporter.js';

class ImportManager {
  constructor() {
    this.supportedTypes = ['category', 'listing'];
    this.checkpointInterval = 50; // Save checkpoint every 50 records
  }

  // ... existing validateType and getImporter methods ...

  async import(inputPath, type, options = {}) {
    try {
      await recoverySystem.initialize();
      
      // Check for existing checkpoint if resume option is enabled
      let startIndex = 0;
      let transformedData;

      if (options.resume) {
        const checkpoint = await recoverySystem.loadLatestCheckpoint(type);
        if (checkpoint) {
          logger.info('Resuming from checkpoint', {
            progress: checkpoint.progress,
            total: checkpoint.totalCount
          });
          transformedData = checkpoint.remainingData;
          startIndex = checkpoint.processedCount;
        }
      }

      // Transform data if not resuming
      if (!transformedData) {
        transformedData = await transformer.transform(inputPath, type);
      }

      const importer = this.getImporter(type);
      const results = {
        success: 0,
        failed: 0,
        errors: [],
        checkpoints: []
      };

      // Process in batches
      const { import: importConfig } = config.get();
      for (let i = startIndex; i < transformedData.length; i += importConfig.batchSize) {
        const batch = transformedData.slice(i, i + importConfig.batchSize);
        
        try {
          // Validate batch
          const validatedBatch = await Promise.all(
            batch.map(item => importer.validate(item))
          );

          // Import batch with retry
          await recoverySystem.retryOperation(
            async () => {
              const transaction = await importer.createTransaction();
              validatedBatch.forEach(doc => transaction.create(doc));
              await transaction.commit();
            },
            { batch: i / importConfig.batchSize, type }
          );

          results.success += batch.length;

          // Save checkpoint at intervals
          if (i > 0 && i % this.checkpointInterval === 0) {
            const checkpointFile = await recoverySystem.saveCheckpoint(
              type,
              transformedData,
              i + batch.length
            );
            results.checkpoints.push(checkpointFile);
          }

        } catch (error) {
          results.failed += batch.length;
          results.errors.push({
            batch: i / importConfig.batchSize,
            error: error.message,
            items: batch
          });

          if (!options.continueOnError) {
            throw error;
          }

          logger.error('Batch failed, continuing with next batch', {
            batch: i / importConfig.batchSize,
            error: error.message
          });
        }

        logger.info('Import progress', {
          processed: i + batch.length,
          total: transformedData.length,
          success: results.success,
          failed: results.failed
        });
      }

      // Clean up old checkpoints
      await recoverySystem.cleanOldCheckpoints(type);

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

export default new ImportManager(); 