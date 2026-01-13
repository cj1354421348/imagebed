# 图床中转

支持多后端的图床服务，可部署到 **Cloudflare Pages** 和 **Vercel**。

## ✨ 功能

- 📤 拖拽 / 点击 / 粘贴上传
- 🔗 一键复制直链、Markdown、HTML
- ☁️ 支持 Cloudinary 和 ImgBB 双后端
- 🎨 精美深色界面

## 🚀 一键部署

### Cloudflare Pages

1. **Fork 本仓库**

2. **[Cloudflare Dashboard](https://dash.cloudflare.com/)** → Workers & Pages → Create → Pages → Connect to Git

3. **构建设置**：
   - Root directory: `cloudflare-pages`
   - Build command: `npm run build`
   - Build output directory: `public`

4. **Settings → Environment Variables** 添加：
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
   - `IMGBB_API_KEY`

---

### Vercel

1. **Fork 本仓库**

2. **[Vercel](https://vercel.com/)** 导入项目，Root Directory 选择 `vercel`

3. **Build Command**: `npm run build`

4. **Environment Variables** 添加同上

## 🔑 获取 API 密钥

| 服务 | 获取地址 |
|------|---------|
| Cloudinary | https://cloudinary.com/ |
| ImgBB | https://api.imgbb.com/ |

## 📁 项目结构

```
├── public/                # 共享前端文件（单一来源）
│   ├── index.html
│   └── favicon.svg
├── cloudflare-pages/      # CF Pages 部署
│   ├── functions/upload.js
│   ├── public/            # 构建时从根 public/ 复制
│   └── package.json
└── vercel/                # Vercel 部署
    ├── api/upload.js
    ├── public/            # 构建时从根 public/ 复制
    ├── package.json
    └── vercel.json
```

> **修改前端只需要编辑 `public/index.html`，构建时会自动同步到各平台。**

## 📝 License

MIT
