export { createAdapter } from './dynamodb.adapter';
export type { DynamoDBAdapter } from './dynamodb.types';
export { 
  generateId,
  getCurrentTimestamp,
  addTimestamps,
  addTimestampsIfMissing,
  updateTimestamp,
  buildKeys,
  extractKeysFromRecord
} from './dynamodb.utils';
export {
  baseRecordSchema,
  dynamoDBKeySchema,
  dynamoDBAdapterConfigSchema,
  validateKeys,
  validateRecord
} from './dynamodb.schema';
export {
  DEFAULT_PARTITION_KEY,
  DEFAULT_SORT_KEY,
  DEFAULT_GSI_NAME,
  DEFAULT_DYNAMODB_CONFIG,
  mergeWithDefaults,
  type MergedConfig
} from './dynamodb.config';
export { 
  createRecordValidator,
  type RecordValidator 
} from './dynamodb.validation';