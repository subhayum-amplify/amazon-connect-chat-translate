import type { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

async function detectLanguageAndTranslate(text: string, targetLanguage: string = 'English') {
  const prompt = `Human: You are a language detection and translation expert. Translate the following NATURAL LANGUAGE text from its detected language to ${targetLanguage}.

IMPORTANT: This text should contain ONLY natural human language content. No code, URLs, or technical elements should be present.

Text to translate: "${text}"
Target language: ${targetLanguage}

If you cannot detect the language confidently, default to English.

Respond with valid JSON:
{
  "detectedLanguage": "detected language name (e.g., Spanish, French, German)",
  "detectedLanguageCode": "ISO language code (e.g., es, fr, de, en)",
  "translatedText": "translated text in target language",
  "originalText": "${text}"
}`

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
    console.log('Raw Bedrock response:', content);

    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsedResult = JSON.parse(jsonMatch[0]);
      console.log('Parsed result:', parsedResult);

      // Handle unknown language - default to English
      if (!parsedResult.detectedLanguage ||
        parsedResult.detectedLanguage === 'Unknown' ||
        !parsedResult.detectedLanguageCode) {
        console.log('Language detection failed or unknown, defaulting to English');
        return {
          detectedLanguage: 'English',
          detectedLanguageCode: 'en',
          translatedText: text,
          originalText: text
        };
      }

      // Validate that we have proper translation result
      if (!parsedResult.translatedText) {
        parsedResult.translatedText = text;
      }

      console.log('Translation completed:', {
        language: parsedResult.detectedLanguage,
        originalLength: text.length,
        translatedLength: parsedResult.translatedText.length
      });

      return {
        detectedLanguage: parsedResult.detectedLanguage,
        detectedLanguageCode: parsedResult.detectedLanguageCode,
        translatedText: parsedResult.translatedText,
        originalText: parsedResult.originalText || text
      };
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Error parsing Bedrock response:', error);
    console.error('Response content:', responseBody.content[0]?.text);

    // Default to English for natural language content
    console.log('Fallback: Defaulting to English');
    return {
      detectedLanguage: 'English',
      detectedLanguageCode: 'en',
      translatedText: text,
      originalText: text
    };
  }
}

export const handler: APIGatewayProxyHandler = async (event) => {
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