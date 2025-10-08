import { post } from 'aws-amplify/api';
import MixedContentProcessor from './mixedContentProcessor';

// Simple cache to prevent duplicate API calls for the same content
const translationCache = new Map();

// Internal function to call the Lambda API for pure natural language translation
async function callTranslationAPI(content, targetLang = 'English') {
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
    console.log(`[${callId}] API Call (Natural Language Only): `, content);

    try {
        const apiResponse = await post({
            apiName,
            path,
            options: myInit,
        }).response;

        const res = apiResponse.body;
        const resp = await res.json();
        console.log(`[${callId}] API Response: `, resp);

        return {
            translatedText: resp.translatedText || content,
            detectedLanguage: resp.detectedLanguage || 'Unknown',
            detectedLanguageCode: resp.detectedLanguageCode || 'unknown',
            originalText: resp.originalText || content
        };
    } catch (error) {
        console.error(`[${callId}] API Error: `, error);
        throw error;
    }
}

// Main translation function that handles mixed content
async function ProcessChatText(content, sourceLang = 'auto', targetLang = 'English') {
    // Create cache key
    const cacheKey = `${content}-${sourceLang}-${targetLang}`;

    // Check if we already have this translation cached
    if (translationCache.has(cacheKey)) {
        console.log(`[CACHE] Using cached translation for: ${content.substring(0, 50)}...`);
        return translationCache.get(cacheKey);
    }

    const callId = Math.random().toString(36).substring(2, 11);
    console.log(`[${callId}] ProcessChatText AGENT MESSAGE: `, content.substring(0, 100) + (content.length > 100 ? '...' : ''));
    console.log(`[${callId}] sourceLang: ${sourceLang}, targetLang: ${targetLang}`);
    
    // Check if this looks like mixed content
    const hasPotentialTechnicalContent = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH|function|const|let|var|class|Error:|Exception:|https?:\/\/)\b/i.test(content);
    console.log(`[${callId}] Has potential technical content: ${hasPotentialTechnicalContent}`);

    try {
        // Use MixedContentProcessor to handle mixed content
        const result = await MixedContentProcessor.processMixedContent(content, sourceLang, targetLang);
        
        console.log(`[${callId}] Mixed content processing result:`, {
            detectedLanguage: result.detectedLanguage,
            hasMixedContent: result.hasMixedContent,
            segmentCount: result.segments ? result.segments.length : 0,
            originalLength: content.length,
            translatedLength: result.translatedText?.length
        });

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
            originalText: content,
            hasMixedContent: false,
            segments: []
        };

        // Cache the error result to prevent retrying the same failed translation
        translationCache.set(cacheKey, errorResult);

        return errorResult;
    }
}

// Export both functions - the main one and the API caller for internal use
export default ProcessChatText;
export { callTranslationAPI };
