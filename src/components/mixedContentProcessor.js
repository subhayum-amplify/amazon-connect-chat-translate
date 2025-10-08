import { callTranslationAPI } from './translate';

/**
 * Processes mixed content messages by splitting them into natural language and technical sections,
 * translating only the natural language parts, and reassembling the message.
 */
class MixedContentProcessor {
    
    /**
     * Technical patterns to identify and preserve
     */
    static technicalPatterns = [
        // SQL queries - match complete SQL blocks
        {
            name: 'SQL',
            pattern: /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)[\s\S]*?(?=\n\s*[A-Z][a-z]{2,}|$)/gi,
            multiline: true
        },
        // Code blocks (function definitions, etc.)
        {
            name: 'CODE_BLOCK',
            pattern: /(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\}|class\s+\w+[\s\S]*?\{[\s\S]*?\}|if\s*\([^)]*\)\s*\{[\s\S]*?\})/gi,
            multiline: true
        },
        // Error messages and stack traces
        {
            name: 'ERROR',
            pattern: /(Error:|Exception:|TypeError:|ReferenceError:|SyntaxError:|at\s+.*\(.*:\d+:\d+\)|Traceback[\s\S]*?(?=\n[A-Z][a-z]|\n\s*$|$))/gi,
            multiline: true
        },
        // URLs and file paths
        {
            name: 'URL_PATH',
            pattern: /(https?:\/\/[^\s]+|\/[a-zA-Z0-9_\-\/\.]+|[A-Z]:\\[a-zA-Z0-9_\-\\\.]+|\.\/[a-zA-Z0-9_\-\/\.]+)/gi,
            multiline: false
        },
        // JSON/XML/HTML blocks
        {
            name: 'STRUCTURED_DATA',
            pattern: /(\{[\s\S]*?\}|\[[\s\S]*?\]|<[^>]*>[\s\S]*?<\/[^>]*>)/gi,
            multiline: true
        },
        // Configuration key-value pairs
        {
            name: 'CONFIG',
            pattern: /([a-zA-Z_][a-zA-Z0-9_]*\s*[:=]\s*[^\n\r]*)/gi,
            multiline: false
        },
        // Log entries
        {
            name: 'LOG',
            pattern: /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}[\s\S]*?(?=\n[A-Z][a-z]|\n\s*$|$)|\[(INFO|DEBUG|ERROR|WARN)\][\s\S]*?(?=\n[A-Z][a-z]|\n\s*$|$))/gi,
            multiline: true
        },
        // Command line commands
        {
            name: 'COMMAND',
            pattern: /(npm\s+install[^\n]*|git\s+commit[^\n]*|docker\s+run[^\n]*|yarn\s+add[^\n]*|pip\s+install[^\n]*)/gi,
            multiline: false
        }
    ];

    /**
     * Splits mixed content into segments using a smarter approach
     * @param {string} text - The input text to split
     * @returns {Array} Array of segments with type and content
     */
    static splitMixedContent(text) {
        console.log('Splitting mixed content:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
        
        const segments = [];
        
        // Look for SQL blocks by finding SELECT/INSERT/etc and then finding where they end
        const sqlStartPattern = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|WITH)\b/gi;
        const sqlStarts = [];
        
        let match;
        while ((match = sqlStartPattern.exec(text)) !== null) {
            sqlStarts.push({
                start: match.index,
                keyword: match[0]
            });
        }
        
        console.log('Found SQL starts:', sqlStarts);
        
        if (sqlStarts.length > 0) {
            // For each SQL start, find where the SQL block ends
            const sqlBlocks = [];
            
            sqlStarts.forEach((sqlStart, index) => {
                let sqlEnd = text.length; // Default to end of text
                
                // Look for the end of SQL block by finding natural language patterns
                // SQL typically ends when we see a line that starts with a capital letter followed by lowercase
                // and doesn't contain SQL keywords
                const remainingText = text.substring(sqlStart.start);
                const lines = remainingText.split('\n');
                
                let endFound = false;
                let currentPos = sqlStart.start;
                
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    currentPos += lines[i-1].length + 1; // +1 for newline
                    
                    // Check if this line looks like natural language (not SQL)
                    if (line.length > 0) {
                        const isNaturalLanguage = /^[A-Z][a-z]{2,}/.test(line) && 
                                                 !/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|GROUP|HAVING|ORDER|AND|OR|AS|ON|IN|LIKE|BETWEEN)\b/i.test(line) &&
                                                 !/^\s*[(){}[\];,]/.test(line);
                        
                        if (isNaturalLanguage) {
                            sqlEnd = currentPos;
                            endFound = true;
                            break;
                        }
                    }
                }
                
                // If we're looking at the last SQL start and didn't find a natural end,
                // look for the next SQL start as the boundary
                if (!endFound && index < sqlStarts.length - 1) {
                    sqlEnd = sqlStarts[index + 1].start;
                }
                
                sqlBlocks.push({
                    start: sqlStart.start,
                    end: sqlEnd,
                    content: text.substring(sqlStart.start, sqlEnd).trim()
                });
            });
            
            // Merge overlapping or adjacent SQL blocks
            const mergedSqlBlocks = [];
            sqlBlocks.forEach(block => {
                const lastBlock = mergedSqlBlocks[mergedSqlBlocks.length - 1];
                if (lastBlock && block.start <= lastBlock.end + 50) { // 50 char tolerance for adjacent blocks
                    // Merge with previous block
                    lastBlock.end = Math.max(lastBlock.end, block.end);
                    lastBlock.content = text.substring(lastBlock.start, lastBlock.end).trim();
                } else {
                    mergedSqlBlocks.push(block);
                }
            });
            
            // Build segments using the merged SQL blocks
            let lastEnd = 0;
            
            mergedSqlBlocks.forEach(sqlBlock => {
                // Add natural language segment before SQL
                if (sqlBlock.start > lastEnd) {
                    const naturalContent = text.substring(lastEnd, sqlBlock.start).trim();
                    if (naturalContent) {
                        segments.push({
                            type: 'natural',
                            content: naturalContent,
                            originalIndex: segments.length
                        });
                    }
                }
                
                // Add SQL segment
                segments.push({
                    type: 'technical',
                    content: sqlBlock.content,
                    technicalType: 'SQL',
                    originalIndex: segments.length
                });
                
                lastEnd = sqlBlock.end;
            });
            
            // Add remaining natural language content
            if (lastEnd < text.length) {
                const naturalContent = text.substring(lastEnd).trim();
                if (naturalContent) {
                    segments.push({
                        type: 'natural',
                        content: naturalContent,
                        originalIndex: segments.length
                    });
                }
            }
        } else {
            // No SQL found, check for other technical patterns
            const technicalMatches = [];
            
            this.technicalPatterns.forEach(patternObj => {
                if (patternObj.name !== 'SQL') {
                    let match;
                    const regex = new RegExp(patternObj.pattern.source, patternObj.pattern.flags);
                    
                    while ((match = regex.exec(text)) !== null) {
                        technicalMatches.push({
                            start: match.index,
                            end: match.index + match[0].length,
                            content: match[0],
                            type: patternObj.name
                        });
                    }
                }
            });

            if (technicalMatches.length > 0) {
                // Sort and process other technical content
                technicalMatches.sort((a, b) => a.start - b.start);
                
                let lastEnd = 0;
                technicalMatches.forEach(match => {
                    if (match.start > lastEnd) {
                        const naturalContent = text.substring(lastEnd, match.start).trim();
                        if (naturalContent) {
                            segments.push({
                                type: 'natural',
                                content: naturalContent,
                                originalIndex: segments.length
                            });
                        }
                    }
                    
                    segments.push({
                        type: 'technical',
                        content: match.content,
                        technicalType: match.type,
                        originalIndex: segments.length
                    });
                    
                    lastEnd = match.end;
                });

                if (lastEnd < text.length) {
                    const naturalContent = text.substring(lastEnd).trim();
                    if (naturalContent) {
                        segments.push({
                            type: 'natural',
                            content: naturalContent,
                            originalIndex: segments.length
                        });
                    }
                }
            } else {
                // No technical content found
                segments.push({
                    type: 'natural',
                    content: text.trim(),
                    originalIndex: 0
                });
            }
        }

        console.log('Mixed content split into segments:', segments.map(s => ({
            type: s.type,
            length: s.content.length,
            preview: s.content.substring(0, 50) + (s.content.length > 50 ? '...' : '')
        })));
        
        return segments;
    }

    /**
     * Processes mixed content by translating natural language parts
     * @param {string} text - The input text
     * @param {string} sourceLang - Source language (or 'auto')
     * @param {string} targetLang - Target language
     * @returns {Object} Translation result with mixed content handling
     */
    static async processMixedContent(text, sourceLang = 'auto', targetLang = 'English') {
        try {
            console.log('Processing mixed content:', { 
                textLength: text.length, 
                textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                sourceLang, 
                targetLang 
            });
            
            // Split the content into segments
            const segments = this.splitMixedContent(text);
            
            // Check if we have mixed content
            const hasTechnicalContent = segments.some(segment => segment.type === 'technical');
            const hasNaturalContent = segments.some(segment => segment.type === 'natural');
            
            if (!hasNaturalContent) {
                // Pure technical content
                console.log('Pure technical content detected');
                return {
                    translatedText: text,
                    detectedLanguage: 'Technical Content',
                    detectedLanguageCode: 'tech',
                    originalText: text,
                    hasMixedContent: false,
                    segments: segments
                };
            }

            // Process natural language segments
            const processedSegments = [];
            let detectedLanguage = 'English';
            let detectedLanguageCode = 'en';
            
            for (const segment of segments) {
                if (segment.type === 'natural') {
                    try {
                        console.log(`Translating natural segment: "${segment.content.substring(0, 50)}..."`);
                        // Translate the natural language segment using the API
                        const translationResult = await callTranslationAPI(segment.content, targetLang);
                        console.log(`Translation completed for segment`);
                        
                        processedSegments.push({
                            ...segment,
                            translatedContent: translationResult.translatedText,
                            detectedLanguage: translationResult.detectedLanguage,
                            detectedLanguageCode: translationResult.detectedLanguageCode
                        });
                        
                        // Use the first natural segment's detected language for the overall result
                        if (segment.originalIndex === 0 || detectedLanguageCode === 'en') {
                            detectedLanguage = translationResult.detectedLanguage;
                            detectedLanguageCode = translationResult.detectedLanguageCode;
                        }
                        
                    } catch (error) {
                        console.error('Error translating natural segment:', error);
                        console.error('Segment content:', segment.content);
                        console.error('Error details:', error.message);
                        
                        // Fallback: keep original content
                        processedSegments.push({
                            ...segment,
                            translatedContent: segment.content,
                            detectedLanguage: 'English',
                            detectedLanguageCode: 'en'
                        });
                    }
                } else {
                    // Technical content - preserve as-is
                    console.log(`Preserving technical segment: "${segment.content.substring(0, 50)}..."`);
                    processedSegments.push({
                        ...segment,
                        translatedContent: segment.content
                    });
                }
            }

            // Reassemble the translated text
            const translatedText = processedSegments
                .map(segment => segment.translatedContent)
                .join('');

            console.log('Mixed content processing completed:', {
                originalSegments: segments.length,
                processedSegments: processedSegments.length,
                detectedLanguage,
                hasMixedContent: hasTechnicalContent
            });

            return {
                translatedText: translatedText,
                detectedLanguage: detectedLanguage,
                detectedLanguageCode: detectedLanguageCode,
                originalText: text,
                hasMixedContent: hasTechnicalContent,
                segments: processedSegments
            };
            
        } catch (error) {
            console.error('Critical error in processMixedContent:', error);
            console.error('Error details:', error.message, error.stack);
            
            // Ultimate fallback - return original text
            return {
                translatedText: text,
                detectedLanguage: 'Error',
                detectedLanguageCode: 'error',
                originalText: text,
                hasMixedContent: false,
                segments: []
            };
        }
    }
}

export default MixedContentProcessor;