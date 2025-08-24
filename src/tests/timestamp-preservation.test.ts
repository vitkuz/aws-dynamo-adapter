import { createAdapter, generateId } from '../adapters/dynamodb';
import { BaseRecord } from '../shared/types';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

interface TestProduct extends BaseRecord {
  id: string;
  sk: string;
  name: string;
  price: number;
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
    console.log('\\n🧪 Running timestamp preservation tests...\\n');

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

  notEqual: (actual: any, expected: any, message?: string) => {
    if (actual === expected) {
      throw new Error(message || `Expected not to equal ${expected}`);
    }
  },

  ok: (value: any, message?: string) => {
    if (!value) {
      throw new Error(message || `Expected truthy value, got ${value}`);
    }
  },
};

// Run tests
const runner = new TestRunner();

// Test: Should preserve user-provided createdAt timestamp
runner.test('should preserve user-provided createdAt timestamp', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  const customCreatedAt = '2020-01-01T00:00:00.000Z';
  const record = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
    createdAt: customCreatedAt,
  };

  const created = await adapter.createOneRecord(record);

  assert.equal(created.createdAt, customCreatedAt, 'createdAt should be preserved');
  assert.ok(created.updatedAt, 'updatedAt should be generated');
  assert.notEqual(
    created.updatedAt,
    customCreatedAt,
    'updatedAt should be different from custom createdAt'
  );

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should preserve user-provided updatedAt timestamp
runner.test('should preserve user-provided updatedAt timestamp', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  const customUpdatedAt = '2020-02-02T00:00:00.000Z';
  const record = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
    updatedAt: customUpdatedAt,
  };

  const created = await adapter.createOneRecord(record);

  assert.equal(created.updatedAt, customUpdatedAt, 'updatedAt should be preserved');
  assert.ok(created.createdAt, 'createdAt should be generated');
  assert.notEqual(
    created.createdAt,
    customUpdatedAt,
    'createdAt should be different from custom updatedAt'
  );

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should preserve both timestamps when provided
runner.test('should preserve both timestamps when provided', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  const customCreatedAt = '2020-01-01T00:00:00.000Z';
  const customUpdatedAt = '2020-02-02T00:00:00.000Z';
  const record = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
    createdAt: customCreatedAt,
    updatedAt: customUpdatedAt,
  };

  const created = await adapter.createOneRecord(record);

  assert.equal(created.createdAt, customCreatedAt, 'createdAt should be preserved');
  assert.equal(created.updatedAt, customUpdatedAt, 'updatedAt should be preserved');

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should generate both timestamps when not provided
runner.test('should generate both timestamps when not provided', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  const beforeCreate = new Date().toISOString();

  const record = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
  };

  const created = await adapter.createOneRecord(record);

  const afterCreate = new Date().toISOString();

  assert.ok(created.createdAt >= beforeCreate, 'createdAt should be after test start');
  assert.ok(created.createdAt <= afterCreate, 'createdAt should be before test end');
  assert.equal(
    created.createdAt,
    created.updatedAt,
    'timestamps should be equal when auto-generated'
  );

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should preserve timestamps in batch operations
runner.test('should preserve timestamps in batch operations', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  const customTimestamp1 = '2020-01-01T00:00:00.000Z';
  const customTimestamp2 = '2020-02-02T00:00:00.000Z';

  const records = [
    {
      id: generateId(),
      sk: 'products',
      name: 'Product 1',
      price: 10,
      createdAt: customTimestamp1,
    },
    {
      id: generateId(),
      sk: 'products',
      name: 'Product 2',
      price: 20,
      updatedAt: customTimestamp2,
    },
    {
      id: generateId(),
      sk: 'products',
      name: 'Product 3',
      price: 30,
      createdAt: customTimestamp1,
      updatedAt: customTimestamp2,
    },
    {
      id: generateId(),
      sk: 'products',
      name: 'Product 4',
      price: 40,
      // No timestamps provided
    },
  ];

  const created = await adapter.createManyRecords(records);

  assert.equal(
    created[0].createdAt,
    customTimestamp1,
    'First record createdAt should be preserved'
  );
  assert.ok(
    created[0].updatedAt !== customTimestamp1,
    'First record updatedAt should be generated'
  );

  assert.equal(
    created[1].updatedAt,
    customTimestamp2,
    'Second record updatedAt should be preserved'
  );
  assert.ok(
    created[1].createdAt !== customTimestamp2,
    'Second record createdAt should be generated'
  );

  assert.equal(
    created[2].createdAt,
    customTimestamp1,
    'Third record createdAt should be preserved'
  );
  assert.equal(
    created[2].updatedAt,
    customTimestamp2,
    'Third record updatedAt should be preserved'
  );

  assert.ok(created[3].createdAt, 'Fourth record createdAt should be generated');
  assert.ok(created[3].updatedAt, 'Fourth record updatedAt should be generated');
  assert.equal(
    created[3].createdAt,
    created[3].updatedAt,
    'Fourth record timestamps should be equal'
  );

  // Cleanup
  const keysToDelete = created.map((p) => ({ id: p.id, sk: p.sk }));
  await adapter.deleteManyRecords(keysToDelete);
});

// Test: Should handle empty string timestamps as missing
runner.test('should handle empty string timestamps as missing', async () => {
  const adapter = createAdapter<any>({
    tableName: TABLE_NAME,
  });

  const record = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
    createdAt: '', // Empty string should be treated as missing
    updatedAt: '', // Empty string should be treated as missing
  };

  const created = await adapter.createOneRecord(record);

  assert.ok(
    created.createdAt && created.createdAt !== '',
    'createdAt should be generated when empty'
  );
  assert.ok(
    created.updatedAt && created.updatedAt !== '',
    'updatedAt should be generated when empty'
  );
  assert.equal(created.createdAt, created.updatedAt, 'timestamps should be equal when both empty');

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should handle null/undefined timestamps as missing
runner.test('should handle null/undefined timestamps as missing', async () => {
  const adapter = createAdapter<any>({
    tableName: TABLE_NAME,
  });

  const record = {
    id: generateId(),
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
    createdAt: null as any,
    updatedAt: undefined as any,
  };

  const created = await adapter.createOneRecord(record);

  assert.ok(created.createdAt, 'createdAt should be generated when null');
  assert.ok(created.updatedAt, 'updatedAt should be generated when undefined');
  assert.equal(
    created.createdAt,
    created.updatedAt,
    'timestamps should be equal when both missing'
  );

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Run all tests
runner.run().catch(console.error);
