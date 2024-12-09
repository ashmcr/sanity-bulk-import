# API Documentation

## Importers

### CategoryImporter

Class for handling category imports with validation and transformation. 

```typescript
interface CategoryData {
  title: string;
  description?: string;
  color?: string;
  featuredListing?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
  checkpoints?: string[];
}

class CategoryImporter {
  async validate(data: CategoryData): Promise<SanityDocument>;
  async import(categories: CategoryData[]): Promise<ImportResult>;
}
```

#### Methods

- **validate(data)**
  - Purpose: Validates and transforms category data
  - Parameters: `CategoryData` object
  - Returns: Sanity-formatted document
  - Validation:
    - Required fields: `title`
    - Color format: Valid hex code (#RGB or #RRGGBB)
    - Featured listing: Must reference existing listing
  - Throws: `ValidationError` for invalid data

- **import(categories)**
  - Purpose: Imports array of categories
  - Parameters: Array of `CategoryData` objects
  - Returns: `ImportResult`
  - Features:
    - Batch processing
    - Transaction support
    - Error recovery
    - Progress tracking

### ListingImporter

Class for handling listing imports with validation and image processing.

```typescript
interface ListingData {
  title: string;
  description?: string;
  email: string;
  websiteUrl?: string;
  instagramUrl?: string;
  galleryImages?: string[];
  categories?: string[];
  tags?: string[];
}

class ListingImporter {
  async validate(data: ListingData): Promise<SanityDocument>;
  async import(listings: ListingData[]): Promise<ImportResult>;
}
```

#### Methods

- **validate(data)**
  - Purpose: Validates and transforms listing data
  - Parameters: `ListingData` object
  - Returns: Sanity-formatted document
  - Validation:
    - Required fields: `title`, `email`
    - Email format validation
    - URL format validation
    - Category reference validation
    - Image URL validation
  - Throws: `ValidationError` for invalid data

- **import(listings)**
  - Purpose: Imports array of listings
  - Parameters: Array of `ListingData` objects
  - Returns: `ImportResult`
  - Features:
    - Image upload handling
    - Batch processing
    - Transaction support
    - Error recovery

## Utilities

### RecoverySystem

Handles error recovery and checkpoint management.

```typescript
interface Checkpoint {
  timestamp: string;
  type: string;
  progress: number;
  remainingData: any[];
  processedCount: number;
  totalCount: number;
}

class RecoverySystem {
  constructor(options?: RecoveryOptions);
  async saveCheckpoint(type: string, data: any[], progress: number): Promise<string>;
  async loadLatestCheckpoint(type: string): Promise<Checkpoint | null>;
  async cleanOldCheckpoints(type: string, maxAge?: string): Promise<void>;
  async retryOperation(operation: Function, context: object): Promise<any>;
}
```

#### Methods

- **saveCheckpoint**
  - Purpose: Creates progress checkpoint
  - Parameters:
    - type: Import type ('category' or 'listing')
    - data: Remaining data array
    - progress: Current progress count
  - Returns: Checkpoint filename

- **loadLatestCheckpoint**
  - Purpose: Retrieves most recent checkpoint
  - Parameters:
    - type: Import type
  - Returns: Checkpoint data or null

- **cleanOldCheckpoints**
  - Purpose: Removes expired checkpoints
  - Parameters:
    - type: Import type
    - maxAge: Age threshold (e.g., '7d', '1w')
  - Returns: void

- **retryOperation**
  - Purpose: Retries failed operations
  - Parameters:
    - operation: Async function to retry
    - context: Error context object
  - Returns: Operation result
  - Features:
    - Exponential backoff
    - Configurable retry count
    - Detailed error logging

### ImageHandler

Handles image upload and processing.

```typescript
interface ImageUploadResult {
  successful: ImageReference[];
  failed: FailedUpload[];
}

class ImageHandler {
  async uploadImageFromUrl(imageUrl: string, options?: object): Promise<SanityAsset>;
  async uploadMultipleImages(imageUrls: string[], options?: object): Promise<ImageUploadResult>;
}
```

## Configuration

### Environment Variables

```typescript
interface EnvironmentConfig {
  SANITY_PROJECT_ID: string;    // Sanity project identifier
  SANITY_DATASET: string;       // Target dataset name
  SANITY_AUTH_TOKEN: string;    // API authentication token
  SANITY_API_VERSION: string;   // API version (YYYY-MM-DD)
  LOG_LEVEL: string;            // Logging level (debug|info|warn|error)
}
```

### Application Configuration

```typescript
interface ImportConfig {
  batchSize: number;            // Number of documents per batch
  maxRetries: number;           // Maximum retry attempts
  retryDelay: number;           // Delay between retries (ms)
}

interface LoggingConfig {
  directory: string;            // Log file directory
  maxSize: string;             // Maximum log file size
  maxFiles: string;            // Log retention period
}

interface ApiConfig {
  timeout: number;              // API request timeout (ms)
  concurrentRequests: number;   // Maximum concurrent requests
}
```

## Error Codes

### Validation Errors

- `REQUIRED_FIELD`: Required field is missing
- `INVALID_EMAIL`: Email format is invalid
- `INVALID_URL`: URL format is invalid
- `INVALID_COLOR`: Color code format is invalid
- `INVALID_REFERENCE`: Referenced document not found
- `INVALID_IMAGE_URL`: Image URL is invalid or inaccessible

### Import Errors

- `BATCH_FAILED`: Batch import failed
- `TRANSACTION_FAILED`: Sanity transaction failed
- `IMAGE_UPLOAD_FAILED`: Image upload failed
- `CHECKPOINT_ERROR`: Checkpoint operation failed
- `RETRY_EXHAUSTED`: Maximum retry attempts reached

### System Errors

- `CONFIG_ERROR`: Configuration error
- `AUTH_ERROR`: Authentication failed
- `API_ERROR`: Sanity API error
- `NETWORK_ERROR`: Network connection error
- `FILESYSTEM_ERROR`: File system operation failed

## Response Types

```typescript
interface ImportError {
  code: string;
  message: string;
  batch?: number;
  items?: any[];
  context?: object;
}

interface ValidationError {
  field: string;
  value: any;
  message: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: ImportError[];
  checkpoints?: string[];
}
```

## Usage Examples

```typescript
// Import categories
const categoryImporter = new CategoryImporter();
const categories = [/* category data */];
const results = await categoryImporter.import(categories);

// Import listings with recovery
const listingImporter = new ListingImporter();
const listings = [/* listing data */];
const options = { resume: true, continueOnError: true };
const results = await listingImporter.import(listings, options);

// Retry operation
const recovery = new RecoverySystem();
await recovery.retryOperation(
  async () => { /* operation */ },
  { context: 'import' }
);
``` 