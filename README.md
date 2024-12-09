# Sanity.io Bulk Import Tool

A robust tool for bulk importing data into Sanity.io with support for categories and listings. Features include data validation, error recovery, checkpointing, and detailed logging.

## Features

- 🔄 Import categories and listings in bulk
- ✅ Comprehensive data validation
- 📁 Support for CSV and JSON input
- 🔒 Automatic backup before import
- 💾 Checkpoint system for resumable imports
- 📝 Detailed logging and error reporting
- 🔁 Automatic retry on failures
- 🏃‍♂️ Progress tracking

## Installation

1. Clone the repository: 
```bash
git clone https://github.com/yourusername/sanity-bulk-import.git
cd sanity-bulk-import
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update `.env` with your Sanity.io credentials:
```env
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_AUTH_TOKEN=your_auth_token
SANITY_API_VERSION=2024-02-14
LOG_LEVEL=info
```

## Configuration

### Environment Variables

- `SANITY_PROJECT_ID`: Your Sanity project ID
- `SANITY_DATASET`: Target dataset (e.g., production, development)
- `SANITY_AUTH_TOKEN`: Sanity API token with write access
- `SANITY_API_VERSION`: Sanity API version
- `LOG_LEVEL`: Logging level (debug, info, warn, error)

### Application Settings

Configuration can be customized in `config/default.json`:

```json
{
  "import": {
    "batchSize": 50,
    "maxRetries": 3,
    "retryDelay": 1000
  },
  "logging": {
    "directory": "logs",
    "maxSize": "20m",
    "maxFiles": "14d"
  },
  "api": {
    "timeout": 30000,
    "concurrentRequests": 5
  }
}
```

## Usage

### Basic Commands

```bash
# Import data
npm run import category ./data/categories.json
npm run import listing ./data/listings.csv

# Validate data without importing
npm run validate category ./data/categories.json
npm run validate listing ./data/listings.csv

# Create backup
npm run backup

# Transform data
npm run transform ./data/input.csv listing
```

### Advanced Usage

```bash
# Import with backup
npm run import category ./data/categories.json --backup

# Dry run (validate only)
npm run import listing ./data/listings.csv --dry-run

# Resume interrupted import
npm run import listing ./data/listings.json --resume

# Continue on errors
npm run import category ./data/categories.csv --continue-on-error
```

## Data Format Requirements

### Category Schema

```json
{
  "title": "string (required)",
  "description": "text (optional)",
  "color": "hex color code (optional)",
  "featuredListing": "reference ID (optional)"
}
```

Example CSV:
```csv
title,description,color,featured_listing_id
"Restaurants","Local dining options","#FF5733","listing123"
"Shopping","Retail stores","#00FF00",
```

### Listing Schema

```json
{
  "title": "string (required)",
  "description": "text (optional)",
  "email": "email (required)",
  "websiteUrl": "url (optional)",
  "instagramUrl": "url (optional)",
  "galleryImages": "array of URLs (optional)",
  "categories": "array of category IDs (optional)",
  "tags": "array of strings (optional)"
}
```

Example CSV:
```csv
title,description,email,website_url,instagram_url,gallery_images,categories,tags
"Local Cafe","A cozy cafe",contact@cafe.com,www.cafe.com,instagram.com/cafe,"img1.jpg,img2.jpg","cat1,cat2","coffee,food"
```

## Error Recovery

The tool includes several error recovery features:

1. **Checkpoints**: Created every 50 records
2. **Auto-retry**: Failed operations are retried up to 3 times
3. **Resume**: Can resume from last checkpoint using `--resume`
4. **Backup**: Automatic backup with `--backup` option

## Troubleshooting

### Common Issues

1. **Authentication Errors**
    ```
    Error: Failed to connect to Sanity
    ```
    - Check SANITY_AUTH_TOKEN in .env
    - Verify token has write permissions

2. **Invalid Data Format**
    ```
    Error: Data structure validation failed
    ```
    - Check input data against schema requirements
    - Verify CSV column names match expected fields

3. **Reference Errors**
    ```
    Error: Referenced category not found
    ```
    - Ensure referenced documents exist
    - Import categories before listings

4. **Network Issues**
    ```
    Error: Failed to upload image
    ```
    - Check image URLs are accessible
    - Verify network connectivity
    - Try reducing concurrent requests

### Logs

Logs are stored in the `logs` directory:
- `error.log`: Error messages
- `combined.log`: All log messages
- Rotated daily with timestamp

View recent errors:
```bash
tail -f logs/error.log
```

### Debug Mode

Enable debug logging in `.env`:
```env
LOG_LEVEL=debug
```

## Directory Structure

```
sanity-bulk-import/
├── src/
│   ├── importers/
│   ├── utils/
│   ├── scripts/
│   └── index.js
├── config/
│   └── default.json
├── data/
│   └── samples/
├── logs/
├── checkpoints/
└── backups/
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

ISC License

## Support

For issues and feature requests, please [create an issue](https://github.com/yourusername/sanity-bulk-import/issues).