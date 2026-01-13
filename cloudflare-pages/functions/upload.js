/**
 * Cloudflare Pages Functions - 多后端图床
 * 支持 Cloudinary 和 ImgBB
 */

// CORS 响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// JSON 响应
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}

// ============ Cloudinary 上传 ============
async function generateSignature(params, apiSecret) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const stringToSign = paramString + apiSecret;

    const encoder = new TextEncoder();
    const data = encoder.encode(stringToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToCloudinary(imageData, env) {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: 'imagebed', timestamp };
    const signature = await generateSignature(params, env.CLOUDINARY_API_SECRET);

    const formData = new FormData();
    formData.append('file', imageData);
    formData.append('api_key', env.CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', 'imagebed');
    formData.append('signature', signature);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
    );

    const result = await response.json();
    if (result.error) throw new Error(result.error.message);

    return {
        id: result.public_id,
        link: result.secure_url,
        width: result.width,
        height: result.height,
    };
}

// ============ ImgBB 上传 ============
async function uploadToImgBB(imageData, apiKey) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64Data);

    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message || 'ImgBB upload failed');

    return {
        id: result.data.id,
        link: result.data.url,
        width: result.data.width,
        height: result.data.height,
    };
}

// ============ Pages Function Handler ============
export async function onRequest(context) {
    const { request, env } = context;

    // CORS 预检
    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
    }

    try {
        const body = await request.json();
        const imageData = body.image;
        const backend = body.backend || 'cloudinary';

        if (!imageData) {
            return jsonResponse({ success: false, error: 'No image provided' }, 400);
        }

        let result;
        if (backend === 'imgbb') {
            if (!env.IMGBB_API_KEY) {
                return jsonResponse({ success: false, error: 'ImgBB API key not configured' }, 500);
            }
            result = await uploadToImgBB(imageData, env.IMGBB_API_KEY);
        } else {
            if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
                return jsonResponse({ success: false, error: 'Cloudinary credentials not configured' }, 500);
            }
            result = await uploadToCloudinary(imageData, env);
        }

        return jsonResponse({ success: true, data: result });
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}
