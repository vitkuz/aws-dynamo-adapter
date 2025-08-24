import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';

/**
 * Factory function that creates a fetch function for all records
 * Can create either a query function (with sort key) or scan function (without)
 */
export const createCreateFetchAllRecords =
  (config: AdapterConfig) =>
  <T extends BaseRecord = BaseRecord>(index: string = config.deps.gsiName, sk?: string) =>
  async (): Promise<T[]> => {
    if (sk) {
      config.logger.debug('Creating fetch function for specific sort key', {
        tableName: config.deps.tableName,
        index,
        sk,
      });

      const items: T[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;

      do {
        const result = await config.client.send(
          new QueryCommand({
            TableName: config.deps.tableName,
            IndexName: index,
            KeyConditionExpression: '#sk = :sk',
            ExpressionAttributeNames: {
              '#sk': config.deps.sortKey || 'sk',
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

      config.logger.info('Records fetched via created function', {
        tableName: config.deps.tableName,
        index,
        sk,
        count: items.length,
      });

      return items;
    } else {
      config.logger.debug('Creating fetch function for all records', {
        tableName: config.deps.tableName,
      });

      const items: T[] = [];
      let lastEvaluatedKey: Record<string, any> | undefined;

      do {
        const result = await config.client.send(
          new ScanCommand({
            TableName: config.deps.tableName,
            ExclusiveStartKey: lastEvaluatedKey,
          })
        );

        if (result.Items) {
          items.push(...(result.Items as T[]));
        }

        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);

      config.logger.info('All records fetched via created function', {
        tableName: config.deps.tableName,
        count: items.length,
      });

      return items;
    }
  };
