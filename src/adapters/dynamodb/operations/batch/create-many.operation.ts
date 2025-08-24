import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, WithTimestamps, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { addTimestampsIfMissing } from '../../dynamodb.utils';
import { DYNAMODB_BATCH_WRITE_LIMIT } from '../../dynamodb.constants';

/**
 * Creates multiple records in DynamoDB using batch write
 * Automatically splits into batches of 25 items (DynamoDB limit)
 */
export const createCreateManyRecords = (
  config: AdapterConfig
) => async <T extends BaseRecord = BaseRecord>(records: (T & WithTimestamps)[]): Promise<(T & RecordWithTimestamps)[]> => {
  const validatedRecords = config.validator.validateBatchRecords(records);
  const recordsWithTimestamps = validatedRecords.map(record => addTimestampsIfMissing(record));
  
  config.logger.debug('Creating multiple records', { 
    tableName: config.deps.tableName, 
    count: validatedRecords.length 
  });
  
  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < recordsWithTimestamps.length; i += DYNAMODB_BATCH_WRITE_LIMIT) {
    batches.push(recordsWithTimestamps.slice(i, i + DYNAMODB_BATCH_WRITE_LIMIT));
  }
  
  for (const batch of batches) {
    const putRequests = batch.map(item => ({
      PutRequest: { Item: item }
    }));
    
    await config.client.send(
      new BatchWriteCommand({
        RequestItems: {
          [config.deps.tableName]: putRequests,
        },
      })
    );
  }
  
  config.logger.info('Multiple records created successfully', { 
    tableName: config.deps.tableName, 
    count: recordsWithTimestamps.length 
  });
  
  return recordsWithTimestamps;
};