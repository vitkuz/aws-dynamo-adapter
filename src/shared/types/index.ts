import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// BaseRecord can be any object - users define their own shape
export type BaseRecord = Record<string, any>;

// Optional interface for records with timestamps
export interface WithTimestamps {
  createdAt?: string;
  updatedAt?: string;
}

// Helper type for records that include timestamps
export type RecordWithTimestamps<T extends BaseRecord = BaseRecord> = T & Required<WithTimestamps>;

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface DynamoDBAdapterConfig {
  tableName: string;
  partitionKey?: string;
  sortKey?: string;
  gsiName?: string;
  region?: string;
  logger?: Logger;
  client?: DynamoDBDocumentClient;
}

export interface DynamoDBKey {
  [key: string]: string | number;
}
