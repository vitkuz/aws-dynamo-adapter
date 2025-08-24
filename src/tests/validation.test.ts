import { createAdapter } from '../adapters/dynamodb';
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
    console.log('\\n🧪 Running validation tests...\\n');

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

// Run tests
const runner = new TestRunner();

// Test: Should fail when creating record without partition key
runner.test('should fail when creating record without partition key', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.createOneRecord({
      // Missing 'id' (partition key)
      sk: 'products',
      name: 'Test Product',
      price: 99.99,
    } as any);
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed')) {
      throw new Error(`Expected validation error, got: ${error.message}`);
    }
  }
});

// Test: Should fail when creating record without sort key
runner.test('should fail when creating record without sort key', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.createOneRecord({
      id: 'test-id',
      // Missing 'sk' (sort key)
      name: 'Test Product',
      price: 99.99,
    } as any);
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed')) {
      throw new Error(`Expected validation error, got: ${error.message}`);
    }
  }
});

// Test: Should fail when deleting with missing partition key
runner.test('should fail when deleting with missing partition key', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.deleteOneRecord({
      // Missing 'id' (partition key)
      sk: 'products',
    });
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed')) {
      throw new Error(`Expected validation error, got: ${error.message}`);
    }
  }
});

// Test: Should fail when patching with missing keys
runner.test('should fail when patching with missing keys', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.patchOneRecord(
      {
        // Missing 'id' (partition key)
        sk: 'products',
      },
      { price: 19.99 }
    );
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed')) {
      throw new Error(`Expected validation error, got: ${error.message}`);
    }
  }
});

// Test: Should filter out partition and sort keys from patch updates
runner.test('should filter out partition and sort keys from patch updates', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  // First create a record
  const created = await adapter.createOneRecord({
    id: 'test-id-filter',
    sk: 'products',
    name: 'Test Product',
    price: 29.99,
  });

  // Try to patch with partition and sort keys (should be filtered out)
  const patched = await adapter.patchOneRecord({ id: created.id, sk: created.sk }, {
    id: 'different-id', // Should be filtered out
    sk: 'different-sk', // Should be filtered out
    price: 39.99,
  } as any);

  // Verify keys weren't changed
  if (patched.id !== created.id) {
    throw new Error('Partition key should not be updated');
  }
  if (patched.sk !== created.sk) {
    throw new Error('Sort key should not be updated');
  }
  if (patched.price !== 39.99) {
    throw new Error('Price should be updated');
  }

  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should validate all records in batch operations
runner.test('should validate all records in batch operations', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.createManyRecords([
      {
        id: 'batch-1',
        sk: 'products',
        name: 'Product 1',
        price: 10,
      },
      {
        // Missing 'id' in second record
        sk: 'products',
        name: 'Product 2',
        price: 20,
      } as any,
    ]);
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed') || !error.message.includes('index 1')) {
      throw new Error(`Expected validation error for index 1, got: ${error.message}`);
    }
  }
});

// Test: Should validate all keys in batch delete operations
runner.test('should validate all keys in batch delete operations', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.deleteManyRecords([
      { id: 'key-1', sk: 'products' },
      { sk: 'products' }, // Missing 'id' in second key
    ]);
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed') || !error.message.includes('index 1')) {
      throw new Error(`Expected validation error for index 1, got: ${error.message}`);
    }
  }
});

// Test: Should validate empty strings as invalid
runner.test('should validate empty strings as invalid', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
  });

  try {
    await adapter.createOneRecord({
      id: '', // Empty string should fail validation
      sk: 'products',
      name: 'Test Product',
      price: 99.99,
    });
    throw new Error('Should have thrown validation error');
  } catch (error: any) {
    if (!error.message.includes('Validation failed')) {
      throw new Error(`Expected validation error for empty string, got: ${error.message}`);
    }
  }
});

// Test: Should convert numbers to strings for keys
runner.test('should convert numbers to strings for keys', async () => {
  const adapter = createAdapter<any>({
    tableName: TABLE_NAME,
  });

  const created = await adapter.createOneRecord({
    id: '123', // String as partition key
    sk: '456', // String as sort key
    name: 'Test with string keys',
  });

  if (created.id !== '123' || created.sk !== '456') {
    throw new Error('Should accept strings as keys');
  }

  // Cleanup
  await adapter.deleteOneRecord({ id: '123', sk: '456' });
});

// Run all tests
runner.run().catch(console.error);
