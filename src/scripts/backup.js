import fs from 'fs/promises';
import path from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import sanityClient from '../utils/sanityClient.js';
import logger from '../utils/logger.js';
import config from '../utils/config.js';

class SanityBackup {
  constructor() {
    this.client = sanityClient.client;
    this.backupDir = path.join(process.cwd(), 'backups');
    this.batchSize = 100;
  }

  async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create backup directory: ${error.message}`);
    }
  }

  generateBackupFilename(dataset) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(
      this.backupDir,
      `sanity-backup-${dataset}-${timestamp}.json.gz`
    );
  }

  async fetchDocumentCount() {
    try {
      const result = await this.client.fetch(
        'count(*[!(_type match "system.**")])'
      );
      return result;
    } catch (error) {
      throw new Error(`Failed to fetch document count: ${error.message}`);
    }
  }

  async* fetchAllDocuments() {
    const totalDocs = await this.fetchDocumentCount();
    logger.info(`Found ${totalDocs} documents to backup`);

    for (let start = 0; start < totalDocs; start += this.batchSize) {
      try {
        const documents = await this.client.fetch(
          `*[!(_type match "system.**")] | order(_type, _id) [${start}...${start + this.batchSize}]`
        );

        yield documents;

        logger.info(`Fetched documents ${start + 1} to ${start + documents.length} of ${totalDocs}`);
      } catch (error) {
        logger.error(`Failed to fetch batch starting at ${start}`, { error: error.message });
        throw error;
      }
    }
  }

  async createBackupStream(filename) {
    const gzip = createGzip();
    const writeStream = createWriteStream(filename);

    // Create a wrapper around writeStream that handles JSON formatting
    let isFirst = true;
    const jsonStream = {
      write: (docs) => {
        const data = docs.map(doc => JSON.stringify(doc)).join(',\n');
        if (isFirst) {
          gzip.write('[\n');
          isFirst = false;
        } else {
          gzip.write(',\n');
        }
        gzip.write(data);
        return true;
      },
      end: () => {
        gzip.write('\n]');
        gzip.end();
      }
    };

    // Set up error handlers
    writeStream.on('error', (error) => {
      logger.error('Error writing backup file', { error: error.message });
      throw error;
    });

    gzip.on('error', (error) => {
      logger.error('Error compressing backup', { error: error.message });
      throw error;
    });

    // Connect gzip to file stream
    pipeline(gzip, writeStream);

    return jsonStream;
  }

  async backup() {
    try {
      await this.initialize();

      const { sanity } = config.get();
      const filename = this.generateBackupFilename(sanity.dataset);
      
      logger.info('Starting backup', {
        dataset: sanity.dataset,
        filename: path.basename(filename)
      });

      const startTime = Date.now();
      const backupStream = await this.createBackupStream(filename);

      let documentCount = 0;
      for await (const documents of this.fetchAllDocuments()) {
        backupStream.write(documents);
        documentCount += documents.length;
      }

      backupStream.end();

      const duration = (Date.now() - startTime) / 1000;
      const fileStats = await fs.stat(filename);
      const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);

      logger.info('Backup completed successfully', {
        filename: path.basename(filename),
        documentCount,
        fileSizeMB: `${fileSizeMB}MB`,
        duration: `${duration.toFixed(2)}s`
      });

      return {
        filename,
        documentCount,
        fileSize: fileStats.size,
        duration
      };
    } catch (error) {
      logger.error('Backup failed', { error: error.message });
      throw error;
    }
  }

  async listBackups() {
    try {
      await this.initialize();
      
      const files = await fs.readdir(this.backupDir);
      const backups = await Promise.all(
        files
          .filter(file => file.endsWith('.json.gz'))
          .map(async file => {
            const stats = await fs.stat(path.join(this.backupDir, file));
            return {
              filename: file,
              size: stats.size,
              created: stats.birthtime
            };
          })
      );

      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      logger.error('Failed to list backups', { error: error.message });
      throw error;
    }
  }

  async cleanOldBackups(maxAge = '30d') {
    try {
      const backups = await this.listBackups();
      const maxAgeMs = this.parseMaxAge(maxAge);
      const now = Date.now();

      for (const backup of backups) {
        const age = now - backup.created.getTime();
        if (age > maxAgeMs) {
          const filePath = path.join(this.backupDir, backup.filename);
          await fs.unlink(filePath);
          logger.info('Deleted old backup', { filename: backup.filename });
        }
      }
    } catch (error) {
      logger.error('Failed to clean old backups', { error: error.message });
      throw error;
    }
  }

  parseMaxAge(maxAge) {
    const units = {
      d: 24 * 60 * 60 * 1000,
      w: 7 * 24 * 60 * 60 * 1000,
      m: 30 * 24 * 60 * 60 * 1000
    };

    const match = maxAge.match(/^(\d+)([dwm])$/);
    if (!match) {
      throw new Error('Invalid maxAge format. Use format: 30d, 4w, or 2m');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }
}

// Create CLI interface
async function main() {
  const backup = new SanityBackup();
  
  try {
    const [,, command = 'backup', ...args] = process.argv;

    switch (command) {
      case 'backup':
        await backup.backup();
        break;

      case 'list':
        const backups = await backup.listBackups();
        console.table(
          backups.map(b => ({
            ...b,
            size: `${(b.size / (1024 * 1024)).toFixed(2)}MB`,
            created: b.created.toISOString()
          }))
        );
        break;

      case 'clean':
        const maxAge = args[0] || '30d';
        await backup.cleanOldBackups(maxAge);
        break;

      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    logger.error('Backup operation failed', { error: error.message });
    process.exit(1);
  }
}

// Export both the class and the CLI function
export const backupTool = new SanityBackup();
export { main };

// Run the CLI if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
} 