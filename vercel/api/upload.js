/**
 * 多后端图床 - Vercel Edge Runtime 版本
 * 支持 Cloudinary 和 ImgBB
 */

export const config = {
    runtime: 'edge',
};

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

async function uploadToCloudinary(imageData) {
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { folder: 'imagebed', timestamp };
    const signature = await generateSignature(params, process.env.CLOUDINARY_API_SECRET);

    const formData = new FormData();
    formData.append('file', imageData);
    formData.append('api_key', process.env.CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', 'imagebed');
    formData.append('signature', signature);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
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
async function uploadToImgBB(imageData) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    const formData = new FormData();
    formData.append('key', process.env.IMGBB_API_KEY);
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

// JSON 响应
function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
    });
}

export default async function handler(request) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
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
            if (!process.env.IMGBB_API_KEY) {
                return jsonResponse({ success: false, error: 'ImgBB API key not configured' }, 500);
            }
            result = await uploadToImgBB(imageData);
        } else {
            if (!process.env.CLOUDINARY_CLOUD_NAME) {
                return jsonResponse({ success: false, error: 'Cloudinary not configured' }, 500);
            }
            result = await uploadToCloudinary(imageData);
        }

        return jsonResponse({ success: true, data: result });
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}
