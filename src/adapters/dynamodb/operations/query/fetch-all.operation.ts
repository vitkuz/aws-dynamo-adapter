import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';

/**
 * Fetches all records with a specific sort key using GSI
 * Handles pagination automatically
 */
export const createFetchAllRecords = (
  config: AdapterConfig
) => async <T extends BaseRecord = BaseRecord>(sk: string): Promise<T[]> => {
  config.logger.debug('Fetching all records by sort key', { 
    tableName: config.deps.tableName, 
    index: config.deps.gsiName, 
    sk 
  });
  
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;
  
  do {
    const result = await config.client.send(
      new QueryCommand({
        TableName: config.deps.tableName,
        IndexName: config.deps.gsiName,
        KeyConditionExpression: '#sk = :sk',
        ExpressionAttributeNames: {
          '#sk': config.deps.sortKey,
        },
        ExpressionAttributeValues: {
          ':sk': sk,
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    
    if (result.Items) {
      items.push(...(result.Items as T[]));
    }
    
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  
  config.logger.info('Records fetched successfully', { 
    tableName: config.deps.tableName, 
    index: config.deps.gsiName, 
    sk, 
    count: items.length 
  });
  
  return items;
};