import { BaseRecord, DynamoDBAdapterConfig } from '../../shared/types';
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
  createCreateFetchAllRecords,
} from './operations';

/**
 * Factory function to create a DynamoDB adapter instance
 * Assembles all operations with shared configuration
 */
export const createAdapter = <T extends BaseRecord = BaseRecord>(
  adapterConfig: DynamoDBAdapterConfig
): DynamoDBAdapter<T> => {
  const mergedConfig = mergeWithDefaults(adapterConfig);
  const { client, logger, tableName, partitionKey, sortKey, gsiName } = mergedConfig;
  
  const deps: DynamoDBClientDependencies = {
    tableName,
    partitionKey,
    sortKey,
    gsiName,
  };
  
  const validator = createRecordValidator<T>(deps);
  
  const config: AdapterConfig<T> = {
    client,
    deps,
    logger,
    validator,
  };
  
  logger.info('DynamoDB adapter created', { config: deps });
  
  return {
    // Single operations
    createOneRecord: createCreateOneRecord<T>(config),
    fetchOneRecord: createFetchOneRecord<T>(config),
    deleteOneRecord: createDeleteOneRecord<T>(config),
    replaceOneRecord: createReplaceOneRecord<T>(config),
    patchOneRecord: createPatchOneRecord<T>(config),
    
    // Batch operations
    createManyRecords: createCreateManyRecords<T>(config),
    fetchManyRecords: createFetchManyRecords<T>(config),
    deleteManyRecords: createDeleteManyRecords<T>(config),
    patchManyRecords: createPatchManyRecords<T>(config),
    
    // Query operations
    fetchAllRecords: createFetchAllRecords<T>(config),
    createFetchAllRecords: createCreateFetchAllRecords<T>(config),
  };
};