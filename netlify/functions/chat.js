// netlify/functions/chat.js
const axios = require('axios');

exports.handler = async function(event, context) {
    console.log('=== Chat函数开始执行 ===');
    
    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    // Handle OPTIONS request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: ''
        };
    }
    
    // Only accept POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: headers,
            body: JSON.stringify({
                error: 'Method not allowed',
                message: '只支持POST请求'
            })
        };
    }
    
    try {
        console.log('解析请求数据...');
        let requestData;
        try {
            requestData = JSON.parse(event.body || '{}');
        } catch (e) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({
                    error: 'Invalid JSON',
                    message: '请求数据格式错误'
                })
            };
        }
        
        const { message, language = 'zh' } = requestData;
        console.log('用户消息:', message?.substring(0, 100));
        console.log('请求的语言:', language);
        
        if (!message || message.trim() === '') {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({
                    error: 'Empty message',
                    message: '消息不能为空'
                })
            };
        }
        
        // Check API key
        const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        console.log('API密钥检查:', DEEPSEEK_API_KEY ? '已设置' : '未设置');
        
        if (!DEEPSEEK_API_KEY) {
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({
                    error: 'API key missing',
                    message: '服务器配置错误：请设置DEEPSEEK_API_KEY环境变量',
                    instructions: '在Netlify控制台的Environment Variables中添加DEEPSEEK_API_KEY'
                })
            };
        }
        
        // Determine language for response
        const responseLanguage = language === 'en' ? 'en' : 'zh';
        console.log('响应语言:', responseLanguage);
        
        // Prepare system prompt based on language
        const systemPrompt = responseLanguage === 'en' 
            ? "You are AnesLink Anesthesia Assistant. You MUST answer in English. Provide professional anesthesia knowledge including drug dosages, techniques, complications, and patient management. Be concise and accurate."
            : "你是AnesLink麻醉学助手。你必须用中文回答。提供专业的麻醉学知识，包括药物剂量、技术操作、并发症处理和患者管理。回答要简洁准确。";
        
        // Build messages
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            },
            {
                role: 'user',
                content: message
            }
        ];
        
        console.log('调用DeepSeek API...');
        console.log('请求消息数量:', messages.length);
        
        try {
            const response = await axios.post(
                'https://api.deepseek.com/chat/completions',
                {
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    stream: false
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                    },
                    timeout: 30000
                }
            );
            
            console.log('API响应状态:', response.status);
            
            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                console.error('API返回数据格式错误:', response.data);
                throw new Error('API返回格式异常');
            }
            
            const aiResponse = response.data.choices[0].message.content;
            console.log('AI回复长度:', aiResponse.length);
            console.log('AI回复预览:', aiResponse.substring(0, 100));
            
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    success: true,
                    response: aiResponse,
                    language: responseLanguage,
                    model: response.data.model
                })
            };
            
        } catch (apiError) {
            console.error('DeepSeek API调用失败:', apiError.message);
            
            if (apiError.response) {
                console.error('API错误状态:', apiError.response.status);
                console.error('API错误数据:', apiError.response.data);
            }
            
            // 提供简单的备用回复
            const fallbackResponse = responseLanguage === 'en'
                ? "I apologize, but I'm currently unable to connect to the AI service. This could be due to:\n\n1. Network connection issues\n2. API service temporary unavailability\n3. Configuration problems\n\nPlease try again in a few moments, or contact the system administrator."
                : "抱歉，我目前无法连接到AI服务。可能的原因：\n\n1. 网络连接问题\n2. API服务暂时不可用\n3. 配置问题\n\n请稍后重试，或联系系统管理员。";
            
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    success: false,
                    response: fallbackResponse,
                    error: apiError.message,
                    language: responseLanguage
                })
            };
        }
        
    } catch (error) {
        console.error('函数执行错误:', error);
        
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: '服务器内部错误',
                details: error.message
            })
        };
    }
};