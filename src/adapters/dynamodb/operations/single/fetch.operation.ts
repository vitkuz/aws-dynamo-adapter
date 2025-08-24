import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, DynamoDBKey, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';

/**
 * Fetches a single record from DynamoDB by its keys
 * Returns null if the record is not found
 */
export const createFetchOneRecord = (
  config: AdapterConfig
) => async <T extends BaseRecord = BaseRecord>(keys: DynamoDBKey): Promise<(T & RecordWithTimestamps) | null> => {
  const validatedKeys = config.validator.validateKeys(keys);
  
  config.logger.debug('Fetching record', { 
    tableName: config.deps.tableName, 
    keys: validatedKeys 
  });
  
  const result = await config.client.send(
    new GetCommand({
      TableName: config.deps.tableName,
      Key: validatedKeys,
    })
  );
  
  if (!result.Item) {
    config.logger.info('Record not found', { 
      tableName: config.deps.tableName, 
      keys: validatedKeys 
    });
    return null;
  }
  
  config.logger.info('Record fetched successfully', { 
    tableName: config.deps.tableName, 
    keys: validatedKeys 
  });
  
  return result.Item as T & RecordWithTimestamps;
};