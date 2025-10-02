"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_translate_1 = require("@aws-sdk/client-translate");
const translateClient = new client_translate_1.TranslateClient({ region: process.env.AWS_REGION });
const handler = async (event) => {
    console.log('event: ', event);
    // Common headers for all responses
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Content-Type': 'application/json',
    };
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
            },
            body: '',
        };
    }
    try {
        const payload = JSON.parse(event.body || '{}');
        const params = {
            SourceLanguageCode: payload.sourceLang,
            TargetLanguageCode: payload.targetLang,
            Text: payload.content,
        };
        console.log('parameters: ' + JSON.stringify(params));
        const command = new client_translate_1.TranslateTextCommand(params);
        const response = await translateClient.send(command);
        console.log('response ' + JSON.stringify(response));
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(response),
        };
    }
    catch (error) {
        console.log(error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: errorMessage }),
        };
    }
};
exports.handler = handler;
//# sourceMappingURL=handler.js.map