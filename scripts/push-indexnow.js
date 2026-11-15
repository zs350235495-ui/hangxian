/**
 * IndexNow 自动推送脚本 (Node.js 原生无外部依赖)
 * 用于在构建/发布后自动解析 sitemap.xml 并推送全部 URL 到 IndexNow 搜索引擎网络
 * 支持多网关自动容灾切换 (api.indexnow.org / yandex.com / bing.com / seznam.cz)
 */

const fs = require('fs');
const path = require('path');

const HOST = 'hangxianyinhang.com';
const ENDPOINTS = [
    { name: 'IndexNow 官方通用网关', url: 'https://api.indexnow.org/indexnow' },
    { name: 'Yandex 网关', url: 'https://yandex.com/indexnow' },
    { name: 'Bing 官方直连网关', url: 'https://www.bing.com/indexnow' },
    { name: 'Seznam 网关', url: 'https://search.seznam.cz/indexnow' }
];

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

// 3. 执行单网关推送
async function tryPushToEndpoint(endpoint, payload) {
    try {
        console.log(`[IndexNow] 正在向 [${endpoint.name}] (${endpoint.url}) 发送请求...`);
        const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        const status = response.status;
        const text = await response.text();

        if (status === 200 || status === 202) {
            console.log(`[IndexNow] ✅ [${endpoint.name}] 推送成功！HTTP 状态码: ${status} ${status === 200 ? '(OK)' : '(Accepted)'}`);
            return { success: true, status, text };
        } else {
            console.warn(`[IndexNow] ⚠️ [${endpoint.name}] 响应非成功状态码: ${status}，返回内容: ${text || '无'}`);
            return { success: false, status, text };
        }
    } catch (err) {
        console.warn(`[IndexNow] ⚠️ [${endpoint.name}] 网络请求异常: ${err.message}`);
        return { success: false, error: err.message };
    }
}

// 4. 执行批量推送与全网同步
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

        let hasSuccess = false;
        const results = [];

        // 遍历各 IndexNow 节点；各搜索引擎之间会自动广播同步提交
        for (const ep of ENDPOINTS) {
            const res = await tryPushToEndpoint(ep, payload);
            results.push({ name: ep.name, ...res });
            if (res.success) {
                hasSuccess = true;
                // 一旦成功推送到联盟任一节点，该节点会自动向 Bing/Yandex/Seznam 广播同步
            }
        }

        if (hasSuccess) {
            console.log(`\n[IndexNow] 🎉 核心节点已成功接收！IndexNow 联盟将自动全网广播同步至各搜索引擎。`);
            console.log(`[IndexNow] 已成功提交的 URL 列表 (${urlList.length} 个):`);
            urlList.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));
            process.exit(0);
        } else {
            console.error(`\n[IndexNow] ❌ 全部网关推送均失败，请排查域名解析或密钥文件是否已被线上 WAF 拦截！`);
            process.exit(1);
        }
    } catch (err) {
        console.error(`[IndexNow] 发生严重错误:`, err.message);
        process.exit(1);
    }
}

pushToIndexNow();

