import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, DynamoDBKey } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { DYNAMODB_BATCH_WRITE_LIMIT } from '../../dynamodb.constants';

/**
 * Deletes multiple records from DynamoDB using batch write
 * Automatically splits into batches of 25 items (DynamoDB limit)
 */
export const createDeleteManyRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keysList: DynamoDBKey[]): Promise<void> => {
  const validatedKeysList = config.validator.validateBatchKeys(keysList);
  
  config.logger.debug('Deleting multiple records', { 
    tableName: config.deps.tableName, 
    count: validatedKeysList.length 
  });
  
  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < validatedKeysList.length; i += DYNAMODB_BATCH_WRITE_LIMIT) {
    batches.push(validatedKeysList.slice(i, i + DYNAMODB_BATCH_WRITE_LIMIT));
  }
  
  for (const batch of batches) {
    const deleteRequests = batch.map(keys => ({
      DeleteRequest: { Key: keys }
    }));
    
    await config.client.send(
      new BatchWriteCommand({
        RequestItems: {
          [config.deps.tableName]: deleteRequests,
        },
      })
    );
  }
  
  config.logger.info('Multiple records deleted successfully', { 
    tableName: config.deps.tableName, 
    count: validatedKeysList.length 
  });
};