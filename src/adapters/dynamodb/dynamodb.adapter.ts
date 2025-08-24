import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  BatchWriteCommand,
  BatchGetCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { BaseRecord, DynamoDBAdapterConfig, DynamoDBKey, Logger, WithTimestamps, RecordWithTimestamps } from '../../shared/types';
import { DynamoDBAdapter, DynamoDBClientDependencies, AdapterConfig } from './dynamodb.types';
import {
  addTimestampsIfMissing,
  updateTimestamp,
  extractKeysFromRecord,
} from './dynamodb.utils';
import { mergeWithDefaults } from './dynamodb.config';
import { RecordValidator, createRecordValidator } from './dynamodb.validation';

const createCreateOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (record: T & WithTimestamps): Promise<T & RecordWithTimestamps> => {
  const validatedRecord = config.validator.validateCreateRecord(record);
  const recordWithTimestamps = addTimestampsIfMissing(validatedRecord);
  
  config.logger.debug('Creating record', { tableName: config.deps.tableName, record: recordWithTimestamps });
  
  await config.client.send(
    new PutCommand({
      TableName: config.deps.tableName,
      Item: recordWithTimestamps,
    })
  );
  
  config.logger.info('Record created successfully', { 
    tableName: config.deps.tableName,
    keys: extractKeysFromRecord(recordWithTimestamps, config.deps.partitionKey, config.deps.sortKey)
  });
  
  return recordWithTimestamps;
};

const createFetchOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keys: DynamoDBKey): Promise<(T & RecordWithTimestamps) | null> => {
  const validatedKeys = config.validator.validateKeys(keys);
  config.logger.debug('Fetching record', { tableName: config.deps.tableName, keys: validatedKeys });
  
  const result = await config.client.send(
    new GetCommand({
      TableName: config.deps.tableName,
      Key: validatedKeys,
    })
  );
  
  if (!result.Item) {
    config.logger.info('Record not found', { tableName: config.deps.tableName, keys: validatedKeys });
    return null;
  }
  
  config.logger.info('Record fetched successfully', { tableName: config.deps.tableName, keys: validatedKeys });
  return result.Item as T & RecordWithTimestamps;
};

const createFetchManyRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keysList: DynamoDBKey[]): Promise<(T & RecordWithTimestamps)[]> => {
  if (keysList.length === 0) {
    config.logger.debug('No keys provided for batch fetch', { tableName: config.deps.tableName });
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
  for (let i = 0; i < validatedKeysList.length; i += 100) {
    batches.push(validatedKeysList.slice(i, i + 100));
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

const createDeleteOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keys: DynamoDBKey): Promise<void> => {
  const validatedKeys = config.validator.validateKeys(keys);
  config.logger.debug('Deleting record', { tableName: config.deps.tableName, keys: validatedKeys });
  
  await config.client.send(
    new DeleteCommand({
      TableName: config.deps.tableName,
      Key: validatedKeys,
    })
  );
  
  config.logger.info('Record deleted successfully', { tableName: config.deps.tableName, keys: validatedKeys });
};

const createReplaceOneRecord = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (record: T & WithTimestamps): Promise<T & RecordWithTimestamps> => {
  const validatedRecord = config.validator.validateUpdateRecord(record);
  const updatedRecord = updateTimestamp(validatedRecord) as T & RecordWithTimestamps;
  
  config.logger.debug('Replacing record', { tableName: config.deps.tableName, record: updatedRecord });
  
  await config.client.send(
    new PutCommand({
      TableName: config.deps.tableName,
      Item: updatedRecord,
    })
  );
  
  config.logger.info('Record replaced successfully', {
    tableName: config.deps.tableName,
    keys: extractKeysFromRecord(updatedRecord, config.deps.partitionKey, config.deps.sortKey)
  });
  
  return updatedRecord;
};

const createPatchOneRecord = <T extends BaseRecord>(
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
  
  config.logger.debug('Patching record', { tableName: config.deps.tableName, keys: validatedKeys, updates: updatesWithTimestamp });
  
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
  
  config.logger.info('Record patched successfully', { tableName: config.deps.tableName, keys: validatedKeys });
  
  return result.Attributes as T & RecordWithTimestamps;
};

const createCreateManyRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (records: (T & WithTimestamps)[]): Promise<(T & RecordWithTimestamps)[]> => {
  const validatedRecords = config.validator.validateBatchRecords(records);
  const recordsWithTimestamps = validatedRecords.map(record => addTimestampsIfMissing(record));
  
  config.logger.debug('Creating multiple records', { tableName: config.deps.tableName, count: validatedRecords.length });
  
  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < recordsWithTimestamps.length; i += 25) {
    batches.push(recordsWithTimestamps.slice(i, i + 25));
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

const createDeleteManyRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (keysList: DynamoDBKey[]): Promise<void> => {
  const validatedKeysList = config.validator.validateBatchKeys(keysList);
  config.logger.debug('Deleting multiple records', { tableName: config.deps.tableName, count: validatedKeysList.length });
  
  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < validatedKeysList.length; i += 25) {
    batches.push(validatedKeysList.slice(i, i + 25));
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

const createPatchManyRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>): Promise<(T & RecordWithTimestamps)[]> => {
  const validatedUpdates = config.validator.validateBatchPatchUpdates(updates);
  config.logger.debug('Patching multiple records', { tableName: config.deps.tableName, count: validatedUpdates.length });
  
  const patchOneRecord = createPatchOneRecord<T>(config);
  const results = await Promise.all(
    validatedUpdates.map(({ keys, updates }) => patchOneRecord(keys, updates))
  );
  
  config.logger.info('Multiple records patched successfully', { 
    tableName: config.deps.tableName, 
    count: results.length 
  });
  
  return results;
};

const createFetchAllRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => async (sk: string): Promise<T[]> => {
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

const createCreateFetchAllRecords = <T extends BaseRecord>(
  config: AdapterConfig<T>
) => (index: string = config.deps.gsiName, sk?: string) => async (): Promise<T[]> => {
  if (sk) {
    config.logger.debug('Creating fetch function for specific sort key', { 
      tableName: config.deps.tableName, 
      index, 
      sk 
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
      count: items.length 
    });
    
    return items;
  } else {
    config.logger.debug('Creating fetch function for all records', { 
      tableName: config.deps.tableName 
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
      count: items.length 
    });
    
    return items;
  }
};

export const createAdapter = <T extends BaseRecord = BaseRecord>(
  adapterConfig: DynamoDBAdapterConfig
): DynamoDBAdapter<T> => {
  const mergedConfig = mergeWithDefaults(adapterConfig);
  const { client, logger, tableName, partitionKey, sortKey, gsiName } = mergedConfig;
  
  const deps: DynamoDBClientDependencies = {
    tableName,
    partitionKey,
    sortKey,
    gsiName,
  };
  
  const validator = createRecordValidator<T>(deps);
  
  const config: AdapterConfig<T> = {
    client,
    deps,
    logger,
    validator,
  };
  
  logger.info('DynamoDB adapter created', { config: deps });
  
  return {
    createOneRecord: createCreateOneRecord<T>(config),
    deleteOneRecord: createDeleteOneRecord<T>(config),
    replaceOneRecord: createReplaceOneRecord<T>(config),
    patchOneRecord: createPatchOneRecord<T>(config),
    createManyRecords: createCreateManyRecords<T>(config),
    deleteManyRecords: createDeleteManyRecords<T>(config),
    patchManyRecords: createPatchManyRecords<T>(config),
    fetchOneRecord: createFetchOneRecord<T>(config),
    fetchManyRecords: createFetchManyRecords<T>(config),
    fetchAllRecords: createFetchAllRecords<T>(config),
    createFetchAllRecords: createCreateFetchAllRecords<T>(config),
  };
};