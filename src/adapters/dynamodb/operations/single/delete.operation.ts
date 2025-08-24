import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, DynamoDBKey } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';

/**
 * Deletes a single record from DynamoDB
 */
export const createDeleteOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keys: DynamoDBKey): Promise<void> => {
  const validatedKeys = config.validator.validateKeys(keys);
  
  config.logger.debug('Deleting record', { 
    tableName: config.deps.tableName, 
    keys: validatedKeys 
  });
  
  await config.client.send(
    new DeleteCommand({
      TableName: config.deps.tableName,
      Key: validatedKeys,
    })
  );
  
  config.logger.info('Record deleted successfully', { 
    tableName: config.deps.tableName, 
    keys: validatedKeys 
  });
};