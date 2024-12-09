import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'path';
import config from './config.js';

const { logging, logLevel } = config.get();

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
      msg += `\n${JSON.stringify(metadata, null, 2)}`;
    }
    return msg;
  })
);

// Custom format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

// Create rotating file transport for errors
const errorFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logging.directory, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: logging.maxSize,
  maxFiles: logging.maxFiles,
  format: fileFormat
});

// Create rotating file transport for combined logs
const combinedFileTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logging.directory, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: logging.maxSize,
  maxFiles: logging.maxFiles,
  format: fileFormat
});

// Create console transport
const consoleTransport = new winston.transports.Console({
  format: consoleFormat
});

// Handle transport errors
[errorFileTransport, combinedFileTransport].forEach(transport => {
  transport.on('rotate', function(oldFilename, newFilename) {
    logger.info('Rotating log file', { oldFilename, newFilename });
  });

  transport.on('error', function(error) {
    console.error('Error in log transport:', error);
  });
});

const logger = winston.createLogger({
  level: logLevel,
  levels: winston.config.npm.levels,
  transports: [
    errorFileTransport,
    combinedFileTransport,
    consoleTransport
  ],
  // Prevent logger from exiting on error
  exitOnError: false,
  // Handle uncaught exceptions
  handleExceptions: true,
  handleRejections: true,
  // Add default metadata to all logs
  defaultMeta: { service: 'sanity-bulk-import' }
});

// Create wrapper methods with metadata support
const enhancedLogger = {
  error: (message, metadata = {}) => {
    logger.error(message, { timestamp: new Date(), ...metadata });
  },
  warn: (message, metadata = {}) => {
    logger.warn(message, { timestamp: new Date(), ...metadata });
  },
  info: (message, metadata = {}) => {
    logger.info(message, { timestamp: new Date(), ...metadata });
  },
  debug: (message, metadata = {}) => {
    logger.debug(message, { timestamp: new Date(), ...metadata });
  },
  // Add a method for logging operation results
  logOperation: (operation, success, details = {}) => {
    const level = success ? 'info' : 'error';
    logger[level](`Operation ${operation} ${success ? 'succeeded' : 'failed'}`, {
      operation,
      success,
      timestamp: new Date(),
      ...details
    });
  }
};

// Log startup information
enhancedLogger.info('Logger initialized', {
  logLevel,
  logDirectory: logging.directory,
  maxFileSize: logging.maxSize,
  maxFiles: logging.maxFiles
});

export default enhancedLogger; 