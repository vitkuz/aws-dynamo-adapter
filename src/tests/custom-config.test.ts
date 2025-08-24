import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { createAdapter, generateId } from '../adapters/dynamodb';
import { BaseRecord, Logger } from '../shared/types';

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
    console.log('\n🧪 Running custom configuration tests...\n');
    
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
  
  includes: (str: string, substring: string, message?: string) => {
    if (!str.includes(substring)) {
      throw new Error(message || `Expected "${str}" to include "${substring}"`);
    }
  }
};

// Run tests
const runner = new TestRunner();

// Test: Should use custom client
runner.test('should use custom DynamoDB client with custom configuration', async () => {
  const customClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ 
      maxAttempts: 5,
      requestHandler: {
        requestTimeout: 10000,
        httpsAgent: { keepAlive: true }
      } as any
    })
  );
  
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    client: customClient
  });
  
  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product with Custom Client',
    price: 49.99,
  };
  
  const created = await adapter.createOneRecord(product);
  
  assert.ok(created, 'Should create product with custom client');
  assert.equal(created.name, product.name, 'Product name should match');
  
  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should use custom logger
runner.test('should use custom logger implementation', async () => {
  const logMessages: Array<{ level: string; message: string; args: unknown[] }> = [];
  
  const customLogger: Logger = {
    debug: (message: string, ...args: unknown[]) => {
      logMessages.push({ level: 'debug', message, args });
    },
    info: (message: string, ...args: unknown[]) => {
      logMessages.push({ level: 'info', message, args });
    },
    warn: (message: string, ...args: unknown[]) => {
      logMessages.push({ level: 'warn', message, args });
    },
    error: (message: string, ...args: unknown[]) => {
      logMessages.push({ level: 'error', message, args });
    },
  };
  
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    logger: customLogger
  });
  
  // Check that adapter creation was logged
  const adapterCreatedLog = logMessages.find(log => 
    log.level === 'info' && log.message === 'DynamoDB adapter created'
  );
  assert.ok(adapterCreatedLog, 'Should log adapter creation');
  
  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product with Custom Logger',
    price: 79.99,
  };
  
  // Create a product
  const created = await adapter.createOneRecord(product);
  
  // Check that creation was logged
  const createLog = logMessages.find(log => 
    log.level === 'info' && log.message === 'Record created successfully'
  );
  assert.ok(createLog, 'Should log record creation');
  
  // Delete the product
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
  
  // Check that deletion was logged
  const deleteLog = logMessages.find(log => 
    log.level === 'info' && log.message === 'Record deleted successfully'
  );
  assert.ok(deleteLog, 'Should log record deletion');
  
  // Verify multiple log entries were captured
  assert.ok(logMessages.length >= 5, 'Should have captured multiple log messages');
});

// Test: Should use both custom client and logger
runner.test('should use both custom client and custom logger', async () => {
  const logMessages: string[] = [];
  
  const customClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ 
      region: 'us-east-1',
      maxAttempts: 3
    })
  );
  
  const customLogger: Logger = {
    debug: () => {},  // Suppress debug logs
    info: (message: string) => logMessages.push(`[INFO] ${message}`),
    warn: (message: string) => logMessages.push(`[WARN] ${message}`),
    error: (message: string) => logMessages.push(`[ERROR] ${message}`),
  };
  
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    client: customClient,
    logger: customLogger
  });
  
  assert.includes(logMessages[0], '[INFO] DynamoDB adapter created', 'Should use custom logger format');
  
  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product with Both Custom',
    price: 99.99,
  };
  
  const created = await adapter.createOneRecord(product);
  assert.ok(created, 'Should create product with custom client and logger');
  
  const hasCreateLog = logMessages.some(msg => msg.includes('Record created successfully'));
  assert.ok(hasCreateLog, 'Should log creation with custom logger');
  
  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Default client and logger should still work
runner.test('should still work with default client and logger', async () => {
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME
    // No custom client or logger provided
  });
  
  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product with Defaults',
    price: 29.99,
  };
  
  const created = await adapter.createOneRecord(product);
  
  assert.ok(created, 'Should create product with default configuration');
  assert.equal(created.name, product.name, 'Product name should match');
  assert.ok(created.createdAt, 'Should have createdAt timestamp');
  assert.ok(created.updatedAt, 'Should have updatedAt timestamp');
  
  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Should use region configuration
runner.test('should create adapter with region configuration', async () => {
  // Note: This test uses the default region since the table exists there
  // In production, you could specify any valid AWS region
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    region: process.env.AWS_REGION || 'us-east-1'
  });
  
  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product with Region Config',
    price: 59.99,
  };
  
  const created = await adapter.createOneRecord(product);
  
  assert.ok(created, 'Should create product with region configuration');
  assert.equal(created.name, product.name, 'Product name should match');
  
  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Custom client should override region configuration
runner.test('should ignore region config when custom client is provided', async () => {
  const customClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ 
      maxAttempts: 3
    })
  );
  
  const adapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    region: 'eu-central-1',  // This should be ignored
    client: customClient      // Custom client takes precedence
  });
  
  const product = {
    id: generateId(),
    sk: 'products',
    name: 'Product with Client Override',
    price: 89.99,
  };
  
  const created = await adapter.createOneRecord(product);
  
  assert.ok(created, 'Should create product with custom client (region ignored)');
  assert.equal(created.name, product.name, 'Product name should match');
  
  // Cleanup
  await adapter.deleteOneRecord({ id: created.id, sk: created.sk });
});

// Test: Multiple adapters with different regions (simulated)
runner.test('should support creating multiple adapters for different regions', async () => {
  // Note: All adapters use the same region in this test environment
  // but demonstrate the API for multi-region usage
  const currentRegion = process.env.AWS_REGION || 'us-east-1';
  
  const usAdapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    region: currentRegion  // In production: 'us-east-1'
  });
  
  const euAdapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    region: currentRegion  // In production: 'eu-west-1'
  });
  
  const asiaAdapter = createAdapter<TestProduct>({
    tableName: TABLE_NAME,
    region: currentRegion  // In production: 'ap-southeast-1'
  });
  
  // Create products in each "region"
  const usProduct = await usAdapter.createOneRecord({
    id: generateId(),
    sk: 'products',
    name: 'US Product',
    price: 19.99,
  });
  
  const euProduct = await euAdapter.createOneRecord({
    id: generateId(),
    sk: 'products',
    name: 'EU Product',
    price: 29.99,
  });
  
  const asiaProduct = await asiaAdapter.createOneRecord({
    id: generateId(),
    sk: 'products',
    name: 'Asia Product',
    price: 39.99,
  });
  
  assert.ok(usProduct, 'Should create product in US adapter');
  assert.ok(euProduct, 'Should create product in EU adapter');
  assert.ok(asiaProduct, 'Should create product in Asia adapter');
  
  // Cleanup
  await usAdapter.deleteOneRecord({ id: usProduct.id, sk: usProduct.sk });
  await euAdapter.deleteOneRecord({ id: euProduct.id, sk: euProduct.sk });
  await asiaAdapter.deleteOneRecord({ id: asiaProduct.id, sk: asiaProduct.sk });
});

// Run all tests
runner.run().catch(console.error);