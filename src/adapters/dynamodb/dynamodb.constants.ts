/**
 * DynamoDB service limits and constants
 */

export const DYNAMODB_BATCH_WRITE_LIMIT = 25;
export const DYNAMODB_BATCH_GET_LIMIT = 100;
export const DYNAMODB_MAX_TRANSACT_ITEMS = 25;
export const DYNAMODB_MAX_ITEM_SIZE = 400 * 1024; // 400 KB
export const DYNAMODB_MAX_QUERY_ITEMS = 1000000; // 1MB of data