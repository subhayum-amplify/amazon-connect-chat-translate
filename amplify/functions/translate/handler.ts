import type { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

async function detectLanguageAndTranslate(text: string, targetLanguage: string = 'English') {
  const prompt = `Human: Analyze this text and provide JSON response:
Text: "${text}"
Format: {"detectedLanguage": "name", "detectedLanguageCode": "code", "translatedText": "translation to ${targetLanguage}", "originalText": "original"}
Assistant:`;

  const modelId = 'anthropic.claude-3-haiku-20240307-v1:0';
  
  const command = new InvokeModelCommand({
    modelId,
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    }),
    contentType: 'application/json',
    accept: 'application/json'
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  
  try {
    const content = responseBody.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Error parsing Bedrock response:', error);
    return {
      detectedLanguage: 'Unknown',
      detectedLanguageCode: 'unknown',
      translatedText: text,
      originalText: text
    };
  }
}export
 const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Bedrock Translation Handler - Event:', event);

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' },
      body: '',
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { content, targetLang = 'English', operation = 'translate' } = payload;

    if (!content) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Content is required' }),
      };
    }

    console.log('Processing:', { content, targetLang, operation });

    const result = await detectLanguageAndTranslate(content, targetLang);
    
    console.log('Bedrock result:', result);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    console.error('Handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: errorMessage }),
    };
  }
};