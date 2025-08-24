import { createAdapter, generateId } from '../adapters/dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

async function testFetchOneRecord() {
  console.log('Testing fetchOneRecord...');
  
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });
  
  const testId = generateId();
  const record = {
    id: testId,
    sk: 'products',
    name: 'Test Product for Fetch',
    price: 149.99,
  };
  
  try {
    const created = await adapter.createOneRecord<{ id: string; sk: string; name: string; price: number }>(record);
    console.log('✅ Created record for testing:', created);
    
    console.log('Testing fetchOneRecord with existing record...');
    const fetched = await adapter.fetchOneRecord<{ id: string; sk: string; name: string; price: number }>({ id: testId, sk: 'products' });
    
    if (!fetched) throw new Error('Record should have been found');
    if (fetched.id !== testId) throw new Error(`ID mismatch: ${fetched.id} !== ${testId}`);
    if (fetched.sk !== 'products') throw new Error(`SK mismatch: ${fetched.sk} !== products`);
    if (fetched.name !== 'Test Product for Fetch') throw new Error(`Name mismatch: ${fetched.name} !== Test Product for Fetch`);
    if (fetched.price !== 149.99) throw new Error(`Price mismatch: ${fetched.price} !== 149.99`);
    if (!fetched.createdAt) throw new Error('Missing createdAt timestamp');
    if (!fetched.updatedAt) throw new Error('Missing updatedAt timestamp');
    if (fetched.createdAt !== created.createdAt) throw new Error('CreatedAt timestamp mismatch');
    if (fetched.updatedAt !== created.updatedAt) throw new Error('UpdatedAt timestamp mismatch');
    
    console.log('✅ fetchOneRecord test passed for existing record');
    console.log('Fetched record:', fetched);
    
    console.log('Testing fetchOneRecord with non-existent record...');
    const nonExistentId = generateId();
    const notFound = await adapter.fetchOneRecord<{ id: string; sk: string; name: string; price: number }>({ id: nonExistentId, sk: 'products' });
    
    if (notFound !== null) throw new Error('Should return null for non-existent record');
    
    console.log('✅ fetchOneRecord correctly returned null for non-existent record');
    
    await adapter.deleteOneRecord({ id: testId, sk: 'products' });
    console.log('✅ Cleanup completed');
    
    console.log('Testing fetchOneRecord after deletion...');
    const deletedRecord = await adapter.fetchOneRecord<{ id: string; sk: string; name: string; price: number }>({ id: testId, sk: 'products' });
    
    if (deletedRecord !== null) throw new Error('Should return null for deleted record');
    
    console.log('✅ fetchOneRecord correctly returned null for deleted record');
    
    return true;
  } catch (error) {
    console.error('❌ fetchOneRecord test failed:', error);
    try {
      await adapter.deleteOneRecord({ id: testId, sk: 'products' });
      console.log('Cleanup attempted after error');
    } catch {}
    return false;
  }
}

testFetchOneRecord()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });