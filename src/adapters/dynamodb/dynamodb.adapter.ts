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
import { DynamoDBAdapter, DynamoDBClientDependencies } from './dynamodb.types';
import {
  addTimestampsIfMissing,
  updateTimestamp,
  extractKeysFromRecord,
} from './dynamodb.utils';
import { mergeWithDefaults } from './dynamodb.config';
import { RecordValidator, createRecordValidator } from './dynamodb.validation';

const createCreateOneRecord = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (record: T & WithTimestamps): Promise<T & RecordWithTimestamps> => {
  const validatedRecord = validator.validateCreateRecord(record);
  const recordWithTimestamps = addTimestampsIfMissing(validatedRecord);
  
  logger.debug('Creating record', { tableName: deps.tableName, record: recordWithTimestamps });
  
  await client.send(
    new PutCommand({
      TableName: deps.tableName,
      Item: recordWithTimestamps,
    })
  );
  
  logger.info('Record created successfully', { 
    tableName: deps.tableName,
    keys: extractKeysFromRecord(recordWithTimestamps, deps.partitionKey, deps.sortKey)
  });
  
  return recordWithTimestamps;
};

const createFetchOneRecord = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (keys: DynamoDBKey): Promise<(T & RecordWithTimestamps) | null> => {
  const validatedKeys = validator.validateKeys(keys);
  logger.debug('Fetching record', { tableName: deps.tableName, keys: validatedKeys });
  
  const result = await client.send(
    new GetCommand({
      TableName: deps.tableName,
      Key: validatedKeys,
    })
  );
  
  if (!result.Item) {
    logger.info('Record not found', { tableName: deps.tableName, keys: validatedKeys });
    return null;
  }
  
  logger.info('Record fetched successfully', { tableName: deps.tableName, keys: validatedKeys });
  return result.Item as T & RecordWithTimestamps;
};

const createFetchManyRecords = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (keysList: DynamoDBKey[]): Promise<(T & RecordWithTimestamps)[]> => {
  if (keysList.length === 0) {
    logger.debug('No keys provided for batch fetch', { tableName: deps.tableName });
    return [];
  }
  
  const validatedKeysList = validator.validateBatchKeys(keysList);
  logger.debug('Fetching multiple records by keys', { 
    tableName: deps.tableName, 
    count: validatedKeysList.length 
  });
  
  const results: (T & RecordWithTimestamps)[] = [];
  
  // Split into batches of 100 (DynamoDB limit for BatchGetItem)
  const batches = [];
  for (let i = 0; i < validatedKeysList.length; i += 100) {
    batches.push(validatedKeysList.slice(i, i + 100));
  }
  
  for (const batch of batches) {
    const response = await client.send(
      new BatchGetCommand({
        RequestItems: {
          [deps.tableName]: {
            Keys: batch,
          },
        },
      })
    );
    
    if (response.Responses && response.Responses[deps.tableName]) {
      results.push(...(response.Responses[deps.tableName] as (T & RecordWithTimestamps)[]));
    }
    
    // Handle unprocessed keys if any
    if (response.UnprocessedKeys && response.UnprocessedKeys[deps.tableName]) {
      logger.warn('Some keys were not processed', {
        tableName: deps.tableName,
        unprocessedCount: response.UnprocessedKeys[deps.tableName].Keys?.length || 0,
      });
    }
  }
  
  logger.info('Multiple records fetched by keys', { 
    tableName: deps.tableName, 
    requested: validatedKeysList.length,
    found: results.length 
  });
  
  return results;
};

const createDeleteOneRecord = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (keys: DynamoDBKey): Promise<void> => {
  const validatedKeys = validator.validateKeys(keys);
  logger.debug('Deleting record', { tableName: deps.tableName, keys: validatedKeys });
  
  await client.send(
    new DeleteCommand({
      TableName: deps.tableName,
      Key: validatedKeys,
    })
  );
  
  logger.info('Record deleted successfully', { tableName: deps.tableName, keys: validatedKeys });
};

const createReplaceOneRecord = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (record: T & WithTimestamps): Promise<T & RecordWithTimestamps> => {
  const validatedRecord = validator.validateUpdateRecord(record);
  const updatedRecord = updateTimestamp(validatedRecord) as T & RecordWithTimestamps;
  
  logger.debug('Replacing record', { tableName: deps.tableName, record: updatedRecord });
  
  await client.send(
    new PutCommand({
      TableName: deps.tableName,
      Item: updatedRecord,
    })
  );
  
  logger.info('Record replaced successfully', {
    tableName: deps.tableName,
    keys: extractKeysFromRecord(updatedRecord, deps.partitionKey, deps.sortKey)
  });
  
  return updatedRecord;
};

const createPatchOneRecord = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (keys: DynamoDBKey, updates: Partial<T>): Promise<T & RecordWithTimestamps> => {
  const { keys: validatedKeys, updates: validatedUpdates } = validator.validatePatchUpdates(keys, updates);
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
  
  logger.debug('Patching record', { tableName: deps.tableName, keys: validatedKeys, updates: updatesWithTimestamp });
  
  const result = await client.send(
    new UpdateCommand({
      TableName: deps.tableName,
      Key: validatedKeys,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    })
  );
  
  logger.info('Record patched successfully', { tableName: deps.tableName, keys: validatedKeys });
  
  return result.Attributes as T & RecordWithTimestamps;
};

const createCreateManyRecords = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (records: (T & WithTimestamps)[]): Promise<(T & RecordWithTimestamps)[]> => {
  const validatedRecords = validator.validateBatchRecords(records);
  const recordsWithTimestamps = validatedRecords.map(record => addTimestampsIfMissing(record));
  
  logger.debug('Creating multiple records', { tableName: deps.tableName, count: validatedRecords.length });
  
  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < recordsWithTimestamps.length; i += 25) {
    batches.push(recordsWithTimestamps.slice(i, i + 25));
  }
  
  for (const batch of batches) {
    const putRequests = batch.map(item => ({
      PutRequest: { Item: item }
    }));
    
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [deps.tableName]: putRequests,
        },
      })
    );
  }
  
  logger.info('Multiple records created successfully', { 
    tableName: deps.tableName, 
    count: recordsWithTimestamps.length 
  });
  
  return recordsWithTimestamps;
};

const createDeleteManyRecords = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (keysList: DynamoDBKey[]): Promise<void> => {
  const validatedKeysList = validator.validateBatchKeys(keysList);
  logger.debug('Deleting multiple records', { tableName: deps.tableName, count: validatedKeysList.length });
  
  // Split into batches of 25 (DynamoDB limit)
  const batches = [];
  for (let i = 0; i < validatedKeysList.length; i += 25) {
    batches.push(validatedKeysList.slice(i, i + 25));
  }
  
  for (const batch of batches) {
    const deleteRequests = batch.map(keys => ({
      DeleteRequest: { Key: keys }
    }));
    
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [deps.tableName]: deleteRequests,
        },
      })
    );
  }
  
  logger.info('Multiple records deleted successfully', { 
    tableName: deps.tableName, 
    count: validatedKeysList.length 
  });
};

const createPatchManyRecords = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>): Promise<(T & RecordWithTimestamps)[]> => {
  const validatedUpdates = validator.validateBatchPatchUpdates(updates);
  logger.debug('Patching multiple records', { tableName: deps.tableName, count: validatedUpdates.length });
  
  const patchOneRecord = createPatchOneRecord<T>(client, deps, logger, validator);
  const results = await Promise.all(
    validatedUpdates.map(({ keys, updates }) => patchOneRecord(keys, updates))
  );
  
  logger.info('Multiple records patched successfully', { 
    tableName: deps.tableName, 
    count: results.length 
  });
  
  return results;
};

const createFetchAllRecords = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => async (sk: string): Promise<T[]> => {
  logger.debug('Fetching all records by sort key', { 
    tableName: deps.tableName, 
    index: deps.gsiName, 
    sk 
  });
  
  const items: T[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;
  
  do {
    const result = await client.send(
      new QueryCommand({
        TableName: deps.tableName,
        IndexName: deps.gsiName,
        KeyConditionExpression: '#sk = :sk',
        ExpressionAttributeNames: {
          '#sk': deps.sortKey,
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
  
  logger.info('Records fetched successfully', { 
    tableName: deps.tableName, 
    index: deps.gsiName, 
    sk, 
    count: items.length 
  });
  
  return items;
};

const createCreateFetchAllRecords = <T extends BaseRecord>(
  client: DynamoDBDocumentClient,
  deps: DynamoDBClientDependencies,
  logger: Logger,
  validator: RecordValidator<T>
) => (index: string = deps.gsiName, sk?: string) => async (): Promise<T[]> => {
  if (sk) {
    logger.debug('Creating fetch function for specific sort key', { 
      tableName: deps.tableName, 
      index, 
      sk 
    });
    
    const items: T[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;
    
    do {
      const result = await client.send(
        new QueryCommand({
          TableName: deps.tableName,
          IndexName: index,
          KeyConditionExpression: '#sk = :sk',
          ExpressionAttributeNames: {
            '#sk': deps.sortKey || 'sk',
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
    
    logger.info('Records fetched via created function', { 
      tableName: deps.tableName, 
      index, 
      sk, 
      count: items.length 
    });
    
    return items;
  } else {
    logger.debug('Creating fetch function for all records', { 
      tableName: deps.tableName 
    });
    
    const items: T[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined;
    
    do {
      const result = await client.send(
        new ScanCommand({
          TableName: deps.tableName,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      
      if (result.Items) {
        items.push(...(result.Items as T[]));
      }
      
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    
    logger.info('All records fetched via created function', { 
      tableName: deps.tableName, 
      count: items.length 
    });
    
    return items;
  }
};

export const createAdapter = <T extends BaseRecord = BaseRecord>(
  config: DynamoDBAdapterConfig
): DynamoDBAdapter<T> => {
  const mergedConfig = mergeWithDefaults(config);
  const { client, logger, tableName, partitionKey, sortKey, gsiName } = mergedConfig;
  
  const deps: DynamoDBClientDependencies = {
    tableName,
    partitionKey,
    sortKey,
    gsiName,
  };
  
  const validator = createRecordValidator<T>(deps);
  
  logger.info('DynamoDB adapter created', { config: deps });
  
  return {
    createOneRecord: createCreateOneRecord<T>(client, deps, logger, validator),
    deleteOneRecord: createDeleteOneRecord<T>(client, deps, logger, validator),
    replaceOneRecord: createReplaceOneRecord<T>(client, deps, logger, validator),
    patchOneRecord: createPatchOneRecord<T>(client, deps, logger, validator),
    createManyRecords: createCreateManyRecords<T>(client, deps, logger, validator),
    deleteManyRecords: createDeleteManyRecords<T>(client, deps, logger, validator),
    patchManyRecords: createPatchManyRecords<T>(client, deps, logger, validator),
    fetchOneRecord: createFetchOneRecord<T>(client, deps, logger, validator),
    fetchManyRecords: createFetchManyRecords<T>(client, deps, logger, validator),
    fetchAllRecords: createFetchAllRecords<T>(client, deps, logger, validator),
    createFetchAllRecords: createCreateFetchAllRecords<T>(client, deps, logger, validator),
  };
};