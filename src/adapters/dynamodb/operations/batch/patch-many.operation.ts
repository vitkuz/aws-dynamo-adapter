import { BaseRecord, DynamoDBKey, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { createPatchOneRecord } from '../single/patch.operation';

/**
 * Patches multiple records in DynamoDB
 * Uses parallel processing for optimal performance
 */
export const createPatchManyRecords = (
  config: AdapterConfig
) => async <T extends BaseRecord = BaseRecord>(updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>): Promise<(T & RecordWithTimestamps)[]> => {
  const validatedUpdates = config.validator.validateBatchPatchUpdates(updates);
  
  config.logger.debug('Patching multiple records', { 
    tableName: config.deps.tableName, 
    count: validatedUpdates.length 
  });
  
  const patchOneRecord = createPatchOneRecord(config);
  const results = await Promise.all(
    validatedUpdates.map(({ keys, updates }) => patchOneRecord(keys, updates))
  );
  
  config.logger.info('Multiple records patched successfully', { 
    tableName: config.deps.tableName, 
    count: results.length 
  });
  
  return results;
};