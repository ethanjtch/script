// 默认数据源（留空，用户自己填写）
var DEFAULT_JSON_URL = "";

// 默认图标库（国内稳定地址，用户可修改）
var DEFAULT_LOGO_BASE_URL = "https://live.fanmingming.com/tv/";

var IMAGE_PROXY_URL = "https://images.weserv.nl/";

// 预设的请求头组合（用于智能重试）
var USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
];
var REFERRERS = [
    "https://www.google.com/",
    "https://www.bing.com/",
    "https://live.zbds.top/",
    ""
];

var WidgetMetadata = {
    id: "TV_LIVE_AUTO",
    title: "电视台",
    description: "获取热门电视直播频道（智能识别 M3U/TXT/JSON，自动分类，图标缩放，自动请求头）",
    author: "MoYan & 两块",
    version: "2.5.0",
    requiredVersion: "0.0.1",
    globalParams: [
        {
            name: "dataSource",
            title: "数据源 URL",
            type: "input",
            description: "支持任何返回 .m3u / .txt / .json 内容的 URL",
            value: DEFAULT_JSON_URL
        },
        {
            name: "logoBaseUrl",
            title: "图标基础 URL",
            type: "input",
            description: "当源中没有图标时，用此地址拼接频道名获取图标",
            value: DEFAULT_LOGO_BASE_URL
        },
        {
            name: "enableImageProxy",
            title: "启用图标缩放（16:9）",
            type: "enumeration",
            enumOptions: [
                { title: "是", value: "true" },
                { title: "否", value: "false" }
            ]
        }
    ],
    modules: [
        {
            title: "电视频道",
            description: "热门电视频道",
            requiresWebView: false,
            type: "video",
            functionName: "getLiveTv",
            params: [
                {
                    name: "sort_by",
                    title: "分类",
                    type: "enumeration",
                    value: "all",
                    enumOptions: [
                        { title: "全部", value: "all" },
                        { title: "央视", value: "cctv" },
                        { title: "卫视", value: "stv" },
                        { title: "地方", value: "ltv" },
                        { title: "港澳", value: "hk" },
                        { title: "海外", value: "overseas" },
                        { title: "体育", value: "sports" },
                        { title: "影视", value: "movie" },
                        { title: "纪录", value: "doc" },
                        { title: "少儿", value: "kids" },
                        { title: "音乐", value: "music" },
                        { title: "新闻", value: "news" }
                    ]
                },
                {
                    name: "genre",
                    title: "叠加类型",
                    type: "enumeration",
                    value: "",
                    enumOptions: [
                        { title: "全部", value: "" },
                        { title: "剧情", value: "18" },
                        { title: "科幻", value: "10765" },
                        { title: "动画", value: "16" },
                        { title: "喜剧", value: "35" },
                        { title: "动作", value: "10759" },
                        { title: "犯罪", value: "80" },
                        { title: "悬疑", value: "9648" },
                        { title: "纪录", value: "99" }
                    ]
                },
                {
                    name: "sortBy",
                    title: "排序方式",
                    type: "enumeration",
                    value: "default",
                    enumOptions: [
                        { title: "默认排序", value: "default" }
                    ]
                },
                {
                    name: "page",
                    title: "页码",
                    type: "page"
                }
            ]
        }
    ]
};

// ==================== 辅助函数 ====================
function scaleIcon(url, enable) {
    if (!enable || !url) return url;
    if (url.startsWith(IMAGE_PROXY_URL)) return url;
    var encodedUrl = encodeURIComponent(url);
    return IMAGE_PROXY_URL + "?url=" + encodedUrl + "&w=200&h=112&fit=contain&bg=transparent";
}

function cleanLeadingDash(str) {
    if (!str) return '';
    return str.replace(/^[-\s\._－]+/, '');
}

function guessCategory(channelName) {
    if (!channelName) return "ltv";
    var name = channelName.toLowerCase();
    if (name.includes("cctv") || name.includes("央视")) return "cctv";
    if (name.includes("卫视") && !name.includes("地方")) return "stv";
    if (name.includes("体育") || name.includes("sports")) return "sports";
    if (name.includes("电影") || name.includes("电视剧") || name.includes("影院")) return "movie";
    if (name.includes("纪录") || name.includes("纪实") || name.includes("documentary")) return "doc";
    if (name.includes("少儿") || name.includes("儿童") || name.includes("卡通")) return "kids";
    if (name.includes("音乐") || name.includes("music")) return "music";
    if (name.includes("新闻") || name.includes("news")) return "news";
    if (name.includes("港澳") || name.includes("台湾") || name.includes("香港") || name.includes("澳门")) return "hk";
    if (name.includes("海外") || name.includes("国际") || name.includes("foreign")) return "overseas";
    return "ltv";
}

function cleanChannelNameForLogo(rawName) {
    if (!rawName) return "";
    var name = cleanLeadingDash(rawName);
    var redundant = ["高清", "超清", "蓝光", "HD", "FHD", "4K", "频道", "直播"];
    for (var i = 0; i < redundant.length; i++) {
        var regex = new RegExp("\\s*" + redundant[i] + "\\s*", "gi");
        name = name.replace(regex, "");
    }
    name = name.replace(/([a-z]+)(\d*)/i, function(match, p1, p2) {
        return p1.toUpperCase() + p2;
    });
    name = name.replace(/CCTV(\d+)\+/i, "CCTV$1+");
    name = name.replace(/\s+/g, " ").trim();
    name = name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9+]/g, '');
    return name;
}

// 智能请求：自动重试多种请求头
async function smartFetch(url) {
    // 先尝试默认请求头
    try {
        var resp = await Widget.http.get(url);
        if (resp && resp.data) return resp;
    } catch (e) {}

    // 尝试各种 User-Agent + Referer 组合
    for (var i = 0; i < USER_AGENTS.length; i++) {
        for (var j = 0; j < REFERRERS.length; j++) {
            var headers = { "User-Agent": USER_AGENTS[i] };
            if (REFERRERS[j]) headers["Referer"] = REFERRERS[j];
            try {
                var resp = await Widget.http.get(url, { headers: headers });
                if (resp && resp.data) return resp;
            } catch (e) {}
        }
    }

    throw new Error("所有请求头尝试均失败，请检查网络或数据源地址");
}

// 根据内容自动判断格式：返回 "m3u" / "txt" / "json"
function detectFormat(content) {
    if (!content) return null;
    var str = typeof content === 'string' ? content : content.toString();
    var trimmed = str.trim();
    if (trimmed.startsWith("#EXTM3U")) return "m3u";
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            JSON.parse(trimmed);
            return "json";
        } catch (e) {}
    }
    if (trimmed.includes("http://") || trimmed.includes("https://")) return "txt";
    return null;
}

// ==================== 主函数 ====================
async function getLiveTv(params) {
    try {
        var dataSource = params.dataSource || DEFAULT_JSON_URL;
        if (typeof dataSource !== 'string' || dataSource.trim() === "") {
            dataSource = DEFAULT_JSON_URL;
        }
        var url = dataSource.trim();

        var response = await smartFetch(url);
        if (!response || !response.data) {
            throw new Error("无法获取数据，请检查网络或数据源地址");
        }

        var content = response.data;
        var format = detectFormat(content);
        if (!format) {
            throw new Error("无法识别内容格式，请确认源返回的是 M3U/TXT/JSON");
        }

        var enableProxy = params.enableImageProxy === "true" ? true : false;
        var selectedType = params.sort_by || "all";
        var logoBaseUrl = params.logoBaseUrl || DEFAULT_LOGO_BASE_URL;
        if (typeof logoBaseUrl !== 'string' || logoBaseUrl.trim() === "") {
            logoBaseUrl = DEFAULT_LOGO_BASE_URL;
        }

        var items;
        if (format === "m3u") {
            items = parseM3uSource(content, logoBaseUrl, enableProxy);
            if (selectedType !== "all") {
                items = items.filter(function(item) {
                    return item._category === selectedType;
                });
            }
        } else if (format === "txt") {
            items = parseTxtSource(content, logoBaseUrl, enableProxy);
            if (selectedType !== "all") {
                items = items.filter(function(item) {
                    return item._category === selectedType;
                });
            }
        } else {
            items = parseJsonSource(content, selectedType, enableProxy);
        }

        items.forEach(function(item) {
            delete item._category;
        });

        return items;
    } catch (error) {
        console.error("获取直播频道失败: " + error.message);
        throw error;
    }
}

// ==================== JSON 源解析 ====================
function parseJsonSource(data, type, enableProxy) {
    var modifiedData = {};
    for (var key in data) { modifiedData[key] = data[key]; }
    var allChannels = [];
    for (var key in modifiedData) {
        var channels = modifiedData[key];
        if (Array.isArray(channels)) { allChannels = allChannels.concat(channels); }
    }
    modifiedData["all"] = allChannels;
    var dataType = modifiedData[type];
    if (!dataType) { throw new Error("不支持的类型: " + type); }
    var items = [];
    for (var i = 0; i < dataType.length; i++) {
        var item = dataType[i];
        var childItems = [];
        if (item.childItems && Array.isArray(item.childItems)) {
            for (var j = 0; j < item.childItems.length; j++) {
                var child = item.childItems[j];
                if (typeof child === 'string' && child.trim().length > 0) {
                    childItems.push({
                        id: child, type: "url", title: "备用线路 - " + (j + 1),
                        backdropPath: item.backdrop_path, description: item.description, videoUrl: child
                    });
                }
            }
        }
        var baseItem = {
            id: item.id, type: "url", title: cleanLeadingDash(item.name), backdropPath: item.backdrop_path,
            description: cleanLeadingDash(item.description || item.name), videoUrl: item.id
        };
        if (childItems.length > 0) { baseItem.childItems = childItems; }
        if (baseItem.backdropPath) baseItem.backdropPath = scaleIcon(baseItem.backdropPath, enableProxy);
        items.push(baseItem);
    }
    return items;
}

// ==================== M3U 源解析 ====================
function parseM3uSource(content, logoBaseUrl, enableProxy) {
    var str = typeof content === 'string' ? content : content.toString();
    var lines = str.split(/\r?\n/);
    var channelMap = new Map();

    var currentRawName = "";
    var currentLogo = "";

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.startsWith("#EXTINF:")) {
            var nameMatch = line.match(/#EXTINF:.*?,(.+)$/);
            currentRawName = nameMatch ? nameMatch[1].trim() : "未知频道";
            currentRawName = cleanLeadingDash(currentRawName);
            var logoMatch = line.match(/tvg-logo="([^"]+)"/) || line.match(/logo="([^"]+)"/);
            currentLogo = logoMatch ? logoMatch[1] : "";
        } else if (line && !line.startsWith("#")) {
            if (!channelMap.has(currentRawName)) {
                var clean = cleanChannelNameForLogo(currentRawName);
                var category = guessCategory(currentRawName);
                channelMap.set(currentRawName, { urls: [], logoUrl: currentLogo, cleanName: clean, category: category });
            }
            var entry = channelMap.get(currentRawName);
            entry.urls.push(line);
            if (currentLogo && !entry.logoUrl) {
                entry.logoUrl = currentLogo;
            }
            currentRawName = "";
            currentLogo = "";
        }
    }

    var items = [];
    for (var entry of channelMap.entries()) {
        var rawName = entry[0];
        var data = entry[1];
        var urls = data.urls;
        var logoUrl = data.logoUrl;
        var cleanName = data.cleanName;
        var category = data.category;

        if (urls.length === 0) continue;
        var mainUrl = urls[0];

        var finalIconUrl = logoUrl;
        if (!finalIconUrl && cleanName) {
            finalIconUrl = logoBaseUrl + cleanName + ".png";
        }
        finalIconUrl = scaleIcon(finalIconUrl, enableProxy);

        var childItems = [];
        for (var j = 1; j < urls.length; j++) {
            childItems.push({
                id: urls[j],
                type: "url",
                title: "备用线路 " + j,
                description: rawName + " 备用线路",
                videoUrl: urls[j],
                backdropPath: null
            });
        }

        var displayTitle = cleanName || rawName;
        displayTitle = cleanLeadingDash(displayTitle);
        var displayDescription = cleanLeadingDash(rawName);

        if (displayTitle.length > 15) displayTitle = displayTitle.substring(0, 12) + "..";

        var item = {
            id: mainUrl,
            type: "url",
            title: displayTitle,
            description: displayDescription,
            videoUrl: mainUrl,
            coverUrl: finalIconUrl,
            backdropPath: null,
            childItems: childItems,
            _category: category
        };
        items.push(item);
    }

    if (items.length === 0) {
        throw new Error("M3U 文件中未找到任何有效频道");
    }
    console.log("解析到 " + items.length + " 个频道");
    return items;
}

// ==================== TXT 源解析 ====================
function parseTxtSource(content, logoBaseUrl, enableProxy) {
    var str = typeof content === 'string' ? content : content.toString();
    var lines = str.split(/\r?\n/);
    var channelMap = new Map();

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === "") continue;
        if (line.startsWith("#")) continue;

        var url = "";
        var name = "";
        if (line.indexOf(",") !== -1) {
            var parts = line.split(",");
            name = parts[0].trim();
            url = parts.slice(1).join(",").trim();
        } else if (line.indexOf(" ") !== -1) {
            var firstSpace = line.indexOf(" ");
            name = line.substring(0, firstSpace).trim();
            url = line.substring(firstSpace + 1).trim();
        } else {
            url = line;
            name = "频道 " + (channelMap.size + 1);
        }

        if (!url) continue;
        if (!url.startsWith("http") && !url.startsWith("https") && !url.startsWith("rtmp") && !url.startsWith("rtsp")) {
            continue;
        }

        name = cleanLeadingDash(name);

        if (!name || name === "频道 " + (channelMap.size + 1)) {
            var urlParts = url.split("/");
            var lastPart = urlParts[urlParts.length - 1];
            if (lastPart && lastPart.includes(".")) {
                name = lastPart.split(".")[0];
            } else {
                name = "频道 " + (channelMap.size + 1);
            }
        }

        var cleanName = cleanChannelNameForLogo(name);
        if (!channelMap.has(name)) {
            var category = guessCategory(name);
            channelMap.set(name, { urls: [], cleanName: cleanName, category: category });
        }
        var entry = channelMap.get(name);
        entry.urls.push(url);
    }

    var items = [];
    for (var entry of channelMap.entries()) {
        var name = entry[0];
        var data = entry[1];
        var urls = data.urls;
        var cleanName = data.cleanName;
        var category = data.category;

        if (urls.length === 0) continue;
        var mainUrl = urls[0];

        var finalIconUrl = logoBaseUrl + cleanName + ".png";
        finalIconUrl = scaleIcon(finalIconUrl, enableProxy);

        var childItems = [];
        for (var j = 1; j < urls.length; j++) {
            childItems.push({
                id: urls[j],
                type: "url",
                title: "备用线路 " + j,
                description: name + " 备用线路",
                videoUrl: urls[j],
                backdropPath: null
            });
        }

        var displayTitle = cleanName || name;
        displayTitle = cleanLeadingDash(displayTitle);
        var displayDescription = cleanLeadingDash(name);

        if (displayTitle.length > 15) displayTitle = displayTitle.substring(0, 12) + "..";

        var item = {
            id: mainUrl,
            type: "url",
            title: displayTitle,
            description: displayDescription,
            videoUrl: mainUrl,
            coverUrl: finalIconUrl,
            backdropPath: null,
            childItems: childItems,
            _category: category
        };
        items.push(item);
    }

    if (items.length === 0) {
        throw new Error("TXT 文件中未找到任何有效频道");
    }
    console.log("解析到 " + items.length + " 个频道（TXT源）");
    return items;
}