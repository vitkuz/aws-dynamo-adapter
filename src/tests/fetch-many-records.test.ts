import { createAdapter, generateId } from '../adapters/dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

type Author = {
  id: string;
  sk: string;
  name: string;
  bio: string;
};

type Book = {
  id: string;
  sk: string;
  title: string;
  authorId: string;
  isbn: string;
};

async function testFetchManyRecords() {
  console.log('Testing fetchManyRecords...');
  
  const adapter = createAdapter({
    tableName: TABLE_NAME,
  });
  
  const authorIds = [generateId(), generateId(), generateId()];
  const bookIds = [generateId(), generateId(), generateId()];
  
  const authors: Author[] = [
    {
      id: authorIds[0],
      sk: 'authors',
      name: 'J.K. Rowling',
      bio: 'British author, best known for the Harry Potter series',
    },
    {
      id: authorIds[1],
      sk: 'authors',
      name: 'George R.R. Martin',
      bio: 'American novelist and short story writer, known for A Song of Ice and Fire',
    },
    {
      id: authorIds[2],
      sk: 'authors',
      name: 'Brandon Sanderson',
      bio: 'American author of epic fantasy and science fiction',
    },
  ];
  
  const books: Book[] = [
    {
      id: bookIds[0],
      sk: 'books',
      title: 'Harry Potter and the Philosopher\'s Stone',
      authorId: authorIds[0],
      isbn: '978-0747532699',
    },
    {
      id: bookIds[1],
      sk: 'books',
      title: 'A Game of Thrones',
      authorId: authorIds[1],
      isbn: '978-0553103540',
    },
    {
      id: bookIds[2],
      sk: 'books',
      title: 'The Way of Kings',
      authorId: authorIds[2],
      isbn: '978-0765326355',
    },
  ];
  
  try {
    console.log('Creating test data...');
    const createdAuthors = await adapter.createManyRecords<Author>(authors);
    const createdBooks = await adapter.createManyRecords<Book>(books);
    console.log('✅ Test data created');
    
    console.log('\nTesting fetchManyRecords with all existing author keys...');
    const authorKeys = authorIds.map(id => ({ id, sk: 'authors' }));
    const fetchedAuthors = await adapter.fetchManyRecords<Author>(authorKeys);
    
    if (fetchedAuthors.length !== 3) {
      throw new Error(`Expected 3 authors, got ${fetchedAuthors.length}`);
    }
    
    for (const author of createdAuthors) {
      const found = fetchedAuthors.find(a => a.id === author.id);
      if (!found) throw new Error(`Author ${author.id} not found in fetched results`);
      if (found.name !== author.name) throw new Error(`Author name mismatch: ${found.name} !== ${author.name}`);
      if (found.bio !== author.bio) throw new Error(`Author bio mismatch`);
      if (!found.createdAt || !found.updatedAt) throw new Error(`Author ${author.id} missing timestamps`);
    }
    console.log('✅ All authors fetched successfully');
    console.log('Fetched authors:', fetchedAuthors.map(a => ({ id: a.id, name: a.name })));
    
    console.log('\nTesting fetchManyRecords with all existing book keys...');
    const bookKeys = bookIds.map(id => ({ id, sk: 'books' }));
    const fetchedBooks = await adapter.fetchManyRecords<Book>(bookKeys);
    
    if (fetchedBooks.length !== 3) {
      throw new Error(`Expected 3 books, got ${fetchedBooks.length}`);
    }
    
    for (const book of createdBooks) {
      const found = fetchedBooks.find(b => b.id === book.id);
      if (!found) throw new Error(`Book ${book.id} not found in fetched results`);
      if (found.title !== book.title) throw new Error(`Book title mismatch: ${found.title} !== ${book.title}`);
      if (found.authorId !== book.authorId) throw new Error(`Book authorId mismatch`);
      if (found.isbn !== book.isbn) throw new Error(`Book ISBN mismatch`);
      if (!found.createdAt || !found.updatedAt) throw new Error(`Book ${book.id} missing timestamps`);
    }
    console.log('✅ All books fetched successfully');
    console.log('Fetched books:', fetchedBooks.map(b => ({ id: b.id, title: b.title })));
    
    console.log('\nTesting fetchManyRecords with mix of existing and non-existing keys...');
    const nonExistentId1 = generateId();
    const nonExistentId2 = generateId();
    const mixedKeys = [
      { id: authorIds[0], sk: 'authors' },
      { id: nonExistentId1, sk: 'authors' },
      { id: authorIds[2], sk: 'authors' },
      { id: nonExistentId2, sk: 'authors' },
    ];
    
    const mixedResults = await adapter.fetchManyRecords<Author>(mixedKeys);
    
    if (mixedResults.length !== 2) {
      throw new Error(`Expected 2 results for mixed keys, got ${mixedResults.length}`);
    }
    
    const foundIds = new Set(mixedResults.map(r => r.id));
    if (!foundIds.has(authorIds[0])) throw new Error('First author should be in results');
    if (!foundIds.has(authorIds[2])) throw new Error('Third author should be in results');
    if (foundIds.has(nonExistentId1)) throw new Error('Non-existent ID 1 should not be in results');
    if (foundIds.has(nonExistentId2)) throw new Error('Non-existent ID 2 should not be in results');
    
    console.log('✅ Mixed keys test passed - only existing records returned');
    console.log(`Requested: 4 keys, Found: ${mixedResults.length} records`);
    
    console.log('\nTesting fetchManyRecords with empty array...');
    const emptyResults = await adapter.fetchManyRecords<Author>([]);
    
    if (emptyResults.length !== 0) {
      throw new Error(`Expected empty array, got ${emptyResults.length} results`);
    }
    console.log('✅ Empty array test passed');
    
    console.log('\nTesting fetchManyRecords with large batch (testing batch splitting)...');
    // Create a large number of keys to test batch splitting (DynamoDB limit is 100)
    const largeKeySet = [
      ...authorKeys,
      // Add non-existent keys to make it interesting
      ...Array.from({ length: 10 }, () => ({ id: generateId(), sk: 'authors' })),
    ];
    
    const largeBatchResults = await adapter.fetchManyRecords<Author>(largeKeySet);
    
    // Should only find the 3 authors we created
    if (largeBatchResults.length !== 3) {
      throw new Error(`Expected 3 results from large batch, got ${largeBatchResults.length}`);
    }
    console.log('✅ Large batch test passed');
    
    console.log('\nCleaning up test data...');
    await adapter.deleteManyRecords(authorKeys);
    await adapter.deleteManyRecords(bookKeys);
    console.log('✅ Cleanup completed');
    
    console.log('\nVerifying records were deleted...');
    const deletedAuthors = await adapter.fetchManyRecords<Author>(authorKeys);
    const deletedBooks = await adapter.fetchManyRecords<Book>(bookKeys);
    
    if (deletedAuthors.length !== 0) {
      throw new Error('Authors should be deleted');
    }
    if (deletedBooks.length !== 0) {
      throw new Error('Books should be deleted');
    }
    console.log('✅ Deletion verified');
    
    return true;
  } catch (error) {
    console.error('❌ fetchManyRecords test failed:', error);
    
    try {
      console.log('Attempting cleanup after error...');
      const authorKeys = authorIds.map(id => ({ id, sk: 'authors' }));
      const bookKeys = bookIds.map(id => ({ id, sk: 'books' }));
      
      await adapter.deleteManyRecords(authorKeys).catch(() => {});
      await adapter.deleteManyRecords(bookKeys).catch(() => {});
      console.log('Cleanup attempted after error');
    } catch {}
    
    return false;
  }
}

testFetchManyRecords()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });