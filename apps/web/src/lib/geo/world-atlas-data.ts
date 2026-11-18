/**
 * 内置权威世界地理索引与高精度简化陆地轮廓 GeoJSON
 * 用途：
 * 1. 为 MapLibre GL JS 提供零外部依赖、100% 离线/沙箱可用的双主题矢量底图要素（海岸线、大陆板块、经纬网、核心枢纽点）。
 * 2. 在外部 Nominatim / Wikipedia 网络受限或离线部署环境下，提供真实经纬度坐标与权威地理背景回退（诚实标注 builtin_gazetteer）。
 */

export interface GazetteerEntry {
  id: string;
  name: string;
  englishName: string;
  aliases: string[];
  latitude: number;
  longitude: number;
  country: string;
  countryCode: string;
  adminArea: string;
  city: string;
  category: string;
  elevationOrTerrain: string;
  wikiSlugEn: string;
  factualSummary: string;
}

export const WORLD_ATLAS_GAZETTEER: GazetteerEntry[] = [
  {
    id: "gz-beijing",
    name: "北京",
    englishName: "Beijing",
    aliases: ["beijing", "peking", "北京市", "中关村", "中国首都"],
    latitude: 39.9042,
    longitude: 116.4074,
    country: "中国",
    countryCode: "CN",
    adminArea: "北京市",
    city: "北京",
    category: "首都 / 科技与文化中枢",
    elevationOrTerrain: "华北平原西北缘 · 海拔约 43m",
    wikiSlugEn: "Beijing",
    factualSummary:
      "中华人民共和国首都，位于华北平原北部，毗邻燕山与太行山脉交汇带，汇聚国家级科研院所、高校与软件工程产业集群。",
  },
  {
    id: "gz-shanghai",
    name: "上海",
    englishName: "Shanghai",
    aliases: ["shanghai", "上海市", "浦东", "张江", "外滩", "长三角"],
    latitude: 31.2304,
    longitude: 121.4737,
    country: "中国",
    countryCode: "CN",
    adminArea: "上海市",
    city: "上海",
    category: "国际航运与金融科技枢纽",
    elevationOrTerrain: "长江三角洲冲积平原 · 海拔约 4m",
    wikiSlugEn: "Shanghai",
    factualSummary:
      "位于长江入海口与东海交汇处，是中国核心国际经济、金融、贸易、航运与集成电路/人工智能科创中心，拥有多条海底光缆登陆站。",
  },
  {
    id: "gz-shenzhen",
    name: "深圳",
    englishName: "Shenzhen",
    aliases: ["shenzhen", "深圳市", "南山区", "粤港澳大湾区", "华强北"],
    latitude: 22.5431,
    longitude: 114.0579,
    country: "中国",
    countryCode: "CN",
    adminArea: "广东省",
    city: "深圳",
    category: "硬件制造与软件研发核心城市",
    elevationOrTerrain: "珠江口东岸滨海丘陵平原 · 海拔约 18m",
    wikiSlugEn: "Shenzhen",
    factualSummary:
      "地处广东省南部、珠江口东岸，与香港一水之隔，是全球消费电子供应链、智能硬件研发、通信设备与开源硬件制造高地。",
  },
  {
    id: "gz-hongkong",
    name: "香港",
    englishName: "Hong Kong",
    aliases: ["hong kong", "hk", "香港特别行政区", "维多利亚港"],
    latitude: 22.3193,
    longitude: 114.1694,
    country: "中国",
    countryCode: "HK",
    adminArea: "香港特别行政区",
    city: "香港",
    category: "亚太国际网络交换与航运枢纽",
    elevationOrTerrain: "滨海山地与天然深水港 · 海拔 5m–957m",
    wikiSlugEn: "Hong_Kong",
    factualSummary:
      "位于南海北岸、珠江口东侧，拥有维多利亚港深水航道及高密度亚太国际互联网交换中心（HKIX）与海底通信光缆节点。",
  },
  {
    id: "gz-taipei",
    name: "台北",
    englishName: "Taipei",
    aliases: ["taipei", "台北市", "新竹", "台湾"],
    latitude: 25.033,
    longitude: 121.5654,
    country: "中国",
    countryCode: "TW",
    adminArea: "台湾",
    city: "台北",
    category: "半导体与计算机硬件产业重镇",
    elevationOrTerrain: "台北盆地 · 淡水河水系 · 海拔约 10m",
    wikiSlugEn: "Taipei",
    factualSummary:
      "位于台湾岛北部的台北盆地，紧邻全球核心晶圆代工、PC 主板显卡与服务器硬件研发制造走廊（台北—桃园—新竹）。",
  },
  {
    id: "gz-hangzhou",
    name: "杭州",
    englishName: "Hangzhou",
    aliases: ["hangzhou", "杭州市", "西湖", "余杭"],
    latitude: 30.2741,
    longitude: 120.1551,
    country: "中国",
    countryCode: "CN",
    adminArea: "浙江省",
    city: "杭州",
    category: "云计算与开源大模型重镇",
    elevationOrTerrain: "钱塘江下游与东南丘陵过渡带 · 海拔约 19m",
    wikiSlugEn: "Hangzhou",
    factualSummary:
      "浙江省省会，位于钱塘江下游与京杭大运河南端，是中国云计算基础设施、电商工程体系与开源大模型研发的重要聚集地。",
  },
  {
    id: "gz-chengdu",
    name: "成都",
    englishName: "Chengdu",
    aliases: ["chengdu", "成都市", "天府新区", "四川盆地"],
    latitude: 30.5728,
    longitude: 104.0668,
    country: "中国",
    countryCode: "CN",
    adminArea: "四川省",
    city: "成都",
    category: "西部科学城与游戏研发中心",
    elevationOrTerrain: "四川盆地西部成都平原 · 海拔约 500m",
    wikiSlugEn: "Chengdu",
    factualSummary:
      "位于四川盆地西部的成都平原，依托都江堰水利体系，是中国西南地区通信枢纽、数字文创与游戏工程研发中心。",
  },
  {
    id: "gz-tokyo",
    name: "东京",
    englishName: "Tokyo",
    aliases: ["tokyo", "东京都", "秋叶原", "日本首都", "kanto"],
    latitude: 35.6762,
    longitude: 139.6503,
    country: "日本",
    countryCode: "JP",
    adminArea: "东京都",
    city: "东京",
    category: "首都 / 主机游戏与精密工业中心",
    elevationOrTerrain: "关东平原临东京湾 · 海拔约 40m",
    wikiSlugEn: "Tokyo",
    factualSummary:
      "日本首都及关东大都市圈核心，面朝东京湾，是全球电子游戏产业（Sony PlayStation 等）、精密光学仪器与跨太平洋海缆核心枢纽。",
  },
  {
    id: "gz-kyoto",
    name: "京都",
    englishName: "Kyoto",
    aliases: ["kyoto", "京都市", "任天堂总部"],
    latitude: 35.0116,
    longitude: 135.7681,
    country: "日本",
    countryCode: "JP",
    adminArea: "京都府",
    city: "京都",
    category: "历史文化名城 / 游戏与精密电子总部",
    elevationOrTerrain: "京都盆地 · 鸭川流域 · 海拔约 50m",
    wikiSlugEn: "Kyoto",
    factualSummary:
      "位于日本关西地区京都盆地，兼具千年文化遗产与现代精密电子、游戏产业（Nintendo 总部所在地）。",
  },
  {
    id: "gz-seoul",
    name: "首尔",
    englishName: "Seoul",
    aliases: ["seoul", "汉城", "首尔特别市", "板桥"],
    latitude: 37.5665,
    longitude: 126.978,
    country: "韩国",
    countryCode: "KR",
    adminArea: "首尔特别市",
    city: "首尔",
    category: "首都 / 存储芯片与高带宽网络都市",
    elevationOrTerrain: "汉江下游盆地丘陵 · 海拔约 38m",
    wikiSlugEn: "Seoul",
    factualSummary:
      "韩国首都，横跨汉江两岸，周边京畿道都市圈集中了全球高带宽存储半导体（DRAM / NAND Flash）、显示面板与电竞游戏产业。",
  },
  {
    id: "gz-singapore",
    name: "新加坡",
    englishName: "Singapore",
    aliases: ["singapore", "狮城", "马六甲海峡", "东南亚云节点"],
    latitude: 1.3521,
    longitude: 103.8198,
    country: "新加坡",
    countryCode: "SG",
    adminArea: "Central Region",
    city: "新加坡",
    category: "全球航运咽喉与东南亚云数据中心枢纽",
    elevationOrTerrain: "赤道热带岛屿低丘 · 海拔约 15m",
    wikiSlugEn: "Singapore",
    factualSummary:
      "坐落于马来半岛南端、扼守马六甲海峡东口，连接太平洋与印度洋航线，同时也是亚太核心云服务可用区与低延迟国际网络枢纽。",
  },
  {
    id: "gz-sanfrancisco",
    name: "旧金山 / 硅谷",
    englishName: "San Francisco",
    aliases: [
      "san francisco",
      "silicon valley",
      "bay area",
      "硅谷",
      "旧金山湾区",
      "openai",
      "mountain view",
    ],
    latitude: 37.7749,
    longitude: -122.4194,
    country: "美国",
    countryCode: "US",
    adminArea: "California",
    city: "San Francisco",
    category: "全球 AI 大模型、半导体与开源软件发源地",
    elevationOrTerrain: "北加州太平洋沿岸半岛与旧金山湾 · 海拔约 16m",
    wikiSlugEn: "San_Francisco",
    factualSummary:
      "位于美国加利福尼亚州北部的旧金山湾区，与南侧硅谷共同构成半导体芯片、现代操作系统、浏览器标准及前沿大模型研发重镇。",
  },
  {
    id: "gz-seattle",
    name: "西雅图 / 贝尔维尤",
    englishName: "Seattle",
    aliases: [
      "seattle",
      "redmond",
      "bellevue",
      "西雅图",
      "雷德蒙德",
      "valve",
      "microsoft",
    ],
    latitude: 47.6062,
    longitude: -122.3321,
    country: "美国",
    countryCode: "US",
    adminArea: "Washington",
    city: "Seattle",
    category: "云计算、操作系统与 PC 游戏发行中心",
    elevationOrTerrain: "普吉特海湾与华盛顿湖地峡 · 海拔约 53m",
    wikiSlugEn: "Seattle",
    factualSummary:
      "位于美国太平洋西北地区华盛顿州，大西雅图都会区汇聚了 Microsoft（Redmond）、Valve/Steam（Bellevue）及超大规模云基础设施总部。",
  },
  {
    id: "gz-newyork",
    name: "纽约",
    englishName: "New York",
    aliases: ["new york", "nyc", "manhattan", "纽约市", "曼哈顿"],
    latitude: 40.7128,
    longitude: -74.006,
    country: "美国",
    countryCode: "US",
    adminArea: "New York",
    city: "New York",
    category: "北大西洋金融、媒体与跨洋网络核心",
    elevationOrTerrain: "哈德逊河入海口天然港湾 · 海拔约 10m",
    wikiSlugEn: "New_York_City",
    factualSummary:
      "位于美国东海岸哈德逊河口，是全球金融交易系统、超低延迟跨大西洋光缆互联与数字媒体科技产业核心城市。",
  },
  {
    id: "gz-london",
    name: "伦敦",
    englishName: "London",
    aliases: ["london", "英国首都", "格林尼治", "greenwich", "deepmind"],
    latitude: 51.5074,
    longitude: -0.1278,
    country: "英国",
    countryCode: "GB",
    adminArea: "England",
    city: "London",
    category: "本初子午线基准地 / 欧洲 AI 研究重镇",
    elevationOrTerrain: "泰晤士河下游盆地 · 海拔约 11m",
    wikiSlugEn: "London",
    factualSummary:
      "英国首都，横跨泰晤士河，东南部格林尼治皇家天文台确立了地理经度 0° 本初子午线与世界协调时参考基准，也是前沿科学 AI 研究重镇。",
  },
  {
    id: "gz-paris",
    name: "巴黎",
    englishName: "Paris",
    aliases: ["paris", "法国首都", "塞纳河"],
    latitude: 48.8566,
    longitude: 2.3522,
    country: "法国",
    countryCode: "FR",
    adminArea: "Île-de-France",
    city: "Paris",
    category: "首都 / 欧洲开源 AI 与航空航天工程中心",
    elevationOrTerrain: "巴黎盆地塞纳河流域 · 海拔约 35m",
    wikiSlugEn: "Paris",
    factualSummary:
      "法国首都，位于巴黎盆地中央，是国际度量衡局（SI 国际单位制基准）、欧洲开源大模型研发与基础数学研究核心城市。",
  },
  {
    id: "gz-frankfurt",
    name: "法兰克福",
    englishName: "Frankfurt",
    aliases: ["frankfurt", "de-cix", "法兰克福", "德国数据中心"],
    latitude: 50.1109,
    longitude: 8.6821,
    country: "德国",
    countryCode: "DE",
    adminArea: "Hesse",
    city: "Frankfurt",
    category: "欧洲核心互联网交换中心 (DE-CIX)",
    elevationOrTerrain: "美因河畔谷地 · 海拔约 112m",
    wikiSlugEn: "Frankfurt",
    factualSummary:
      "位于德国黑森州美因河畔，承载全球吞吐量规模领先的互联网交换节点 DE-CIX，是欧洲骨干网路由测速的核心基准站。",
  },
  {
    id: "gz-warsaw",
    name: "华沙",
    englishName: "Warsaw",
    aliases: ["warsaw", "波兰首都", "gog", "cd projekt"],
    latitude: 52.2297,
    longitude: 21.0122,
    country: "波兰",
    countryCode: "PL",
    adminArea: "Masovian",
    city: "Warsaw",
    category: "中东欧软件工程与正版 DRM-Free 游戏中心",
    elevationOrTerrain: "维斯瓦河中游平原 · 海拔约 100m",
    wikiSlugEn: "Warsaw",
    factualSummary:
      "波兰首都，位于维斯瓦河两岸，是中东欧重要的计算机算法竞赛、系统软件工程与数字游戏研发发行（CD PROJEKT / GOG）中心。",
  },
  {
    id: "gz-zurich",
    name: "苏黎世",
    englishName: "Zurich",
    aliases: ["zurich", "zürich", "苏黎世", "eth"],
    latitude: 47.3769,
    longitude: 8.5417,
    country: "瑞士",
    countryCode: "CH",
    adminArea: "Zürich",
    city: "Zurich",
    category: "精密工程、计算机视觉与机器人研究中心",
    elevationOrTerrain: "瑞士高原苏黎世湖北端 · 海拔约 408m",
    wikiSlugEn: "Zurich",
    factualSummary:
      "瑞士最大城市，毗邻阿尔卑斯山北麓，依托苏黎世联邦理工学院（ETH Zürich）形成欧洲计算机图形学、几何制图与精密仪器工程重镇。",
  },
  {
    id: "gz-sydney",
    name: "悉尼",
    englishName: "Sydney",
    aliases: ["sydney", "悉尼", "澳大利亚", "澳洲节点"],
    latitude: -33.8688,
    longitude: 151.2093,
    country: "澳大利亚",
    countryCode: "AU",
    adminArea: "New South Wales",
    city: "Sydney",
    category: "南半球核心海港与大洋洲云数据中心枢纽",
    elevationOrTerrain: "东南太平洋沿岸杰克逊港盆地 · 海拔约 19m",
    wikiSlugEn: "Sydney",
    factualSummary:
      "位于澳大利亚东南海岸，是大洋洲人口最多的大都会及南太平洋跨洋海底光缆核心汇聚站。",
  },
  {
    id: "gz-toronto",
    name: "多伦多",
    englishName: "Toronto",
    aliases: ["toronto", "多伦多", "安大略湖", "加拿大"],
    latitude: 43.6532,
    longitude: -79.3832,
    country: "加拿大",
    countryCode: "CA",
    adminArea: "Ontario",
    city: "Toronto",
    category: "深度学习学术起源重镇与北美科技枢纽",
    elevationOrTerrain: "安大略西北岸平原 · 海拔约 76m",
    wikiSlugEn: "Toronto",
    factualSummary:
      "加拿大最大城市，位于安大略湖北岸，在现代深度神经网络基础研究、图形处理器工程与跨国软件研发领域具有重要地位。",
  },
  {
    id: "gz-saopaulo",
    name: "圣保罗",
    englishName: "São Paulo",
    aliases: ["sao paulo", "são paulo", "圣保罗", "巴西"],
    latitude: -23.5505,
    longitude: -46.6333,
    country: "巴西",
    countryCode: "BR",
    adminArea: "São Paulo",
    city: "São Paulo",
    category: "南美洲经济、工业与互联网交换中枢",
    elevationOrTerrain: "巴西高原东南缘盆地 · 海拔约 760m",
    wikiSlugEn: "S%C3%A3o_Paulo",
    factualSummary:
      "位于巴西东南部高原，是南半球规模最大的都会区之一，承载拉丁美洲核心互联网流量交换节点（IX.br）与云计算区域中心。",
  },
  {
    id: "gz-dubai",
    name: "迪拜",
    englishName: "Dubai",
    aliases: ["dubai", "迪拜", "阿联酋", "波斯湾"],
    latitude: 25.2048,
    longitude: 55.2708,
    country: "阿联酋",
    countryCode: "AE",
    adminArea: "Dubai",
    city: "Dubai",
    category: "中东亚欧非航空航运与通信中继枢纽",
    elevationOrTerrain: "阿拉伯半岛波斯湾南岸海岸沙漠 · 海拔约 5m",
    wikiSlugEn: "Dubai",
    factualSummary:
      "位于阿拉伯半岛东部波斯湾海岸，连接亚欧非三大洲航空物流走廊与红海—波斯湾国际通信网。",
  },
  {
    id: "gz-bengaluru",
    name: "班加罗尔",
    englishName: "Bengaluru",
    aliases: ["bengaluru", "bangalore", "班加罗尔", "印度硅谷"],
    latitude: 12.9716,
    longitude: 77.5946,
    country: "印度",
    countryCode: "IN",
    adminArea: "Karnataka",
    city: "Bengaluru",
    category: "南亚软件研发与芯片验证工程中心",
    elevationOrTerrain: "德干高原南部迈索尔高原 · 海拔约 920m",
    wikiSlugEn: "Bangalore",
    factualSummary:
      "位于印度南部德干高原，海拔约 920 米气候温和，汇聚大量系统软件开发、SoC 芯片验证与开源工程团队。",
  },
  {
    id: "gz-cairo",
    name: "开罗",
    englishName: "Cairo",
    aliases: ["cairo", "开罗", "埃及首都", "尼罗河", "苏伊士"],
    latitude: 30.0444,
    longitude: 31.2357,
    country: "埃及",
    countryCode: "EG",
    adminArea: "Cairo Governorate",
    city: "Cairo",
    category: "北非最大都市 / 亚欧红海通信走廊重镇",
    elevationOrTerrain: "尼罗河三角洲南端顶点 · 海拔约 23m",
    wikiSlugEn: "Cairo",
    factualSummary:
      "埃及首都，扼守尼罗河三角洲咽喉并毗邻苏伊士运河走廊，是连接欧洲与亚洲海陆光缆路由的关键地理门户。",
  },
  {
    id: "gz-reykjavik",
    name: "雷克雅未克",
    englishName: "Reykjavik",
    aliases: ["reykjavik", "冰岛", "绿色算力中心", "地热"],
    latitude: 64.1466,
    longitude: -21.9426,
    country: "冰岛",
    countryCode: "IS",
    adminArea: "Capital Region",
    city: "Reykjavik",
    category: "全球纬度最高首都 / 100% 可再生地热算力基地",
    elevationOrTerrain: "北大西洋火山裂谷海岸 · 海拔约 14m",
    wikiSlugEn: "Reykjav%C3%ADk",
    factualSummary:
      "冰岛首都，靠近北极圈，依托充沛的水电与地热清洁能源及低温自然冷却气候，成为绿色高性能计算（HPC）数据中心代表地区。",
  },
  {
    id: "gz-everest",
    name: "珠穆朗玛峰",
    englishName: "Mount Everest",
    aliases: ["everest", "mount everest", "珠穆朗玛峰", "珠峰", "喜马拉雅"],
    latitude: 27.9881,
    longitude: 86.925,
    country: "中国 / 尼泊尔边界",
    countryCode: "CN",
    adminArea: "西藏自治区日喀则市 / 萨加玛塔专区",
    city: "定日县 / 昆布",
    category: "地球陆地最高峰地标",
    elevationOrTerrain: "喜马拉雅山脉主峰 · 2020 联合实测岩面雪面高程 8848.86m",
    wikiSlugEn: "Mount_Everest",
    factualSummary:
      "位于中尼边界喜马拉雅山脉中段，2020 年中尼联合测量确定高程为 8848.86 米，是板块构造隆升与高海拔大气科学观测标志点。",
  },
  {
    id: "gz-panama",
    name: "巴拿马运河",
    englishName: "Panama Canal",
    aliases: ["panama", "panama canal", "巴拿马运河", "巴拿马城"],
    latitude: 8.9824,
    longitude: -79.5199,
    country: "巴拿马",
    countryCode: "PA",
    adminArea: "Panamá",
    city: "Panama City",
    category: "沟通太平洋与大西洋的世界航运工程咽喉",
    elevationOrTerrain: "中美地峡船闸水系 · 加通湖海拔约 26m",
    wikiSlugEn: "Panama_Canal",
    factualSummary:
      "横穿巴拿马地峡，通过分级船闸连接太平洋与加勒比海/大西洋，大幅缩短美洲东西海岸及亚美海运航程。",
  },
];

/**
 * 简化全球主要大陆与岛屿多边形（WGS84 经纬度），用于内嵌式 MapLibre 矢量图层渲染。
 */
export const WORLD_LANDMASS_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: { name: "北美大陆", region: "Americas" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-168, 66], [-162, 71], [-140, 70], [-125, 72], [-95, 74],
            [-78, 72], [-64, 66], [-55, 52], [-66, 44], [-74, 40],
            [-81, 31], [-82, 25], [-90, 29], [-97, 26], [-96, 19],
            [-88, 21], [-83, 10], [-78, 8], [-85, 11], [-94, 16],
            [-105, 20], [-112, 31], [-117, 32], [-123, 38], [-125, 48],
            [-135, 58], [-150, 61], [-162, 55], [-168, 66],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "格陵兰岛", region: "Americas" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-54, 60], [-43, 60], [-22, 70], [-18, 81], [-45, 83],
            [-68, 78], [-58, 68], [-54, 60],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "南美大陆", region: "Americas" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-78, 9], [-62, 11], [-50, 1], [-35, -6], [-38, -14],
            [-41, -23], [-52, -33], [-62, -40], [-68, -54], [-74, -52],
            [-73, -40], [-71, -30], [-71, -18], [-81, -5], [-78, 9],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "欧亚大陆主体", region: "Eurasia" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-9, 37], [-9, 43], [-2, 44], [-4, 48], [3, 51], [8, 54],
            [6, 61], [16, 69], [28, 71], [42, 68], [60, 70], [80, 73],
            [106, 77], [140, 73], [170, 69], [179, 65], [162, 56],
            [142, 54], [135, 44], [129, 35], [124, 40], [121, 39],
            [122, 31], [119, 25], [114, 22], [108, 21], [109, 12],
            [103, 1], [100, 7], [97, 16], [90, 22], [80, 14], [77, 8],
            [72, 19], [67, 25], [56, 26], [50, 30], [59, 22], [44, 13],
            [35, 28], [35, 36], [27, 37], [23, 38], [16, 40], [12, 44],
            [5, 43], [0, 39], [-5, 36], [-9, 37],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "不列颠与爱尔兰群岛", region: "Europe" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-10, 51], [-6, 58], [1, 58], [2, 51], [-5, 50], [-10, 51],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "非洲大陆", region: "Africa" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [-17, 15], [-13, 28], [-6, 36], [10, 37], [25, 32], [33, 31],
            [43, 12], [51, 12], [41, -2], [40, -15], [33, -26], [28, -33],
            [18, -35], [14, -22], [12, -6], [9, 4], [-8, 5], [-17, 15],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "马达加斯加岛", region: "Africa" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [44, -16], [49, -12], [50, -19], [47, -25], [43, -24], [44, -16],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "日本列岛", region: "Asia" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [130, 31], [136, 34], [141, 36], [145, 44], [141, 45],
            [139, 39], [134, 35], [130, 33], [130, 31],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "台湾岛", region: "Asia" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [120.1, 22.0], [121.0, 21.9], [122.0, 25.0], [121.4, 25.3],
            [120.2, 23.6], [120.1, 22.0],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "东南亚群岛", region: "Asia" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [95, 5], [105, -2], [118, -8], [127, -8], [126, 7],
            [121, 18], [117, 7], [109, 2], [99, -2], [95, 5],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "澳大利亚大陆", region: "Oceania" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [114, -22], [129, -14], [142, -11], [153, -26], [150, -38],
            [139, -36], [130, -32], [115, -34], [114, -22],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: { name: "新西兰群岛", region: "Oceania" },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [166, -46], [172, -41], [178, -37], [175, -35], [171, -43], [166, -46],
          ],
        ],
      },
    },
  ],
};

export function buildWorldGraticuleGeoJson() {
  const features: Array<{
    type: "Feature";
    properties: { kind: "equator" | "grid" };
    geometry: { type: "LineString"; coordinates: Array<[number, number]> };
  }> = [];

  for (let lat = -60; lat <= 60; lat += 30) {
    features.push({
      type: "Feature",
      properties: { kind: lat === 0 ? "equator" : "grid" },
      geometry: {
        type: "LineString",
        coordinates: [
          [-180, lat],
          [0, lat],
          [180, lat],
        ],
      },
    });
  }

  for (let lon = -150; lon <= 180; lon += 30) {
    features.push({
      type: "Feature",
      properties: { kind: lon === 0 ? "equator" : "grid" },
      geometry: {
        type: "LineString",
        coordinates: [
          [lon, -80],
          [lon, 0],
          [lon, 80],
        ],
      },
    });
  }

  return {
    type: "FeatureCollection" as const,
    features,
  };
}
