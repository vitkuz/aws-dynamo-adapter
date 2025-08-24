/**
 * All DynamoDB operations
 */

// Single item operations
export {
  createCreateOneRecord,
  createFetchOneRecord,
  createDeleteOneRecord,
  createReplaceOneRecord,
  createPatchOneRecord,
} from './single';

// Batch operations
export {
  createCreateManyRecords,
  createFetchManyRecords,
  createDeleteManyRecords,
  createPatchManyRecords,
} from './batch';

// Query operations
export { createFetchAllRecords, createCreateFetchAllRecords } from './query';
