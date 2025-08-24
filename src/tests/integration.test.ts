import { createAdapter } from '../adapters/dynamodb';
import { BaseRecord } from '../shared/types';
import { generateId } from '../adapters/dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

interface TestProduct extends BaseRecord {
  id: string;
  sk: string;
  name: string;
  price: number;
  category?: string;
}

interface TestUser extends BaseRecord {
  id: string;
  sk: string;
  email: string;
  username: string;
}

// Simple test runner
class TestRunner {
  private tests: Array<{ name: string; fn: () => Promise<void> }> = [];
  private passed = 0;
  private failed = 0;

  test(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\\n🧪 Running integration tests...\\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (error) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.error(`   Error: ${error}`);
      }
    }

    console.log(`\\n📊 Results: ${this.passed} passed, ${this.failed} failed\\n`);

    if (this.failed > 0) {
      process.exit(1);
    }
  }
}

// Assertion helpers
const assert = {
  equal: (actual: any, expected: any, message?: string) => {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
  },

  deepEqual: (actual: any, expected: any, message?: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(message || `Objects are not equal`);
    }
  },

  ok: (value: any, message?: string) => {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },

  includes: (array: any[], item: any, message?: string) => {
    if (!array.includes(item)) {
      throw new Error(message || `Array does not include ${item}`);
    }
  },

  length: (array: any[], expectedLength: number, message?: string) => {
    if (array.length !== expectedLength) {
      throw new Error(message || `Expected length ${expectedLength}, got ${array.length}`);
    }
  },
};

// Run tests
const runner = new TestRunner();

// Test: Create adapter with default configuration
runner.test('should create adapter with default configuration', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  assert.ok(adapter, 'Adapter should be created');
  assert.ok(adapter.createOneRecord, 'Should have createOneRecord method');
  assert.ok(adapter.deleteOneRecord, 'Should have deleteOneRecord method');
  assert.ok(adapter.replaceOneRecord, 'Should have replaceOneRecord method');
  assert.ok(adapter.patchOneRecord, 'Should have patchOneRecord method');
  assert.ok(adapter.createManyRecords, 'Should have createManyRecords method');
  assert.ok(adapter.deleteManyRecords, 'Should have deleteManyRecords method');
  assert.ok(adapter.patchManyRecords, 'Should have patchManyRecords method');
  assert.ok(adapter.fetchAllRecords, 'Should have fetchAllRecords method');
  assert.ok(adapter.createFetchAllRecords, 'Should have createFetchAllRecords method');
});

// Test: Create adapter with custom configuration
runner.test('should create adapter with custom configuration', async () => {
  const customLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const adapter = createAdapter({
    tableName: TABLE_NAME,
    partitionKey: 'customId',
    sortKey: 'customSk',
    gsiName: 'customGsi',
    logger: customLogger,
  });

  assert.ok(adapter, 'Adapter with custom config should be created');
});

// Test: Create one record
runner.test('should create one record with timestamps', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
  };

  const created = await adapter.createOneRecord<TestProduct>(product);

  assert.equal(created.id, product.id, 'ID should match');
  assert.equal(created.sk, product.sk, 'Sort key should match');
  assert.equal(created.name, product.name, 'Name should match');
  assert.equal(created.price, product.price, 'Price should match');
  assert.ok(created.createdAt, 'Should have createdAt timestamp');
  assert.ok(created.updatedAt, 'Should have updatedAt timestamp');
  assert.equal(created.createdAt, created.updatedAt, 'Timestamps should be equal on creation');

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Delete one record
runner.test('should delete one record', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product to Delete',
    price: 49.99,
  };

  const created = await adapter.createOneRecord<TestProduct>(product);
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });

  // Verify deletion by trying to fetch all products
  const products = await adapter.fetchAllRecords<TestProduct>('products');
  const found = products.find((p) => p.id === created.id);
  assert.ok(!found, 'Product should be deleted');
});

// Test: Replace one record
runner.test('should replace one record and update timestamp', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Original Product',
    price: 29.99,
  };

  const created = await adapter.createOneRecord<TestProduct>(product);

  // Wait a bit to ensure different timestamp
  await new Promise((resolve) => setTimeout(resolve, 100));

  const updatedProduct = {
    ...created,
    name: 'Updated Product',
    price: 39.99,
    category: 'Electronics',
  };

  const replaced = await adapter.replaceOneRecord<TestProduct>(updatedProduct);

  assert.equal(replaced.id, created.id, 'ID should remain the same');
  assert.equal(replaced.name, 'Updated Product', 'Name should be updated');
  assert.equal(replaced.price, 39.99, 'Price should be updated');
  assert.equal(replaced.category, 'Electronics', 'Category should be added');
  assert.equal(replaced.createdAt, created.createdAt, 'CreatedAt should remain the same');
  assert.ok(replaced.updatedAt > created.updatedAt, 'UpdatedAt should be newer');

  // Cleanup
  await adapter.deleteOneRecord({ id: replaced.id, sk: replaced.sk });
});

// Test: Patch one record
runner.test('should patch one record with partial updates', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product to Patch',
    price: 19.99,
  };

  const created = await adapter.createOneRecord<TestProduct>(product);

  // Wait a bit to ensure different timestamp
  await new Promise((resolve) => setTimeout(resolve, 100));

  const patched = await adapter.patchOneRecord<TestProduct>(
    { id: created.id, sk: created.sk },
    { price: 24.99, category: 'Books' }
  );

  assert.equal(patched.id, created.id, 'ID should remain the same');
  assert.equal(patched.name, created.name, 'Name should remain the same');
  assert.equal(patched.price, 24.99, 'Price should be updated');
  assert.equal(patched.category, 'Books', 'Category should be added');
  assert.ok(patched.updatedAt > created.updatedAt, 'UpdatedAt should be newer');

  // Cleanup
  await adapter.deleteOneRecord({ id: patched.id, sk: patched.sk });
});

// Test: Create many records
runner.test('should create many records in batches', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const products = Array.from({ length: 30 }, (_, i) => ({
    id: generateId(),
    sk: 'products',
    name: `Bulk Product ${i}`,
    price: 10 + i,
  }));

  const created = await adapter.createManyRecords<TestProduct>(products);

  assert.length(created, 30, 'Should create all 30 products');

  // Verify all have timestamps
  created.forEach((product) => {
    assert.ok(product.createdAt, 'Each product should have createdAt');
    assert.ok(product.updatedAt, 'Each product should have updatedAt');
  });

  // Cleanup
  const keysToDelete = created.map((p) => ({ id: p.id, sk: p.sk }));
  await adapter.deleteManyRecords(keysToDelete);
});

// Test: Delete many records
runner.test('should delete many records in batches', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const products = Array.from({ length: 10 }, (_, i) => ({
    id: generateId(),
    sk: 'products',
    name: `Product to Delete ${i}`,
    price: 5 + i,
  }));

  const created = await adapter.createManyRecords<TestProduct>(products);
  const keysToDelete = created.map((p) => ({ id: p.id, sk: p.sk }));

  await adapter.deleteManyRecords(keysToDelete);

  // Verify deletion
  const remaining = await adapter.fetchAllRecords<TestProduct>('products');
  const foundIds = created.map((p) => p.id);
  const anyFound = remaining.some((p) => foundIds.includes(p.id));

  assert.ok(!anyFound, 'All products should be deleted');
});

// Test: Patch many records
runner.test('should patch many records', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const products = Array.from({ length: 5 }, (_, i) => ({
    id: generateId(),
    sk: 'products',
    name: `Product ${i}`,
    price: 20 + i,
  }));

  const created = await adapter.createManyRecords<TestProduct>(products);

  // Wait a bit to ensure different timestamp
  await new Promise((resolve) => setTimeout(resolve, 100));

  const updates = created.map((p) => ({
    keys: { id: p.id, sk: p.sk },
    updates: { price: p.price * 2, category: 'Sale' },
  }));

  const patched = await adapter.patchManyRecords<TestProduct>(updates);

  assert.length(patched, 5, 'Should patch all 5 products');

  patched.forEach((product, i) => {
    assert.equal(product.price, (20 + i) * 2, 'Price should be doubled');
    assert.equal(product.category, 'Sale', 'Category should be added');
    assert.ok(product.updatedAt > created[i].updatedAt, 'UpdatedAt should be newer');
  });

  // Cleanup
  const keysToDelete = patched.map((p) => ({ id: p.id, sk: p.sk }));
  await adapter.deleteManyRecords(keysToDelete);
});

// Test: Fetch all records by sort key
runner.test('should fetch all records by sort key', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const products = Array.from({ length: 15 }, (_, i) => ({
    id: generateId(),
    sk: 'products',
    name: `Product ${i}`,
    price: 15 + i,
  }));

  const created = await adapter.createManyRecords<TestProduct>(products);

  const fetched = await adapter.fetchAllRecords<TestProduct>('products');

  // Should contain at least our created products
  assert.ok(fetched.length >= 15, 'Should fetch at least 15 products');

  // Verify our products are in the fetched results
  const createdIds = created.map((p) => p.id);
  const fetchedIds = fetched.map((p) => p.id);
  createdIds.forEach((id) => {
    assert.includes(fetchedIds, id, `Product ${id} should be in fetched results`);
  });

  // Cleanup
  const keysToDelete = created.map((p) => ({ id: p.id, sk: p.sk }));
  await adapter.deleteManyRecords(keysToDelete);
});

// Test: Create fetch function with specific sort key
runner.test('should create fetch function for specific sort key', async () => {
  const adapter = createAdapter<TestUser>({
    tableName: TABLE_NAME,
  });

  const users = Array.from({ length: 5 }, (_, i) => ({
    id: generateId(),
    sk: 'users',
    email: `user${i}@example.com`,
    username: `user${i}`,
  }));

  const created = await adapter.createManyRecords<TestUser>(users);

  const fetchUsers = adapter.createFetchAllRecords<TestUser>('gsiBySk', 'users');
  const fetched = await fetchUsers();

  // Should contain at least our created users
  assert.ok(fetched.length >= 5, 'Should fetch at least 5 users');

  // Verify all fetched records are users
  fetched.forEach((record) => {
    assert.equal(record.sk, 'users', 'All fetched records should be users');
  });

  // Cleanup
  const keysToDelete = created.map((u) => ({ id: u.id, sk: u.sk }));
  await adapter.deleteManyRecords(keysToDelete);
});

// Test: Create fetch function without sort key (scan all)
runner.test('should create fetch function to scan all records', async () => {
  const adapter = createAdapter<BaseRecord>({
    tableName: TABLE_NAME,
  });

  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
  };

  const user = {
    id: generateId(),
    sk: 'users',
    email: 'test@example.com',
    username: 'testuser',
  };

  const createdProduct = await adapter.createOneRecord<TestProduct>(product);
  const createdUser = await adapter.createOneRecord<TestUser>(user);

  const fetchAll = adapter.createFetchAllRecords<BaseRecord>();
  const allRecords = await fetchAll();

  // Should contain at least our created records
  assert.ok(allRecords.length >= 2, 'Should fetch at least 2 records');

  const foundProduct = allRecords.find((r) => r.id === createdProduct.id);
  const foundUser = allRecords.find((r) => r.id === createdUser.id);

  assert.ok(foundProduct, 'Product should be in results');
  assert.ok(foundUser, 'User should be in results');

  // Cleanup
  await adapter.deleteOneRecord({ id: createdProduct.id, sk: createdProduct.sk });
  await adapter.deleteOneRecord({ id: createdUser.id, sk: createdUser.sk });
});

// Test: Handle large batches (more than 25 items)
runner.test('should handle batch operations with more than 25 items', async () => {
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });

  const products = Array.from({ length: 50 }, (_, i) => ({
    id: generateId(),
    sk: 'products',
    name: `Large Batch Product ${i}`,
    price: 100 + i,
  }));

  const created = await adapter.createManyRecords<TestProduct>(products);
  assert.length(created, 50, 'Should create all 50 products');

  const keysToDelete = created.map((p) => ({ id: p.id, sk: p.sk }));
  await adapter.deleteManyRecords(keysToDelete);

  // Verify deletion
  const remaining = await adapter.fetchAllRecords<TestProduct>('products');
  const createdIds = created.map((p) => p.id);
  const anyFound = remaining.some((p) => createdIds.includes(p.id));

  assert.ok(!anyFound, 'All 50 products should be deleted');
});

// Run all tests
runner.run().catch(console.error);
