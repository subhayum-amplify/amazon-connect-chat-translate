import React, { useEffect, useState } from 'react';
import { Grid } from 'semantic-ui-react';
//import awsconfig from '../aws-exports';
import Chatroom from './chatroom';
import ProcessChatText from './translate'
import { addChat, setLanguageTranslate, clearChat, useGlobalState, setCurrentContactId, addLanguagePair, clearLanguagePair } from '../store/state';

// Note: Amplify.configure() is called in App.js

const Ccp = () => {
    const [languageTranslate] = useGlobalState('languageTranslate');
    const [languagePairs] = useGlobalState('languagePairs');
    var localLanguageTranslate = [];
    const [Chats] = useGlobalState('Chats');
    const [lang, setLang] = useState("");
    const [currentContactId] = useGlobalState('currentContactId');
    const [languageOptions] = useGlobalState('languageOptions');
    const [agentChatSessionState, setAgentChatSessionState] = useState([]);
    const [setRefreshChild] = useState([]);

    console.log(lang)
    console.log(currentContactId)
    //console.log(Chats)

    // *******
    // Subscribe to the chat session
    // *******
    function getEvents(contact, agentChatSession) {
        console.log(agentChatSession);
        contact.getAgentConnection().getMediaController().then(controller => {
            controller.onMessage(messageData => {
                if (messageData.chatDetails.participantId === messageData.data.ParticipantId) {
                    console.log(`CDEBUG ===> Agent ${messageData.data.DisplayName} Says`,
                        messageData.data.Content)
                }
                else {
                    console.log(`CDEBUG ===> Customer ${messageData.data.DisplayName} Says`, messageData.data.Content);
                    processChatText(messageData.data.Content, messageData.data.Type, messageData.data.ContactId);
                }
            })
        })
    }
    // Track processed messages to prevent duplicates
    const processedMessages = new Set();

    // Helper function to create chat data with proper content rendering
    const createChatData = (contactId, username, originalText, translatedText, detectedLanguage, languageCode, translationResult = null) => {
        const segments = translationResult?.segments || [];
        const hasMixedContent = translationResult?.hasMixedContent || false;
        
        console.log('Creating customer chat data:', {
            username,
            originalText: originalText?.substring(0, 100),
            translatedText: translatedText?.substring(0, 100),
            hasMixedContent,
            segmentCount: segments.length,
            segments: segments.map(s => ({ 
                type: s.type, 
                contentPreview: s.content?.substring(0, 50),
                hasTranslatedContent: !!s.translatedContent 
            }))
        });
        
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
                console.log('Creating manual technical segment for customer:', originalText.substring(0, 50));
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

    // *******
    // Processing the incoming chat from the Customer
    // *******
    async function processChatText(content, type, contactId) {
        // Check if we've already processed this exact message recently (within 1 second)
        const recentMessageKey = `${contactId}-${content}`;
        if (processedMessages.has(recentMessageKey)) {
            console.log(`CDEBUG ===> Skipping duplicate message: ${content}`);
            return;
        }

        // Add to processed messages and remove after 2 seconds to prevent memory buildup
        processedMessages.add(recentMessageKey);
        setTimeout(() => {
            processedMessages.delete(recentMessageKey);
        }, 2000);

        console.log(`CDEBUG ===> Processing customer message: ${content} (type: ${type})`);

        // Check if languages are already locked for this contact
        const existingPair = languagePairs.find(pair => pair.contactId === contactId);
        if (existingPair && existingPair.isLocked) {
            console.log(`CDEBUG ===> Languages already locked for contact ${contactId}. Customer: ${existingPair.customerLang}, Agent: ${existingPair.agentLang}`);
            console.log(`CDEBUG ===> Only processing messages in locked customer language: ${existingPair.customerLang}`);

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
                return 'English';
            };

            // Convert the locked customer language to the proper format for Bedrock
            const sourceLanguageName = getLanguageName(existingPair.customerLang);
            console.log(`CDEBUG ===> Languages are LOCKED. Only translating from ${sourceLanguageName} to English`);
            console.log(`CDEBUG ===> Assuming customer message is in locked language: ${sourceLanguageName}`);

            // Directly translate using the locked customer language - NO language detection
            const translationResult = await ProcessChatText(content, sourceLanguageName, 'English');
            const translatedMessage = translationResult.translatedText || content;

            console.log(`CDEBUG ===> Locked translation result:`, translationResult);

            // create the new message to add to Chats.
            let data2 = createChatData(
                contactId,
                'customer',
                content,
                translatedMessage,
                sourceLanguageName,
                existingPair.customerLang,
                translationResult
            );
            addChat(prevMsg => [...prevMsg, data2]);
            return;
        }

        // Check if we already know the language for this contactId
        let existingLanguage = languageTranslate.find(lang => lang.contactId === contactId);

        // Check if this is the first customer message
        const customerMessages = Chats.filter(chat => chat.contactId === contactId && chat.username === 'customer');
        const isFirstCustomerMessage = customerMessages.length === 0;

        if (isFirstCustomerMessage && !existingLanguage) {
            // This is the FIRST customer message - detect and lock the language
            console.log(`CDEBUG ===> FIRST customer message - detecting and locking language: ${content}`);

            let translationResult = await ProcessChatText(content, 'auto', 'English');
            console.log(`CDEBUG ===> First message translation result:`, translationResult);

            const translatedMessage = translationResult.translatedText || content;
            const detectedLang = translationResult.detectedLanguage || 'Unknown';
            const detectedLangCode = translationResult.detectedLanguageCode || 'en';

            // Store the detected language - this will be LOCKED
            console.log(`CDEBUG ===> LOCKING customer language to: ${detectedLangCode}`);
            function upsert(array, item) {
                const i = array.findIndex(_item => _item.contactId === item.contactId);
                if (i > -1) array[i] = item;
                else array.push(item);
            }
            upsert(languageTranslate, { contactId: contactId, lang: detectedLangCode });
            setLanguageTranslate(languageTranslate);

            // Create the message
            let data2 = createChatData(
                contactId,
                'customer',
                content,
                translatedMessage,
                detectedLang,
                detectedLangCode,
                translationResult
            );
            addChat(prevMsg => [...prevMsg, data2]);

        } else if (existingLanguage) {
            // Language is already locked - validate and translate using locked language
            const lockedLangCode = existingLanguage.lang;

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

                if (languageMap[langCode]) {
                    return languageMap[langCode];
                }

                if (typeof langCode === 'string' && langCode.length > 2) {
                    return langCode;
                }

                return 'English';
            };

            console.log(`CDEBUG ===> Language LOCKED to: ${lockedLangCode}. Validating message: ${content}`);

            // First detect the language of this message to validate it
            let detectionResult = await ProcessChatText(content, 'auto', 'English');
            const currentMsgLangCode = detectionResult.detectedLanguageCode || 'en';

            console.log(`CDEBUG ===> Current message language: ${currentMsgLangCode}, Locked language: ${lockedLangCode}`);

            if (currentMsgLangCode !== lockedLangCode) {
                // Different language detected - show warning
                console.log(`CDEBUG ===> ⚠️ DIFFERENT LANGUAGE DETECTED! Message: ${currentMsgLangCode}, Expected: ${lockedLangCode}`);

                let data2 = createChatData(
                    contactId,
                    'customer',
                    content,
                    `⚠️ Different language detected. Please use ${getLanguageName(lockedLangCode)} only.`,
                    getLanguageName(currentMsgLangCode),
                    currentMsgLangCode
                );
                addChat(prevMsg => [...prevMsg, data2]);
            } else {
                // Same language - translate normally using locked language
                console.log(`CDEBUG ===> ✅ Language matches locked language. Translating from ${getLanguageName(lockedLangCode)} to English`);

                const sourceLanguageName = getLanguageName(lockedLangCode);
                let translationResult = await ProcessChatText(content, sourceLanguageName, 'English');
                const translatedMessage = translationResult.translatedText || content;

                console.log(`CDEBUG ===> Translation result:`, translationResult);

                let data2 = createChatData(
                    contactId,
                    'customer',
                    content,
                    translatedMessage,
                    sourceLanguageName,
                    lockedLangCode,
                    translationResult
                );
                addChat(prevMsg => [...prevMsg, data2]);
            }
        } else {
            // Fallback case - shouldn't happen but handle gracefully
            console.log(`CDEBUG ===> Fallback case - no existing language found`);
            let data2 = createChatData(
                contactId,
                'customer',
                content,
                content,
                'Unknown',
                'unknown'
            );
            addChat(prevMsg => [...prevMsg, data2]);
        }
    }

    // *******
    // Subscribing to CCP events. See : https://github.com/aws/amazon-connect-streams/blob/master/Documentation.md
    // *******
    function subscribeConnectEvents() {
        console.log("CDEBUG ===> subscribeConnectEvents");

        // Wait for CCP to be fully initialized before subscribing to events
        if (!window.connect || !window.connect.core) {
            console.log("CDEBUG ===> Connect core not ready, retrying in 2s");
            setTimeout(subscribeConnectEvents, 2000);
            return;
        }

        try {
            window.connect.core.onViewContact(function (event) {
                var contactId = event.contactId;
                console.log("CDEBUG ===> onViewContact", contactId)
                setCurrentContactId(contactId);
            });

            // If this is a chat session
            if (window.connect.ChatSession) {
                console.log("CDEBUG ===> Subscribing to Connect Contact Events for chats");
                window.connect.contact(contact => {

                    // This is invoked when CCP is ringing
                    contact.onConnecting(() => {
                        console.log("CDEBUG ===> onConnecting() >> contactId: ", contact.contactId);
                        let contactAttributes = contact.getAttributes();
                        console.log("CDEBUG ===> contactAttributes: ", JSON.stringify(contactAttributes));
                        let contactQueue = contact.getQueue();
                        console.log("CDEBUG ===> contactQueue: ", contactQueue);
                    });

                    // This is invoked when the chat is accepted
                    contact.onAccepted(async () => {
                        console.log("CDEBUG ===> onAccepted: ", contact);
                        const cnn = contact.getConnections().find(cnn => cnn.getType() === window.connect.ConnectionType.AGENT);
                        const agentChatSession = await cnn.getMediaController();
                        setCurrentContactId(contact.contactId)
                        console.log("CDEBUG ===> agentChatSession ", agentChatSession)
                        // Save the session to props, this is required to send messages within the chatroom.js
                        setAgentChatSessionState(agentChatSessionState => [...agentChatSessionState, { [contact.contactId]: agentChatSession }])

                        // Get the language from the attributes, if the value is valid then add to the store
                        const contactAttributes = contact.getAttributes();
                        console.log("CDEBUG ===> Contact attributes:", contactAttributes);

                        if (contactAttributes && contactAttributes.x_lang && contactAttributes.x_lang.value) {
                            localLanguageTranslate = contactAttributes.x_lang.value;
                            console.log("CDEBUG ===> Found x_lang attribute:", localLanguageTranslate);

                            if (Object.keys(languageOptions).find(key => languageOptions[key] === localLanguageTranslate) !== undefined) {
                                console.log("CDEBUG ===> Setting lang code from attributes:", localLanguageTranslate)
                                languageTranslate.push({ contactId: contact.contactId, lang: localLanguageTranslate })
                                setLanguageTranslate(languageTranslate);
                                setRefreshChild('updated') // Workaround to force a refresh of the chatroom UI to show the updated language based on contact attribute.
                            } else {
                                console.log("CDEBUG ===> x_lang value not found in languageOptions:", localLanguageTranslate);
                            }
                        } else {
                            console.log("CDEBUG ===> x_lang attribute not found in contact attributes");
                        }
                        console.log("CDEBUG ===> onAccepted, languageTranslate ", languageTranslate)

                    });

                    // This is invoked when the customer and agent are connected
                    contact.onConnected(async () => {
                        console.log("CDEBUG ===> onConnected() >> contactId: ", contact.contactId);
                        const cnn = contact.getConnections().find(cnn => cnn.getType() === window.connect.ConnectionType.AGENT);
                        const agentChatSession = await cnn.getMediaController();
                        getEvents(contact, agentChatSession);
                    });

                    // This is invoked when new agent data is available
                    contact.onRefresh(() => {
                        console.log("CDEBUG ===> onRefresh() >> contactId: ", contact.contactId);
                    });

                    // This is invoked when the agent moves to ACW
                    contact.onEnded(() => {
                        console.log("CDEBUG ===> onEnded() >> contactId: ", contact.contactId);
                        setLang('');
                    });

                    // This is invoked when the agent moves out of ACW to a different state
                    contact.onDestroy(() => {
                        console.log("CDEBUG ===> onDestroy() >> contactId: ", contact.contactId);
                        // Clear the language pair for this contact
                        clearLanguagePair(contact.contactId);
                        setCurrentContactId('');
                        clearChat();
                    });
                });

                /* 
                **** Subscribe to the agent API **** 
                See : https://github.com/aws/amazon-connect-streams/blob/master/Documentation.md
                */

                console.log("CDEBUG ===> Subscribing to Connect Agent Events");
                window.connect.agent((agent) => {
                    agent.onStateChange((agentStateChange) => {
                        // On agent state change, update the React state.
                        let state = agentStateChange.newState;
                        console.log("CDEBUG ===> New State: ", state);

                    });

                });
            }
            else {
                console.log("CDEBUG ===> ChatSession not available, waiting 3s");
                setTimeout(function () { subscribeConnectEvents(); }, 3000);
            }
        } catch (error) {
            console.error("CDEBUG ===> Error subscribing to Connect events:", error);
            setTimeout(subscribeConnectEvents, 3000);
        }
    };


    // ***** 
    // Loading CCP
    // *****
    useEffect(() => {
        // Check if CCP is already initialized to prevent duplicate initialization
        const ccpContainer = document.getElementById("ccp-container");
        if (ccpContainer && ccpContainer.children.length > 0) {
            console.log("CDEBUG ===> CCP already initialized, skipping initApp");
            return;
        }

        // Check if window.connect is available
        if (!window.connect || !window.connect.agentApp) {
            console.log("CDEBUG ===> Connect streams not loaded yet, retrying in 1s");
            setTimeout(() => {
                // Trigger a re-render by updating a dummy state
                setLang(prev => prev);
            }, 1000);
            return;
        }

        const connectUrl = process.env.REACT_APP_CONNECT_INSTANCE_URL;
        const connectRegion = process.env.REACT_APP_CONNECT_REGION;

        console.log("CDEBUG ===> All REACT_APP_ environment variables:",
            Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
        console.log("CDEBUG ===> Initializing CCP with URL:", connectUrl);
        console.log("CDEBUG ===> Connect Region:", connectRegion);

        if (!connectUrl) {
            console.error("CDEBUG ===> REACT_APP_CONNECT_INSTANCE_URL is not set!");
            console.error("CDEBUG ===> Please restart the React app to load environment variables");
            return;
        }

        try {
            window.connect.agentApp.initApp(
                "ccp",
                "ccp-container",
                connectUrl + "/connect/ccp-v2/", {
                ccpParams: {
                    region: connectRegion,
                    pageOptions: {                  // optional
                        enableAudioDeviceSettings: true, // optional, defaults to 'false'
                        enablePhoneTypeSettings: true // optional, defaults to 'true'
                    }
                }
            }
            );
            console.log("CDEBUG ===> CCP initialization started");

            // Listen for CCP initialization completion
            window.connect.core.onInitialized(() => {
                console.log("CDEBUG ===> CCP fully initialized, starting event subscription");
                subscribeConnectEvents();
            });

            // Fallback timeout in case onInitialized doesn't fire
            setTimeout(() => {
                console.log("CDEBUG ===> Fallback: Starting event subscription after timeout");
                subscribeConnectEvents();
            }, 5000);

        } catch (error) {
            console.error("CDEBUG ===> Error initializing CCP:", error);
        }
    }, []);

    // Cleanup function to prevent memory leaks
    useEffect(() => {
        return () => {
            // Cleanup function when component unmounts
            console.log("CDEBUG ===> CCP component unmounting");
        };
    }, []);


    return (
        <main>
            <Grid columns='equal' stackable padded>
                <Grid.Row>
                    {/* CCP window will load here */}
                    <div id="ccp-container"></div>
                    {/* Translate window will laod here. We pass the agent state to be able to use this to push messages to CCP */}
                    <div id="chatroom" ><Chatroom session={agentChatSessionState} /> </div>
                </Grid.Row>
            </Grid>
        </main>
    );
};

export default Ccp;
