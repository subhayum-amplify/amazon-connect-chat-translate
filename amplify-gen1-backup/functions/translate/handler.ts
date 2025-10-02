import type { APIGatewayProxyHandler } from 'aws-lambda';
import { TranslateClient, TranslateTextCommand } from '@aws-sdk/client-translate';

const translateClient = new TranslateClient({ region: process.env.AWS_REGION });

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('event: ', event);
  
  try {
    const payload = JSON.parse(event.body || '{}');
    
    const params = {
      SourceLanguageCode: payload.sourceLang,
      TargetLanguageCode: payload.targetLang,
      Text: payload.content,
    };
    
    console.log('parameters: ' + JSON.stringify(params));
    
    const command = new TranslateTextCommand(params);
    const response = await translateClient.send(command);
    
    console.log('response ' + JSON.stringify(response));
    
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};