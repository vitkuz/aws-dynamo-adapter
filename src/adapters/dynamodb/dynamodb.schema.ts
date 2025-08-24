import { z } from 'zod';

export const baseRecordSchema = z.object({
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const dynamoDBKeySchema = z.record(z.string(), z.union([z.string(), z.number()]));

export const dynamoDBAdapterConfigSchema = z.object({
  tableName: z.string().min(1),
  partitionKey: z.string().optional(),
  sortKey: z.string().optional(),
  gsiName: z.string().optional(),
  logger: z.any().optional(),
});

export const validateKeys = (
  keys: unknown,
  partitionKey: string,
  sortKey?: string
): z.infer<typeof dynamoDBKeySchema> => {
  const parsed = dynamoDBKeySchema.parse(keys);

  if (!parsed[partitionKey]) {
    throw new Error(`Missing partition key: ${partitionKey}`);
  }

  if (sortKey && !parsed[sortKey]) {
    throw new Error(`Missing sort key: ${sortKey}`);
  }

  return parsed;
};

export const validateRecord = <T extends Record<string, any>>(
  record: T,
  partitionKey: string,
  sortKey?: string
): T => {
  if (!record[partitionKey]) {
    throw new Error(`Record missing partition key: ${partitionKey}`);
  }

  if (sortKey && !record[sortKey]) {
    throw new Error(`Record missing sort key: ${sortKey}`);
  }

  return record;
};
