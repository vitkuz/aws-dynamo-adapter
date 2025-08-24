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

async function testCreateManyRecords() {
  console.log('Testing createManyRecords with Authors and Books...');
  
  const authorAdapter = createAdapter<Author>({
    tableName: TABLE_NAME,
  });
  
  const bookAdapter = createAdapter<Book>({
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
    console.log('Creating authors batch...');
    const createdAuthors = await authorAdapter.createManyRecords(authors);
    
    if (createdAuthors.length !== 3) throw new Error(`Expected 3 authors, got ${createdAuthors.length}`);
    
    for (let i = 0; i < createdAuthors.length; i++) {
      const created = createdAuthors[i];
      const original = authors[i];
      
      if (created.id !== original.id) throw new Error(`Author ${i} ID mismatch: ${created.id} !== ${original.id}`);
      if (created.sk !== 'authors') throw new Error(`Author ${i} SK mismatch: ${created.sk} !== authors`);
      if (created.name !== original.name) throw new Error(`Author ${i} name mismatch: ${created.name} !== ${original.name}`);
      if (created.bio !== original.bio) throw new Error(`Author ${i} bio mismatch`);
      if (!created.createdAt) throw new Error(`Author ${i} missing createdAt timestamp`);
      if (!created.updatedAt) throw new Error(`Author ${i} missing updatedAt timestamp`);
      if (created.createdAt !== created.updatedAt) throw new Error(`Author ${i} timestamps should be equal on creation`);
    }
    
    console.log('✅ Authors batch created successfully');
    console.log('Created authors:', createdAuthors.map(a => ({ id: a.id, name: a.name })));
    
    console.log('Creating books batch...');
    const createdBooks = await bookAdapter.createManyRecords(books);
    
    if (createdBooks.length !== 3) throw new Error(`Expected 3 books, got ${createdBooks.length}`);
    
    for (let i = 0; i < createdBooks.length; i++) {
      const created = createdBooks[i];
      const original = books[i];
      
      if (created.id !== original.id) throw new Error(`Book ${i} ID mismatch: ${created.id} !== ${original.id}`);
      if (created.sk !== 'books') throw new Error(`Book ${i} SK mismatch: ${created.sk} !== books`);
      if (created.title !== original.title) throw new Error(`Book ${i} title mismatch: ${created.title} !== ${original.title}`);
      if (created.authorId !== original.authorId) throw new Error(`Book ${i} authorId mismatch: ${created.authorId} !== ${original.authorId}`);
      if (created.isbn !== original.isbn) throw new Error(`Book ${i} ISBN mismatch: ${created.isbn} !== ${original.isbn}`);
      if (!created.createdAt) throw new Error(`Book ${i} missing createdAt timestamp`);
      if (!created.updatedAt) throw new Error(`Book ${i} missing updatedAt timestamp`);
      if (created.createdAt !== created.updatedAt) throw new Error(`Book ${i} timestamps should be equal on creation`);
    }
    
    console.log('✅ Books batch created successfully');
    console.log('Created books:', createdBooks.map(b => ({ id: b.id, title: b.title, authorId: b.authorId })));
    
    console.log('Verifying author-book relationships...');
    for (let i = 0; i < books.length; i++) {
      const book = createdBooks[i];
      const expectedAuthorId = authorIds[i];
      if (book.authorId !== expectedAuthorId) {
        throw new Error(`Book "${book.title}" has incorrect authorId: ${book.authorId} !== ${expectedAuthorId}`);
      }
    }
    console.log('✅ Author-book relationships verified');
    
    console.log('Fetching all authors to verify persistence...');
    const fetchedAuthors = await authorAdapter.fetchAllRecords('authors');
    const createdAuthorIds = new Set(authorIds);
    const foundAuthors = fetchedAuthors.filter(a => createdAuthorIds.has(a.id));
    
    if (foundAuthors.length !== 3) throw new Error(`Expected to find 3 authors, found ${foundAuthors.length}`);
    console.log('✅ All authors found in database');
    
    console.log('Fetching all books to verify persistence...');
    const fetchedBooks = await bookAdapter.fetchAllRecords('books');
    const createdBookIds = new Set(bookIds);
    const foundBooks = fetchedBooks.filter(b => createdBookIds.has(b.id));
    
    if (foundBooks.length !== 3) throw new Error(`Expected to find 3 books, found ${foundBooks.length}`);
    console.log('✅ All books found in database');
    
    console.log('Cleaning up - deleting all test records...');
    const authorKeys = authorIds.map(id => ({ id, sk: 'authors' }));
    const bookKeys = bookIds.map(id => ({ id, sk: 'books' }));
    
    await authorAdapter.deleteManyRecords(authorKeys);
    await bookAdapter.deleteManyRecords(bookKeys);
    console.log('✅ Cleanup completed');
    
    console.log('Verifying cleanup...');
    const remainingAuthors = await authorAdapter.fetchAllRecords('authors');
    const remainingBooks = await bookAdapter.fetchAllRecords('books');
    
    const foundRemainingAuthors = remainingAuthors.filter(a => createdAuthorIds.has(a.id));
    const foundRemainingBooks = remainingBooks.filter(b => createdBookIds.has(b.id));
    
    if (foundRemainingAuthors.length > 0) throw new Error('Some authors were not deleted');
    if (foundRemainingBooks.length > 0) throw new Error('Some books were not deleted');
    
    console.log('✅ Cleanup verified - all test records deleted');
    
    return true;
  } catch (error) {
    console.error('❌ createManyRecords test failed:', error);
    
    try {
      console.log('Attempting cleanup after error...');
      const authorKeys = authorIds.map(id => ({ id, sk: 'authors' }));
      const bookKeys = bookIds.map(id => ({ id, sk: 'books' }));
      
      await authorAdapter.deleteManyRecords(authorKeys).catch(() => {});
      await bookAdapter.deleteManyRecords(bookKeys).catch(() => {});
      console.log('Cleanup attempted after error');
    } catch {}
    
    return false;
  }
}

testCreateManyRecords()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });