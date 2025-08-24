import { createAdapter, generateId } from '../adapters/dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

// Example 1: Simple record without timestamp fields in type
interface SimpleProduct {
  id: string;
  sk: string;
  name: string;
  price: number;
}

// Example 2: Record with optional timestamps
interface ProductWithOptionalTimestamps {
  id: string;
  sk: string;
  name: string;
  price: number;
  createdAt?: string;
  updatedAt?: string;
}

// Example 3: Custom record with different fields
interface CustomRecord {
  id: string;
  sk: string;
  data: {
    nested: string;
    values: number[];
  };
  metadata?: Record<string, any>;
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
    console.log('\n🧪 Running flexible types tests...\n');

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

    console.log(`\n📊 Results: ${this.passed} passed, ${this.failed} failed\n`);

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

  ok: (value: any, message?: string) => {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },

  deepEqual: (actual: any, expected: any, message?: string) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        message ||
          `Objects are not equal: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`
      );
    }
  },
};

// Run tests
const runner = new TestRunner();

// Test: Simple product without timestamps in type
runner.test('should work with simple types without timestamp fields', async () => {
  const adapter = createAdapter<SimpleProduct>({
    tableName: TABLE_NAME,
  });

  const product: SimpleProduct = {
    id: generateId(),
    sk: 'products',
    name: 'Simple Product',
    price: 29.99,
  };

  // Create record - adapter adds timestamps automatically
  const created = await adapter.createOneRecord(product);

  assert.equal(created.id, product.id, 'ID should match');
  assert.equal(created.name, product.name, 'Name should match');
  assert.equal(created.price, product.price, 'Price should match');
  assert.ok(created.createdAt, 'Should have createdAt timestamp');
  assert.ok(created.updatedAt, 'Should have updatedAt timestamp');

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Product with optional timestamps
runner.test('should work with optional timestamp fields', async () => {
  const adapter = createAdapter<ProductWithOptionalTimestamps>({
    tableName: TABLE_NAME,
  });

  // Test 1: Without providing timestamps
  const product1: ProductWithOptionalTimestamps = {
    id: generateId(),
    sk: 'products',
    name: 'Product without timestamps',
    price: 39.99,
  };

  const created1 = await adapter.createOneRecord(product1);
  assert.ok(created1.createdAt, 'Should generate createdAt');
  assert.ok(created1.updatedAt, 'Should generate updatedAt');

  // Test 2: With providing timestamps
  const customDate = '2024-01-01T00:00:00.000Z';
  const product2: ProductWithOptionalTimestamps = {
    id: generateId(),
    sk: 'products',
    name: 'Product with timestamps',
    price: 49.99,
    createdAt: customDate,
    updatedAt: customDate,
  };

  const created2 = await adapter.createOneRecord(product2);
  assert.equal(created2.createdAt, customDate, 'Should preserve provided createdAt');
  assert.equal(created2.updatedAt, customDate, 'Should preserve provided updatedAt');

  // Cleanup
  await adapter.deleteOneRecord({ id: created1.id, sk: created1.sk });
  await adapter.deleteOneRecord({ id: created2.id, sk: created2.sk });
});

// Test: Custom record with nested data
runner.test('should work with complex nested types', async () => {
  const adapter = createAdapter<CustomRecord>({
    tableName: TABLE_NAME,
  });

  const record: CustomRecord = {
    id: generateId(),
    sk: 'custom',
    data: {
      nested: 'value',
      values: [1, 2, 3, 4, 5],
    },
    metadata: {
      key1: 'value1',
      key2: 42,
      key3: true,
    },
  };

  const created = await adapter.createOneRecord(record);

  assert.equal(created.id, record.id, 'ID should match');
  assert.deepEqual(created.data, record.data, 'Nested data should match');
  assert.deepEqual(created.metadata, record.metadata, 'Metadata should match');
  assert.ok(created.createdAt, 'Should have createdAt timestamp');
  assert.ok(created.updatedAt, 'Should have updatedAt timestamp');

  // Test updating
  const updated = await adapter.patchOneRecord(
    { id: created.id, sk: created.sk },
    {
      data: {
        nested: 'updated',
        values: [10, 20, 30],
      },
    }
  );

  assert.equal(updated.data.nested, 'updated', 'Nested value should be updated');
  assert.deepEqual(updated.data.values, [10, 20, 30], 'Array should be updated');
  assert.ok(updated.updatedAt > created.updatedAt, 'UpdatedAt should be newer');

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Batch operations with mixed types
runner.test('should handle batch operations with flexible types', async () => {
  const adapter = createAdapter<SimpleProduct>({
    tableName: TABLE_NAME,
  });

  const products: SimpleProduct[] = [
    { id: generateId(), sk: 'products', name: 'Product 1', price: 10 },
    { id: generateId(), sk: 'products', name: 'Product 2', price: 20 },
    { id: generateId(), sk: 'products', name: 'Product 3', price: 30 },
  ];

  const created = await adapter.createManyRecords(products);

  assert.equal(created.length, 3, 'Should create all products');
  created.forEach((product, i) => {
    assert.equal(product.name, products[i].name, `Product ${i} name should match`);
    assert.equal(product.price, products[i].price, `Product ${i} price should match`);
    assert.ok(product.createdAt, `Product ${i} should have createdAt`);
    assert.ok(product.updatedAt, `Product ${i} should have updatedAt`);
  });

  // Cleanup
  const keysToDelete = created.map((p) => ({ id: p.id, sk: p.sk }));
  await adapter.deleteManyRecords(keysToDelete);
});

// Test: Any type record (maximum flexibility)
runner.test('should work with any type (Record<string, any>)', async () => {
  // Using the most flexible type
  const adapter = createAdapter<Record<string, any>>({
    tableName: TABLE_NAME,
  });

  const record = {
    id: generateId(),
    sk: 'anything',
    randomField: 'random value',
    numberField: 123,
    boolField: true,
    arrayField: ['a', 'b', 'c'],
    objectField: { nested: { deeply: 'value' } },
  };

  const created = await adapter.createOneRecord(record);

  assert.equal(created.randomField, 'random value', 'String field should match');
  assert.equal(created.numberField, 123, 'Number field should match');
  assert.equal(created.boolField, true, 'Boolean field should match');
  assert.deepEqual(created.arrayField, ['a', 'b', 'c'], 'Array field should match');
  assert.deepEqual(
    created.objectField,
    { nested: { deeply: 'value' } },
    'Object field should match'
  );
  assert.ok(created.createdAt, 'Should have createdAt timestamp');
  assert.ok(created.updatedAt, 'Should have updatedAt timestamp');

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Run all tests
runner.run().catch(console.error);
