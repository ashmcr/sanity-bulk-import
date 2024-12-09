import fs from 'fs/promises';
import path from 'path';
import logger from './logger.js';

class RecoverySystem {
  constructor() {
    this.checkpointDir = path.join(process.cwd(), 'checkpoints');
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  async initialize() {
    await fs.mkdir(this.checkpointDir, { recursive: true });
  }

  generateCheckpointFilename(type, timestamp) {
    return path.join(
      this.checkpointDir,
      `checkpoint_${type}_${timestamp}.json`
    );
  }

  async saveCheckpoint(type, data, progress) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = this.generateCheckpointFilename(type, timestamp);

      const checkpoint = {
        timestamp,
        type,
        progress,
        remainingData: data.slice(progress),
        processedCount: progress,
        totalCount: data.length
      };

      await fs.writeFile(
        filename,
        JSON.stringify(checkpoint, null, 2)
      );

      logger.info('Checkpoint saved', {
        type,
        progress,
        filename: path.basename(filename)
      });

      return filename;
    } catch (error) {
      logger.error('Failed to save checkpoint', { error: error.message });
      throw error;
    }
  }

  async loadLatestCheckpoint(type) {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const checkpointFiles = files
        .filter(file => file.startsWith(`checkpoint_${type}_`))
        .sort()
        .reverse();

      if (checkpointFiles.length === 0) {
        return null;
      }

      const latestFile = path.join(this.checkpointDir, checkpointFiles[0]);
      const content = await fs.readFile(latestFile, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to load checkpoint', { error: error.message });
      throw error;
    }
  }

  async cleanOldCheckpoints(type, maxAge = '7d') {
    try {
      const files = await fs.readdir(this.checkpointDir);
      const now = Date.now();
      const maxAgeMs = this.parseMaxAge(maxAge);

      for (const file of files) {
        if (!file.startsWith(`checkpoint_${type}_`)) continue;

        const filePath = path.join(this.checkpointDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAgeMs) {
          await fs.unlink(filePath);
          logger.info('Removed old checkpoint', { file });
        }
      }
    } catch (error) {
      logger.error('Failed to clean old checkpoints', { error: error.message });
    }
  }

  parseMaxAge(maxAge) {
    const units = {
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000
    };

    const match = maxAge.match(/^(\d+)([dw])$/);
    if (!match) {
      throw new Error('Invalid maxAge format. Use format: 7d or 1w');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  async retryOperation(operation, context) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn('Operation failed, retrying', {
          attempt,
          maxRetries: this.maxRetries,
          error: error.message,
          context
        });

        if (attempt < this.maxRetries) {
          await new Promise(resolve => 
            setTimeout(resolve, this.retryDelay * attempt)
          );
        }
      }
    }

    throw new Error(
      `Operation failed after ${this.maxRetries} attempts: ${lastError.message}`
    );
  }
}

export default new RecoverySystem(); 