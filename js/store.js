/**
 * 시연용 메모리 저장소.
 * 완성도, 중복, GPS 점 수, DDS 생성 가능 여부를 화면이 같이 씁니다.
 */
(function (global) {
  const S = global.KIJANIFY_SAMPLE;

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function farmGapItems(farm) {
    const items = [];
    if (!farm.phone) {
      items.push({ code: "phone", title: "연락처 없음", detail: "전화·메일이 비어 있습니다." });
    }
    const pts = locPts(farm);
    if (pts < 3) {
      items.push({
        code: "gps",
        title: "위치 " + pts + "/3",
        detail: pts === 0
          ? "경계 점이 없습니다. 3개가 필요합니다."
          : "경계 점 " + pts + "개입니다. 3개가 필요합니다."
      });
    }
    if (farm.kg === "" || farm.kg === null || farm.kg === undefined) {
      items.push({ code: "kg", title: "생산량 없음", detail: "올해 수확량(kg)이 비어 있습니다." });
    }
    return items;
  }

  function farmGaps(farm) {
    return farmGapItems(farm).map((i) => i.title);
  }

  function locPts(farm) {
    return (farm.plots || []).reduce((n, p) => Math.max(n, (p.points || []).length), 0);
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

  function detectFormatErrors(rows) {
    return rows.map((row, idx) => {
      const lat = parseFloat(row.GPS_lat);
      const lng = parseFloat(row.GPS_lng);
      const errs = [];
      if (row.GPS_lat && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        errs.push("위도가 -90~90 범위를 벗어남 (" + row.GPS_lat + ")");
      }
      if (row.GPS_lng && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        errs.push("경도가 -180~180 범위를 벗어남");
      }
      return errs.length ? { idx, row, errs } : null;
    }).filter(Boolean);
  }

  function calcAreaHa(farm) {
    const plot = (farm.plots || []).find((p) => (p.points || []).length >= 3);
    if (!plot) return null;
    const pts = plot.points;
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      s += a.lng * b.lat - b.lng * a.lat;
    }
    const ha = Math.abs(s) / 2 * 111 * 111 * 100;
    return +ha.toFixed(2);
  }

  function farmDupMatches(farm) {
    const hits = [];
    const farmerOk = farm.farmer && farm.farmer !== "(조합)";
    state.farms.forEach((o) => {
      if (o.id === farm.id) return;
      const nameScore = similar(farm.name, o.name);
      const farmerScore = farmerOk && o.farmer !== "(조합)" ? similar(farm.farmer, o.farmer) : 0;
      const score = Math.max(nameScore, farmerScore);
      if (score >= 85) hits.push({ other: o, score: score, kind: "farm" });
    });
    (state.master.coops || []).forEach((c) => {
      const score = similar(farm.name, c.name);
      if (score >= 85) hits.push({ other: c, score: score, kind: "coop" });
    });
    return hits;
  }

  function farmErrorItems(farm) {
    const items = [];
    (farm.plots || []).forEach((p) => {
      (p.points || []).forEach((pt) => {
        if (pt.lat < -90 || pt.lat > 90) {
          items.push({
            code: "lat",
            title: "위도 범위 오류",
            value: String(pt.lat),
            expect: "-90 ~ 90",
            example: "2.9273"
          });
        }
        if (pt.lng < -180 || pt.lng > 180) {
          items.push({
            code: "lng",
            title: "경도 범위 오류",
            value: String(pt.lng),
            expect: "-180 ~ 180",
            example: "-75.2819"
          });
        }
      });
    });
    if (farm.kg !== "" && farm.kg != null && isNaN(Number(farm.kg))) {
      items.push({
        code: "kgnum",
        title: "생산량이 숫자가 아님",
        value: String(farm.kg),
        expect: "숫자(kg)",
        example: "860"
      });
    }
    const calc = calcAreaHa(farm);
    if (farm.areaHa && calc != null) {
      const entered = Number(farm.areaHa);
      if (entered > 0 && Math.abs(entered - calc) / entered > 0.3) {
        items.push({
          code: "area",
          title: "면적 불일치",
          value: entered + "ha",
          expect: "경계 계산 " + calc + "ha",
          example: "차이 30% 이내"
        });
      }
    }
    return items;
  }

  function farmErrors(farm) {
    return farmErrorItems(farm).map((i) => i.title + (i.value ? " (" + i.value + ")" : ""));
  }

  function farmDupItems(farm) {
    return farmDupMatches(farm).map((h) => {
      if (h.kind === "coop") {
        return {
          code: "coop",
          title: "조합명과 같음",
          target: h.other.name,
          reason: "농장 이름이 협동조합 이름과 같습니다.",
          score: h.score
        };
      }
      return {
        code: "farm",
        title: "농장명 유사",
        target: h.other.name,
        reason: "이미 있는 농장과 이름 또는 생산자가 같습니다.",
        score: h.score
      };
    });
  }

  const state = {
    farms: clone(S.INITIAL_FARMS),
    master: clone(S.MASTER),
    importFile: { name: "", headers: [], rows: [], mapping: [], dups: [], errors: [], step: 1 },
    selectedFarmId: "FARM-ESPERANZA",
    selectedSurveyorId: "SV-ALIKU",
    selectedDdsId: "FARM-LALITPUR",
    requests: [],
    ddsDocs: [],
    arrDocs: [],
    factors: clone(S.FACTORS),
    carbonInput: clone(S.CARBON_SAMPLE),
    eudr: clone(S.EUDR_SAMPLE),
    users: clone(S.USERS),
    notices: clone(S.NOTICES),
    deliveries: clone(S.DELIVERIES),
    dispatches: clone(S.DISPATCHES),
    procLogs: clone(S.PROC_LOGS),
    viewAsUserId: "U-WAN",
    selectedNoticeId: "N-1",
    completeFilter: "all",
    completeSubfilter: "all",
    completeQuery: "",
    farmQuery: "",
    farmMode: "exist",
    farmTab: "survey",
    ddsMode: "survey",
    requestPurposes: { dds: true, carbon: true, trace: true },
    requestStep: 1
  };

  state.farms.forEach(refreshStatus);

  const api = {
    state,
    farmGaps,
    farmGapItems,
    locPts,
    completeness,
    refreshStatus,
    parseCsv,
    autoMap,
    detectDuplicates,
    detectFormatErrors,
    emptyCells,
    farmDupMatches,
    farmDupItems,
    farmErrors,
    farmErrorItems,
    calcAreaHa,
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
    farmsByIssue(kind) {
      const q = state.completeQuery.trim().toLowerCase();
      const sub = state.completeSubfilter || "all";
      return state.farms.filter((f) => {
        const gaps = farmGapItems(f);
        if (kind === "gap") {
          if (!gaps.length) return false;
          if (sub === "gps" && locPts(f) >= 3) return false;
          if (sub === "phone" && f.phone) return false;
          if (sub === "kg" && f.kg !== "" && f.kg != null) return false;
        } else if (kind === "error") {
          if (!farmErrorItems(f).length) return false;
        } else if (kind === "dup") {
          if (!farmDupItems(f).length) return false;
        } else if (kind === "ready") {
          if (f.status !== "ready") return false;
        }
        if (!q) return true;
        return [f.name, f.farmer, f.coopId, gaps.map((g) => g.title).join(" ")].join(" ").toLowerCase().indexOf(q) >= 0;
      });
    },
    filteredFarms() {
      const filt = state.completeFilter || "all";
      if (filt === "all" || filt === "error" || filt === "dup" || filt === "ready") {
        return api.farmsByIssue("gap");
      }
      return api.farmsByIssue(filt);
    },
    counts() {
      const all = state.farms.length;
      const ready = state.farms.filter((f) => f.status === "ready").length;
      const gapFarms = state.farms.filter((f) => f.status === "gap");
      const gap = gapFarms.length;
      const surveying = state.farms.filter((f) => f.surveyStatus === "in_progress" || f.surveyStatus === "assigned").length;
      const dup = state.farms.filter((f) => farmDupItems(f).length).length;
      const error = state.farms.filter((f) => farmErrorItems(f).length).length;
      const gps = gapFarms.filter((f) => locPts(f) < 3).length;
      const phone = gapFarms.filter((f) => !f.phone).length;
      const kg = gapFarms.filter((f) => f.kg === "" || f.kg === null || f.kg === undefined).length;
      const lat = state.farms.filter((f) => farmErrorItems(f).some((i) => i.code === "lat" || i.code === "lng")).length;
      const area = state.farms.filter((f) => farmErrorItems(f).some((i) => i.code === "area")).length;
      const kgnum = state.farms.filter((f) => farmErrorItems(f).some((i) => i.code === "kgnum")).length;
      const dupCoop = state.farms.filter((f) => farmDupItems(f).some((i) => i.code === "coop")).length;
      const dupFarm = state.farms.filter((f) => farmDupItems(f).some((i) => i.code === "farm")).length;
      return { all, ready, gap, surveying, dup, error, gps, phone, kg, lat, area, kgnum, dupCoop, dupFarm };
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
      const errors = detectFormatErrors(parsed.rows);
      state.importFile = {
        name: fileName || S.CSV_FILE_NAME,
        headers: parsed.headers,
        rows: parsed.rows,
        mapping,
        dups,
        errors,
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
      state.importFile.errors = detectFormatErrors(state.importFile.rows);
    },
    setDupAction(idx, action) {
      const d = state.importFile.dups.find((x) => x.idx === idx);
      if (d) d.action = action;
    },
    applyImport() {
      const file = state.importFile;
      const created = [];
      const skipErr = new Set((file.errors || []).map((e) => e.idx));
      file.dups.forEach((d) => {
        if (d.action === "skip") return;
        if (skipErr.has(d.idx)) return;
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
        purposes: Object.assign({}, state.requestPurposes),
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
      const ship = state.ddsMode === "ship" ? (state.dispatches[0] || null) : null;
      const doc = {
        id: "DDS-2025-HUILA-00" + (state.ddsDocs.length + 1),
        farmId: f ? f.id : farmId,
        file: "DDS-2025-HUILA-00" + (state.ddsDocs.length + 1) + ".pdf",
        createdAt: "2026-09-17 10:12",
        basis: ship ? ("출하 " + ship.id + " · " + ship.period) : "조사 건"
      };
      state.ddsDocs.push(doc);
      state.selectedDdsId = doc.id;
      return doc;
    },
    generateArr(farmId) {
      const f = api.getFarm(farmId) || state.farms.find((x) => x.status === "ready");
      const doc = {
        id: "ARR-2025-HUILA-00" + (state.arrDocs.length + 1),
        farmId: f ? f.id : farmId,
        file: "ARR-2025-HUILA-00" + (state.arrDocs.length + 1) + ".pdf",
        createdAt: "2026-09-17 10:20",
        note: "보완 2건은 한계로 표시 · 발급은 가능"
      };
      state.arrDocs.push(doc);
      return doc;
    },
    addRosterFarm(data) {
      const farm = api.addFarm({
        name: data.name,
        farmer: data.farmer,
        phone: data.phone || "",
        kg: "",
        coopId: data.coopId || "COOP-001"
      });
      farm.source = "명부";
      farm.surveyStatus = "new";
      farm.assignee = null;
      return farm;
    },
    addDelivery(data) {
      const row = {
        id: "DLV-" + (state.deliveries.length + 1),
        date: data.date || "2026-09-17",
        farm: data.farm,
        kg: data.kg,
        dest: data.dest || "Huila Coffee Processing Center"
      };
      state.deliveries.unshift(row);
      return row;
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
