import { BaseRecord, DynamoDBKey } from '../../shared/types';

export interface DynamoDBAdapter<T extends BaseRecord = BaseRecord> {
  createOneRecord: (record: Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>) => Promise<T>;
  deleteOneRecord: (keys: DynamoDBKey) => Promise<void>;
  replaceOneRecord: (record: T) => Promise<T>;
  patchOneRecord: (keys: DynamoDBKey, updates: Partial<T>) => Promise<T>;
  createManyRecords: (records: (Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>)[]) => Promise<T[]>;
  deleteManyRecords: (keysList: DynamoDBKey[]) => Promise<void>;
  patchManyRecords: (updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>) => Promise<T[]>;
  fetchAllRecords: (sk: string) => Promise<T[]>;
  createFetchAllRecords: (index?: string, sk?: string) => () => Promise<T[]>;
}

export interface DynamoDBClientDependencies {
  tableName: string;
  partitionKey: string;
  sortKey: string;
  gsiName: string;
}