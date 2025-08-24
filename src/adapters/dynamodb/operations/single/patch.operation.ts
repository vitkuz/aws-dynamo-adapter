import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, DynamoDBKey, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { updateTimestamp } from '../../dynamodb.utils';

/**
 * Patches a record in DynamoDB with partial updates
 * Only updates the specified fields and the updatedAt timestamp
 */
export const createPatchOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keys: DynamoDBKey, updates: Partial<T>): Promise<T & RecordWithTimestamps> => {
  const { keys: validatedKeys, updates: validatedUpdates } = config.validator.validatePatchUpdates(keys, updates);
  const updatesWithTimestamp = updateTimestamp(validatedUpdates);
  
  const updateExpressionParts: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  
  Object.entries(updatesWithTimestamp).forEach(([key, value], index) => {
    if (!Object.keys(keys).includes(key)) {
      const attrName = `#attr${index}`;
      const attrValue = `:val${index}`;
      
      updateExpressionParts.push(`${attrName} = ${attrValue}`);
      expressionAttributeNames[attrName] = key;
      expressionAttributeValues[attrValue] = value;
    }
  });
  
  const updateExpression = `SET ${updateExpressionParts.join(', ')}`;
  
  config.logger.debug('Patching record', { 
    tableName: config.deps.tableName, 
    keys: validatedKeys, 
    updates: updatesWithTimestamp 
  });
  
  const result = await config.client.send(
    new UpdateCommand({
      TableName: config.deps.tableName,
      Key: validatedKeys,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );
  
  config.logger.info('Record patched successfully', { 
    tableName: config.deps.tableName, 
    keys: validatedKeys 
  });
  
  return result.Attributes as T & RecordWithTimestamps;
};