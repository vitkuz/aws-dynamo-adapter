import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

export interface BaseRecord {
  createdAt: string;
  updatedAt: string;
}

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