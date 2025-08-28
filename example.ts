import { createAdapter } from './src';

// Define your entity type - no need to extend BaseRecord
interface Product {
  id: string;
  sk: string;
  name: string;
  price: number;
  category?: string;
  // Optional: include timestamps if you want to provide them
  createdAt?: string;
  updatedAt?: string;
}

async function example() {
  // Create adapter with TypeScript generics
  const adapter = createAdapter<Product>({
    tableName: 'my-products-table',
    // Optional configuration
    // partitionKey: 'id',     // default
    // sortKey: 'sk',          // default
    // gsiName: 'gsiBySk',     // default
  });

  // Create a product
  const product = await adapter.createOneRecord({
    id: 'prod-123',
    sk: 'products',
    name: 'Awesome Widget',
    price: 29.99,
    category: 'Electronics',
  });
  console.log('Created:', product);
  // Output includes createdAt and updatedAt timestamps

  // Update product price
  const updated = await adapter.patchOneRecord(
    { id: 'prod-123', sk: 'products' },
    { price: 34.99 }
  );
  console.log('Updated:', updated);
  // updatedAt timestamp is automatically updated

  // Fetch all products using GSI
  const allProducts = await adapter.fetchAllRecords('products');
  console.log('All products:', allProducts);

  // Create batch of products
  const batchProducts = await adapter.createManyRecords([
    { id: 'prod-456', sk: 'products', name: 'Widget Pro', price: 49.99 },
    { id: 'prod-789', sk: 'products', name: 'Widget Ultra', price: 99.99 },
  ]);
  console.log('Batch created:', batchProducts.length, 'products');

  // Delete a product
  await adapter.deleteOneRecord({ id: 'prod-123', sk: 'products' });
  console.log('Product deleted');
}

// Run example
example().catch(console.error);
