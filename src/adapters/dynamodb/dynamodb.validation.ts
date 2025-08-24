import { z, ZodError } from 'zod';
import { BaseRecord, DynamoDBKey } from '../../shared/types';
import { DynamoDBClientDependencies } from './dynamodb.types';

export interface RecordValidator<T extends BaseRecord = BaseRecord> {
  validateCreateRecord: (record: Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>) => Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>;
  validateKeys: (keys: DynamoDBKey) => DynamoDBKey;
  validateUpdateRecord: (record: T) => T;
  validateBatchRecords: (records: (Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>)[]) => (Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>)[];
  validateBatchKeys: (keysList: DynamoDBKey[]) => DynamoDBKey[];
  validatePatchUpdates: (keys: DynamoDBKey, updates: Partial<T>) => { keys: DynamoDBKey; updates: Partial<T> };
  validateBatchPatchUpdates: (updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>) => Array<{ keys: DynamoDBKey; updates: Partial<T> }>;
}

// Factory to create dynamic Zod schema based on configuration
const createKeySchema = (partitionKey: string, sortKey: string) => {
  const schemaShape: Record<string, z.ZodTypeAny> = {
    [partitionKey]: z.string().min(1),
    [sortKey]: z.string().min(1),
  };
  
  return z.object(schemaShape).catchall(z.union([z.string(), z.number()]));
};

// Factory to create record schema for validation
const createRecordSchema = (partitionKey: string, sortKey: string) => {
  const schemaShape: Record<string, z.ZodTypeAny> = {
    [partitionKey]: z.string().min(1),
    [sortKey]: z.string().min(1),
  };
  
  return z.object(schemaShape).passthrough();
};

// Create validator instance
export const createRecordValidator = <T extends BaseRecord = BaseRecord>(
  deps: DynamoDBClientDependencies
): RecordValidator<T> => {
  const keySchema = createKeySchema(deps.partitionKey, deps.sortKey);
  const recordSchema = createRecordSchema(deps.partitionKey, deps.sortKey);
  
  const validateCreateRecord = (record: Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>): Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'> => {
    try {
      const validated = recordSchema.parse(record);
      return validated as Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>;
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues || [];
        const missingFields = issues.map((e: z.ZodIssue) => e.path.join('.')).join(', ');
        throw new Error(`Validation failed for create record: Missing or invalid fields: ${missingFields}`);
      }
      throw error;
    }
  };
  
  const validateKeys = (keys: DynamoDBKey): DynamoDBKey => {
    try {
      const validated = keySchema.parse(keys);
      // Ensure we only have the required keys
      const result: DynamoDBKey = {
        [deps.partitionKey]: validated[deps.partitionKey] as string | number,
        [deps.sortKey]: validated[deps.sortKey] as string | number,
      };
      return result;
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues || [];
        const missingFields = issues.map((e: z.ZodIssue) => e.path.join('.')).join(', ');
        throw new Error(`Validation failed for keys: Missing or invalid fields: ${missingFields}`);
      }
      throw error;
    }
  };
  
  const validateUpdateRecord = (record: T): T => {
    try {
      const validated = recordSchema.parse(record);
      return validated as T;
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues || [];
        const missingFields = issues.map((e: z.ZodIssue) => e.path.join('.')).join(', ');
        throw new Error(`Validation failed for update record: Missing or invalid fields: ${missingFields}`);
      }
      throw error;
    }
  };
  
  const validateBatchRecords = (records: (Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>)[]): (Partial<Pick<T, 'createdAt' | 'updatedAt'>> & Omit<T, 'createdAt' | 'updatedAt'>)[] => {
    return records.map((record, index) => {
      try {
        return validateCreateRecord(record);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Validation failed for record at index ${index}: ${error.message}`);
        }
        throw error;
      }
    });
  };
  
  const validateBatchKeys = (keysList: DynamoDBKey[]): DynamoDBKey[] => {
    return keysList.map((keys, index) => {
      try {
        return validateKeys(keys);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Validation failed for keys at index ${index}: ${error.message}`);
        }
        throw error;
      }
    });
  };
  
  const validatePatchUpdates = (keys: DynamoDBKey, updates: Partial<T>): { keys: DynamoDBKey; updates: Partial<T> } => {
    const validatedKeys = validateKeys(keys);
    
    // Ensure updates don't contain partition or sort keys
    const cleanedUpdates = { ...updates };
    delete cleanedUpdates[deps.partitionKey as keyof T];
    delete cleanedUpdates[deps.sortKey as keyof T];
    
    return {
      keys: validatedKeys,
      updates: cleanedUpdates,
    };
  };
  
  const validateBatchPatchUpdates = (updates: Array<{ keys: DynamoDBKey; updates: Partial<T> }>): Array<{ keys: DynamoDBKey; updates: Partial<T> }> => {
    return updates.map((update, index) => {
      try {
        return validatePatchUpdates(update.keys, update.updates);
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Validation failed for patch at index ${index}: ${error.message}`);
        }
        throw error;
      }
    });
  };
  
  return {
    validateCreateRecord,
    validateKeys,
    validateUpdateRecord,
    validateBatchRecords,
    validateBatchKeys,
    validatePatchUpdates,
    validateBatchPatchUpdates,
  };
};