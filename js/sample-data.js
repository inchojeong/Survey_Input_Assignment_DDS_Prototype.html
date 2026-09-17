/**
 * KIJANIFY 시연용 샘플 데이터
 * PDF 매뉴얼(콜롬비아 Huila Arabica) + 라이브 앱(Koboko, Arua) 값을 그대로 사용합니다.
 */
(function (global) {
  const EXAMPLES = {
    harvestYear: { label: "조사 대상 수확연도", example: "2025", hint: "YYYY, 해당 커피가 수확된 연도" },
    country: { label: "생산국", example: "CO / Colombia", hint: "ISO 코드 또는 국가명" },
    site: { label: "지역", example: "Huila", hint: "주·지역명. 선택" },
    hsCode: { label: "HS 코드", example: "090111", hint: "6자리. 비볶은·비카페인제거 커피" },
    tradeName: { label: "상품명", example: "Decarbon Coffee Huila Green Coffee", hint: "거래에 쓰는 제품명" },
    scientificName: { label: "학명(품종)", example: "Arabica - Caturra", hint: "종 / 품종" },
    coopName: { label: "협동조합", example: "Cooperativa Cafetera de Huila", hint: "공식 명칭" },
    farmName: { label: "농장명", example: "Finca La Esperanza", hint: "농장 또는 생산지 이름" },
    farmerName: { label: "생산자", example: "Maria Gomez", hint: "농장 생산자 이름" },
    phone: { label: "생산자 연락처", example: "+57 608 836 0000", hint: "국가번호 포함" },
    gps: { label: "위치정보", example: "2.9273, -75.2819", hint: "위도, 경도. 농장 경계는 위치 3개 이상" },
    kg: { label: "해당 연도 생산량 (kg)", example: "1250", hint: "kg 단위 숫자만" },
    hsCacao: { label: "카카오 HS", example: "180100", hint: "Koboko cacao 시연용" },
    kwh: { label: "가공 전력", example: "13200", hint: "7.5kW × 8시간 × 220일 = 13,200 kWh" },
    wastewater: { label: "폐수량", example: "1440000", hint: "12,000 L/일 × 120일 = 1,440,000 L" },
    diesel: { label: "운송 경유", example: "180", hint: "L 단위. Pitalito → Buenaventura 예시" },
    factorElec: { label: "전력 배출계수", example: "0.456", hint: "kgCO₂e/kWh, 버전 2025.1 예시" },
    noticeTitle: { label: "공지 제목", example: "EUDR 증빙사진 촬영 요청", hint: "조사원에게 보이는 짧은 제목" }
  };

  const CSV_TEXT = [
    "Cooperative,Farm,Farmer,GPS_lat,GPS_lng,HS,Product,HarvestYear,Contact,Country,Site",
    "Cooperativa Cafetera de Huila,Finca El Roble,Carlos Mendoza,2.9273,-75.2819,090111,Decarbon Coffee Huila Green Coffee,2025,,CO,Huila",
    "Cooperativa Cafetera de Huila,Finca La Esperanza,Maria Gomez,,,090111,Decarbon Coffee Huila Green Coffee,2025,,CO,Huila",
    "Cooperativa Cafetera de Huila,Cooperativa Cafetera de Huila,(조합),2.9273,-75.2819,090111,Decarbon Coffee Huila Green Coffee,2025,+57 608 836 0000,CO,Huila",
    "Koboko Cooperative,Koboko cacao farm,Wan Song,3.4200,30.9600,180100,Koboko cacao,2024,,UG,Koboko"
  ].join("\n");

  const CSV_FILE_NAME = "Huila_producers_2025.csv";

  const COLUMN_TARGETS = [
    { id: "coop", label: "협동조합" },
    { id: "farm", label: "농장명" },
    { id: "farmer", label: "생산자" },
    { id: "gps", label: "농장 구역 위치" },
    { id: "hs", label: "HS 코드" },
    { id: "product", label: "상품명" },
    { id: "year", label: "수확연도" },
    { id: "contact", label: "생산자 연락처" },
    { id: "country", label: "국가" },
    { id: "site", label: "지역" },
    { id: "skip", label: "이번에 연결하지 않음" }
  ];

  const MASTER = {
    coops: [
      {
        id: "COOP-001",
        name: "Cooperativa Cafetera de Huila",
        country: "CO",
        address: "Pitalito, Huila, Colombia",
        phone: "+57 608 836 0000",
        founded: 2001,
        membersM: 186,
        membersF: 94,
        productionKg: 1250000
      }
    ],
    facilities: [
      {
        id: "FAC-001",
        name: "Huila Coffee Processing Center",
        gps: "2.9273, -75.2819",
        phone: "+57 608 836 1000",
        address: "Pitalito, Huila, Colombia"
      }
    ],
    exporters: [
      {
        id: "EXPORTER-001",
        name: "Colombia Green Coffee Export S.A.S.",
        address: "Buenaventura, Valle del Cauca, Colombia",
        phone: "+57 602 241 0000"
      }
    ],
    surveyors: [
      { id: "SV-ALIKU", name: "Aliku William", region: "UG", load: 1 },
      { id: "SV-HYUN", name: "이현우", region: "ET", load: 0 }
    ]
  };

  const INITIAL_FARMS = [
    {
      id: "FARM-ESPERANZA",
      name: "Finca La Esperanza",
      farmer: "Maria Gomez",
      coopId: "COOP-001",
      country: "CO",
      site: "Huila",
      source: "파일",
      phone: "",
      harvestYear: 2025,
      kg: "",
      plots: [],
      status: "gap",
      surveyStatus: "new",
      assignee: null,
      lastSurvey: null,
      evidence: false
    },
    {
      id: "FARM-ROBLE",
      name: "Finca El Roble",
      farmer: "Carlos Mendoza",
      coopId: "COOP-001",
      country: "CO",
      site: "Huila",
      source: "파일",
      phone: "",
      harvestYear: 2025,
      kg: "",
      plots: [{ id: "P1", points: [{ lat: 2.9273, lng: -75.2819 }, { lat: 2.9290, lng: -75.2801 }] }],
      status: "gap",
      surveyStatus: "new",
      assignee: null,
      lastSurvey: null,
      evidence: false
    },
    {
      id: "FARM-COOP",
      name: "Cooperativa Cafetera de Huila",
      farmer: "(조합)",
      coopId: "COOP-001",
      country: "CO",
      site: "Huila",
      source: "기존 연결",
      phone: "+57 608 836 0000",
      harvestYear: 2025,
      kg: "1250000",
      plots: [{ id: "P1", points: [{ lat: 2.9273, lng: -75.2819 }, { lat: 2.9288, lng: -75.2790 }, { lat: 2.9251, lng: -75.2832 }] }],
      status: "ready",
      surveyStatus: "ready",
      assignee: null,
      lastSurvey: "2025-11-18",
      evidence: true
    },
    {
      id: "FARM-MAWA",
      name: "mawa Stephen-1",
      farmer: "mawa stephen",
      coopId: "COOP-ARUA",
      coopName: "Arua district farmers association",
      country: "UG",
      site: "andruvu",
      source: "이전 조사",
      phone: "+256 790333444",
      harvestYear: 2026,
      kg: "",
      plots: [{ id: "P1", points: [{ lat: 3.0201, lng: 30.9102 }, { lat: 3.0210, lng: 30.9115 }, { lat: 3.0192, lng: 30.9120 }] }],
      status: "gap",
      surveyStatus: "assigned",
      assignee: "SV-ALIKU",
      lastSurvey: "2026-05-11",
      evidence: true
    },
    {
      id: "FARM-KOBOKO",
      name: "Koboko cacao",
      farmer: "Wan Song",
      coopId: "COOP-KOBOKO",
      country: "UG",
      site: "Koboko",
      source: "고객신청",
      phone: "",
      harvestYear: 2024,
      kg: "400",
      plots: [],
      status: "gap",
      surveyStatus: "in_progress",
      assignee: "SV-ALIKU",
      lastSurvey: null,
      evidence: false
    },
    {
      id: "FARM-LALITPUR",
      name: "Coffee Cooperative Union Limited Lalitpur",
      farmer: "(조합)",
      coopId: "COOP-LALITPUR",
      country: "NP",
      site: "Lalitpur",
      source: "이전 조사",
      phone: "+977 1-5550000",
      harvestYear: 2026,
      kg: "8200",
      plots: [{ id: "P1", points: [{ lat: 27.6588, lng: 85.3247 }, { lat: 27.6601, lng: 85.3260 }, { lat: 27.6570, lng: 85.3272 }] }],
      status: "ready",
      surveyStatus: "ready",
      assignee: "SV-HYUN",
      lastSurvey: "2026-05-10",
      evidence: true
    },
    {
      id: "FARM-AKUAPEM",
      name: "Akuapem Coffee Growers",
      farmer: "(조합)",
      coopId: "COOP-AKUAPEM",
      country: "GH",
      site: "Akuapem",
      source: "이전 조사",
      phone: "+233 20 000 0000",
      harvestYear: 2026,
      kg: "3100",
      plots: [{ id: "P1", points: [{ lat: 5.934, lng: -0.086 }, { lat: 5.936, lng: -0.084 }] }],
      status: "gap",
      surveyStatus: "review",
      assignee: "SV-HYUN",
      lastSurvey: "2026-05-29",
      evidence: false
    }
  ];

  const SAMPLE_REQUEST = {
    harvestYear: "2025",
    hsCode: "090111",
    tradeName: "Decarbon Coffee Huila Green Coffee",
    country: "Colombia (CO)",
    site: "Huila"
  };

  const SAMPLE_NEW_FARM = {
    name: "Finca Los Andes",
    farmer: "Andres Ruiz",
    phone: "+57 608 836 2000",
    kg: "860"
  };

  const SAMPLE_GPS_POINTS = [
    { lat: 2.9273, lng: -75.2819 },
    { lat: 2.9288, lng: -75.2790 },
    { lat: 2.9251, lng: -75.2832 }
  ];

  const CARBON_SAMPLE = {
    farmId: "FARM-ESPERANZA",
    harvestKg: 1250,
    kwh: 13200,
    kwhHow: "7.5 kW × 8시간 × 220일",
    wastewaterL: 1440000,
    wastewaterHow: "12,000 L/일 × 120일",
    dieselL: 180,
    distanceKm: 310,
    route: "Pitalito, Huila → Buenaventura"
  };

  const FACTORS = [
    { id: "EF-ELEC-2025", name: "전력 (콜롬비아 그리드)", unit: "kgCO₂e/kWh", value: 0.456, version: "2025.1", current: true, crop: "공통" },
    { id: "EF-DSL-2025", name: "경유", unit: "kgCO₂e/L", value: 2.68, version: "2025.1", current: true, crop: "공통" },
    { id: "EF-ELEC-2024", name: "전력 (콜롬비아 그리드)", unit: "kgCO₂e/kWh", value: 0.478, version: "2024.2", current: false, crop: "공통" }
  ];

  const TRACE_EVENTS = [
    { date: "2024-12-18", stage: "생산", actor: "Finca El Roble", detail: "980 kg · Arabica" },
    { date: "2025-03-02", stage: "생산", actor: "Finca La Esperanza", detail: "1,250 kg · Caturra" },
    { date: "2025-03-20", stage: "가공", actor: "Huila Coffee Processing Center", detail: "습식 가공 · 전력 13,200 kWh" },
    { date: "2025-04-11", stage: "보관", actor: "Huila Coffee Processing Center", detail: "그린빈 1,180 kg" },
    { date: "2025-05-08", stage: "수출", actor: "Colombia Green Coffee Export S.A.S.", detail: "LOT-HC-2025-014 · Buenaventura" }
  ];

  const EUDR_SAMPLE = {
    farmId: "FARM-COOP",
    satelliteDate: "2026-02-10",
    satelliteSrc: "Hansen / JRC 예시 결과",
    satelliteResult: "산림 훼손 징후 없음",
    keepUntil: "2031-09-17",
    photos: 2,
    note: "위성 분석 엔진이 아니라, 결과가 농장에 붙고 5년 보관되는 흐름을 보여 줍니다."
  };

  const USERS = [
    { id: "U-WAN", name: "Wan Song", email: "wan@songstark.com", role: "관리자", company: "키자니테이블", companyId: "ORG-KIJANIFY", sees: "모든 회사 데이터" },
    { id: "U-CLI", name: "Maria Gomez", email: "perseverance220@gmail.com", role: "고객", company: "Cooperativa Cafetera de Huila", companyId: "COOP-001", sees: "자사 농가·조사만" },
    { id: "U-HYUN", name: "이현우", email: "hyun@kijanify.demo", role: "조사원", company: "키자니테이블", companyId: "ORG-KIJANIFY", sees: "배정된 조사만" }
  ];

  const NOTICES = [
    { id: "N-1", title: "2025 수확 조사 마감 안내", date: "2026-09-10", audience: "조사원", body: "Huila 현장조사는 9월 30일까지 제출해 주세요. 위치 3개가 없는 농가는 먼저 보완합니다." },
    { id: "N-2", title: "배출계수 2025.1 적용", date: "2026-09-01", audience: "관리자", body: "이후 탄소 산정은 2025.1 계수를 씁니다. 이미 끝난 산정은 당시 버전을 유지합니다." }
  ];

  const NOTICE_SAMPLE = {
    title: "EUDR 증빙사진 촬영 요청",
    audience: "조사원",
    body: "Esperanza·El Roble 조사 시 토지 증빙사진을 2장 이상 찍어 주세요."
  };

  global.KIJANIFY_SAMPLE = {
    EXAMPLES,
    CSV_TEXT,
    CSV_FILE_NAME,
    COLUMN_TARGETS,
    MASTER,
    INITIAL_FARMS,
    SAMPLE_REQUEST,
    SAMPLE_NEW_FARM,
    SAMPLE_GPS_POINTS,
    CARBON_SAMPLE,
    FACTORS,
    TRACE_EVENTS,
    EUDR_SAMPLE,
    USERS,
    NOTICES,
    NOTICE_SAMPLE
  };
})(window);
