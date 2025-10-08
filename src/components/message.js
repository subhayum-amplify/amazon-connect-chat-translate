
// Helper function to detect if text is technical
const isTechnicalContent = (text) => {
    const technicalPatterns = [
        /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b/i,
        /\b(function|const|let|var|class|import|export)\b/i,
        /(Error:|Exception:|TypeError:|ReferenceError:|SyntaxError:)/i,
        /https?:\/\/[^\s]+/i,
        /\{[\s\S]*\}|\[[\s\S]*\]/,
        /^\s*[a-zA-Z_][a-zA-Z0-9_]*\s*[:=]/m
    ];
    return technicalPatterns.some(pattern => pattern.test(text));
};

// Helper function to render mixed content as regular text (no code blocks)
const renderMixedContent = (segments, isTranslated = false) => {
    if (!segments || segments.length === 0) {
        return null;
    }

    console.log('Rendering mixed content:', {
        segmentCount: segments.length,
        isTranslated,
        segments: segments.map(s => ({ type: s.type, hasTranslated: !!s.translatedContent }))
    });

    return segments.map((segment, index) => {
        const content = isTranslated ? (segment.translatedContent || segment.content) : segment.content;

        console.log(`Segment ${index}:`, {
            type: segment.type,
            original: segment.content?.substring(0, 50),
            translated: segment.translatedContent?.substring(0, 50),
            isTranslated,
            finalContent: content?.substring(0, 50)
        });

        if (!content) {
            console.warn(`Empty content for segment ${index}`);
            return null;
        }

        // Render both technical and natural content as plain text
        return (
            <span key={index}>
                {content}
            </span>
        );
    }).filter(Boolean); // Remove null elements
};

// Helper function to render simple content as regular text (no code blocks)
const renderSimpleContent = (content) => {
    if (!content) return null;

    // Always render as simple content, no code block detection
    return <div className="simple-content">{content}</div>;
};

// This function creates the HTML to add the chats to the store, controlling the layout
const Message = ({ chat, user }) => {
    const isRight = user === chat.username;

    // Check if we have mixed content segments
    const hasSegments = chat.segments && chat.segments.length > 0;

    // Check if we have translation (either simple or mixed content)
    const hasTranslation = chat.translatedMessage ||
        (hasSegments && chat.translatedText && chat.translatedText !== chat.originalText) ||
        (hasSegments && chat.segments.some(seg => seg.translatedContent && seg.translatedContent !== seg.content));

    // Debug logging to see what's different between agent and customer messages
    console.log(`Message rendering for ${chat.username} (${isRight ? 'RIGHT/AGENT' : 'LEFT/CUSTOMER'}):`, {
        isRight,
        hasSegments,
        hasTranslation,
        segmentCount: chat.segments?.length || 0,
        hasTranslatedMessage: !!chat.translatedMessage,
        originalText: chat.originalText?.substring(0, 50),
        translatedText: chat.translatedText?.substring(0, 50),
        hasMixedContent: chat.hasMixedContent,
        content: chat.content,
        translatedMessage: chat.translatedMessage
    });

    // Special debugging for agent messages
    if (chat.username === 'AGENT' || chat.username === 'agent') {
        console.log('AGENT MESSAGE DETAILED DEBUG:', {
            fullChat: chat,
            segments: chat.segments,
            hasSegments,
            hasTranslation
        });
    }

    return (
        <li className={`chat ${isRight ? "right" : "left"}`}>
            {/* Temporary debug indicator */}
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '2px' }}>
                {chat.username} | Segments: {hasSegments ? 'YES' : 'NO'} | Translation: {hasTranslation ? 'YES' : 'NO'}
            </div>

            <div className="message-content">
                <div className="original-content">
                    {hasTranslation && <div className="content-label">Original:</div>}
                    {hasSegments ? (
                        <div className="mixed-content">
                            {renderMixedContent(chat.segments, false)}
                        </div>
                    ) : (
                        renderSimpleContent(chat.content)
                    )}
                </div>
            </div>

            {hasTranslation && (
                <div className="translated-section">
                    <div className="translated-label">Translation:</div>
                    <div className="translatedMessage">
                        {hasSegments ? (
                            <div className="mixed-content">
                                {renderMixedContent(chat.segments, true)}
                            </div>
                        ) : (
                            renderSimpleContent(chat.translatedMessage)
                        )}
                    </div>
                </div>
            )}
        </li>
    );
};

export default Message;

