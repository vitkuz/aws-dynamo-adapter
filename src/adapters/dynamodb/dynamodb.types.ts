import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  BaseRecord,
  DynamoDBKey,
  WithTimestamps,
  RecordWithTimestamps,
  Logger,
} from '../../shared/types';
import { RecordValidator } from './dynamodb.validation';

export interface DynamoDBAdapter {
  createOneRecord: <T extends BaseRecord = BaseRecord>(
    record: T & WithTimestamps
  ) => Promise<T & RecordWithTimestamps>;
  deleteOneRecord: (keys: DynamoDBKey) => Promise<void>;
  replaceOneRecord: <T extends BaseRecord = BaseRecord>(
    record: T & WithTimestamps
  ) => Promise<T & RecordWithTimestamps>;
  patchOneRecord: <T extends BaseRecord = BaseRecord>(
    keys: DynamoDBKey,
    updates: Partial<T>
  ) => Promise<T & RecordWithTimestamps>;
  createManyRecords: <T extends BaseRecord = BaseRecord>(
    records: (T & WithTimestamps)[]
  ) => Promise<(T & RecordWithTimestamps)[]>;
  deleteManyRecords: (keysList: DynamoDBKey[]) => Promise<void>;
  patchManyRecords: <T extends BaseRecord = BaseRecord>(
    updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>
  ) => Promise<(T & RecordWithTimestamps)[]>;
  fetchOneRecord: <T extends BaseRecord = BaseRecord>(
    keys: DynamoDBKey
  ) => Promise<(T & RecordWithTimestamps) | null>;
  fetchManyRecords: <T extends BaseRecord = BaseRecord>(
    keysList: DynamoDBKey[]
  ) => Promise<(T & RecordWithTimestamps)[]>;
  fetchAllRecords: <T extends BaseRecord = BaseRecord>(sk: string) => Promise<T[]>;
  createFetchAllRecords: <T extends BaseRecord = BaseRecord>(
    index?: string,
    sk?: string
  ) => () => Promise<T[]>;
}

export interface DynamoDBClientDependencies {
  tableName: string;
  partitionKey: string;
  sortKey: string;
  gsiName: string;
}

export interface AdapterConfig {
  client: DynamoDBDocumentClient;
  deps: DynamoDBClientDependencies;
  logger: Logger;
  validator: RecordValidator;
}
