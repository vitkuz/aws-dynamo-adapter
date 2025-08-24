import {
  DynamoDBClient,
  DeleteTableCommand,
  DescribeTableCommand,
} from '@aws-sdk/client-dynamodb';

const TABLE_NAME = process.env.TEST_TABLE_NAME || 'test-dynamodb-adapter';

const client = new DynamoDBClient({});

const teardownDatabase = async (): Promise<void> => {
  console.log(`Tearing down DynamoDB table: ${TABLE_NAME}`);
  
  try {
    // Check if table exists
    await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    
    // Table exists, delete it
    await client.send(new DeleteTableCommand({ TableName: TABLE_NAME }));
    console.log(`Table ${TABLE_NAME} deletion initiated`);
    
    // Wait for table to be deleted
    let tableDeleted = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!tableDeleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
        console.log('Waiting for table to be deleted...');
      } catch (error: any) {
        if (error.name === 'ResourceNotFoundException') {
          tableDeleted = true;
          console.log(`Table ${TABLE_NAME} has been deleted successfully`);
        } else {
          console.error('Error checking table status:', error);
        }
      }
      
      attempts++;
    }
    
    if (!tableDeleted) {
      throw new Error(`Table ${TABLE_NAME} was not deleted within ${maxAttempts} seconds`);
    }
  } catch (error: any) {
    if (error.name === 'ResourceNotFoundException') {
      console.log(`Table ${TABLE_NAME} does not exist`);
    } else {
      console.error('Error deleting table:', error);
      throw error;
    }
  }
};

// Run the teardown
teardownDatabase()
  .then(() => {
    console.log('Database teardown completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Database teardown failed:', error);
    process.exit(1);
  });