import { post } from 'aws-amplify/api';

// Simple cache to prevent duplicate API calls for the same content
const translationCache = new Map();

async function ProcessChatText(content, sourceLang = 'auto', targetLang = 'English') {
    // Create cache key
    const cacheKey = `${content}-${sourceLang}-${targetLang}`;

    // Check if we already have this translation cached
    if (translationCache.has(cacheKey)) {
        console.log(`[CACHE] Using cached translation for: ${content}`);
        return translationCache.get(cacheKey);
    }
    const apiName = 'translateApi';
    const path = '/translate';

    const myInit = {
        body: {
            'content': content,
            'targetLang': targetLang,
            'operation': 'translate'
        },
        headers: {
            'Content-Type': 'application/json'
        },
    };

    const callId = Math.random().toString(36).substring(2, 11);
    console.log(`[${callId}] ProcessChatText (Bedrock): `, content);
    console.log(`[${callId}] ProcessChatText sourceLang: `, sourceLang);
    console.log(`[${callId}] ProcessChatText targetLang: `, targetLang);

    try {
        const apiResponse = await post({
            apiName,
            path,
            options: myInit,
        }).response;

        console.log(`[${callId}] Bedrock Translation Payload: `, apiResponse);
        const res = apiResponse.body;
        const resp = await res.json();
        console.log(`[${callId}] Bedrock Translation Response: `, resp);

        // Return the translated text from Bedrock response
        const result = {
            translatedText: resp.translatedText || content,
            detectedLanguage: resp.detectedLanguage || 'Unknown',
            detectedLanguageCode: resp.detectedLanguageCode || 'unknown',
            originalText: resp.originalText || content
        };

        // Cache the result to prevent duplicate calls
        translationCache.set(cacheKey, result);

        return result;
    }
    catch (error) {
        console.error(`[${callId}] ProcessChatText Error: `, error);
        const errorResult = {
            translatedText: content,
            detectedLanguage: 'Unknown',
            detectedLanguageCode: 'unknown',
            originalText: content
        };

        // Cache the error result to prevent retrying the same failed translation
        translationCache.set(cacheKey, errorResult);

        return errorResult;
    }
}

export default ProcessChatText
