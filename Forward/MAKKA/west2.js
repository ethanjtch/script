WidgetMetadata = {
    id: "western_trends_hub",
    title: "欧美风向标|口碑与热度",
    author: "𝙈𝙖𝙠𝙠𝙖𝙋𝙖𝙠𝙠𝙖",
    description: "聚合烂番茄(口碑)与流媒体平台(热度)，高精度抓取无Emoji纯净版。",
    version: "1.1.5", // 🚀 修复：烂番茄前端大改版导致失效的问题，引入“逆向DOM树遍历”防封杀解析
    requiredVersion: "0.0.1",
    site: "https://t.me/MakkaPakkaOvO",

    modules: [
        {
            title: "欧美风向标",
            functionName: "loadWesternTrends",
            type: "video", 
            cacheDuration: 3600,
            params: [
                {
                    name: "sort_by", 
                    title: "选择榜单",
                    type: "enumeration",
                    value: "rt_movies_home",
                    enumOptions: [
                        { title: "烂番茄 - 流媒体热映", value: "rt_movies_home" },
                        { title: "烂番茄 - 院线 热映", value: "rt_movies_theater" },
                        { title: "烂番茄 - 热门 剧集", value: "rt_tv_popular" },
                        { title: "烂番茄 - 最新 剧集", value: "rt_tv_new" },
                        { title: "烂番茄 - 最佳流媒体", value: "rt_movies_best" },
                        { title: "Netflix Top10", value: "fp_netflix" },
                        { title: "HBO Top10", value: "fp_hbo" },
                        { title: "Disney+ Top10", value: "fp_disney" },
                        { title: "Apple TV+ Top10", value: "fp_apple" },
                        { title: "Amazon Top10", value: "fp_amazon" }
                    ]
                },
                {
                    name: "region",
                    title: "地区 (仅热度榜)",
                    type: "enumeration",
                    value: "united-states",
                    belongTo: { 
                        paramName: "sort_by",
                        value: ["fp_netflix", "fp_hbo", "fp_disney", "fp_apple", "fp_amazon"] 
                    },
                    enumOptions: [
                        { title: "美国", value: "united-states" },
                        { title: "英国", value: "united-kingdom" },
                        { title: "韩国", value: "south-korea" },
                        { title: "日本", value: "japan" },
                        { title: "台灣", value: "taiwan" },
                        { title: "香港", value: "hong-kong" }
                    ]
                },
                {
                    name: "mediaType",
                    title: "类型 (仅热度榜)",
                    type: "enumeration",
                    value: "all",
                    belongTo: { 
                        paramName: "sort_by",
                        value: ["fp_netflix", "fp_hbo", "fp_disney", "fp_apple", "fp_amazon"] 
                    },
                    enumOptions: [
                        { title: "综合 (电影+剧集)", value: "all" },
                        { title: "剧集", value: "tv" },
                        { title: "电影", value: "movie" }
                    ]
                },
                { name: "page", title: "页码", type: "page" }
            ]
        }
    ]
};

// =========================================================================
// 0. 通用配置
// =========================================================================

const GENRE_MAP = {
    28: "动作", 12: "冒险", 16: "动画", 35: "喜剧", 80: "犯罪", 99: "纪录片",
    18: "剧情", 10751: "家庭", 14: "奇幻", 36: "历史", 27: "恐怖", 10402: "音乐",
    9648: "悬疑", 10749: "爱情", 878: "科幻", 10770: "电视电影", 53: "惊悚",
    10752: "战争", 37: "西部", 10759: "动作冒险", 10765: "科幻奇幻"
};

const RT_URLS = {
    "rt_movies_theater": "https://www.rottentomatoes.com/browse/movies_in_theaters/sort:popular?minTomato=75",
    "rt_movies_home": "https://www.rottentomatoes.com/browse/movies_at_home/sort:popular?minTomato=75",
    "rt_movies_best": "https://www.rottentomatoes.com/browse/movies_at_home/sort:critic_highest?minTomato=90",
    "rt_tv_popular": "https://www.rottentomatoes.com/browse/tv_series_browse/sort:popular?minTomato=75",
    "rt_tv_new": "https://www.rottentomatoes.com/browse/tv_series_browse/sort:newest?minTomato=75"
};

// =========================================================================
// 1. 入口分流
// =========================================================================

async function loadWesternTrends(params = {}) {
    const sort_by = params.sort_by || "rt_movies_home"; 
    const page = params.page || 1;
    
    if (sort_by.startsWith("rt_")) return await loadRottenTomatoes(sort_by, page);
    if (sort_by.startsWith("fp_")) {
        const platform = sort_by.replace("fp_", ""); 
        return await loadFlixPatrol(platform, params.region, params.mediaType);
    }
}

// =========================================================================
// 2. 烂番茄逻辑 (高容错逆向遍历解析)
// =========================================================================

async function loadRottenTomatoes(listType, page) {
    const pageSize = 15;
    const allItems = await fetchRottenTomatoesList(listType);
    if (allItems.length === 0) return [];
    
    const start = (page - 1) * pageSize;
    const pageItems = allItems.slice(start, start + pageSize);
    const promises = pageItems.map((item, i) => searchTmdb(item, start + i + 1));
    return (await Promise.all(promises)).filter(Boolean);
}

async function fetchRottenTomatoesList(type) {
    const url = RT_URLS[type] || RT_URLS["rt_movies_home"];
    try {
        const res = await Widget.http.get(url, { 
            headers: { 
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" 
            } 
        });
        const html = typeof res === 'string' ? res : (res.data || "");
        const $ = Widget.html.load(html);
        const items = [];
        
        // 🌟 核心重构：不再依赖脆弱的最外层结构，直接查找最稳定的标题节点
        const titleNodes = $('[data-qa="discovery-media-list-item-title"], [data-qa="list-item-title"], .js-tile-link .p--small');
        
        if (titleNodes.length > 0) {
            titleNodes.each((i, el) => {
                const title = $(el).text().trim();
                if (!title) return;

                // 像爬树一样往上找：不管外层怎么改，分数组件总是和标题在同一个大卡片里
                let container = $(el).parent();
                for (let level = 0; level < 5; level++) {
                    if (container.find('score-board, score-pairs, score-pairs-deprecated').length > 0) {
                        break;
                    }
                    if (container.length === 0) break;
                    container = container.parent();
                }

                let tomatoScore = "";
                let popcornScore = "";
                
                // 兼容最新版 <score-board> 和各种老版分数标签
                const scoreTags = ['score-board', 'score-pairs', 'score-pairs-deprecated'];
                for (const tag of scoreTags) {
                    const scoreEl = container.find(tag);
                    if (scoreEl.length > 0) {
                        tomatoScore = scoreEl.attr('tomatometerscore') || scoreEl.attr('critics-score') || scoreEl.attr('criticsscore') || "";
                        popcornScore = scoreEl.attr('audiencescore') || scoreEl.attr('audience-score') || "";
                        break;
                    }
                }

                items.push({
                    title: title,
                    tomatoScore: tomatoScore,
                    popcornScore: popcornScore,
                    mediaType: type.includes("tv") ? "tv" : "movie"
                });
            });
        }

        // 去重防御：防止烂番茄网页渲染重叠节点导致抓取重复
        const uniqueItems = [];
        const seen = new Set();
        for (const item of items) {
            const cleanTitle = item.title.replace(/\s+/g, ' ').trim();
            if (cleanTitle && !seen.has(cleanTitle)) {
                seen.add(cleanTitle);
                item.title = cleanTitle;
                uniqueItems.push(item);
            }
        }

        return uniqueItems;
    } catch (e) { return []; }
}

async function searchTmdb(rtItem, rank) {
    const cleanTitle = rtItem.title.replace(/\s\(\d{4}\)$/, "");
    try {
        const res = await Widget.tmdb.get(`/search/${rtItem.mediaType}`, {
            params: { query: cleanTitle, language: "zh-CN", page: 1 }
        });
        
        const match = (res.results || []).find(item => item.poster_path);
        if (!match) return null; 

        let scores = [];
        if (rtItem.tomatoScore) scores.push(`新鲜度 ${rtItem.tomatoScore}%`);
        if (rtItem.popcornScore) scores.push(`爆米花 ${rtItem.popcornScore}%`);
        
        return buildItem(match, rtItem.mediaType, {
            customSub: scores.join(" | ") || "烂番茄认证榜"
        });
    } catch (e) { return null; }
}

// =========================================================================
// 3. FlixPatrol 逻辑 (保持高精度不变)
// =========================================================================

async function loadFlixPatrol(platform, region = "united-states", mediaType = "tv") {
    const titles = await fetchFlixPatrolData(platform, region, mediaType);
    if (titles.length === 0) return await fetchTmdbFallback(platform, region, mediaType);
    const promises = titles.slice(0, 10).map((title, i) => searchTmdbFP(title, mediaType, i + 1));
    return (await Promise.all(promises)).filter(Boolean);
}

async function fetchFlixPatrolData(platform, region, mediaType) {
    const url = `https://flixpatrol.com/top10/${platform}/${region}/`;
    try {
        const res = await Widget.http.get(url, { 
            headers: { 
                "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" 
            } 
        });
        const html = typeof res === 'string' ? res : (res.data || "");
        if (!html) return [];

        const $ = Widget.html.load(html);
        const tables = $('.card-table tbody');
        if (tables.length === 0) return [];
        
        let tableIndex = 0;
        if (platform === "disney") {
            tableIndex = mediaType === "all" ? 0 : (mediaType === "movie" ? 1 : 2);
        } else if (platform === "hbo") {
            tableIndex = mediaType === "movie" ? 0 : 1;
        } else {
            tableIndex = mediaType === "movie" ? 0 : (mediaType === "tv" ? 1 : 2);
        }

        if (tableIndex >= tables.length) {
            tableIndex = tables.length - 1;
        }

        const targetTable = tables.eq(tableIndex);
        const titles = [];
        targetTable.find('tr').each((i, el) => {
            if (i >= 10) return; 

            const textLink = $(el).find('a.hover\\:underline').text().trim();
            const textTd = $(el).find('td').eq(2).text().trim();
            
            const finalTitle = textLink || textTd;
            if (finalTitle && finalTitle.length > 1) {
                titles.push(finalTitle.split('(')[0].trim());
            }
        });

        return titles;
    } catch (e) { return []; }
}

async function searchTmdbFP(title, mediaType, rank) {
    const cleanTitle = title.trim();
    try {
        const searchType = mediaType === "all" ? "multi" : mediaType;
        const res = await Widget.tmdb.get(`/search/${searchType}`, {
            params: { query: cleanTitle, language: "zh-CN", page: 1 }
        });
        
        let results = res.results || [];
        if (mediaType === "all") {
            results = results.filter(item => item.media_type === 'movie' || item.media_type === 'tv');
        }
        
        if (results.length === 0) return null;

        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000); 
        const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000); 

        let bestMatch = null;

        for (let item of results.slice(0, 5)) {
            if (!item.poster_path) continue; 

            const itemType = item.media_type || (mediaType === "all" ? "movie" : mediaType);
            
            if (itemType === "movie") {
                if (item.release_date) {
                    const releaseTime = new Date(item.release_date).getTime();
                    if (releaseTime >= oneYearAgo) {
                        bestMatch = item;
                        break;
                    }
                }
            } else if (itemType === "tv") {
                try {
                    const detail = await Widget.tmdb.get(`/tv/${item.id}`, { params: { language: "zh-CN" } });
                    const lastAirDate = detail.last_air_date || item.first_air_date;
                    if (lastAirDate) {
                        const airTime = new Date(lastAirDate).getTime();
                        if (airTime >= sixMonthsAgo) {
                            bestMatch = item;
                            break;
                        }
                    }
                } catch (e) {
                    if (item.first_air_date) {
                        const airTime = new Date(item.first_air_date).getTime();
                        if (airTime >= sixMonthsAgo) {
                            bestMatch = item;
                            break;
                        }
                    }
                }
            }
        }

        if (!bestMatch) {
            bestMatch = results.find(item => item.poster_path);
        }
        
        if (!bestMatch) return null; 

        const actualMediaType = bestMatch.media_type || (mediaType === "all" ? "movie" : mediaType);
        return buildItem(bestMatch, actualMediaType, { rank: rank });
        
    } catch (e) { return null; }
}

async function fetchTmdbFallback(platform, region, mediaType) {
    const map = { "netflix":"8", "disney":"337", "hbo":"1899|118", "apple":"350", "amazon":"119" };
    const regMap = { "united-states":"US", "united-kingdom":"GB", "south-korea":"KR", "japan":"JP", "taiwan":"TW", "hong-kong":"HK" };
    
    const tmdbMediaType = mediaType === "all" ? "tv" : mediaType;
    
    try {
        const res = await Widget.tmdb.get(`/discover/${tmdbMediaType}`, {
            params: {
                watch_region: regMap[region] || "US",
                with_watch_providers: map[platform] || "8",
                sort_by: "popularity.desc",
                language: "zh-CN",
                page: 1
            }
        });
        
        const validResults = (res.results || []).filter(item => item.poster_path);
        return validResults.slice(0, 10).map((item, i) => buildItem(item, tmdbMediaType, { rank: i + 1 }));
    } catch (e) { return []; }
}

// =========================================================================
// 4. 通用 Item 构建器 (统一纯净UI排版)
// =========================================================================

function buildItem(item, mediaType, { rank, customSub } = {}) {
    const dateStr = item.first_air_date || item.release_date || "";
    
    const genreNames = (item.genre_ids || [])
        .map(id => GENRE_MAP[id])
        .filter(Boolean)
        .slice(0, 2)
        .join(" / ");
        
    let descInfo = "";
    if (rank) {
        descInfo = `TOP ${rank} | 评分 ${item.vote_average ? item.vote_average.toFixed(1) : "0.0"}`;
    } else if (customSub) {
        descInfo = customSub;
    } else {
        descInfo = `评分 ${item.vote_average ? item.vote_average.toFixed(1) : "0.0"}`;
    }

    return {
        id: String(item.id),
        tmdbId: parseInt(item.id),
        type: "tmdb",
        mediaType: mediaType,
        
        title: item.name || item.title, 
        
        genreTitle: genreNames || "影视",
        releaseDate: dateStr, 
        subTitle: "", 
        
        posterPath: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : "",
        backdropPath: item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : "",
        
        description: `${descInfo}\n${item.overview || "暂无简介"}`,
        rating: item.vote_average || 0
    };
}
