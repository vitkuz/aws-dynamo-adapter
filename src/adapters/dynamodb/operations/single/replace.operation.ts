import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { BaseRecord, WithTimestamps, RecordWithTimestamps } from '../../../../shared/types';
import { AdapterConfig } from '../../dynamodb.types';
import { updateTimestamp, extractKeysFromRecord } from '../../dynamodb.utils';

/**
 * Replaces an existing record in DynamoDB
 * Updates the updatedAt timestamp
 */
export const createReplaceOneRecord =
  (config: AdapterConfig) =>
  async <T extends BaseRecord = BaseRecord>(
    record: T & WithTimestamps
  ): Promise<T & RecordWithTimestamps> => {
    const validatedRecord = config.validator.validateUpdateRecord(record);
    const updatedRecord = updateTimestamp(validatedRecord) as T & RecordWithTimestamps;

    config.logger.debug('Replacing record', {
      tableName: config.deps.tableName,
      record: updatedRecord,
    });

    await config.client.send(
      new PutCommand({
        TableName: config.deps.tableName,
        Item: updatedRecord,
      })
    );

    config.logger.info('Record replaced successfully', {
      tableName: config.deps.tableName,
      keys: extractKeysFromRecord(updatedRecord, config.deps.partitionKey, config.deps.sortKey),
    });

    return updatedRecord;
  };
