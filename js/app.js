/**
 * KIJANIFY 프로토타입 시연 화면.
 * 가져오기 → 완성도 → 배정 → 농장/Plot → 고객신청 → DDS 를 메모리 저장소로 돌립니다.
 */
(function () {
  const S = window.KIJANIFY_SAMPLE;
  const Store = window.KIJANIFY_STORE;
  const st = Store.state;
  const selected = new Set(["FARM-ESPERANZA", "FARM-ROBLE", "FARM-MAWA"]);

  function $(id) {
    return document.getElementById(id);
  }
  function qsa(sel, el) {
    return Array.from((el || document).querySelectorAll(sel));
  }
  function escapeHtml(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  function go(id) {
    qsa(".app").forEach((v) => v.classList.toggle("show", v.id === id));
    qsa(".pnav a").forEach((a) => a.classList.toggle("on", a.dataset.go === id));
    history.replaceState(null, "", "#" + id);
    render(id);
  }

  function render(id) {
    const view = id || (location.hash || "#import").slice(1);
    paintAdminNav(view);
    if (view === "import") renderImport();
    if (view === "complete") renderComplete();
    if (view === "assign") renderAssign();
    if (view === "farm") renderFarm();
    if (view === "plot") renderPlot();
    if (view === "request") renderRequest();
    if (view === "dds") renderDds();
    if (view === "dash") renderDash();
    if (view === "masters") renderMasters();
    if (view === "coop") renderCoop();
    if (view === "trace") renderTrace();
    if (view === "carbon") renderCarbon();
    if (view === "factors") renderFactors();
    if (view === "eudr") renderEudr();
    if (view === "users") renderUsers();
    if (view === "notices") renderNotices();
  }

  function exBox(keys, fillLabel, fillFn) {
    const rows = keys.map((k) => {
      const e = S.EXAMPLES[k];
      if (!e) return "";
      return "<div><b>" + escapeHtml(e.label) + "</b> 예: <code>" + escapeHtml(e.example) + "</code> · " + escapeHtml(e.hint) + "</div>";
    }).join("");
    const btn = fillFn
      ? '<button class="btn" type="button" data-exfill="' + fillFn + '">' + (fillLabel || "예시 값 채우기") + "</button>"
      : "";
    return '<div class="exbox"><div class="bar"><b>입력 예시</b>' + btn + "</div>" + rows + "</div>";
  }

  function statusBadge(farm) {
    if (farm.status === "ready") {
      return '<span class="b ok" title="DDS/EUDR 및 탄소 산정에 사용할 수 있습니다">필수정보 입력 완료</span>';
    }
    const gaps = Store.farmGaps(farm);
    if (gaps.some((g) => g.indexOf("농장 경계") >= 0)) {
      return '<span class="b warn">농장 경계 확인 필요</span>';
    }
    if (farm.lastSurvey) return '<span class="b teal">기존 정보 있음</span>';
    return '<span class="b warn">추가 확인 필요</span>';
  }

  function gapChips(farm) {
    const gaps = Store.farmGaps(farm);
    if (!gaps.length) {
      return '<span class="b ok" title="DDS/EUDR 및 탄소 산정에 사용할 수 있습니다">필수정보 입력 완료</span>';
    }
    return gaps.map((g) => '<span class="b gap">' + escapeHtml(g) + "</span>").join(" ");
  }

  function plotCount(farm) {
    const pts = (farm.plots || []).reduce((n, p) => n + (p.points || []).length, 0);
    return (farm.plots || []).length + "개 · 위치 " + pts;
  }

  function sourceLabel(src) {
    const map = {
      "파일": "파일 등록",
      "기존 연결": "기존 정보 연결",
      "이전 조사": "이전 조사",
      "고객신청": "조사 신청",
      "현장신규": "새 농장 등록"
    };
    return map[src] || src;
  }

  /* ---------- 1 외부 데이터 등록 ---------- */
  function renderImport() {
    const file = st.importFile;
    const step = file.step || 1;
    qsa("#imp-steps button").forEach((b) => {
      const n = +b.dataset.step;
      b.classList.toggle("on", n === step);
      b.classList.toggle("done", n < step);
    });
    $("imp-step-1").classList.toggle("hide", step !== 1);
    $("imp-step-2").classList.toggle("hide", step !== 2);
    $("imp-step-3").classList.toggle("hide", step !== 3);
    $("imp-step-4").classList.toggle("hide", step !== 4);

    $("imp-ex").innerHTML = exBox(["coopName", "farmName", "farmerName", "gps", "hsCode", "phone"], "샘플 CSV로 시연", "csv") +
      '<div class="exbox" style="margin-top:8px"><b>CSV 첫 줄 예</b><pre style="margin-top:6px;white-space:pre-wrap;font-size:11px;line-height:1.45">' +
      escapeHtml(S.CSV_TEXT.split("\n").slice(0, 3).join("\n")) +
      "</pre><p class=" + '"hint" style="margin-top:6px">파일 선택 대신 위 버튼으로 Huila 4행을 바로 넣을 수 있습니다.</p></div>';

    if (step === 1) {
      $("imp-filechip").classList.toggle("hide", !file.name);
      $("imp-filechip").textContent = file.name ? file.name + " · " + file.rows.length + "행" : "";
    }

    if (step === 2) {
      const mapped = file.mapping.filter((m) => m.target !== "skip").length;
      $("imp-map-title").innerHTML = "업로드한 파일의 항목을 확인해주세요 <span class=\"b teal\">자동으로 연결됨 " + mapped + "/" + file.mapping.length + "</span>";
      $("imp-map-list").innerHTML = file.mapping.map((m) => {
        const opts = S.COLUMN_TARGETS.map((t) =>
          "<option value=\"" + t.id + "\"" + (m.target === t.id ? " selected" : "") + ">" + t.label + "</option>"
        ).join("");
        const warn = m.target === "skip";
        return '<div class="maprow">' +
          '<div class="l" title="' + escapeHtml(m.header) + '">' + escapeHtml(m.header) + "</div>" +
          "<div>→</div>" +
          '<select class="selx" data-map-header="' + escapeHtml(m.header) + '">' + opts + "</select>" +
          '<div class="conf"><i style="width:' + m.conf + "%;background:" + (warn ? "#f59e0b" : "") + '"></i></div>' +
          "</div>";
      }).join("");

      const previewRows = file.rows.slice(0, 4).map((row) => {
        const farm = Store.mappedValue(row, file.mapping, "farm") || row.Farm || "—";
        const farmer = Store.mappedValue(row, file.mapping, "farmer") || row.Farmer || "—";
        const lat = row.GPS_lat || "";
        const lng = row.GPS_lng || "";
        const gps = lat && lng ? lat + ", " + lng : (lat || lng || "—");
        const phone = Store.mappedValue(row, file.mapping, "contact") || row.Contact || "없음";
        return "<tr><td>" + escapeHtml(farm) + "</td><td>" + escapeHtml(farmer) + "</td><td>" +
          escapeHtml(gps) + "</td><td class=\"hint\">" + escapeHtml(phone || "없음") + "</td></tr>";
      }).join("");
      $("imp-preview-head").textContent = "미리보기 · " + (file.name || "파일 없음");
      $("imp-preview-body").innerHTML = previewRows || "<tr><td colspan=\"4\" class=\"hint\">샘플 CSV를 먼저 불러오세요.</td></tr>";
      const empties = Store.emptyCells(file.rows, file.mapping);
      const dups = file.dups.filter((d) => d.action === "link" || d.action === "review").length;
      $("imp-stats").innerHTML =
        '<span class="b ok">항목 연결 완료 ' + mapped + "개</span>" +
        '<span class="b warn">입력되지 않은 정보 ' + empties + "개</span>" +
        '<span class="b gap">기존 데이터와 유사한 항목 ' + dups + "개</span>";
    }

    if (step === 3) {
      $("imp-dup-body").innerHTML = file.dups.map((d) => {
        const match = d.best.match
          ? escapeHtml(d.best.match.name || d.best.match.id) +
            (d.best.kind === "coop" ? " · 협동조합" : " · 등록된 농장") +
            '<br><span class="hint">' + (d.action === "link" ? "이름 일치" : "담당자 확인") + "</span>"
          : "비슷한 이름 없음";
        return "<tr class=\"" + (d.action === "link" ? "sel" : "") + "\">" +
          "<td>" + escapeHtml(d.farmName) + (d.farmer ? " / " + escapeHtml(d.farmer) : "") + "</td>" +
          "<td>" + match + "</td>" +
          "<td>" + d.best.score + "%</td>" +
          "<td><select class=\"selx\" data-dup-idx=\"" + d.idx + "\">" +
          "<option value=\"link\"" + (d.action === "link" ? " selected" : "") + ">기존 정보에 연결</option>" +
          "<option value=\"new\"" + (d.action === "new" ? " selected" : "") + ">새 정보로 등록</option>" +
          "<option value=\"review\"" + (d.action === "review" ? " selected" : "") + ">담당자 확인</option>" +
          "<option value=\"skip\"" + (d.action === "skip" ? " selected" : "") + ">이번 등록에서 제외</option>" +
          "</select></td></tr>";
      }).join("");
    }

    if (step === 4) {
      $("imp-done-msg").textContent = file.rows.length + "행을 등록했습니다. 입력되지 않은 정보는 누락 현황에서 현장조사로 이어서 채웁니다.";
    }

    const next = $("imp-next");
    const prev = $("imp-prev");
    prev.disabled = step === 1;
    const similarN = file.dups.filter((d) => d.best.score >= 40).length;
    if (step === 1) next.textContent = "다음 · 파일 항목 확인";
    if (step === 2) next.textContent = "다음 · 기존 데이터 " + similarN + "건 확인";
    if (step === 3) next.textContent = "등록하고 누락정보 확인으로 이동";
    if (step === 4) next.textContent = "누락정보 확인으로";
  }

  function loadSampleCsv() {
    Store.loadCsvText(S.CSV_TEXT, S.CSV_FILE_NAME);
    toast("샘플 CSV 4행을 넣었습니다. Huila + Koboko 값입니다.");
    renderImport();
  }

  function onImportNext() {
    const file = st.importFile;
    if ((file.step || 1) === 1 && !file.rows.length) {
      loadSampleCsv();
      return;
    }
    if (file.step === 3) {
      const created = Store.applyImport();
      toast((created.length ? created.length + "개 새 농장 등록. " : "기존 정보에 연결했습니다. ") + "누락정보를 확인하세요.");
      go("complete");
      return;
    }
    if (file.step === 4) {
      go("complete");
      return;
    }
    file.step = Math.min(4, (file.step || 1) + 1);
    renderImport();
  }

  function onImportPrev() {
    st.importFile.step = Math.max(1, (st.importFile.step || 1) - 1);
    renderImport();
  }

  /* ---------- 2 완성도 ---------- */
  function renderComplete() {
    const c = Store.counts();
    $("kpi-all").textContent = c.all;
    $("kpi-ready").textContent = c.ready;
    $("kpi-gap").textContent = c.gap;
    $("kpi-survey").textContent = c.surveying;
    $("complete-ex").innerHTML = exBox(["farmName", "phone", "gps", "kg"]);

    qsa("[data-cfilter]").forEach((b) => {
      b.className = "btn " + (b.dataset.cfilter === st.completeFilter ? "p" : "g");
      const gpsN = st.farms.filter((f) => Store.farmGaps(f).some((g) => g.indexOf("위치정보") >= 0 || g.indexOf("농장 경계") >= 0)).length;
      const phoneN = st.farms.filter((f) => Store.farmGaps(f).includes("생산자 연락처 없음")).length;
      if (b.dataset.cfilter === "gap") b.textContent = "추가정보 필요 " + c.gap;
      if (b.dataset.cfilter === "gps") b.textContent = "위치정보 없음 " + gpsN;
      if (b.dataset.cfilter === "phone") b.textContent = "생산자 연락처 없음 " + phoneN;
      if (b.dataset.cfilter === "ready") b.textContent = "필수정보 입력 완료 " + c.ready;
    });

    $("complete-search").value = st.completeQuery;
    $("complete-selected").textContent = selected.size + "건 선택됨";
    $("complete-assign").textContent = "선택한 " + selected.size + "건을 조사원에게 배정";

    const rows = Store.filteredFarms();
    $("complete-tbody").innerHTML = rows.map((f) => {
      const pct = Store.completeness(f);
      const bar = pct >= 100 ? "#009588" : "#d97706";
      const checked = selected.has(f.id) ? " checked" : "";
      const next = f.status === "ready"
        ? '<span class="hint">—</span>'
        : (f.lastSurvey
          ? '<a href="#farm" data-farm="' + f.id + '">기존 농장정보 확인</a>'
          : '<a href="#assign" data-farm="' + f.id + '">조사원에게 배정</a>');
      return '<tr class="clickable" data-farm="' + f.id + '">' +
        '<td><input type="checkbox" data-sel="' + f.id + '"' + checked + "></td>" +
        "<td><b>" + escapeHtml(f.name) + "</b><div class=\"hint\">" +
        escapeHtml(f.farmer) + " · " + escapeHtml(f.coopId) + " · 농장 구역 " + plotCount(f) + "</div></td>" +
        '<td><span class="b grey">' + escapeHtml(sourceLabel(f.source)) + "</span></td>" +
        '<td><div class="prog" title="정보 입력률 ' + pct + '%"><i style="width:' + pct + "%;background:" + bar + '"></i></div></td>' +
        "<td>" + gapChips(f) + "</td>" +
        "<td>" + next + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="hint">조건에 맞는 농장이 없습니다.</td></tr>';
  }

  /* ---------- 3 배정 ---------- */
  function kanbanCard(f, on) {
    const sv = f.assignee ? Store.surveyorName(f.assignee) : "배정 전";
    return '<button class="scard' + (on ? " on" : "") + '" type="button" data-open-assign="' + f.id + '">' +
      '<div class="t">' + escapeHtml(f.name) + "</div>" +
      '<div class="m">' + escapeHtml(sv) + " · " + escapeHtml(f.site || sourceLabel(f.source)) + "</div>" +
      '<div class="gaps">' + gapChips(f) + "</div></button>";
  }

  function renderAssign() {
    $("assign-ex").innerHTML = exBox(["farmName", "phone"]);
    const groups = {
      new: Store.bySurveyStatus("new"),
      assigned: Store.bySurveyStatus("assigned"),
      progress: Store.bySurveyStatus("in_progress"),
      review: st.farms.filter((f) => f.surveyStatus === "review" || f.surveyStatus === "ready")
    };
    $("k-new-n").textContent = groups.new.length;
    $("k-as-n").textContent = groups.assigned.length;
    $("k-pr-n").textContent = groups.progress.length;
    $("k-rv-n").textContent = groups.review.length;
    $("k-new").innerHTML = groups.new.map((f) => kanbanCard(f, f.id === st.selectedFarmId)).join("") || '<p class="hint">대기 없음</p>';
    $("k-as").innerHTML = groups.assigned.map((f) => kanbanCard(f, false)).join("");
    $("k-pr").innerHTML = groups.progress.map((f) => kanbanCard(f, false)).join("");
    $("k-rv").innerHTML = groups.review.map((f) => {
      const extra = f.status === "ready"
        ? '<a class="scard" href="#dds"><div class="t">' + escapeHtml(f.name) + '</div><div class="m">추가 조사 없이 생성 가능</div><div class="gaps"><span class="b ok" title="DDS/EUDR 및 탄소 산정에 사용할 수 있습니다">필수정보 입력 완료</span></div></a>'
        : kanbanCard(f, false);
      return extra;
    }).join("");
    renderAssignDrawer();
  }

  function renderAssignDrawer() {
    const f = Store.getFarm(st.selectedFarmId);
    if (!f) return;
    $("ad-title").textContent = "현장조사 배정";
    $("ad-meta").innerHTML = "대상 <b>" + escapeHtml(f.name) + "</b> · " + escapeHtml(f.coopId) + " " + escapeHtml(f.site || "") + " · 출처 " + escapeHtml(f.source);
    $("ad-gaps").innerHTML = gapChips(f) + ' <span class="b grey">올해 생산량 · 선택 입력</span>';
    $("ad-surveyors").innerHTML = st.master.surveyors.map((sv) => {
      const on = sv.id === st.selectedSurveyorId ? " on" : "";
      const checked = sv.id === st.selectedSurveyorId ? " checked" : "";
      const load = sv.load > 0 ? "현재 조사 " + sv.load + "건 진행 중" : "현재 배정 가능";
      return '<label class="choice' + on + '"><input type="radio" name="sv" value="' + sv.id + '"' + checked + "> " +
        escapeHtml(sv.name) + ' <span class="hint">' + escapeHtml(sv.region) + " · " + load + "</span></label>";
    }).join("");
  }

  function openAssign(id) {
    st.selectedFarmId = id;
    $("assign-drawer").classList.add("show");
    renderAssignDrawer();
  }
  function closeAssign() {
    $("assign-drawer").classList.remove("show");
  }
  function doAssign() {
    const f = Store.assignFarm(st.selectedFarmId, st.selectedSurveyorId);
    closeAssign();
    toast(Store.surveyorName(st.selectedSurveyorId) + "에게 배정했습니다. 배정된 조사에 확인할 정보가 표시됩니다.");
    renderAssign();
    setTimeout(() => go("farm"), 700);
    return f;
  }

  /* ---------- 4 농장 ---------- */
  function renderFarm() {
    $("farm-ex").innerHTML = exBox(["farmName", "farmerName", "phone"], "새 농장 예시 채우기", "newfarm");
    const exist = st.farmMode === "exist";
    qsa("#farm-seg button").forEach((b) => b.classList.toggle("on", b.dataset.mode === st.farmMode));
    $("farm-exist").classList.toggle("hide", !exist);
    $("farm-new").classList.toggle("hide", exist);
    $("farm-search").value = st.farmQuery;
    const q = st.farmQuery.trim().toLowerCase();
    const list = st.farms.filter((f) => {
      if (!q) return true;
      return [f.name, f.farmer, f.site, f.coopId].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    $("farm-list").innerHTML = list.map((f) => {
      const sel = f.id === st.selectedFarmId ? " sel" : "";
      return '<button class="li' + sel + '" type="button" data-pick-farm="' + f.id + '">' +
        '<div class="bar"><b>' + escapeHtml(f.name) + "</b>" + statusBadge(f) + "</div>" +
        '<div class="hint">' + escapeHtml(f.farmer) + " · " + escapeHtml(f.site || "") +
        (f.lastSurvey ? " · 이전 조사 " + f.lastSurvey : " · 이전 조사 기록 없음") + "</div>" +
        '<div class="gaps" style="margin-top:6px">' + gapChips(f) + "</div></button>";
    }).join("") || '<p class="hint">검색 결과가 없습니다. 새 농장 등록에서 추가하세요.</p>';
  }

  function fillNewFarm() {
    $("nf-name").value = S.SAMPLE_NEW_FARM.name;
    $("nf-farmer").value = S.SAMPLE_NEW_FARM.farmer;
    $("nf-phone").value = S.SAMPLE_NEW_FARM.phone;
    $("nf-kg").value = S.SAMPLE_NEW_FARM.kg;
    toast("새 농장 예시를 넣었습니다. Finca Los Andes / Andres Ruiz.");
  }

  function goSurveyFromFarm() {
    if (st.farmMode === "new") {
      const name = $("nf-name").value.trim();
      const farmer = $("nf-farmer").value.trim();
      if (!name || !farmer) {
        toast("농장명과 생산자를 입력하세요. 예시 버튼을 쓸 수 있습니다.");
        return;
      }
      Store.addFarm({
        name,
        farmer,
        phone: $("nf-phone").value.trim(),
        kg: $("nf-kg").value.trim()
      });
      toast("등록한 농장은 저장되며 다음 조사부터 다시 선택할 수 있습니다.");
    }
    go("plot");
  }

  /* ---------- 5 Plot ---------- */
  function renderPlot() {
    const f = Store.getFarm(st.selectedFarmId) || st.farms[0];
    if (!f) return;
    st.selectedFarmId = f.id;
    $("plot-ex").innerHTML = exBox(["harvestYear", "kg", "gps"], "수확·위치 예시 채우기", "plot");
    $("plot-title").textContent = f.name;
    $("plot-gap").innerHTML = gapChips(f);
    $("plot-farm-ro").value = f.name + " · " + f.farmer;
    $("plot-year").value = f.harvestYear || "2025";
    $("plot-kg").value = f.kg || "";
    $("plot-kg").placeholder = "예: 1250";
    $("plots").innerHTML = (f.plots.length ? f.plots : [{ id: "P1", points: [] }]).map((p, i) => {
      const n = (p.points || []).length;
      const badge = n >= 3
        ? '<span class="b ok">경계 위치 ' + n + "/3개 등록</span>"
        : '<span class="b warn">경계 위치 ' + n + "/3개 등록</span>";
      const pts = (p.points || []).map((pt, j) => {
        const left = 18 + (j * 22) % 60;
        const top = 28 + (j * 18) % 40;
        return '<i class="pt" style="left:' + left + "%;top:" + top + '%"></i>';
      }).join("");
      return '<article class="card plot" style="padding:10px;margin-bottom:8px" data-plot="' + i + '">' +
        '<div class="bar"><b>농장 구역 ' + (i + 1) + "</b>" + badge + "</div>" +
        '<div class="mapbox" style="margin:8px 0">' + (n >= 3 ? '<div class="poly"></div>' : "") + pts + "</div>" +
        '<p class="hint">농장 경계는 위치 3개부터 확인할 수 있습니다. 예: 2.9273, -75.2819</p>' +
        '<div class="bar" style="margin-top:6px">' +
        '<button class="btn" type="button" data-add-pt="' + i + '">현재 위치 추가 (예시)</button>' +
        '<button class="btn g" type="button" data-photo="' + i + '">토지 증빙사진 촬영</button></div></article>';
    }).join("");
  }

  function fillPlotSample() {
    const f = Store.getFarm(st.selectedFarmId);
    if (!f) return;
    f.harvestYear = 2025;
    f.kg = S.EXAMPLES.kg.example;
    if (!f.plots.length) f.plots.push({ id: "P1", points: [] });
    S.SAMPLE_GPS_POINTS.forEach((pt) => {
      if (f.plots[0].points.length < 3) f.plots[0].points.push(pt);
    });
    if (!f.phone) f.phone = S.EXAMPLES.phone.example;
    Store.refreshStatus(f);
    toast("수확량 1250kg, Huila 위치 3곳을 넣었습니다.");
    renderPlot();
  }

  function addPoint(plotIdx) {
    const f = Store.getFarm(st.selectedFarmId);
    if (!f) return;
    if (!f.plots[plotIdx]) f.plots[plotIdx] = { id: "P" + (plotIdx + 1), points: [] };
    const used = f.plots[plotIdx].points.length;
    const sample = S.SAMPLE_GPS_POINTS[used % S.SAMPLE_GPS_POINTS.length];
    const jitter = used * 0.0004;
    f.plots[plotIdx].points.push({ lat: +(sample.lat + jitter).toFixed(4), lng: +(sample.lng - jitter).toFixed(4) });
    Store.refreshStatus(f);
    toast("경계 위치 " + f.plots[plotIdx].points.length + "/3개 · " + sample.lat + ", " + sample.lng);
    renderPlot();
  }

  function savePlot() {
    const f = Store.saveSurvey(st.selectedFarmId, {
      harvestYear: $("plot-year").value,
      kg: $("plot-kg").value
    });
    if (!f) return;
    toast("조사를 제출했습니다. " + (f.status === "ready" ? "필수정보가 입력 완료되었습니다." : "관리자 검수를 기다립니다."));
    setTimeout(() => go("dds"), 800);
  }

  /* ---------- 6 고객 신청 ---------- */
  function fillRequest() {
    $("req-year").value = S.SAMPLE_REQUEST.harvestYear;
    $("req-hs").value = S.SAMPLE_REQUEST.hsCode;
    $("req-name").value = S.SAMPLE_REQUEST.tradeName;
    $("req-country").value = S.SAMPLE_REQUEST.country;
    $("req-site").value = S.SAMPLE_REQUEST.site;
    toast("Huila 커피 신청 예시를 넣었습니다. HS 090111.");
    renderRequest();
  }

  function renderRequest() {
    if (!$("req-year").value) {
      $("req-year").value = S.SAMPLE_REQUEST.harvestYear;
      $("req-hs").value = S.SAMPLE_REQUEST.hsCode;
      $("req-name").value = S.SAMPLE_REQUEST.tradeName;
      $("req-country").value = S.SAMPLE_REQUEST.country;
      $("req-site").value = S.SAMPLE_REQUEST.site;
    }
    $("req-ex").innerHTML = exBox(["harvestYear", "hsCode", "tradeName", "country", "site"], "신청 예시 채우기", "request");
    const coopFarms = st.farms.filter((f) => f.coopId === "COOP-001");
    const gapN = coopFarms.filter((f) => f.status === "gap").length;
    $("req-chain").innerHTML =
      '<div class="node on"><b>협동조합</b><span>' + escapeHtml(st.master.coops[0].name) + "</span></div>" +
      '<div class="arr">↓</div>' +
      '<div class="node"><b>연결된 농장 · ' + coopFarms.length + "곳</b><span>" +
      escapeHtml(coopFarms.slice(0, 2).map((f) => f.name.replace("Finca ", "")).join(" · ")) + "</span></div>" +
      '<div class="arr">↓</div>' +
      '<div class="node"><b>가공시설</b><span>' + escapeHtml(st.master.facilities[0].name) + "</span></div>" +
      '<div class="arr">↓</div>' +
      '<div class="node"><b>수출업체</b><span>' + escapeHtml(st.master.exporters[0].name) + "</span></div>";
    $("req-gaps").innerHTML = '<span class="b warn">추가 확인 필요 · ' + gapN + '건</span><span class="b ok">중복 데이터 없음</span>';
  }

  function submitRequest() {
    if (!$("req-year").value || !$("req-hs").value || !$("req-name").value) {
      toast("수확연도, HS 코드, 상품명은 필수입니다. 예시 버튼을 쓰세요.");
      return;
    }
    Store.submitRequest({
      harvestYear: $("req-year").value,
      hsCode: $("req-hs").value,
      tradeName: $("req-name").value,
      country: $("req-country").value,
      site: $("req-site").value
    });
    toast("조사 신청이 등록되었습니다. 추가 확인이 필요한 건은 배정 대기로 이동합니다.");
    setTimeout(() => go("assign"), 800);
  }

  /* ---------- 7 DDS ---------- */
  function renderDds() {
    $("dds-ex").innerHTML = exBox(["coopName", "hsCode", "gps"]);
    const unique = st.farms.filter((f) => f.status === "ready" && (f.surveyStatus === "ready" || f.surveyStatus === "review"));
    if (!st.selectedDdsId || !unique.some((f) => f.id === st.selectedDdsId)) {
      st.selectedDdsId = unique[0] ? unique[0].id : "FARM-LALITPUR";
    }
    $("dds-list").innerHTML = unique.map((f) => {
      const sel = f.id === st.selectedDdsId ? " sel" : "";
      return '<button class="li' + sel + '" type="button" data-dds="' + f.id + '"><b>' +
        escapeHtml(f.name) + '</b><div class="hint">' + escapeHtml(String(f.harvestYear || "")) +
        " · " + (f.status === "ready" ? "추가 조사 없이 생성 가능" : "관리자 검수 대기") + "</div></button>";
    }).join("");

    const f = Store.getFarm(st.selectedDdsId);
    const coop = st.master.coops[0];
    const fac = st.master.facilities[0];
    const exp = st.master.exporters[0];
    const pts = f ? (f.plots || []).reduce((n, p) => n + (p.points || []).length, 0) : 0;
    const gpsOk = pts >= 3 || (f && f.status === "ready");
    $("dds-entities").innerHTML =
      '<div class="entity ok col"><div class="src">생산자 정보 · 기존 데이터에서 불러옴</div><b>' + escapeHtml(coop.name) +
      "</b><p class=\"hint\">" + escapeHtml(coop.address) + "<br>" + escapeHtml(coop.phone) +
      '</p><span class="b ok">기존 정보 사용</span></div>' +
      '<div class="entity ok col"><div class="src">가공시설 정보 · 기존 데이터에서 불러옴</div><b>' + escapeHtml(fac.name) +
      "</b><p class=\"hint\">" + escapeHtml(fac.gps) + "<br>" + escapeHtml(fac.phone) +
      '</p><span class="b ok">기존 정보 사용</span></div>' +
      '<div class="entity ok col"><div class="src">수출업체 정보 · 기존 데이터에서 불러옴</div><b>' + escapeHtml(exp.name) +
      "</b><p class=\"hint\">" + escapeHtml(exp.address) + "<br>" + escapeHtml(exp.phone) +
      '</p><span class="b ok">기존 정보 사용</span></div>';
    $("dds-check").innerHTML =
      "<tr><td>거래 유형</td><td>수입 / 수출</td><td><span class=\"b ok\">자동 확인됨</span></td></tr>" +
      "<tr><td>생산국 위험등급</td><td>CO Standard</td><td><span class=\"b ok\">자동 확인됨</span></td></tr>" +
      "<tr><td>농장 위치정보</td><td>" + (f ? escapeHtml(f.name) : "—") + " · 위치 " + pts + "개" +
      "</td><td>" + (gpsOk ? '<span class="b ok">확인 완료</span>' : '<span class="b warn">위치 3개 필요</span>') + "</td></tr>" +
      "<tr><td>농장 증빙자료</td><td>" + (f && f.evidence ? "농장 단위 첨부" : "현장에서 촬영 후 첨부") +
      "</td><td>" + (f && f.evidence ? '<span class="b ok">첨부됨</span>' : '<span class="b warn">선택</span>') + "</td></tr>";
    $("dds-gen").disabled = !gpsOk;
    const last = st.ddsDocs[st.ddsDocs.length - 1];
    $("dds-idle").classList.toggle("hide", !!last && last.farmId === st.selectedDdsId);
    $("dds-done").classList.toggle("hide", !(last && last.farmId === st.selectedDdsId));
    if (last) {
      $("dds-file").textContent = last.file;
      $("dds-when").textContent = last.createdAt + " · 이 문서는 생성 당시의 정보를 기준으로 저장됩니다. 이후 농장정보가 변경되어도 현재 문서의 내용은 유지됩니다.";
    }
  }

  function genDDS() {
    const doc = Store.generateDds(st.selectedDdsId);
    toast(doc.file + " 문서를 생성했습니다.");
    renderDds();
  }

  const ADMIN_NAV = [
    { h: "업무", items: [
      ["dash", "운영 현황"],
      ["import", "외부 데이터 등록"],
      ["complete", "정보 누락 관리"],
      ["assign", "현장조사 관리"],
      ["dds", "DDS/EUDR 문서"],
      ["eudr", "EUDR 증빙·보관"]
    ]},
    { h: "기준정보", items: [
      ["masters", "생산자·농가"],
      ["coop", "협동조합"],
      ["trace", "공급망 이력"]
    ]},
    { h: "탄소", items: [
      ["carbon", "탄소 산정"],
      ["factors", "배출계수"]
    ]},
    { h: "관리", items: [
      ["users", "사용자·권한"],
      ["notices", "공지"]
    ]}
  ];

  function paintAdminNav(active) {
    qsa(".app.admin aside nav").forEach((nav) => {
      const sid = nav.closest(".app").id;
      const cur = active || sid;
      nav.innerHTML = ADMIN_NAV.map((g) =>
        "<p>" + g.h + "</p>" + g.items.map((it) => {
          const on = it[0] === cur ? ' class="on"' : "";
          return '<a href="#' + it[0] + '"' + on + ">" + it[1] + "</a>";
        }).join("")
      ).join("");
    });
  }

  /* ---------- 8 운영 현황 ---------- */
  function renderDash() {
    const c = Store.counts();
    const review = st.farms.filter((f) => f.surveyStatus === "review");
    const ready = st.farms.filter((f) => f.status === "ready");
    $("dash-kpi").innerHTML =
      '<div class="card"><span>전체 농가</span><b>' + c.all + "</b></div>" +
      '<div class="card hot"><span>추가정보 필요</span><b style="color:#b45309">' + c.gap + "</b></div>" +
      '<div class="card"><span>현장조사 진행 중</span><b>' + c.surveying + "</b></div>" +
      '<div class="card"><span>DDS/EUDR에 사용 가능</span><b style="color:#166534">' + c.ready + "</b></div>";
    const todos = [];
    if (c.gap) todos.push('<a class="li" href="#complete"><b>추가로 필요한 정보 ' + c.gap + "건</b><div class=\"hint\">빈 위치·연락처를 확인하고 조사원에게 배정합니다.</div></a>");
    if (Store.bySurveyStatus("new").length) {
      todos.push('<a class="li" href="#assign"><b>배정 대기 ' + Store.bySurveyStatus("new").length + "건</b><div class=\"hint\">조사원을 고르고 현장조사를 보냅니다.</div></a>");
    }
    review.forEach((f) => {
      todos.push('<div class="li"><div class="bar"><b>' + escapeHtml(f.name) + ' · 검수 대기</b><button class="btn p" type="button" data-approve="' + f.id + '">검수 완료</button></div><div class="hint">위치·생산량을 확인하고 필수정보 입력 완료로 올립니다.</div></div>');
    });
    if (!todos.length) todos.push('<p class="hint">지금 처리할 일이 없습니다. 파일 등록부터 시작해 보세요.</p>');
    $("dash-todo").innerHTML = todos.join("");
    $("dash-reg").textContent = "필수정보가 입력 완료된 농가만 DDS 문서와 탄소 산정에 넣습니다.";
    $("dash-ready").innerHTML = ready.map((f) =>
      '<a class="li" href="#dds" data-farm="' + f.id + '"><b>' + escapeHtml(f.name) + "</b><div class=\"hint\">DDS 문서 만들기</div></a>"
    ).join("") || '<p class="hint">아직 사용 가능한 농가가 없습니다.</p>';
  }

  /* ---------- 9 생산자·농가 ---------- */
  function renderMasters() {
    $("master-ex").innerHTML = exBox(["farmName", "farmerName", "phone", "gps"]);
    const q = ($("master-search").value || "").trim().toLowerCase();
    const rows = st.farms.filter((f) => {
      if (!q) return true;
      return [f.name, f.farmer, f.coopId, f.site].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    $("master-tbody").innerHTML = rows.map((f) => {
      const pts = (f.plots || []).reduce((n, p) => n + (p.points || []).length, 0);
      return "<tr><td><b>" + escapeHtml(f.name) + "</b></td><td>" + escapeHtml(f.farmer) + "</td><td>" +
        escapeHtml(f.coopId) + "</td><td>" + (pts ? "위치 " + pts + "개" : "없음") + "</td><td>" +
        statusBadge(f) + "</td><td><a href=\"#plot\" data-farm=\"" + f.id + "\">위치 확인</a></td></tr>";
    }).join("");
  }

  /* ---------- 10 협동조합 ---------- */
  function renderCoop() {
    $("coop-ex").innerHTML = exBox(["coopName", "phone"]);
    const coop = st.master.coops[0];
    const farms = st.farms.filter((f) => f.coopId === coop.id);
    $("coop-card").innerHTML =
      "<h3>" + escapeHtml(coop.name) + "</h3>" +
      '<p class="hint">' + escapeHtml(coop.address) + "<br>" + escapeHtml(coop.phone) + "</p>" +
      '<div class="keep" style="margin-top:10px"><label class="f">조합 코드</label>' +
      '<input class="in ro" value="미정 · 코드 체계 협의 후 입력" readonly>' +
      '<p class="hint" style="margin-top:6px">KPI용 코드가 정해지면 이 칸에 들어갑니다. 지금은 이름으로 연결합니다.</p></div>' +
      '<div class="grid2" style="margin-top:10px"><div><span class="hint">조합원</span><b>' +
      (coop.membersM + coop.membersF) + '명</b></div><div><span class="hint">연결된 농가</span><b>' +
      farms.length + "곳</b></div></div>";
    $("coop-farms").innerHTML = farms.map((f) =>
      '<button class="li" type="button" data-pick-farm="' + f.id + '"><div class="bar"><b>' +
      escapeHtml(f.name) + "</b>" + statusBadge(f) + "</div><div class=\"hint\">" +
      escapeHtml(f.farmer) + "</div></button>"
    ).join("");
  }

  /* ---------- 11 공급망 이력 ---------- */
  function renderTrace() {
    const coop = st.master.coops[0];
    $("trace-chain").innerHTML =
      '<div class="chain">' +
      '<div class="node on"><b>협동조합</b><span>' + escapeHtml(coop.name) + "</span></div>" +
      '<div class="arr">→</div>' +
      '<div class="node"><b>생산자·농가</b><span>Esperanza · El Roble</span></div>' +
      '<div class="arr">→</div>' +
      '<div class="node"><b>가공시설</b><span>' + escapeHtml(st.master.facilities[0].name) + "</span></div>" +
      '<div class="arr">→</div>' +
      '<div class="node"><b>수출업체</b><span>' + escapeHtml(st.master.exporters[0].name) + "</span></div></div>";
    $("trace-tl").innerHTML = S.TRACE_EVENTS.map((e) =>
      '<div class="ev"><b>' + escapeHtml(e.stage) + "</b> · " + escapeHtml(e.date) +
      '<div class="hint">' + escapeHtml(e.actor) + " · " + escapeHtml(e.detail) + "</div></div>"
    ).join("");
  }

  /* ---------- 12 탄소 ---------- */
  function renderCarbon() {
    $("carbon-ex").innerHTML = exBox(["kwh", "wastewater", "diesel", "kg"], "Huila 예시 값으로 보기", "carbon");
    const r = Store.carbonResult();
    const inp = st.carbonInput;
    $("carbon-kpi").innerHTML =
      '<div class="card"><span>생산</span><b>' + r.prod + '</b><span>tCO₂e</span></div>' +
      '<div class="card"><span>가공</span><b>' + r.proc + '</b><span>tCO₂e · 전력</span></div>' +
      '<div class="card"><span>운송</span><b>' + r.trans + '</b><span>tCO₂e · 경유</span></div>' +
      '<div class="card" style="outline:2px solid var(--teal)"><span>합계 (시연)</span><b style="color:var(--teal-d)">' + r.total + "</b><span>tCO₂e</span></div>";
    $("carbon-act").innerHTML =
      "<tr><td>생산량</td><td>조사 결과</td><td>" + inp.harvestKg + " kg</td></tr>" +
      "<tr><td>가공 전력</td><td>공급망 · " + escapeHtml(inp.kwhHow) + "</td><td>" + Number(inp.kwh).toLocaleString() + " kWh</td></tr>" +
      "<tr><td>폐수량</td><td>" + escapeHtml(inp.wastewaterHow) + "</td><td>" + Number(inp.wastewaterL).toLocaleString() + " L</td></tr>" +
      "<tr><td>운송 경유</td><td>" + escapeHtml(inp.route) + " · " + inp.distanceKm + " km</td><td>" + inp.dieselL + " L</td></tr>";
    $("carbon-ef").innerHTML =
      "<p><b>" + escapeHtml(r.elec.name) + "</b><br><span class=\"hint\">" + r.elec.value + " " + r.elec.unit + " · 버전 " + r.elec.version + "</span></p>" +
      "<p style=\"margin-top:8px\"><b>" + escapeHtml(r.dsl.name) + "</b><br><span class=\"hint\">" + r.dsl.value + " " + r.dsl.unit + " · 버전 " + r.dsl.version + "</span></p>";
  }

  function fillCarbon() {
    st.carbonInput = JSON.parse(JSON.stringify(S.CARBON_SAMPLE));
    toast("Huila 예시: 전력 13,200 kWh, 폐수 1,440,000 L, 경유 180 L.");
    renderCarbon();
  }

  /* ---------- 13 배출계수 ---------- */
  function renderFactors() {
    $("factor-ex").innerHTML = exBox(["factorElec"]);
    $("factor-tbody").innerHTML = st.factors.map((f) => {
      const cur = f.current ? '<span class="b teal">현재 사용</span>' : '<span class="b grey">이전 버전</span>';
      const act = f.current ? "—" : '<button class="btn" type="button" data-ef="' + f.id + '">이 버전 사용</button>';
      return "<tr class=\"" + (f.current ? "sel" : "") + "\"><td>" + escapeHtml(f.name) + "</td><td>" +
        f.value + "</td><td>" + escapeHtml(f.unit) + "</td><td>" + f.version + "</td><td>" + cur + "</td><td>" + act + "</td></tr>";
    }).join("");
  }

  /* ---------- 14 EUDR 증빙 ---------- */
  function renderEudr() {
    $("eudr-ex").innerHTML = exBox(["gps", "farmName"]);
    const e = st.eudr;
    $("eudr-kpi").innerHTML =
      '<div class="card"><span>위성 분석일 (예시)</span><b style="font-size:16px">' + e.satelliteDate + "</b></div>" +
      '<div class="card"><span>분석 결과 (예시)</span><b style="font-size:16px">' + escapeHtml(e.satelliteResult) + "</b></div>" +
      '<div class="card"><span>현장 증빙</span><b>' + e.photos + "</b><span>장</span></div>" +
      '<div class="card"><span>보관 기한</span><b style="font-size:16px">' + e.keepUntil + "</b><span>생성일로부터 5년</span></div>";
    $("eudr-sat").innerHTML =
      "<h3>위치 기반 분석 결과</h3>" +
      '<p class="hint">' + escapeHtml(e.satelliteSrc) + "</p>" +
      '<div class="mapbox" style="margin:10px 0"><div class="poly"></div></div>' +
      '<span class="b ok">' + escapeHtml(e.satelliteResult) + "</span>" +
      '<p class="hint" style="margin-top:8px">' + escapeHtml(e.note) + "</p>";
    $("eudr-keep").innerHTML =
      '<div class="keep"><b>보관 상자</b><p class="hint">문서 생성 당시 위치·증빙·분석 결과가 묶여 2031-09-17까지 유지됩니다. 농장 기본정보를 고쳐도 이 묶음은 바뀌지 않습니다.</p>' +
      "<p>증빙사진 " + e.photos + "장 · DDS 문서 " + Math.max(1, st.ddsDocs.length) + "건</p></div>";
  }

  /* ---------- 15 사용자·권한 ---------- */
  function renderUsers() {
    $("user-ex").innerHTML = exBox(["coopName", "farmerName"]);
    const cur = st.viewAsUserId;
    $("user-list").innerHTML = st.users.map((u) => {
      const on = u.id === cur ? " sel" : "";
      return '<button class="li' + on + '" type="button" data-user="' + u.id + '">' +
        '<div class="bar"><b>' + escapeHtml(u.name) + "</b><span class=\"b teal\">" + escapeHtml(u.role) + "</span></div>" +
        '<div class="hint">' + escapeHtml(u.email) + "<br>" + escapeHtml(u.company) + "</div>" +
        '<div class="hint" style="margin-top:4px">' + escapeHtml(u.sees) + "</div></button>";
    }).join("");
    const pack = Store.visibleFarmsForUser(cur);
    $("user-scope").textContent = pack.user.name + " · " + pack.user.sees + " · 보이는 농가 " + pack.visible.length + "곳";
    const vis = pack.visible.map((f) =>
      '<div class="li" style="cursor:default"><div class="bar"><b>' + escapeHtml(f.name) + "</b>" + statusBadge(f) + "</div>" +
      '<div class="hint">' + escapeHtml(f.farmer) + " · " + escapeHtml(f.coopId) + " · 이 계정에 보임</div></div>"
    ).join("");
    const hid = pack.hidden.map((f) =>
      '<div class="li dim"><div class="bar"><b>' + escapeHtml(f.name) + '</b><span class="b grey">다른 회사 · 보이지 않음</span></div>' +
      '<div class="hint">' + escapeHtml(f.coopId) + " · 화면에는 빈 자리만 남습니다</div></div>"
    ).join("");
    $("user-preview").innerHTML = vis + (hid ? '<p class="hint" style="margin:12px 0 8px">아래로 가려진 데이터 (시연용 표시)</p>' + hid : "");
  }

  /* ---------- 16 공지 ---------- */
  function renderNotices() {
    $("ntc-ex").innerHTML = exBox(["noticeTitle"], "작성 예시 채우기", "notice");
    $("ntc-list").innerHTML = st.notices.map((n) => {
      const on = n.id === st.selectedNoticeId ? " sel" : "";
      return '<button class="li' + on + '" type="button" data-notice="' + n.id + '">' +
        '<div class="bar"><b>' + escapeHtml(n.title) + '</b><span class="b grey">' + escapeHtml(n.audience) + "</span></div>" +
        '<div class="hint">' + n.date + " · " + escapeHtml(n.body) + "</div></button>";
    }).join("");
    const sel = st.notices.find((n) => n.id === st.selectedNoticeId);
    $("ntc-preview").innerHTML = sel
      ? '<div class="keep"><b>미리보기</b><p class="hint">' + escapeHtml(sel.audience) + "에게 " + sel.date + "</p><p>" + escapeHtml(sel.body) + "</p></div>"
      : "";
  }

  function fillNotice() {
    $("ntc-title").value = S.NOTICE_SAMPLE.title;
    $("ntc-audience").value = S.NOTICE_SAMPLE.audience;
    $("ntc-body").value = S.NOTICE_SAMPLE.body;
    toast("조사원 대상 공지 예시를 넣었습니다.");
  }

  function postNotice() {
    const title = $("ntc-title").value.trim();
    const body = $("ntc-body").value.trim();
    if (!title || !body) {
      toast("제목과 내용을 입력하세요. 예시 버튼을 쓸 수 있습니다.");
      return;
    }
    Store.postNotice({
      title,
      audience: $("ntc-audience").value,
      body
    });
    $("ntc-title").value = "";
    $("ntc-body").value = "";
    toast("공지를 게시했습니다. 실제 알림 발송은 이 프로토타입에 없습니다.");
    renderNotices();
  }

  /* ---------- 이벤트 ---------- */
  function bind() {
    qsa(".pnav a").forEach((a) => a.addEventListener("click", (e) => {
      e.preventDefault();
      go(a.dataset.go);
    }));
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute("href").slice(1);
      if ($(id)) {
        e.preventDefault();
        const farm = a.dataset.farm;
        if (farm) st.selectedFarmId = farm;
        go(id);
      }
    });
    window.addEventListener("hashchange", () => {
      const id = location.hash.slice(1);
      if ($(id)) go(id);
    });

    $("imp-steps").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-step]");
      if (!b) return;
      const n = +b.dataset.step;
      if (n > 1 && !st.importFile.rows.length) loadSampleCsv();
      st.importFile.step = n;
      renderImport();
    });
    $("imp-next").addEventListener("click", onImportNext);
    $("imp-prev").addEventListener("click", onImportPrev);
    $("imp-sample").addEventListener("click", loadSampleCsv);
    $("imp-file").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        Store.loadCsvText(String(reader.result), file.name);
        toast(file.name + " 을 읽었습니다.");
        renderImport();
      };
      reader.readAsText(file);
    });
    $("imp-drop").addEventListener("dragover", (e) => { e.preventDefault(); });
    $("imp-drop").addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        Store.loadCsvText(String(reader.result), file.name);
        toast(file.name + " 을 읽었습니다.");
        renderImport();
      };
      reader.readAsText(file);
    });
    $("imp-map-list").addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-map-header]");
      if (!sel) return;
      Store.setMapping(sel.dataset.mapHeader, sel.value);
      renderImport();
    });
    $("imp-dup-body").addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-dup-idx]");
      if (!sel) return;
      Store.setDupAction(+sel.dataset.dupIdx, sel.value);
      renderImport();
    });

    $("complete-search").addEventListener("input", (e) => {
      st.completeQuery = e.target.value;
      renderComplete();
    });
    $("complete-filters").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cfilter]");
      if (!b) return;
      st.completeFilter = b.dataset.cfilter;
      renderComplete();
    });
    $("complete-tbody").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-sel]");
      if (!cb) return;
      if (cb.checked) selected.add(cb.dataset.sel);
      else selected.delete(cb.dataset.sel);
      $("complete-selected").textContent = selected.size + "건 선택됨";
      $("complete-assign").textContent = "선택한 " + selected.size + "건을 조사원에게 배정";
    });
    $("complete-assign").addEventListener("click", (e) => {
      e.preventDefault();
      const first = Array.from(selected)[0] || "FARM-ESPERANZA";
      st.selectedFarmId = first;
      go("assign");
      openAssign(first);
    });

    $("k-new").addEventListener("click", onKanban);
    $("k-as").addEventListener("click", onKanban);
    $("k-pr").addEventListener("click", onKanban);
    $("k-rv").addEventListener("click", onKanban);
    $("assign-drawer").addEventListener("click", (e) => {
      if (e.target.id === "assign-drawer") closeAssign();
    });
    $("ad-close").addEventListener("click", closeAssign);
    $("ad-cancel").addEventListener("click", closeAssign);
    $("ad-go").addEventListener("click", doAssign);
    $("ad-surveyors").addEventListener("change", (e) => {
      if (e.target.name === "sv") {
        st.selectedSurveyorId = e.target.value;
        renderAssignDrawer();
      }
    });

    $("farm-seg").addEventListener("click", (e) => {
      const b = e.target.closest("button[data-mode]");
      if (!b) return;
      st.farmMode = b.dataset.mode;
      renderFarm();
    });
    $("farm-search").addEventListener("input", (e) => {
      st.farmQuery = e.target.value;
      renderFarm();
    });
    $("farm-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick-farm]");
      if (!b) return;
      st.selectedFarmId = b.dataset.pickFarm;
      renderFarm();
    });
    $("farm-go").addEventListener("click", (e) => {
      e.preventDefault();
      goSurveyFromFarm();
    });

    $("plot-add").addEventListener("click", () => {
      Store.addPlot(st.selectedFarmId);
      renderPlot();
    });
    $("plots").addEventListener("click", (e) => {
      const add = e.target.closest("[data-add-pt]");
      if (add) addPoint(+add.dataset.addPt);
      const photo = e.target.closest("[data-photo]");
      if (photo) {
        const f = Store.getFarm(st.selectedFarmId);
        if (f) { f.evidence = true; toast("토지 증빙사진을 첨부했습니다."); renderPlot(); }
      }
    });
    $("plot-save").addEventListener("click", savePlot);
    $("plot-year").addEventListener("change", () => {
      const f = Store.getFarm(st.selectedFarmId);
      if (f) f.harvestYear = $("plot-year").value;
    });
    $("plot-kg").addEventListener("change", () => {
      const f = Store.getFarm(st.selectedFarmId);
      if (f) { f.kg = $("plot-kg").value; Store.refreshStatus(f); }
    });

    $("req-submit").addEventListener("click", submitRequest);
    $("req-draft").addEventListener("click", () => toast("임시저장했습니다."));

    $("dds-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-dds]");
      if (!b) return;
      st.selectedDdsId = b.dataset.dds;
      renderDds();
    });
    $("dds-gen").addEventListener("click", genDDS);
    $("dds-back").addEventListener("click", () => go("assign"));
    $("dds-dl").addEventListener("click", () => toast("시연용이라 실제 PDF는 없습니다. 생성 결과만 보여 줍니다."));
    $("dds-alert").addEventListener("click", () => toast("고객에게 완료 알림을 보냈습니다."));
    $("dds-v2").addEventListener("click", () => {
      st.ddsDocs = [];
      genDDS();
    });

    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-exfill]");
      if (!b) return;
      const kind = b.dataset.exfill;
      if (kind === "csv") loadSampleCsv();
      if (kind === "newfarm") {
        st.farmMode = "new";
        renderFarm();
        fillNewFarm();
      }
      if (kind === "plot") fillPlotSample();
      if (kind === "request") fillRequest();
      if (kind === "carbon") fillCarbon();
      if (kind === "notice") fillNotice();
    });

    $("master-search").addEventListener("input", () => renderMasters());
    $("carbon-fill").addEventListener("click", fillCarbon);
    $("factor-tbody").addEventListener("click", (e) => {
      const b = e.target.closest("[data-ef]");
      if (!b) return;
      Store.setFactorCurrent(b.dataset.ef);
      toast("이 버전을 이후 산정에 사용합니다. 이미 끝난 산정은 바꾸지 않습니다.");
      renderFactors();
      if ($("carbon").classList.contains("show")) renderCarbon();
    });
    $("eudr-photo").addEventListener("click", () => {
      Store.attachEudrPhoto();
      toast("현장 증빙사진을 1장 추가했습니다. 보관 상자에 함께 묶입니다.");
      renderEudr();
    });
    $("eudr-export").addEventListener("click", () => {
      toast("시연용이라 실제 EU 제출 파일은 없습니다. 위치·증빙·분석 결과를 한 상자로 묶는 순서만 보여 줍니다.");
    });
    $("dash-todo").addEventListener("click", (e) => {
      const b = e.target.closest("[data-approve]");
      if (!b) return;
      Store.approveReview(b.dataset.approve);
      toast("검수를 완료했습니다. DDS/EUDR 문서에 넣을 수 있습니다.");
      renderDash();
    });
    $("coop-farms").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick-farm]");
      if (!b) return;
      st.selectedFarmId = b.dataset.pickFarm;
      go("farm");
    });
    $("master-tbody").addEventListener("click", (e) => {
      const a = e.target.closest("[data-farm]");
      if (!a) return;
      st.selectedFarmId = a.dataset.farm;
    });
    $("user-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-user]");
      if (!b) return;
      st.viewAsUserId = b.dataset.user;
      toast("이 계정으로 보면 농가 목록이 달라집니다.");
      renderUsers();
    });
    $("ntc-list").addEventListener("click", (e) => {
      const b = e.target.closest("[data-notice]");
      if (!b) return;
      st.selectedNoticeId = b.dataset.notice;
      renderNotices();
    });
    $("ntc-fill").addEventListener("click", fillNotice);
    $("ntc-post").addEventListener("click", postNotice);
  }

  function onKanban(e) {
    const b = e.target.closest("[data-open-assign]");
    if (!b) return;
    openAssign(b.dataset.openAssign);
  }

  bind();
  const start = (location.hash || "#import").slice(1);
  if ($(start)) go(start);
  else go("import");
})();
