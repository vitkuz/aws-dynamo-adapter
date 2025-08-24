import { v4 as uuidv4 } from 'uuid';
import { BaseRecord } from '../../shared/types';

export const generateId = (): string => uuidv4();

export const getCurrentTimestamp = (): string => new Date().toISOString();

export const addTimestamps = <T>(record: T): T & BaseRecord => {
  const timestamp = getCurrentTimestamp();
  return {
    ...record,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const addTimestampsIfMissing = <T>(record: T & Partial<BaseRecord>): T & BaseRecord => {
  const timestamp = getCurrentTimestamp();
  return {
    ...record,
    createdAt: record.createdAt || timestamp,
    updatedAt: record.updatedAt || timestamp,
  } as T & BaseRecord;
};

export const updateTimestamp = <T>(record: T): T & Pick<BaseRecord, 'updatedAt'> => ({
  ...record,
  updatedAt: getCurrentTimestamp(),
});

export const buildKeys = (
  partitionKey: string,
  sortKey: string | undefined,
  partitionValue: string | number,
  sortValue?: string | number
): Record<string, string | number> => {
  const keys: Record<string, string | number> = {
    [partitionKey]: partitionValue,
  };
  
  if (sortKey && sortValue !== undefined) {
    keys[sortKey] = sortValue;
  }
  
  return keys;
};

export const extractKeysFromRecord = <T extends Record<string, any>>(
  record: T,
  partitionKey: string,
  sortKey?: string
): Record<string, string | number> => {
  const keys: Record<string, string | number> = {
    [partitionKey]: record[partitionKey],
  };
  
  if (sortKey && record[sortKey] !== undefined) {
    keys[sortKey] = record[sortKey];
  }
  
  return keys;
};