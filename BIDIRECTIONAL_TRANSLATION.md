# Bidirectional Translation Flow

This document explains how the bidirectional translation works in the Amazon Connect chat application.

## 🔄 **Translation Flow**

### **Customer → Agent (Incoming Messages)**
1. **Message Received**: Customer sends message in their native language
2. **Language Detection**: Bedrock detects the language automatically
3. **Language Storage**: Language code stored in global state for the contact
4. **Translation**: Message translated to English for the agent
5. **Display**: Both original and translated messages shown to agent

### **Agent → Customer (Outgoing Messages)**
1. **Message Input**: Agent types message in English
2. **Language Lookup**: System finds stored customer language from global state
3. **Language Mapping**: Language code converted to language name for Bedrock
4. **Translation**: Message translated to customer's language using Bedrock
5. **Message Sending**: Translated message sent to customer via Connect

## 🛠 **Key Components**

### **CCP Component (src/components/ccp.js)**
- **processChatText()**: Handles incoming customer messages
- **Language Detection**: Uses Bedrock for automatic language detection
- **Language Storage**: Stores detected language in global state
- **Customer Translation**: Translates customer messages to English

### **Chatroom Component (src/components/chatroom.js)**
- **handleSubmit()**: Handles agent message submission
- **Language Lookup**: Finds customer language from global state
- **Agent Translation**: Translates agent messages to customer language
- **Message Sending**: Sends translated message via Connect session

### **Translation Components**
- **translateAPI.js**: Main translation function using Bedrock
- **translate.js**: Alternative translation function
- **detectText.js**: Language detection using Bedrock

## 🔍 **Debug Information**

### **Customer Message Flow**
```
Customer sends: "Hola, necesito ayuda"
↓
Language Detection: Spanish (es)
↓
Translation: "Hello, I need help"
↓
Agent sees both: Original + Translation
```

### **Agent Message Flow**
```
Agent types: "How can I help you?"
↓
Language Lookup: Spanish (from stored state)
↓
Translation: "¿Cómo puedo ayudarte?"
↓
Customer receives: "¿Cómo puedo ayudarte?"
```

## 🚀 **Features**

### **Automatic Language Detection**
- Uses Bedrock Claude for accurate detection
- Stores language per contact session
- Fallback to English if detection fails

### **Bidirectional Translation**
- Customer messages → English (for agent)
- Agent messages → Customer's language
- Maintains conversation context

### **Error Handling**
- Graceful fallback if translation fails
- Debug logging for troubleshooting
- Original message sent if translation unavailable

### **Language Support**
- Supports 20+ languages
- Extensible language mapping
- Handles both language codes and names

## 🔧 **Configuration**

### **Global State Management**
- `languageTranslate`: Stores contact-to-language mapping
- `currentContactId`: Tracks active contact
- `Chats`: Stores conversation history

### **Translation API**
- **Endpoint**: Bedrock-powered Lambda function
- **Authentication**: Cognito User Pool tokens
- **Format**: JSON request/response

## 📱 **User Experience**

### **For Agents**
- See customer messages in English
- Type responses in English
- Automatic translation to customer language
- Language indicator in chat header

### **For Customers**
- Communicate in native language
- Receive responses in native language
- Seamless translation experience
- No language barriers

## 🛠 **Troubleshooting**

### **Common Issues**
1. **No Translation**: Check if language is detected and stored
2. **Wrong Language**: Verify language mapping function
3. **API Errors**: Check Cognito authentication and Bedrock permissions
4. **Session Issues**: Ensure Connect session is active

### **Debug Logs**
- Check browser console for translation logs
- Monitor CloudWatch for Lambda execution
- Verify language detection results
- Check global state updates

## 🎯 **Future Enhancements**

### **Potential Improvements**
- **Language Selection**: Allow manual language override
- **Translation History**: Store translation pairs for consistency
- **Quality Metrics**: Track translation accuracy
- **Custom Terminology**: Support domain-specific translations
- **Multi-turn Context**: Maintain context across conversation