import { v4 as uuidv4 } from 'uuid';
import { BaseRecord, WithTimestamps, RecordWithTimestamps } from '../../shared/types';

export const generateId = (): string => uuidv4();

export const getCurrentTimestamp = (): string => new Date().toISOString();

export const addTimestamps = <T extends BaseRecord>(record: T): T & RecordWithTimestamps => {
  const timestamp = getCurrentTimestamp();
  return {
    ...record,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const addTimestampsIfMissing = <T extends BaseRecord>(
  record: T & WithTimestamps
): T & RecordWithTimestamps => {
  const timestamp = getCurrentTimestamp();
  return {
    ...record,
    createdAt: record.createdAt || timestamp,
    updatedAt: record.updatedAt || timestamp,
  } as T & RecordWithTimestamps;
};

export const updateTimestamp = <T extends BaseRecord>(
  record: T & WithTimestamps
): T & { updatedAt: string } => ({
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
