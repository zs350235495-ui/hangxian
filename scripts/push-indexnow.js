/**
 * IndexNow 自动推送脚本 (Node.js 原生无外部依赖)
 * 用于在构建/发布后自动解析 sitemap.xml 并推送全部 URL 到 IndexNow 搜索引擎网络
 */

const fs = require('fs');
const path = require('path');

const HOST = 'hangxianyinhang.com';
const API_URL = 'https://api.indexnow.org/indexnow';
const ROOT_DIR = path.resolve(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');

// 1. 查找验证密钥文件 (*.txt，32位十六进制)
function findKey() {
    const files = fs.readdirSync(ROOT_DIR);
    const keyFile = files.find(f => /^[0-9a-f]{32}\.txt$/i.test(f));
    if (!keyFile) {
        throw new Error('未在项目根目录找到 32 位十六进制的 IndexNow 密钥文件！');
    }
    const key = keyFile.replace(/\.txt$/i, '');
    return { key, keyLocation: `https://${HOST}/${keyFile}` };
}

// 2. 解析 sitemap.xml 提取所有页面 URL
function getUrlsFromSitemap() {
    if (!fs.existsSync(SITEMAP_PATH)) {
        throw new Error(`找不到站点地图文件: ${SITEMAP_PATH}`);
    }
    const content = fs.readFileSync(SITEMAP_PATH, 'utf-8');
    const matches = content.match(/<loc>(.*?)<\/loc>/g);
    if (!matches || matches.length === 0) {
        throw new Error('未在 sitemap.xml 中找到任何 <loc> URL');
    }
    return matches.map(tag => tag.replace(/<\/?loc>/g, '').trim());
}

// 3. 执行推送
async function pushToIndexNow() {
    try {
        console.log(`[IndexNow] 正在初始化推送... 目标站点: ${HOST}`);
        const { key, keyLocation } = findKey();
        console.log(`[IndexNow] 密钥: ${key}`);
        console.log(`[IndexNow] 密钥文件地址: ${keyLocation}`);

        const urlList = getUrlsFromSitemap();
        console.log(`[IndexNow] 从 sitemap.xml 成功提取到 ${urlList.length} 个 URL`);

        const payload = {
            host: HOST,
            key: key,
            keyLocation: keyLocation,
            urlList: urlList
        };

        console.log(`[IndexNow] 正在向 ${API_URL} 发送批量提交请求...`);
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const text = await response.text();

        if (status === 200) {
            console.log(`[IndexNow] ✅ 推送成功！HTTP 状态码: 200 (OK - 链接提交成功)`);
        } else if (status === 202) {
            console.log(`[IndexNow] ✅ 推送成功！HTTP 状态码: 202 (Accepted - 链接已被接收并在队列中验证处理)`);
        } else {
            console.error(`[IndexNow] ❌ 推送异常，HTTP 状态码: ${status}`);
            if (text) console.error(`[IndexNow] 响应内容: ${text}`);
            process.exit(1);
        }

        console.log(`[IndexNow] 已成功提交的 URL 列表:`);
        urlList.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
    } catch (err) {
        console.error(`[IndexNow] 发生错误:`, err.message);
        process.exit(1);
    }
}

pushToIndexNow();

