// netlify/functions/chat.js
const axios = require('axios');

exports.handler = async function(event, context) {
    console.log('=== Chat函数被调用 ===');
    
    // CORS 处理
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // 处理预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: ''
        };
    }
    
    // 只处理POST请求
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
        console.log('解析请求体...');
        let requestData;
        try {
            requestData = JSON.parse(event.body || '{}');
        } catch (e) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ 
                    error: 'Invalid JSON',
                    message: '无效的JSON格式'
                })
            };
        }
        
        const { message } = requestData;
        console.log('收到的消息:', message);
        
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
        
        // 检查API密钥
        const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        console.log('API密钥存在:', !!DEEPSEEK_API_KEY);
        
        if (!DEEPSEEK_API_KEY) {
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ 
                    error: 'API key missing',
                    message: '服务器配置错误：DEEPSEEK_API_KEY未设置',
                    instructions: '请在Netlify环境变量中添加您的DeepSeek API密钥'
                })
            };
        }
        
        // 检测语言
        const isEnglish = message.match(/[a-zA-Z]/g)?.length > 5 && !message.match(/[\u4e00-\u9fa5]/g);
        const language = isEnglish ? 'en' : 'zh';
        console.log('检测到的语言:', language);
        
        // 准备系统提示
        const systemPrompt = language === 'en' 
            ? "You are an anesthesiology assistant. Answer all questions in English. Be professional and helpful."
            : "你是麻醉学助手。请用中文回答所有问题。要专业且有帮助。";
        
        // 构建请求
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
        ];
        
        console.log('调用DeepSeek API...');
        
        try {
            const response = await axios.post(
                'https://api.deepseek.com/chat/completions',
                {
                    model: 'deepseek-chat',
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
                    },
                    timeout: 15000
                }
            );
            
            console.log('API响应成功');
            
            const aiResponse = response.data.choices[0]?.message?.content || '抱歉，我无法回答这个问题。';
            
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    response: aiResponse,
                    success: true
                })
            };
            
        } catch (apiError) {
            console.error('API调用错误:', apiError.message);
            
            // 提供备用回复
            const fallbackResponse = language === 'en'
                ? `I'm currently having trouble connecting to the AI service. For anesthesiology questions, please try:\n\n1. What is the induction dose of propofol?\n2. How to manage difficult airway?\n3. How to prevent postoperative nausea and vomiting?\n\nError: ${apiError.message}`
                : `我目前无法连接到AI服务。关于麻醉学问题，请尝试询问：\n\n1. 丙泊酚的诱导剂量是多少？\n2. 如何处理困难气道？\n3. 如何预防术后恶心呕吐？\n\n错误：${apiError.message}`;
            
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    response: fallbackResponse,
                    success: false,
                    error: apiError.message
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
                message: '服务器内部错误: ' + error.message
            })
        };
    }
};