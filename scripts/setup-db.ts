import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  AttributeDefinition,
  KeySchemaElement,
  GlobalSecondaryIndex,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';
const PARTITION_KEY = 'id';
const SORT_KEY = 'sk';
const GSI_NAME = 'gsiBySk';

const client = new DynamoDBClient({});

const setupDatabase = async (): Promise<void> => {
  console.log(`Setting up DynamoDB table: ${TABLE_NAME}`);

  try {
    // Check if table already exists
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`Table ${TABLE_NAME} already exists`);
    return;
  } catch (error: any) {
    if (error.name !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  // Table doesn't exist, create it
  const attributeDefinitions: AttributeDefinition[] = [
    { AttributeName: PARTITION_KEY, AttributeType: 'S' },
    { AttributeName: SORT_KEY, AttributeType: 'S' },
  ];

  const keySchema: KeySchemaElement[] = [
    { AttributeName: PARTITION_KEY, KeyType: 'HASH' },
    { AttributeName: SORT_KEY, KeyType: 'RANGE' },
  ];

  const globalSecondaryIndexes: GlobalSecondaryIndex[] = [
    {
      IndexName: GSI_NAME,
      KeySchema: [
        { AttributeName: SORT_KEY, KeyType: 'HASH' },
        { AttributeName: PARTITION_KEY, KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ];

  try {
    await client.send(
      new CreateTableCommand({
        TableName: TABLE_NAME,
        AttributeDefinitions: attributeDefinitions,
        KeySchema: keySchema,
        GlobalSecondaryIndexes: globalSecondaryIndexes,
        BillingMode: 'PAY_PER_REQUEST',
      })
    );

    console.log(`Table ${TABLE_NAME} created successfully`);

    // Wait for table to be active
    let tableActive = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!tableActive && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const response = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));

        if (response.Table?.TableStatus === 'ACTIVE') {
          tableActive = true;
          console.log(`Table ${TABLE_NAME} is now active`);
        } else {
          console.log(`Waiting for table to become active... (${response.Table?.TableStatus})`);
        }
      } catch (error) {
        console.error('Error checking table status:', error);
      }

      attempts++;
    }

    if (!tableActive) {
      throw new Error(`Table ${TABLE_NAME} did not become active within ${maxAttempts} seconds`);
    }
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
};

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Database setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database setup failed:', error);
    process.exit(1);
  });
