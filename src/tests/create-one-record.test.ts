import { createAdapter, generateId } from '../adapters/dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

// Test createOneRecord
async function testCreateOneRecord() {
  console.log('Testing createOneRecord...');

  const adapter = createAdapter<{ id: string; sk: string; name: string; price: number }>({
    tableName: TABLE_NAME,
  });

  const testId = generateId();
  const record = {
    id: testId,
    sk: 'products',
    name: 'Test Product',
    price: 99.99,
  };

  try {
    const created = await adapter.createOneRecord(record);

    // Validate results
    if (created.id !== testId) throw new Error(`ID mismatch: ${created.id} !== ${testId}`);
    if (created.sk !== 'products') throw new Error(`SK mismatch: ${created.sk} !== products`);
    if (created.name !== 'Test Product')
      throw new Error(`Name mismatch: ${created.name} !== Test Product`);
    if (created.price !== 99.99) throw new Error(`Price mismatch: ${created.price} !== 99.99`);
    if (!created.createdAt) throw new Error('Missing createdAt timestamp');
    if (!created.updatedAt) throw new Error('Missing updatedAt timestamp');
    if (created.createdAt !== created.updatedAt)
      throw new Error('Timestamps should be equal on creation');

    console.log('✅ createOneRecord test passed');
    console.log('Created record:', created);

    // Fetch the record to verify it was actually saved
    console.log('Fetching record to verify using fetchOneRecord...');
    const fetchedRecord = await adapter.fetchOneRecord({ id: testId, sk: 'products' });

    if (!fetchedRecord) throw new Error('Record not found after creation');
    if (fetchedRecord.id !== testId)
      throw new Error(`Fetched ID mismatch: ${fetchedRecord.id} !== ${testId}`);
    if (fetchedRecord.sk !== 'products')
      throw new Error(`Fetched SK mismatch: ${fetchedRecord.sk} !== products`);
    if (fetchedRecord.name !== 'Test Product')
      throw new Error(`Fetched name mismatch: ${fetchedRecord.name} !== Test Product`);
    if (fetchedRecord.price !== 99.99)
      throw new Error(`Fetched price mismatch: ${fetchedRecord.price} !== 99.99`);
    if (fetchedRecord.createdAt !== created.createdAt)
      throw new Error('Fetched createdAt timestamp mismatch');
    if (fetchedRecord.updatedAt !== created.updatedAt)
      throw new Error('Fetched updatedAt timestamp mismatch');

    console.log('✅ Record fetch verification passed');
    console.log('Fetched record:', fetchedRecord);

    // Cleanup
    await adapter.deleteOneRecord({ id: testId, sk: 'products' });
    console.log('✅ Cleanup completed');

    return true;
  } catch (error) {
    console.error('❌ createOneRecord test failed:', error);
    return false;
  }
}

// Run test
testCreateOneRecord()
  .then((success) => process.exit(success ? 0 : 1))
  .catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
