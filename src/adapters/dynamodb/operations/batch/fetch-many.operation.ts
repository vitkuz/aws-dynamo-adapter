import { BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, DynamoDBKey, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { DYNAMODB_BATCH_GET_LIMIT } from '../../dynamodb.constants';

/**
 * Fetches multiple records from DynamoDB using batch get
 * Automatically splits into batches of 100 items (DynamoDB limit)
 * Returns only existing records (non-existent keys are omitted)
 */
export const createFetchManyRecords = (
  config: AdapterConfig
) => async <T extends BaseRecord = BaseRecord>(keysList: DynamoDBKey[]): Promise<(T & RecordWithTimestamps)[]> => {
  if (keysList.length === 0) {
    config.logger.debug('No keys provided for batch fetch', { 
      tableName: config.deps.tableName 
    });
    return [];
  }
  
  const validatedKeysList = config.validator.validateBatchKeys(keysList);
  config.logger.debug('Fetching multiple records by keys', { 
    tableName: config.deps.tableName, 
    count: validatedKeysList.length 
  });
  
  const results: (T & RecordWithTimestamps)[] = [];
  
  // Split into batches of 100 (DynamoDB limit for BatchGetItem)
  const batches = [];
  for (let i = 0; i < validatedKeysList.length; i += DYNAMODB_BATCH_GET_LIMIT) {
    batches.push(validatedKeysList.slice(i, i + DYNAMODB_BATCH_GET_LIMIT));
  }
  
  for (const batch of batches) {
    const response = await config.client.send(
      new BatchGetCommand({
        RequestItems: {
          [config.deps.tableName]: {
            Keys: batch,
          },
        },
      })
    );
    
    if (response.Responses && response.Responses[config.deps.tableName]) {
      results.push(...(response.Responses[config.deps.tableName] as (T & RecordWithTimestamps)[]));
    }
    
    // Handle unprocessed keys if any
    if (response.UnprocessedKeys && response.UnprocessedKeys[config.deps.tableName]) {
      config.logger.warn('Some keys were not processed', {
        tableName: config.deps.tableName,
        unprocessedCount: response.UnprocessedKeys[config.deps.tableName].Keys?.length || 0,
      });
    }
  }
  
  config.logger.info('Multiple records fetched by keys', { 
    tableName: config.deps.tableName, 
    requested: validatedKeysList.length,
    found: results.length 
  });
  
  return results;
};