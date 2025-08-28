import { DynamoDBAdapterConfig } from '../../shared/types';
import { DynamoDBAdapter, DynamoDBClientDependencies, AdapterConfig } from './dynamodb.types';
import { mergeWithDefaults } from './dynamodb.config';
import { createRecordValidator } from './dynamodb.validation';
import {
  createCreateOneRecord,
  createFetchOneRecord,
  createDeleteOneRecord,
  createReplaceOneRecord,
  createPatchOneRecord,
  createCreateManyRecords,
  createFetchManyRecords,
  createDeleteManyRecords,
  createPatchManyRecords,
  createFetchAllRecords,
} from './operations';

/**
 * Factory function to create a DynamoDB adapter instance
 * Assembles all operations with shared configuration
 */
export const createAdapter = (adapterConfig: DynamoDBAdapterConfig): DynamoDBAdapter => {
  const mergedConfig = mergeWithDefaults(adapterConfig);
  const { client, logger, tableName, partitionKey, sortKey, gsiName } = mergedConfig;

  const deps: DynamoDBClientDependencies = {
    tableName,
    partitionKey,
    sortKey,
    gsiName,
  };

  const validator = createRecordValidator(deps);

  const config: AdapterConfig = {
    client,
    deps,
    logger,
    validator,
  };

  logger.info('DynamoDB adapter created', { config: deps });

  return {
    // Single operations
    createOneRecord: createCreateOneRecord(config),
    fetchOneRecord: createFetchOneRecord(config),
    deleteOneRecord: createDeleteOneRecord(config),
    replaceOneRecord: createReplaceOneRecord(config),
    patchOneRecord: createPatchOneRecord(config),

    // Batch operations
    createManyRecords: createCreateManyRecords(config),
    fetchManyRecords: createFetchManyRecords(config),
    deleteManyRecords: createDeleteManyRecords(config),
    patchManyRecords: createPatchManyRecords(config),

    // Query operations
    fetchAllRecords: createFetchAllRecords(config),
  };
};
