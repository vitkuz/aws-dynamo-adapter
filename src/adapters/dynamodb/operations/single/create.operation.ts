import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, WithTimestamps, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { addTimestampsIfMissing, extractKeysFromRecord } from '../../dynamodb.utils';

/**
 * Creates a single record in DynamoDB
 * Automatically adds timestamps if not present
 */
export const createCreateOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (record: T & WithTimestamps): Promise<T & RecordWithTimestamps> => {
  const validatedRecord = config.validator.validateCreateRecord(record);
  const recordWithTimestamps = addTimestampsIfMissing(validatedRecord);
  
  config.logger.debug('Creating record', { 
    tableName: config.deps.tableName, 
    record: recordWithTimestamps 
  });
  
  await config.client.send(
    new PutCommand({
      TableName: config.deps.tableName,
      Item: recordWithTimestamps,
    })
  );
  
  config.logger.info('Record created successfully', { 
    tableName: config.deps.tableName,
    keys: extractKeysFromRecord(
      recordWithTimestamps, 
      config.deps.partitionKey, 
      config.deps.sortKey
    )
  });
  
  return recordWithTimestamps;
};