import React, { useEffect, useRef, useState } from 'react';
import './chatroom.css';
import Message from './message.js';
import ProcessChatText from './translate'
import { addChat, useGlobalState, addLanguagePair } from '../store/state';

const Chatroom = (props) => {

    const [Chats] = useGlobalState('Chats');
    const currentContactId = useGlobalState('currentContactId');
    const [newMessage, setNewMessage] = useState("");
    const [languageTranslate] = useGlobalState('languageTranslate');
    const [languageOptions] = useGlobalState('languageOptions');
    const [languagePairs] = useGlobalState('languagePairs');
    const agentUsername = 'AGENT';
    const messageEl = useRef(null);
    const input = useRef(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track processed agent messages to prevent duplicates
    const processedAgentMessages = useRef(new Set());

    // Helper function to create chat data with proper content rendering
    const createChatData = (contactId, username, originalText, translatedText, detectedLanguage, languageCode, translationResult = null) => {
        const segments = translationResult?.segments || [];
        const hasMixedContent = translationResult?.hasMixedContent || false;
        
        console.log('Creating AGENT chat data:', {
            username,
            originalText: originalText?.substring(0, 100),
            translatedText: translatedText?.substring(0, 100),
            hasMixedContent,
            segmentCount: segments.length,
            translationResultExists: !!translationResult,
            segments: segments.map(s => ({ 
                type: s.type, 
                contentPreview: s.content?.substring(0, 50),
                hasTranslatedContent: !!s.translatedContent 
            }))
        });
        
        // Special debugging for agent messages
        if (username === 'AGENT') {
            console.log('AGENT MESSAGE CREATION DEBUG:', {
                fullTranslationResult: translationResult,
                segmentsDetail: segments
            });
        }
        
        // If we don't have proper segments but the text looks like it should be technical, create segments manually
        if (segments.length === 0 && originalText) {
            const technicalPatterns = [
                /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b/i,
                /\b(function|const|let|var|class|import|export)\b/i,
                /(Error:|Exception:|TypeError:|ReferenceError:)/i,
                /https?:\/\/[^\s]+/i
            ];
            
            const isPureTechnical = technicalPatterns.some(pattern => pattern.test(originalText));
            
            if (isPureTechnical) {
                console.log('Creating manual technical segment for:', originalText.substring(0, 50));
                const manualSegments = [{
                    type: 'technical',
                    content: originalText,
                    translatedContent: translatedText || originalText,
                    originalIndex: 0
                }];
                
                return {
                    contactId,
                    username,
                    content: null,
                    translatedMessage: null,
                    detectedLanguage,
                    languageCode,
                    segments: manualSegments,
                    hasMixedContent: true,
                    originalText: originalText,
                    translatedText: translatedText
                };
            }
        }
        
        return {
            contactId,
            username,
            content: hasMixedContent && segments.length > 0 ? null : <p>{originalText}</p>,
            translatedMessage: hasMixedContent && segments.length > 0 ? null : <p>{translatedText}</p>,
            detectedLanguage,
            languageCode,
            segments: segments,
            hasMixedContent: hasMixedContent,
            originalText: originalText,
            translatedText: translatedText
        };
    };

    // Helper function to convert language codes to language names for Bedrock
    const getLanguageName = (langCode) => {
        const languageMap = {
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'en': 'English',
            'nl': 'Dutch',
            'sv': 'Swedish',
            'no': 'Norwegian',
            'da': 'Danish',
            'fi': 'Finnish',
            'pl': 'Polish',
            'tr': 'Turkish',
            'he': 'Hebrew',
            'th': 'Thai',
            'vi': 'Vietnamese'
        };

        // If exact match found, return it
        if (languageMap[langCode]) {
            return languageMap[langCode];
        }

        // If it's already a language name (like "Spanish"), return as is
        if (typeof langCode === 'string' && langCode.length > 2) {
            return langCode;
        }

        // Default fallback
        console.warn(`Unknown language code: ${langCode}, defaulting to English`);
        return 'English';
    };

    function getKeyByValue(object) {
        let obj = languageTranslate.find(o => o.contactId === currentContactId[0]);
        if (obj === undefined) {
            return
        } else {
            return Object.keys(object).find(key => object[key] === obj.lang);
        }

    }

    const sendMessage = async (session, content) => {
        const awsSdkResponse = await session.sendMessage({
            contentType: "text/plain",
            message: content
        });
        const { AbsoluteTime, Id } = awsSdkResponse.data;
        console.log(AbsoluteTime, Id);
    }

    useEffect(() => {

        // this ensures that the chat window will auto scoll to ensure the more recent message is in view
        if (messageEl) {
            messageEl.current.addEventListener('DOMNodeInserted', event => {
                const { currentTarget: target } = event;
                target.scroll({ top: target.scrollHeight, behavior: 'smooth' });
            });
        }
        // this ensure that the input box has the focus on load and after each entry
        input.current.focus();
    }, []);


    // Helper function to retrieve session value by contact ID
    function retrieveValue(key) {
        var value = "";
        for (var obj in props.session) {
            for (var item in props.session[obj]) {
                if (item === key) {
                    value = props.session[obj][item];
                    break;
                }
            }
        }
        return value;
    }

    async function handleSubmit(event) {
        event.preventDefault();

        // Prevent multiple submissions
        if (isSubmitting) {
            console.log("CDEBUG ===> Already submitting, ignoring duplicate submission");
            return;
        }

        // if there is no text in the the chat input box, do nothing.
        if (newMessage === "") {
            return;
        }

        // Check for duplicate message processing
        const messageKey = `${currentContactId[0]}-${newMessage}`;
        if (processedAgentMessages.current.has(messageKey)) {
            console.log("CDEBUG ===> Skipping duplicate agent message:", newMessage);
            return;
        }

        setIsSubmitting(true);

        // Add to processed messages and remove after 3 seconds
        processedAgentMessages.current.add(messageKey);
        setTimeout(() => {
            processedAgentMessages.current.delete(messageKey);
        }, 3000);

        try {
            console.log("CDEBUG ===> Agent sending message:", newMessage);
            console.log("CDEBUG ===> Current contact ID:", currentContactId[0]);
            console.log("CDEBUG ===> Available language translations:", languageTranslate);

            // Check if languages are already locked for this contact
            const existingPair = languagePairs.find(pair => pair.contactId === currentContactId[0]);
            if (existingPair && existingPair.isLocked) {
                console.log(`CDEBUG ===> Languages already locked. Using locked pair - Customer: ${existingPair.customerLang}, Agent: ${existingPair.agentLang}`);

                // Only translate to the locked customer language
                const targetLanguageName = getLanguageName(existingPair.customerLang);
                console.log("Target language name for Bedrock (locked):", targetLanguageName);

                try {
                    console.log("Starting translation process for locked pair...");
                    let translationResult = await ProcessChatText(newMessage, existingPair.agentLang, targetLanguageName);
                    console.log("Translation process completed successfully");

                    let translatedMessage = translationResult.translatedText || newMessage;

                    console.log("Bedrock translation result (locked):", translationResult);
                    console.log(`Original Agent Message: ${newMessage}`);
                    console.log(`Translated Agent Message: ${translatedMessage}`);

                    // create the new message to add to Chats.
                    let data2 = createChatData(
                        currentContactId[0],
                        agentUsername,
                        newMessage,
                        translatedMessage,
                        existingPair.agentLang,
                        existingPair.agentLang,
                        translationResult
                    );
                    addChat(prevMsg => [...prevMsg, data2]);
                    setNewMessage("");

                    // Send the translated message to the customer
                    const session = retrieveValue(currentContactId[0]);
                    if (session) {
                        console.log("Sending translated message to customer (locked):", translatedMessage);
                        await sendMessage(session, translatedMessage);
                    }

                    return;

                } catch (error) {
                    console.error("Error translating agent message (locked):", error);
                    console.error("Error details:", error.message, error.stack);

                    // Fallback: add message without translation
                    let data2 = createChatData(
                        currentContactId[0],
                        agentUsername,
                        newMessage,
                        '⚠️ Translation failed, sending original message',
                        'Error',
                        'error'
                    );
                    addChat(prevMsg => [...prevMsg, data2]);
                    setNewMessage("");

                    // Send original message to customer
                    const session = retrieveValue(currentContactId[0]);
                    if (session) {
                        await sendMessage(session, newMessage);
                    }
                    return;
                }
            }

            let destLang = languageTranslate.find(o => o.contactId === currentContactId[0]);
            console.log("CDEBUG ===> Destination language found:", destLang);

            // Translate the agent message using Bedrock LLM
            console.log("Agent message to translate:", newMessage);
            console.log("Target language:", destLang);

            if (!destLang || !destLang.lang) {
                console.error("No destination language found for contact:", currentContactId[0]);
                return;
            }

            // Determine target language name for Bedrock
            const targetLanguageName = getLanguageName(destLang.lang);
            console.log("Target language name for Bedrock:", targetLanguageName);

            // Check if this is the first agent message - if so, detect and lock the agent language
            const agentMessages = Chats.filter(chat => chat.contactId === currentContactId[0] && chat.username === agentUsername);
            const customerMessages = Chats.filter(chat => chat.contactId === currentContactId[0] && chat.username === 'customer');
            const isFirstAgentMessage = agentMessages.length === 0;

            if (isFirstAgentMessage && customerMessages.length > 0) {
                // This is the FIRST agent message - detect and lock the agent language
                console.log(`CDEBUG ===> FIRST agent message - detecting and locking agent language: ${newMessage}`);

                // Detect the agent's language from their first message
                let agentDetectionResult = await ProcessChatText(newMessage, 'auto', 'English');
                const detectedAgentLang = agentDetectionResult.detectedLanguageCode || 'en';
                const detectedAgentLangName = agentDetectionResult.detectedLanguage || 'English';

                console.log(`CDEBUG ===> Agent language detected: ${detectedAgentLang} (${detectedAgentLangName})`);

                // Lock the language pair
                const customerLang = destLang.lang;
                console.log(`CDEBUG ===> 🔒 LOCKING LANGUAGE PAIR - Customer: ${customerLang}, Agent: ${detectedAgentLang}`);
                console.log(`CDEBUG ===> From now on, only messages in these languages will be translated`);
                addLanguagePair(currentContactId[0], customerLang, detectedAgentLang);

                // Translate the message normally
                try {
                    let translationResult = await ProcessChatText(newMessage, detectedAgentLangName, targetLanguageName);
                    let translatedMessage = translationResult.translatedText || newMessage;

                    console.log("Bedrock translation result (first agent message):", translationResult);
                    console.log(`Original Agent Message: ${newMessage}`);
                    console.log(`Translated Agent Message: ${translatedMessage}`);

                    // create the new message to add to Chats.
                    let data2 = createChatData(
                        currentContactId[0],
                        agentUsername,
                        newMessage,
                        translatedMessage,
                        detectedAgentLangName,
                        detectedAgentLang,
                        translationResult
                    );
                    addChat(prevMsg => [...prevMsg, data2]);
                    setNewMessage("");

                    // Send the translated message to the customer
                    const session = retrieveValue(currentContactId[0]);
                    if (session) {
                        console.log("Sending translated message to customer:", translatedMessage);
                        await sendMessage(session, translatedMessage);
                    }

                } catch (error) {
                    console.error("Error translating first agent message:", error);
                    // If translation fails, send original message
                    let data2 = createChatData(
                        currentContactId[0],
                        agentUsername,
                        newMessage,
                        newMessage,
                        detectedAgentLangName,
                        detectedAgentLang
                    );
                    addChat(prevMsg => [...prevMsg, data2]);
                    setNewMessage("");

                    const session = retrieveValue(currentContactId[0]);
                    if (session) {
                        await sendMessage(session, newMessage);
                    }
                }

            } else if (!isFirstAgentMessage) {
                // This is NOT the first agent message - validate against locked language
                console.log(`CDEBUG ===> SUBSEQUENT AGENT MESSAGE - Processing: ${newMessage}`);
                console.log(`CDEBUG ===> Agent messages count: ${agentMessages.length}, Customer messages count: ${customerMessages.length}`);

                // Get the locked language pair
                const lockedPair = languagePairs.find(pair => pair.contactId === currentContactId[0]);
                if (lockedPair && lockedPair.isLocked) {
                    const lockedAgentLang = lockedPair.agentLang;
                    const lockedAgentLangName = getLanguageName(lockedAgentLang);

                    console.log(`CDEBUG ===> Agent language LOCKED to: ${lockedAgentLang} (${lockedAgentLangName})`);

                    // Skip language validation to avoid double ProcessChatText calls
                    // Just proceed with translation using the locked language
                    console.log(`CDEBUG ===> Skipping language validation, using locked language: ${lockedAgentLangName}`);
                    
                    {
                        // Same language - translate normally using locked language
                        console.log(`CDEBUG ===> ✅ Agent language matches locked language. Translating from ${lockedAgentLangName} to ${targetLanguageName}`);

                        try {
                            let translationResult = await ProcessChatText(newMessage, lockedAgentLangName, targetLanguageName);
                            let translatedMessage = translationResult.translatedText || newMessage;

                            console.log("Bedrock translation result (locked agent):", translationResult);
                            console.log(`Original Agent Message: ${newMessage}`);
                            console.log(`Translated Agent Message: ${translatedMessage}`);

                            // create the new message to add to Chats.
                            let data2 = createChatData(
                                currentContactId[0],
                                agentUsername,
                                newMessage,
                                translatedMessage,
                                lockedAgentLangName,
                                lockedAgentLang,
                                translationResult
                            );
                            addChat(prevMsg => [...prevMsg, data2]);
                            setNewMessage("");

                            // Send the translated message to the customer
                            const session = retrieveValue(currentContactId[0]);
                            if (session) {
                                console.log("Sending translated message to customer (locked agent):", translatedMessage);
                                await sendMessage(session, translatedMessage);
                            }

                        } catch (error) {
                            console.error("Error translating locked agent message:", error);
                            return;
                        }
                    }
                } else {
                    // Fallback - no locked pair found, translate normally
                    console.log(`CDEBUG ===> No locked pair found, translating normally`);

                    try {
                        let translationResult = await ProcessChatText(newMessage, 'English', targetLanguageName);
                        let translatedMessage = translationResult.translatedText || newMessage;

                        console.log("Bedrock translation result (fallback):", translationResult);
                        console.log(`Original Agent Message: ${newMessage}`);
                        console.log(`Translated Agent Message: ${translatedMessage}`);

                        // create the new message to add to Chats.
                        let data2 = createChatData(
                            currentContactId[0],
                            agentUsername,
                            newMessage,
                            translatedMessage,
                            'English',
                            'en',
                            translationResult
                        );
                        addChat(prevMsg => [...prevMsg, data2]);
                        setNewMessage("");

                        // Send the translated message to the customer
                        const session = retrieveValue(currentContactId[0]);
                        if (session) {
                            console.log("Sending translated message to customer (fallback):", translatedMessage);
                            await sendMessage(session, translatedMessage);
                        }

                    } catch (error) {
                        console.error("Error translating agent message (fallback):", error);
                        let data2 = createChatData(
                            currentContactId[0],
                            agentUsername,
                            newMessage,
                            newMessage,
                            'English',
                            'en',
                            null // No translation result for error case
                        );
                        addChat(prevMsg => [...prevMsg, data2]);
                        setNewMessage("");

                        const session = retrieveValue(currentContactId[0]);
                        if (session) {
                            await sendMessage(session, newMessage);
                        }
                    }
                }
            } else {
                // First agent message but no customer messages yet - translate normally
                console.log(`CDEBUG ===> First agent message but no customer messages yet`);

                try {
                    let translationResult = await ProcessChatText(newMessage, 'English', targetLanguageName);
                    let translatedMessage = translationResult.translatedText || newMessage;

                    console.log("Bedrock translation result (no customer yet):", translationResult);
                    console.log(`Original Agent Message: ${newMessage}`);
                    console.log(`Translated Agent Message: ${translatedMessage}`);

                    // create the new message to add to Chats.
                    let data2 = createChatData(
                        currentContactId[0],
                        agentUsername,
                        newMessage,
                        translatedMessage,
                        'English',
                        'en',
                        translationResult
                    );
                    addChat(prevMsg => [...prevMsg, data2]);
                    setNewMessage("");

                    // Send the translated message to the customer
                    const session = retrieveValue(currentContactId[0]);
                    if (session) {
                        console.log("Sending translated message to customer (no customer yet):", translatedMessage);
                        await sendMessage(session, translatedMessage);
                    }

                } catch (error) {
                    console.error("Error translating agent message (no customer yet):", error);
                    let data2 = createChatData(
                        currentContactId[0],
                        agentUsername,
                        newMessage,
                        newMessage,
                        'English',
                        'en',
                        null // No translation result for error case
                    );
                    addChat(prevMsg => [...prevMsg, data2]);
                    setNewMessage("");

                    const session = retrieveValue(currentContactId[0]);
                    if (session) {
                        await sendMessage(session, newMessage);
                    }
                }
            }
        } catch (error) {
            console.error("Error in handleSubmit:", error);
            // Handle any unexpected errors
            let data2 = createChatData(
                currentContactId[0],
                agentUsername,
                newMessage,
                '⚠️ Error processing message',
                'Unknown',
                'unknown'
            );
            addChat(prevMsg => [...prevMsg, data2]);
            setNewMessage("");
        } finally {
            setIsSubmitting(false);
        }
    }



    return (
        <div className="chatroom">
            <h3>Translate - ({languageTranslate.map(lang => { if (lang.contactId === currentContactId[0]) return lang.lang })}) {getKeyByValue(languageOptions)}</h3>
            <ul className="chats" ref={messageEl}>
                {
                    // iterate over the Chats, and only display the messages for the currently active chat session
                    Chats.map((chat, index) => {
                        if (chat.contactId === currentContactId[0])
                            return <Message key={`${chat.contactId}-${index}`} chat={chat} user={agentUsername} />
                    }
                    )
                }
            </ul>
            <form className="input" onSubmit={handleSubmit} >
                <input
                    ref={input}
                    maxLength="1024"
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                />
                <input type="submit" value="Submit" />
            </form>

        </div>
    );
};


export default Chatroom;
