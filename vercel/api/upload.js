/**
 * Vercel Edge Runtime - 图床中转
 * 支持单图和批量上传
 */

export const config = { runtime: 'edge' };

const MAX_BATCH_SIZE = 10; // 后端强制限制

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

    return { id: result.public_id, link: result.secure_url, width: result.width, height: result.height };
}

async function uploadToImgBB(imageData) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    const formData = new FormData();
    formData.append('key', process.env.IMGBB_API_KEY);
    formData.append('image', base64Data);

    const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const result = await response.json();
    if (!result.success) throw new Error(result.error?.message || 'ImgBB upload failed');

    return { id: result.data.id, link: result.data.url, width: result.data.width, height: result.data.height };
}

async function uploadSingle(image, backend) {
    if (backend === 'imgbb') {
        if (!process.env.IMGBB_API_KEY) throw new Error('ImgBB not configured');
        return await uploadToImgBB(image);
    } else {
        if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error('Cloudinary not configured');
        return await uploadToCloudinary(image);
    }
}

export default async function handler(request) {
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
        const backend = body.backend || 'cloudinary';

        // 批量上传
        if (body.images && Array.isArray(body.images)) {
            if (body.images.length > MAX_BATCH_SIZE) {
                return jsonResponse({
                    success: false,
                    error: `批量上传最多 ${MAX_BATCH_SIZE} 张图片`
                }, 400);
            }

            const results = [];
            for (const image of body.images) {
                try {
                    const result = await uploadSingle(image, backend);
                    results.push({ success: true, data: result });
                } catch (error) {
                    results.push({ success: false, error: error.message });
                }
            }
            return jsonResponse({ success: true, batch: true, results });
        }

        // 单图上传
        const { image } = body;
        if (!image) return jsonResponse({ success: false, error: 'No image provided' }, 400);

        const result = await uploadSingle(image, backend);
        return jsonResponse({ success: true, data: result });

    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
    }
}
