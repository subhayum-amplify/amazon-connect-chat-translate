import { post } from 'aws-amplify/api';

// Language detection using Bedrock LLM
async function DetectChatText(content) {
    const apiName = 'translateApi';
    const path = '/translate';
    
    const myInit = {
        body: { 
            'content': content, 
            'targetLang': 'English', // We just want detection, but translation helps with accuracy
            'operation': 'detect'
        },
        headers: {
            'Content-Type': 'application/json'
        },
    };
    
    console.log("DetectChatText (Bedrock): ", content);
    
    try {
        const result = await post({
            apiName,
            path,
            options: myInit,
        }).response;
        
        const res = result.body;
        const resp = await res.json();
        console.log("Bedrock Language Detection Response: ", resp);
        
        // Return in the format expected by the existing code
        return { 
            textInterpretation: { 
                language: resp.detectedLanguageCode || 'en' 
            },
            language: { 
                value: resp.detectedLanguageCode || 'en' 
            },
            detectedLanguage: resp.detectedLanguage || 'English',
            detectedLanguageCode: resp.detectedLanguageCode || 'en'
        };
    }
    catch (error) {
        console.error("DetectChatText Error: ", error);
        // Fallback to English if detection fails
        return { 
            textInterpretation: { 
                language: 'en' 
            },
            language: { 
                value: 'en' 
            },
            detectedLanguage: 'English',
            detectedLanguageCode: 'en'
        };
    }
}

export default DetectChatText
