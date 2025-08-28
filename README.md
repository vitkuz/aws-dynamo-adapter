# @vitkuz/dynamodb-adapter

[![npm version](https://badge.fury.io/js/@vitkuz%2Fdynamodb-adapter.svg)](https://www.npmjs.com/package/@vitkuz/dynamodb-adapter)

Type-safe DynamoDB adapter with configurable keys and comprehensive operations.

## Features

- ✅ Full TypeScript support with method-level generics
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
npm install @vitkuz/dynamodb-adapter
```

## Usage

### Basic Example

```typescript
import { createAdapter } from '@vitkuz/dynamodb-adapter';

interface Product {
  id: string;
  sk: string;
  name: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

// Create adapter - note: generics are at method level, not adapter level
const adapter = createAdapter({
  tableName: 'my-products-table'
});

// Create a product with type specified at method level
const product = await adapter.createOneRecord<Product>({
  id: 'prod-123',
  sk: 'products',
  name: 'Widget',
  price: 29.99
});

// Update a product
const updated = await adapter.patchOneRecord<Product>(
  { id: 'prod-123', sk: 'products' },
  { price: 34.99 }
);

// Fetch all products
const products = await adapter.fetchAllRecords<Product>('products');
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
const usAdapter = createAdapter({
  tableName: 'my-table',
  region: 'us-east-1'
});

const euAdapter = createAdapter({
  tableName: 'my-table',
  region: 'eu-west-1'
});

const asiaAdapter = createAdapter({
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

## API Methods with Examples

**Important:** Generics are specified at the method level, not when creating the adapter.

```typescript
import { createAdapter, generateId } from '@vitkuz/dynamodb-adapter';

// Define your types
interface Product {
  id: string;
  sk: string;
  name: string;
  price: number;
  category?: string;
}

interface User {
  id: string;
  sk: string;
  email: string;
  username: string;
}

// Create adapter once - no generic here
const adapter = createAdapter({
  tableName: 'my-table'
});
```

### Single Record Operations

#### `createOneRecord<T>(record)` - Create with automatic timestamps
```typescript
const product = await adapter.createOneRecord<Product>({
  id: generateId(),
  sk: 'products',
  name: 'Widget Pro',
  price: 99.99,
  category: 'Electronics'
});
// Returns: Product with createdAt and updatedAt timestamps
```

#### `fetchOneRecord<T>(keys)` - Fetch by composite key
```typescript
const product = await adapter.fetchOneRecord<Product>({
  id: 'prod-123',
  sk: 'products'
});
// Returns: Product | null
```

#### `replaceOneRecord<T>(record)` - Full replacement
```typescript
const replaced = await adapter.replaceOneRecord<Product>({
  id: 'prod-123',
  sk: 'products',
  name: 'Widget Pro Max',
  price: 149.99,
  category: 'Premium Electronics'
});
// Preserves createdAt, updates updatedAt
```

#### `patchOneRecord<T>(keys, updates)` - Partial update
```typescript
const updated = await adapter.patchOneRecord<Product>(
  { id: 'prod-123', sk: 'products' },
  { price: 89.99, category: 'Sale' }
);
// Only updates specified fields and updatedAt
```

#### `deleteOneRecord(keys)` - Delete by key
```typescript
await adapter.deleteOneRecord({ id: 'prod-123', sk: 'products' });
// No return value, throws if fails
```

### Batch Operations

#### `createManyRecords<T>(records)` - Batch creation
```typescript
const products = await adapter.createManyRecords<Product>([
  { id: generateId(), sk: 'products', name: 'Widget A', price: 29.99 },
  { id: generateId(), sk: 'products', name: 'Widget B', price: 39.99 },
  { id: generateId(), sk: 'products', name: 'Widget C', price: 49.99 }
]);
// Returns: Product[] with timestamps added
// Automatically handles DynamoDB batch limits (25 items)
```

#### `fetchManyRecords<T>(keysList)` - Batch fetch by keys
```typescript
const products = await adapter.fetchManyRecords<Product>([
  { id: 'prod-1', sk: 'products' },
  { id: 'prod-2', sk: 'products' },
  { id: 'prod-3', sk: 'products' }
]);
// Returns: Product[] (only existing records)
// Automatically handles DynamoDB batch limits (100 items)
```

#### `patchManyRecords<T>(updates)` - Batch partial updates
```typescript
const updated = await adapter.patchManyRecords<Product>([
  { 
    keys: { id: 'prod-1', sk: 'products' },
    updates: { price: 24.99 }
  },
  {
    keys: { id: 'prod-2', sk: 'products' },
    updates: { category: 'Clearance', price: 19.99 }
  }
]);
// Returns: Product[] with updated records
```

#### `deleteManyRecords(keysList)` - Batch deletion
```typescript
await adapter.deleteManyRecords([
  { id: 'prod-1', sk: 'products' },
  { id: 'prod-2', sk: 'products' },
  { id: 'prod-3', sk: 'products' }
]);
// Automatically handles DynamoDB batch limits (25 items)
```

### Query Operations

#### `fetchAllRecords<T>(sk)` - Query by sort key using GSI
```typescript
// Fetch all products
const products = await adapter.fetchAllRecords<Product>('products');

// Fetch all users
const users = await adapter.fetchAllRecords<User>('users');

// Handles pagination automatically
```

#### `createFetchAllRecords<T>(index?, sk?)` - Create reusable query function
```typescript
// Create a reusable function for fetching products
const fetchProducts = adapter.createFetchAllRecords<Product>(
  'gsiBySk',  // optional: specify GSI name
  'products'  // optional: specify sort key
);

// Use the function multiple times
const allProducts = await fetchProducts();
const productsAgain = await fetchProducts();
```

### Working with Multiple Entity Types

The adapter can handle different entity types in the same table:

```typescript
// Same adapter, different types per method
const adapter = createAdapter({
  tableName: 'my-multi-entity-table'
});

// Create different entity types
const product = await adapter.createOneRecord<Product>({
  id: generateId(),
  sk: 'products',
  name: 'Widget',
  price: 29.99
});

const user = await adapter.createOneRecord<User>({
  id: generateId(),
  sk: 'users',
  email: 'user@example.com',
  username: 'johndoe'
});

// Query by entity type
const allProducts = await adapter.fetchAllRecords<Product>('products');
const allUsers = await adapter.fetchAllRecords<User>('users');
```

## Testing

### Setup Database

```bash
npm run setup:db
```

### Run Tests

```bash
# Run individual test suites
npm run test:create        # Test record creation
npm run test:fetch         # Test record fetching
npm run test:batch         # Test batch operations
npm run test:fetch-many    # Test fetching multiple records
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

## Repository

[GitHub - vitkuz/aws-dynamo-adapter](https://github.com/vitkuz/aws-dynamo-adapter)

## Author

Vitkuz

## License

ISC