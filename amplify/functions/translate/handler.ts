import type { APIGatewayProxyHandler } from 'aws-lambda';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

async function detectLanguageAndTranslate(text: string, targetLanguage: string = 'English') {
  const prompt = `Human: Analyze this text and detect the language of ONLY the natural human language content. Ignore and do not translate any technical content such as:
- Code snippets (SQL, JavaScript, Python, etc.)
- Error messages and stack traces
- Log outputs and system messages
- URLs, file paths, and technical identifiers
- Configuration files and markup

Focus ONLY on natural language text that appears to be human communication (sentences, phrases, conversational text).

Text: "${text}"

If the text contains natural language content, detect its language and translate only that content to ${targetLanguage}. If the text is purely technical with no natural language content, return the original text untranslated.

Provide response in this exact JSON format:
{"detectedLanguage": "language name", "detectedLanguageCode": "ISO code", "translatedText": "translation of natural language parts only", "originalText": "original text"}`;

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

      // Validate the result and default to English if detection failed
      if (!parsedResult.detectedLanguage || parsedResult.detectedLanguage === 'Unknown' || !parsedResult.detectedLanguageCode) {
        console.log('Language detection failed, defaulting to English');
        return {
          detectedLanguage: 'English',
          detectedLanguageCode: 'en',
          translatedText: text,
          originalText: text
        };
      }

      return parsedResult;
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    console.error('Error parsing Bedrock response:', error);
    console.error('Response content:', responseBody.content[0]?.text);
    // Default to English when language detection fails
    return {
      detectedLanguage: 'English',
      detectedLanguageCode: 'en',
      translatedText: text, // Keep original text as-is since we assume it's already English
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