// ==================== 常量定义 ====================
const DEFAULT_BASE_URL = "https://missav.ai";
const REQUEST_TIMEOUT = 15000;
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Referer": "https://missav.ai/",
  "Connection": "keep-alive"
};

// ==================== API 封装类 ====================
class MissAVAPI {
  async get(url, options = {}) {
    const finalOptions = {
      headers: { ...DEFAULT_HEADERS, ...options.headers },
      timeout: options.timeout || REQUEST_TIMEOUT
    };
    try {
      const resp = await Widget.http.get(url, finalOptions);
      if (!resp || resp.statusCode !== 200) {
        throw new Error(`HTTP ${resp?.statusCode || "unknown"}`);
      }
      return resp.data;
    } catch (error) {
      console.error(`请求失败 [${url}]:`, error);
      throw error;
    }
  }

  async getHtml(url, options = {}) {
    const data = await this.get(url, options);
    return Widget.html.load(data);
  }
}

const _api = new MissAVAPI();

// ==================== 辅助函数（内部导出） ====================
function parseVideoList(html) {
  if (!html || html.includes("Just a moment")) {
    console.warn("可能被 Cloudflare 拦截");
    return [];
  }

  const $ = Widget.html.load(html);
  const results = [];

  $("div.group").each((i, el) => {
    const $el = $(el);
    const $link = $el.find("a.text-secondary");
    const href = $link.attr("href");
    if (!href) return;

    const title = $link.text().trim();
    const $img = $el.find("img");
    const imgSrc = $img.attr("data-src") || $img.attr("src");
    const duration = $el.find(".absolute.bottom-1.right-1").text().trim();

    // 提取番号用于构建高清封面
    const videoId = href.split('/').pop().replace(/-uncensored-leak|-chinese-subtitle/g, '').toUpperCase();
    const coverUrl = `https://fourhoi.com/${videoId.toLowerCase()}/cover-t.jpg`;

    results.push({
      id: href,
      type: "url",
      title: title,
      backdropPath: coverUrl || imgSrc || "",
      mediaType: "movie",
      link: href.startsWith('http') ? href : DEFAULT_BASE_URL + href,
      durationText: duration,
      description: `番号: ${videoId}`
    });
  });

  return results;
}
const _parseVideoList = parseVideoList;

// ==================== 元数据生成辅助 ====================
function generateParams(module, extraParams = []) {
  return {
    title: module.title,
    description: module.description,
    requiresWebView: false,
    functionName: module.functionName,
    cacheDuration: module.cacheDuration || 1800,
    params: [
      ...extraParams,
      { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
    ]
  };
}

// ==================== 元数据定义 ====================
WidgetMetadata = {
  id: "missav_makka_play",
  title: "MissAVsearch",
  author: "skywazzle",
  description: "missav搜索模块，支持分类浏览与搜索",
  version: "5.0.0",
  requiredVersion: "0.0.1",
  site: "https://missav.ai",
  detailCacheDuration: 300,
  // 顶级搜索模块
  search: {
    title: "搜索视频",
    functionName: "searchVideos",
    params: [
      { name: "keyword", title: "关键词", type: "input", description: "输入番号或标题", value: "" },
      { name: "page", title: "页码", type: "page", description: "页码", value: "1" }
    ]
  },
  modules: [
    // 浏览视频模块
    generateParams({
      title: "浏览视频",
      description: "按分类和排序浏览视频",
      functionName: "loadList"
    }, [
      {
        name: "category",
        title: "分类",
        type: "enumeration",
        value: "dm588/cn/release",
        enumOptions: [
          { title: "🆕 最新发布", value: "dm588/cn/release" },
          { title: "🔥 本周热门", value: "dm169/cn/weekly-hot" },
          { title: "🌟 月度热门", value: "dm257/cn/monthly-hot" },
          { title: "🔞 无码流出", value: "dm621/cn/uncensored-leak" },
          { title: "🇯🇵 东京热", value: "dm29/cn/tokyohot" },
          { title: "🇨🇳 中文字幕", value: "dm265/cn/chinese-subtitle" }
        ]
      },
      {
        name: "sort",
        title: "排序",
        type: "enumeration",
        value: "released_at",
        enumOptions: [
          { title: "发布日期", value: "released_at" },
          { title: "今日浏览", value: "today_views" },
          { title: "总浏览量", value: "views" },
          { title: "收藏数", value: "saved" }
        ]
      }
    ])
  ]
};

// ==================== 模块功能函数 ====================
// 浏览列表
async function loadList(params) {
  (_params = params).page || (_params.page = 1);
  (_params = params).category || (_params.category = "dm588/cn/release");
  (_params = params).sort || (_params.sort = "released_at");

  const page = params.page;
  const category = params.category;
  const sort = params.sort;

  let url = `${DEFAULT_BASE_URL}/${category}?sort=${sort}`;
  if (page > 1) url += `&page=${page}`;

  try {
    const html = await _api.get(url);
    return _parseVideoList(html);
  } catch (e) {
    console.error("浏览加载失败:", e);
    return [];
  }
}

// 搜索功能（顶级搜索调用）
async function searchVideos(params) {
  (_params = params).keyword || (_params.keyword = "");
  (_params = params).page || (_params.page = 1);

  const keyword = params.keyword;
  const page = params.page;

  if (!keyword.trim()) {
    return []; // 空关键词返回空列表
  }

  let url = `${DEFAULT_BASE_URL}/cn/search/${encodeURIComponent(keyword)}`;
  if (page > 1) url += `?page=${page}`;

  try {
    const html = await _api.get(url);
    return _parseVideoList(html);
  } catch (e) {
    console.error("搜索失败:", e);
    return [];
  }
}

// 详情加载（保持原有逻辑）
async function loadDetail(link) {
  try {
    const html = await _api.get(link);
    const $ = Widget.html.load(html);

    let title = $('meta[property="og:title"]').attr('content') || $('h1').text().trim();
    let videoUrl = "";

    $('script').each((i, el) => {
      const scriptContent = $(el).html() || "";

      // surrit 直连
      if (scriptContent.includes('surrit.com') && scriptContent.includes('.m3u8')) {
        const matches = scriptContent.match(/https:\/\/surrit\.com\/[a-f0-9\-]+\/[^"'\s]*\.m3u8/g);
        if (matches && matches.length > 0) {
          videoUrl = matches[0];
          return false;
        }
      }

      // eval 混淆
      if (!videoUrl && scriptContent.includes('eval(function')) {
        const uuidMatches = scriptContent.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g);
        if (uuidMatches && uuidMatches.length > 0) {
          videoUrl = `https://surrit.com/${uuidMatches[0]}/playlist.m3u8`;
          return false;
        }
      }
    });

    if (!videoUrl) {
      const matchSimple = html.match(/source\s*=\s*['"]([^'"]+)['"]/);
      if (matchSimple) videoUrl = matchSimple[1];
    }

    if (!videoUrl) throw new Error("未找到播放地址");

    return {
      id: link,
      type: "detail",
      videoUrl: videoUrl.replace(/&amp;/g, '&'),
      title: title,
      description: "",
      backdropPath: "",
      mediaType: "movie",
      link: link,
      customHeaders: {
        "Referer": "https://missav.ai/",
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
        "Origin": "https://missav.ai"
      }
    };
  } catch (error) {
    console.error("详情加载失败:", error);
    return {
      id: link,
      type: "detail",
      videoUrl: link,
      title: "加载失败",
      description: error.message || "未知错误",
      backdropPath: "",
      mediaType: "movie",
      link: link
    };
  }
}