import { createAdapter, generateId } from './src';

// Define your entity types - no need to extend BaseRecord
interface Product {
  id: string;
  sk: string;
  name: string;
  price: number;
  category?: string;
  inStock?: boolean;
  // Optional: include timestamps if you want to provide them
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  id: string;
  sk: string;
  email: string;
  username: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

async function demonstrateAllMethods() {
  console.log('🚀 DynamoDB Adapter - Complete Example\n');

  // Create adapter - generics are used at method level, not adapter level
  const adapter = createAdapter({
    tableName: 'my-multi-entity-table',
    // Optional configuration
    // partitionKey: 'id',     // default: 'id'
    // sortKey: 'sk',          // default: 'sk'
    // gsiName: 'gsiBySk',     // default: 'gsiBySk'
    // region: 'us-east-1',    // optional: AWS region
    // logger: customLogger,   // optional: custom logger
    // client: customClient    // optional: custom DynamoDB client
  });

  // ==========================================
  // SINGLE RECORD OPERATIONS
  // ==========================================

  console.log('📝 Single Record Operations\n');

  // 1. createOneRecord - Create a single product with automatic timestamps
  console.log('1. Creating a product...');
  const productId = generateId();
  const product = await adapter.createOneRecord<Product>({
    id: productId,
    sk: 'products',
    name: 'Widget Pro',
    price: 99.99,
    category: 'Electronics',
    inStock: true,
  });
  console.log('   Created:', { id: product.id, name: product.name, createdAt: product.createdAt });

  // 2. fetchOneRecord - Fetch the product we just created
  console.log('2. Fetching the product by keys...');
  const fetchedProduct = await adapter.fetchOneRecord<Product>({
    id: productId,
    sk: 'products',
  });
  console.log('   Fetched:', fetchedProduct ? fetchedProduct.name : 'Not found');

  // 3. patchOneRecord - Partially update the product
  console.log('3. Updating product price and category...');
  const patchedProduct = await adapter.patchOneRecord<Product>(
    { id: productId, sk: 'products' },
    { price: 89.99, category: 'Sale Items' }
  );
  console.log('   Updated price:', patchedProduct.price, 'category:', patchedProduct.category);

  // 4. replaceOneRecord - Completely replace the product (preserves createdAt)
  console.log('4. Replacing entire product...');
  const replacedProduct = await adapter.replaceOneRecord<Product>({
    id: productId,
    sk: 'products',
    name: 'Widget Pro Max',
    price: 149.99,
    category: 'Premium Electronics',
    inStock: false,
  });
  console.log('   Replaced:', { name: replacedProduct.name, price: replacedProduct.price });

  // ==========================================
  // BATCH OPERATIONS
  // ==========================================

  console.log('\n📦 Batch Operations\n');

  // 5. createManyRecords - Create multiple products at once
  console.log('5. Creating batch of products...');
  const productIds = [generateId(), generateId(), generateId()];
  const batchProducts = await adapter.createManyRecords<Product>([
    { id: productIds[0], sk: 'products', name: 'Widget A', price: 29.99, inStock: true },
    { id: productIds[1], sk: 'products', name: 'Widget B', price: 39.99, inStock: true },
    { id: productIds[2], sk: 'products', name: 'Widget C', price: 49.99, inStock: false },
  ]);
  console.log('   Created', batchProducts.length, 'products');

  // 6. fetchManyRecords - Fetch multiple specific products by their keys
  console.log('6. Fetching multiple products by keys...');
  const fetchedBatch = await adapter.fetchManyRecords<Product>([
    { id: productIds[0], sk: 'products' },
    { id: productIds[1], sk: 'products' },
    { id: productIds[2], sk: 'products' },
  ]);
  console.log(
    '   Fetched',
    fetchedBatch.length,
    'products:',
    fetchedBatch.map((p) => p.name)
  );

  // 7. patchManyRecords - Update multiple products with different updates
  console.log('7. Batch updating product prices...');
  const patchedBatch = await adapter.patchManyRecords<Product>([
    {
      keys: { id: productIds[0], sk: 'products' },
      updates: { price: 24.99, category: 'Clearance' },
    },
    {
      keys: { id: productIds[1], sk: 'products' },
      updates: { price: 34.99, inStock: false },
    },
  ]);
  console.log(
    '   Updated',
    patchedBatch.length,
    'products with new prices:',
    patchedBatch.map((p) => p.price)
  );

  // ==========================================
  // MULTI-ENTITY EXAMPLE - Users
  // ==========================================

  console.log('\n👥 Multi-Entity Support\n');

  // Create some users using the same adapter
  console.log('8. Creating users with same adapter...');
  const userIds = [generateId(), generateId()];
  const users = await adapter.createManyRecords<User>([
    {
      id: userIds[0],
      sk: 'users',
      email: 'john@example.com',
      username: 'johndoe',
      role: 'admin',
    },
    {
      id: userIds[1],
      sk: 'users',
      email: 'jane@example.com',
      username: 'janedoe',
      role: 'user',
    },
  ]);
  console.log(
    '   Created',
    users.length,
    'users:',
    users.map((u) => u.username)
  );

  // ==========================================
  // QUERY OPERATIONS
  // ==========================================

  console.log('\n🔍 Query Operations\n');

  // 9. fetchAllRecords - Fetch all products using GSI
  console.log('9. Fetching all products by sort key...');
  const allProducts = await adapter.fetchAllRecords<Product>('products');
  console.log('   Found', allProducts.length, 'total products in table');

  // 10. fetchAllRecords - Fetch all users
  console.log('10. Fetching all users by sort key...');
  const allUsers = await adapter.fetchAllRecords<User>('users');
  console.log(
    '   Found',
    allUsers.length,
    'users:',
    allUsers.map((u) => u.username)
  );

  // 11. createFetchAllRecords - Create reusable fetch functions
  console.log('11. Creating reusable fetch functions...');
  const fetchAllProducts = adapter.createFetchAllRecords<Product>('gsiBySk', 'products');
  const fetchAllUsers = adapter.createFetchAllRecords<User>('gsiBySk', 'users');

  // Use the reusable functions
  const productsAgain = await fetchAllProducts();
  const usersAgain = await fetchAllUsers();
  console.log('   Reusable fetchers work:', {
    products: productsAgain.length,
    users: usersAgain.length,
  });

  // ==========================================
  // CLEANUP OPERATIONS
  // ==========================================

  console.log('\n🧹 Cleanup Operations\n');

  // 12. deleteOneRecord - Delete a single record
  console.log('12. Deleting single product...');
  await adapter.deleteOneRecord({ id: productId, sk: 'products' });
  console.log('   Deleted product:', productId);

  // deleteManyRecords - Delete multiple records at once
  console.log('13. Batch deleting remaining test data...');
  const keysToDelete = [
    ...productIds.map((id) => ({ id, sk: 'products' })),
    ...userIds.map((id) => ({ id, sk: 'users' })),
  ];
  await adapter.deleteManyRecords(keysToDelete);
  console.log('   Deleted', keysToDelete.length, 'records');

  // ==========================================
  // ADVANCED PATTERNS
  // ==========================================

  console.log('\n⚡ Advanced Patterns\n');

  // Working with optional timestamps
  console.log('14. Creating with custom timestamps...');
  const customDate = '2024-01-01T00:00:00.000Z';
  const productWithTimestamp = await adapter.createOneRecord<Product>({
    id: generateId(),
    sk: 'products',
    name: 'Vintage Widget',
    price: 199.99,
    createdAt: customDate, // Provide your own timestamp
    updatedAt: customDate,
  });
  console.log('   Created with custom date:', productWithTimestamp.createdAt);

  // Cleanup
  await adapter.deleteOneRecord({
    id: productWithTimestamp.id,
    sk: productWithTimestamp.sk,
  });

  console.log('\n✅ All operations demonstrated successfully!');
}

// Error handling example
async function demonstrateErrorHandling() {
  console.log('\n⚠️ Error Handling Example\n');

  const adapter = createAdapter({
    tableName: 'my-table',
  });

  try {
    // Attempt to fetch a non-existent record
    const notFound = await adapter.fetchOneRecord<Product>({
      id: 'non-existent',
      sk: 'products',
    });
    console.log('Record found:', notFound); // Will be null
  } catch (error) {
    console.error('Error fetching record:', error);
  }

  try {
    // Attempt to update a non-existent record
    await adapter.patchOneRecord<Product>(
      { id: 'non-existent', sk: 'products' },
      { price: 99.99 }
    );
  } catch (error) {
    console.error('Expected error updating non-existent record:', error);
  }
}

// Run examples
async function runExamples() {
  try {
    await demonstrateAllMethods();
    await demonstrateErrorHandling();
  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Execute if running directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export { demonstrateAllMethods, demonstrateErrorHandling };