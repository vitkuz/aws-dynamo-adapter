import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBAdapterConfig, Logger } from '../../shared/types';

export const DEFAULT_PARTITION_KEY = 'id';
export const DEFAULT_SORT_KEY = 'sk';
export const DEFAULT_GSI_NAME = 'gsiBySk';

export const DEFAULT_DYNAMODB_CONFIG: Partial<DynamoDBAdapterConfig> = {
  partitionKey: DEFAULT_PARTITION_KEY,
  sortKey: DEFAULT_SORT_KEY,
  gsiName: DEFAULT_GSI_NAME,
};

const defaultLogger: Logger = {
  debug: (message: string, ...args: unknown[]) => console.debug(message, ...args),
  info: (message: string, ...args: unknown[]) => console.info(message, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
  error: (message: string, ...args: unknown[]) => console.error(message, ...args),
};

const createDynamoDBClient = (region?: string): DynamoDBDocumentClient => {
  const client = new DynamoDBClient(region ? { region } : {});
  return DynamoDBDocumentClient.from(client);
};

export interface MergedConfig {
  tableName: string;
  partitionKey: string;
  sortKey: string;
  gsiName: string;
  region?: string;
  logger: Logger;
  client: DynamoDBDocumentClient;
}

export const mergeWithDefaults = (config: DynamoDBAdapterConfig): MergedConfig => ({
  tableName: config.tableName,
  partitionKey: config.partitionKey ?? DEFAULT_PARTITION_KEY,
  sortKey: config.sortKey ?? DEFAULT_SORT_KEY,
  gsiName: config.gsiName ?? DEFAULT_GSI_NAME,
  region: config.region,
  logger: config.logger ?? defaultLogger,
  client: config.client ?? createDynamoDBClient(config.region),
});
