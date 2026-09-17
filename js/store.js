/**
 * 시연용 메모리 저장소.
 * 완성도, 중복, GPS 점 수, DDS 생성 가능 여부를 화면이 같이 씁니다.
 */
(function (global) {
  const S = global.KIJANIFY_SAMPLE;

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function farmGaps(farm) {
    const gaps = [];
    if (!farm.phone) gaps.push("생산자 연락처 없음");
    const pts = (farm.plots || []).reduce((n, p) => Math.max(n, (p.points || []).length), 0);
    if (!farm.plots || !farm.plots.length) gaps.push("위치정보 없음");
    else if (pts < 3) gaps.push("농장 경계 위치 " + (3 - pts) + "개 추가 필요");
    if (farm.kg === "" || farm.kg === null || farm.kg === undefined) gaps.push("올해 생산량 입력 필요");
    return gaps;
  }

  function completeness(farm) {
    const checks = [
      !!farm.name,
      !!farm.farmer,
      !!farm.phone,
      (farm.plots || []).some((p) => (p.points || []).length >= 3),
      farm.kg !== "" && farm.kg !== null,
      !!farm.coopId
    ];
    const ok = checks.filter(Boolean).length;
    return Math.round((ok / checks.length) * 100);
  }

  function refreshStatus(farm) {
    const gaps = farmGaps(farm);
    if (!gaps.length) farm.status = "ready";
    else farm.status = "gap";
    return farm;
  }

  function parseCsv(text) {
    const lines = text.replace(/\r/g, "").trim().split("\n").filter(Boolean);
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",");
      const o = {};
      headers.forEach((h, i) => { o[h] = (cols[i] || "").trim(); });
      return o;
    });
    return { headers, rows };
  }

  function autoMap(headers) {
    const rules = [
      { test: /coop|조합/i, target: "coop", conf: 96 },
      { test: /^farm$/i, target: "farm", conf: 91 },
      { test: /farmer|생산자/i, target: "farmer", conf: 90 },
      { test: /gps|lat|lng|좌표/i, target: "gps", conf: 74 },
      { test: /hs/i, target: "hs", conf: 88 },
      { test: /product|상품/i, target: "product", conf: 88 },
      { test: /year|연도|harvest/i, target: "year", conf: 85 },
      { test: /contact|phone|연락/i, target: "contact", conf: 40 },
      { test: /country|국가/i, target: "country", conf: 92 },
      { test: /site|region|지역/i, target: "site", conf: 80 }
    ];
    return headers.map((h) => {
      const hit = rules.find((r) => r.test.test(h));
      if (!hit) return { header: h, target: "skip", conf: 18 };
      if (/contact|phone/i.test(h)) return { header: h, target: "skip", conf: 18, suggested: "contact" };
      return { header: h, target: hit.target, conf: hit.conf };
    });
  }

  function similar(a, b) {
    a = (a || "").toLowerCase();
    b = (b || "").toLowerCase();
    if (!a || !b) return 0;
    if (a === b) return 100;
    if (a.includes(b) || b.includes(a)) return 88;
    const as = new Set(a.split(/\s+/));
    const bs = new Set(b.split(/\s+/));
    let n = 0;
    as.forEach((w) => { if (bs.has(w)) n++; });
    return Math.round((n / Math.max(as.size, bs.size)) * 100);
  }

  function detectDuplicates(rows, mapping, farms, coops) {
    const col = (row, target) => {
      const m = mapping.find((x) => x.target === target);
      return m ? row[m.header] || "" : "";
    };
    return rows.map((row, idx) => {
      const farmName = col(row, "farm") || col(row, "coop");
      const farmer = col(row, "farmer");
      let best = { score: 0, match: null, kind: "" };
      farms.forEach((f) => {
        const s = Math.max(similar(farmName, f.name), similar(farmer, f.farmer));
        if (s > best.score) best = { score: s, match: f, kind: "farm" };
      });
      coops.forEach((c) => {
        const s = similar(farmName, c.name);
        if (s > best.score) best = { score: s, match: c, kind: "coop" };
      });
      let action = "new";
      if (best.score >= 85) action = "link";
      else if (best.score >= 40) action = "review";
      return { idx, row, farmName, farmer, best, action };
    });
  }

  function emptyCells(rows, mapping) {
    const need = ["farm", "farmer", "gps", "contact"];
    let n = 0;
    rows.forEach((row) => {
      need.forEach((t) => {
        const m = mapping.find((x) => x.target === t);
        if (!m || !(row[m.header] || "").trim()) n++;
      });
    });
    return n;
  }

  const state = {
    farms: clone(S.INITIAL_FARMS),
    master: clone(S.MASTER),
    importFile: { name: "", headers: [], rows: [], mapping: [], dups: [], step: 1 },
    selectedFarmId: "FARM-ESPERANZA",
    selectedSurveyorId: "SV-ALIKU",
    selectedDdsId: "FARM-LALITPUR",
    requests: [],
    ddsDocs: [],
    factors: clone(S.FACTORS),
    carbonInput: clone(S.CARBON_SAMPLE),
    eudr: clone(S.EUDR_SAMPLE),
    users: clone(S.USERS),
    notices: clone(S.NOTICES),
    viewAsUserId: "U-WAN",
    selectedNoticeId: "N-1",
    completeFilter: "gap",
    completeQuery: "",
    farmQuery: "",
    farmMode: "exist",
    requestStep: 1
  };

  state.farms.forEach(refreshStatus);

  const api = {
    state,
    farmGaps,
    completeness,
    refreshStatus,
    parseCsv,
    autoMap,
    detectDuplicates,
    emptyCells,
    getFarm(id) {
      return state.farms.find((f) => f.id === id);
    },
    coopName(id) {
      const c = state.master.coops.find((x) => x.id === id);
      return c ? c.name : id;
    },
    surveyorName(id) {
      const s = state.master.surveyors.find((x) => x.id === id);
      return s ? s.name : "";
    },
    filteredFarms() {
      const q = state.completeQuery.trim().toLowerCase();
      return state.farms.filter((f) => {
        const gaps = farmGaps(f);
        if (state.completeFilter === "gap" && f.status !== "gap") return false;
        if (state.completeFilter === "gps" && !gaps.some((g) => g.indexOf("위치정보") >= 0 || g.indexOf("농장 경계") >= 0)) return false;
        if (state.completeFilter === "phone" && !gaps.includes("생산자 연락처 없음")) return false;
        if (state.completeFilter === "ready" && f.status !== "ready") return false;
        if (!q) return true;
        return [f.name, f.farmer, f.coopId, gaps.join(" ")].join(" ").toLowerCase().indexOf(q) >= 0;
      });
    },
    counts() {
      const all = state.farms.length;
      const ready = state.farms.filter((f) => f.status === "ready").length;
      const gap = state.farms.filter((f) => f.status === "gap").length;
      const surveying = state.farms.filter((f) => f.surveyStatus === "in_progress" || f.surveyStatus === "assigned").length;
      return { all, ready, gap, surveying };
    },
    bySurveyStatus(st) {
      return state.farms.filter((f) => f.surveyStatus === st);
    },
    mappedValue(row, mapping, target) {
      const m = mapping.find((x) => x.target === target);
      return m ? (row[m.header] || "").trim() : "";
    },
    loadCsvText(text, fileName) {
      const parsed = parseCsv(text);
      const mapping = autoMap(parsed.headers);
      const dups = detectDuplicates(parsed.rows, mapping, state.farms, state.master.coops);
      state.importFile = {
        name: fileName || S.CSV_FILE_NAME,
        headers: parsed.headers,
        rows: parsed.rows,
        mapping,
        dups,
        step: 2
      };
      return state.importFile;
    },
    setMapping(header, target) {
      const m = state.importFile.mapping.find((x) => x.header === header);
      if (!m) return;
      m.target = target;
      m.conf = target === "skip" ? 18 : 90;
      state.importFile.dups = detectDuplicates(
        state.importFile.rows,
        state.importFile.mapping,
        state.farms,
        state.master.coops
      );
    },
    setDupAction(idx, action) {
      const d = state.importFile.dups.find((x) => x.idx === idx);
      if (d) d.action = action;
    },
    applyImport() {
      const file = state.importFile;
      const created = [];
      file.dups.forEach((d) => {
        if (d.action === "skip") return;
        const farmName = api.mappedValue(d.row, file.mapping, "farm") || d.farmName;
        const farmer = api.mappedValue(d.row, file.mapping, "farmer") || d.farmer;
        const phone = api.mappedValue(d.row, file.mapping, "contact");
        const lat = parseFloat(d.row.GPS_lat || api.mappedValue(d.row, file.mapping, "gps"));
        const lng = parseFloat(d.row.GPS_lng);
        const points = Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
        if (d.action === "link" && d.best.match && d.best.kind === "farm") {
          const f = api.getFarm(d.best.match.id);
          if (f) {
            if (phone && !f.phone) f.phone = phone;
            if (points.length && (!f.plots || !f.plots.length)) f.plots = [{ id: "P1", points }];
            refreshStatus(f);
          }
          return;
        }
        const id = "FARM-" + farmName.replace(/[^A-Za-z0-9]+/g, "-").toUpperCase().slice(0, 18) + "-" + (state.farms.length + 1);
        const farm = {
          id,
          name: farmName || "신규 농장",
          farmer: farmer || "",
          coopId: "COOP-001",
          country: api.mappedValue(d.row, file.mapping, "country") || "CO",
          site: api.mappedValue(d.row, file.mapping, "site") || "Huila",
          source: "파일",
          phone,
          harvestYear: api.mappedValue(d.row, file.mapping, "year") || 2025,
          kg: "",
          plots: points.length ? [{ id: "P1", points }] : [],
          status: "gap",
          surveyStatus: "new",
          assignee: null,
          lastSurvey: null,
          evidence: false
        };
        refreshStatus(farm);
        state.farms.unshift(farm);
        created.push(farm);
      });
      file.step = 4;
      return created;
    },
    assignFarm(farmId, surveyorId) {
      const f = api.getFarm(farmId);
      if (!f) return;
      f.assignee = surveyorId;
      f.surveyStatus = "assigned";
      state.selectedFarmId = farmId;
      state.selectedSurveyorId = surveyorId;
      return f;
    },
    addFarm(data) {
      const farm = {
        id: "FARM-NEW-" + (state.farms.length + 1),
        name: data.name,
        farmer: data.farmer,
        coopId: data.coopId || "COOP-001",
        country: data.country || "CO",
        site: data.site || "Huila",
        source: "현장신규",
        phone: data.phone || "",
        harvestYear: data.harvestYear || 2025,
        kg: data.kg || "",
        plots: [],
        status: "gap",
        surveyStatus: "in_progress",
        assignee: state.selectedSurveyorId,
        lastSurvey: null,
        evidence: false
      };
      refreshStatus(farm);
      state.farms.unshift(farm);
      state.selectedFarmId = farm.id;
      return farm;
    },
    addGpsPoint(farmId, point) {
      const f = api.getFarm(farmId);
      if (!f) return;
      if (!f.plots.length) f.plots.push({ id: "P1", points: [] });
      f.plots[0].points.push(point);
      refreshStatus(f);
      return f.plots[0];
    },
    addPlot(farmId) {
      const f = api.getFarm(farmId);
      if (!f) return;
      const id = "P" + (f.plots.length + 1);
      f.plots.push({ id, points: [] });
      return f.plots[f.plots.length - 1];
    },
    saveSurvey(farmId, patch) {
      const f = api.getFarm(farmId);
      if (!f) return;
      Object.assign(f, patch);
      f.surveyStatus = "review";
      f.lastSurvey = "2026-09-17";
      f.evidence = (f.plots || []).some((p) => (p.points || []).length >= 3);
      refreshStatus(f);
      return f;
    },
    submitRequest(data) {
      const req = {
        id: "REQ-" + (state.requests.length + 1),
        ...data,
        createdAt: "2026-09-17"
      };
      state.requests.push(req);
      state.farms.filter((f) => f.coopId === "COOP-001" && f.status === "gap").forEach((f) => {
        if (f.surveyStatus === "new" || f.surveyStatus === "ready") f.surveyStatus = "new";
      });
      return req;
    },
    generateDds(farmId) {
      const f = api.getFarm(farmId) || state.farms.find((x) => x.status === "ready");
      const doc = {
        id: "DDS-2025-HUILA-00" + (state.ddsDocs.length + 1),
        farmId: f ? f.id : farmId,
        file: "DDS-2025-HUILA-00" + (state.ddsDocs.length + 1) + ".pdf",
        createdAt: "2026-09-17 10:12"
      };
      state.ddsDocs.push(doc);
      state.selectedDdsId = doc.id;
      return doc;
    },
    approveReview(farmId) {
      const f = api.getFarm(farmId);
      if (!f) return;
      f.surveyStatus = "ready";
      f.evidence = true;
      refreshStatus(f);
      return f;
    },
    setFactorCurrent(id) {
      const hit = state.factors.find((x) => x.id === id);
      if (!hit) return;
      state.factors.forEach((x) => {
        if (x.name === hit.name) x.current = x.id === id;
      });
      return hit;
    },
    carbonResult() {
      const elec = state.factors.find((x) => x.name.indexOf("전력") === 0 && x.current) || state.factors[0];
      const dsl = state.factors.find((x) => x.name.indexOf("경유") === 0 && x.current) || state.factors[1];
      const kwh = Number(state.carbonInput.kwh) || 0;
      const diesel = Number(state.carbonInput.dieselL) || 0;
      const proc = +(kwh * elec.value / 1000).toFixed(3);
      const trans = +(diesel * dsl.value / 1000).toFixed(3);
      const prod = +((Number(state.carbonInput.harvestKg) || 0) * 0.00014).toFixed(3);
      return {
        prod, proc, trans, total: +(prod + proc + trans).toFixed(3),
        elec, dsl, kwh, diesel
      };
    },
    attachEudrPhoto() {
      state.eudr.photos += 1;
      return state.eudr;
    },
    visibleFarmsForUser(userId) {
      const u = state.users.find((x) => x.id === userId) || state.users[0];
      if (u.role === "관리자") return { user: u, visible: state.farms.slice(), hidden: [] };
      if (u.role === "고객") {
        const visible = state.farms.filter((f) => f.coopId === u.companyId);
        const hidden = state.farms.filter((f) => f.coopId !== u.companyId);
        return { user: u, visible, hidden };
      }
      const visible = state.farms.filter((f) => f.assignee === "SV-HYUN");
      const hidden = state.farms.filter((f) => f.assignee !== "SV-HYUN");
      return { user: u, visible, hidden };
    },
    postNotice(payload) {
      const n = {
        id: "N-" + (state.notices.length + 1),
        title: payload.title,
        audience: payload.audience,
        body: payload.body,
        date: "2026-09-17"
      };
      state.notices.unshift(n);
      state.selectedNoticeId = n.id;
      return n;
    }
  };

  global.KIJANIFY_STORE = api;
})(window);
