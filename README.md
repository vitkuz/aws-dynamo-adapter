# @dynamodb/adapter

Type-safe DynamoDB adapter with configurable keys and comprehensive operations.

## Features

- ✅ Full TypeScript support with generics
- ✅ Flexible type system - use any object shape
- ✅ Configurable partition and sort keys
- ✅ Automatic timestamp management (createdAt/updatedAt)
- ✅ Optional timestamp preservation
- ✅ Batch operations support
- ✅ Global Secondary Index support
- ✅ AWS region configuration
- ✅ Custom client and logger support
- ✅ ESM and CommonJS compatibility

## Installation

```bash
npm install @dynamodb/adapter
```

## Usage

### Basic Example

```typescript
import { createAdapter } from '@dynamodb/adapter';

interface Product {
  id: string;
  sk: string;
  name: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

const adapter = createAdapter<Product>({
  tableName: 'my-products-table'
});

// Create a product
const product = await adapter.createOneRecord({
  id: 'prod-123',
  sk: 'products',
  name: 'Widget',
  price: 29.99
});

// Update a product
const updated = await adapter.patchOneRecord(
  { id: 'prod-123', sk: 'products' },
  { price: 34.99 }
);

// Fetch all products
const products = await adapter.fetchAllRecords('products');
```

### Custom Configuration

```typescript
const adapter = createAdapter({
  tableName: 'my-table',
  partitionKey: 'customId',  // default: 'id'
  sortKey: 'customSk',        // default: 'sk'
  gsiName: 'customGsi',       // default: 'gsiBySk'
  region: 'eu-west-1',        // optional AWS region
  logger: customLogger,       // optional custom logger
  client: customClient        // optional custom DynamoDB client
});
```

### Using AWS Region Configuration

Easily create adapters for different AWS regions:

```typescript
// Create adapters for different regions
const usAdapter = createAdapter<Product>({
  tableName: 'my-table',
  region: 'us-east-1'
});

const euAdapter = createAdapter<Product>({
  tableName: 'my-table',
  region: 'eu-west-1'
});

const asiaAdapter = createAdapter<Product>({
  tableName: 'my-table',
  region: 'ap-southeast-1'
});
```

### Using Custom DynamoDB Client

Provide your own pre-configured DynamoDB client with custom settings:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const customClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ 
    region: 'eu-west-1',
    maxAttempts: 5,
    requestHandler: {
      requestTimeout: 10000
    }
  })
);

const adapter = createAdapter<Product>({
  tableName: 'my-table',
  client: customClient  // Custom client takes precedence over region config
});
```

**Note:** When both `client` and `region` are provided, the custom client takes precedence and the region configuration is ignored.

### Using Custom Logger

Integrate your own logging solution:

```typescript
const customLogger = {
  debug: (msg, ...args) => myLogger.debug(msg, args),
  info: (msg, ...args) => myLogger.info(msg, args),
  warn: (msg, ...args) => myLogger.warn(msg, args),
  error: (msg, ...args) => myLogger.error(msg, args),
};

const adapter = createAdapter<Product>({
  tableName: 'my-table',
  logger: customLogger
});
```

## API Methods

- `createOneRecord(record)` - Create a single record with timestamps
- `deleteOneRecord(keys)` - Delete a single record
- `replaceOneRecord(record)` - Replace an entire record
- `patchOneRecord(keys, updates)` - Partially update a record
- `createManyRecords(records)` - Create multiple records (batch)
- `deleteManyRecords(keysList)` - Delete multiple records (batch)
- `patchManyRecords(updates)` - Update multiple records
- `fetchAllRecords(sk)` - Fetch all records by sort key
- `createFetchAllRecords(index?, sk?)` - Create a reusable fetch function

## Testing

### Setup Database

```bash
npm run setup:db
```

### Run Tests

```bash
npm test
```

### Teardown Database

```bash
npm run teardown:db
```

## Development

### Build

```bash
npm run build
```

This creates:
- `dist/esm/` - ES modules
- `dist/cjs/` - CommonJS modules  
- `dist/types/` - TypeScript declarations

## License

ISC