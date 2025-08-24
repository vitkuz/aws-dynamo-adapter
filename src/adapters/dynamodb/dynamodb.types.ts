import { BaseRecord, DynamoDBKey, WithTimestamps, RecordWithTimestamps } from '../../shared/types';

export interface DynamoDBAdapter<T extends BaseRecord = BaseRecord> {
  createOneRecord: (record: T & WithTimestamps) => Promise<T & RecordWithTimestamps>;
  deleteOneRecord: (keys: DynamoDBKey) => Promise<void>;
  replaceOneRecord: (record: T & WithTimestamps) => Promise<T & RecordWithTimestamps>;
  patchOneRecord: (keys: DynamoDBKey, updates: Partial<T>) => Promise<T & RecordWithTimestamps>;
  createManyRecords: (records: (T & WithTimestamps)[]) => Promise<(T & RecordWithTimestamps)[]>;
  deleteManyRecords: (keysList: DynamoDBKey[]) => Promise<void>;
  patchManyRecords: (updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>) => Promise<(T & RecordWithTimestamps)[]>;
  fetchOneRecord: (keys: DynamoDBKey) => Promise<(T & RecordWithTimestamps) | null>;
  fetchManyRecords: (keysList: DynamoDBKey[]) => Promise<(T & RecordWithTimestamps)[]>;
  fetchAllRecords: (sk: string) => Promise<T[]>;
  createFetchAllRecords: (index?: string, sk?: string) => () => Promise<T[]>;
}

export interface DynamoDBClientDependencies {
  tableName: string;
  partitionKey: string;
  sortKey: string;
  gsiName: string;
}