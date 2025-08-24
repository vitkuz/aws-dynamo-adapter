export { createAdapter } from './adapters/dynamodb';
export type { DynamoDBAdapter } from './adapters/dynamodb';
export type { BaseRecord, Logger, DynamoDBAdapterConfig, DynamoDBKey } from './shared/types';
export {
  generateId,
  getCurrentTimestamp,
  addTimestamps,
  addTimestampsIfMissing,
  updateTimestamp,
  buildKeys,
  extractKeysFromRecord,
  baseRecordSchema,
  dynamoDBKeySchema,
  dynamoDBAdapterConfigSchema,
  validateKeys,
  validateRecord,
  DEFAULT_PARTITION_KEY,
  DEFAULT_SORT_KEY,
  DEFAULT_GSI_NAME,
  DEFAULT_DYNAMODB_CONFIG,
  mergeWithDefaults,
} from './adapters/dynamodb';
