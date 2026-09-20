(() => {
  const svg = document.getElementById("radial-svg");
  const stage = document.getElementById("radial-stage");
  const statusText = document.getElementById("connection-status");
  const syncButton = document.getElementById("sync-button");
  const message = document.getElementById("app-message");
  const periodTitle = document.getElementById("period-title");
  const periodNote = document.getElementById("period-note");
  const freshness = document.getElementById("freshness");
  const viewOptions = [...document.querySelectorAll(".view-option")];
  const introVortex = document.getElementById("intro-vortex");
  const introConnect = document.getElementById("intro-connect");
  const introConnectOrbits = document.getElementById("intro-connect-orbits");
  const introCurves = document.getElementById("intro-curves");
  const introDataSvg = document.getElementById("intro-data-svg");
  const mobileOrbitControls = document.getElementById("mobile-orbit-controls");
  const dayDialPanel = document.getElementById("day-dial-panel");
  const dayDial = document.getElementById("day-dial");
  const dayDialLabel = document.getElementById("day-dial-label");
  const dayDialAll = document.getElementById("day-dial-all");
  const shutdownDialog = document.getElementById("shutdown-dialog");
  const shutdownConfirm = document.getElementById("shutdown-confirm");
  const shutdownCancel = document.getElementById("shutdown-cancel");
  const shutdownInstruction = document.getElementById("shutdown-instruction");
  const SVG_NS = "http://www.w3.org/2000/svg";
  const HIGH_MMOL = 10.0;
  const LOW_MMOL = 3.9;
  const TARGET_MMOL = 6.4;
  const DAYS_PER_PERIOD = 7;
  const HISTORY_PERIODS = 4;
  const HISTORY_FETCH_DAYS = (DAYS_PER_PERIOD * HISTORY_PERIODS) + DAYS_PER_PERIOD;
  let currentProfile = null;
  let historyRecords = [];
  let historyAverage = null;
  let historyIsSample = false;
  let currentPeriodOffset = 0;
  let maxPeriodOffset = 0;
  let periodSwitching = false;
  let threeFingerGestureActive = false;
  let clearCurrentDay = () => {};
  let dexcomConfigured = false;
  let shutdownEnabled = false;
  let shutdownRequested = false;
  let viewMode = "art";
  let mobileSelectedDay = null;
  let applyViewMode = () => {};
  const phoneLayout = window.matchMedia("(max-width: 580px)");
  const roundDisplayLayout = window.matchMedia(
    "(min-width: 640px) and (max-width: 900px) and (min-height: 640px) and (max-height: 900px)"
  );

  function showShutdownDialog() {
    if (!shutdownEnabled || shutdownRequested) return;
    shutdownInstruction.textContent = "Hold the circle until it fills.";
    shutdownConfirm.disabled = false;
    shutdownConfirm.classList.remove("is-holding", "is-complete");
    shutdownDialog.hidden = false;
    document.body.classList.add("shutdown-open");
    shutdownConfirm.focus({ preventScroll: true });
    if (navigator.vibrate) navigator.vibrate(18);
  }

  function closeShutdownDialog() {
    if (shutdownRequested) return;
    shutdownDialog.hidden = true;
    document.body.classList.remove("shutdown-open");
    shutdownConfirm.classList.remove("is-holding");
  }

  async function requestPoweroff() {
    if (shutdownRequested) return;
    shutdownRequested = true;
    shutdownConfirm.classList.remove("is-holding");
    shutdownConfirm.classList.add("is-complete");
    shutdownConfirm.disabled = true;
    shutdownCancel.hidden = true;
    shutdownInstruction.textContent = "Shutting down… wait for the screen to go black, then unplug.";
    try {
      await fetchJSON("/api/poweroff", {
        method: "POST",
        headers: { "X-Sugar-Orbits-Action": "poweroff" }
      });
    } catch (error) {
      shutdownRequested = false;
      shutdownConfirm.disabled = false;
      shutdownConfirm.classList.remove("is-complete");
      shutdownCancel.hidden = false;
      shutdownInstruction.textContent = error.message;
    }
  }

  function installConfirmationHold() {
    let timer = null;
    let pointerId = null;
    let origin = null;
    const cancel = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      pointerId = null;
      origin = null;
      if (!shutdownRequested) shutdownConfirm.classList.remove("is-holding");
    };
    shutdownConfirm.addEventListener("pointerdown", event => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      cancel();
      pointerId = event.pointerId;
      origin = { x: event.clientX, y: event.clientY };
      if (shutdownConfirm.setPointerCapture) shutdownConfirm.setPointerCapture(pointerId);
      shutdownConfirm.classList.add("is-holding");
      timer = window.setTimeout(requestPoweroff, 2200);
    });
    shutdownConfirm.addEventListener("pointermove", event => {
      if (event.pointerId !== pointerId || !origin) return;
      if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 22) cancel();
    });
    shutdownConfirm.addEventListener("pointerup", cancel);
    shutdownConfirm.addEventListener("pointercancel", cancel);
    shutdownConfirm.addEventListener("contextmenu", event => event.preventDefault());
  }

  installConfirmationHold();
  shutdownCancel.addEventListener("click", closeShutdownDialog);

  function syncDisplayLayout() {
    document.body.classList.toggle("round-display", roundDisplayLayout.matches);
  }

  syncDisplayLayout();
  if (!(roundDisplayLayout.matches || phoneLayout.matches)) viewMode = "days";
  document.body.classList.toggle("art-view", viewMode === "art");

  function svgElement(name, attributes = {}) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function addText(parent, x, y, className, anchor, content) {
    const text = svgElement("text", { x, y, class: className, "text-anchor": anchor });
    text.textContent = content;
    parent.appendChild(text);
    return text;
  }

  function pseudo(day, sample) {
    const x = Math.sin((day + 2) * 91.7 + sample * 13.13) * 43758.5453;
    return x - Math.floor(x);
  }

  function bump(hour, center, width, height) {
    const distance = Math.min(Math.abs(hour - center), 24 - Math.abs(hour - center));
    return height * Math.exp(-(distance * distance) / (2 * width * width));
  }

  function isoDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function dateRangeEnding(endDate, count) {
    const end = new Date(`${endDate}T12:00:00Z`);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(end);
      date.setUTCDate(end.getUTCDate() - (count - 1 - index));
      return isoDate(date);
    });
  }

  function sampleRecords() {
    const today = new Date();
    const endDate = isoDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
    const dates = dateRangeEnding(endDate, 28);
    const records = [];
    dates.forEach((date, day) => {
      const profileDay = day % 14;
      for (let sample = 0; sample < 96; sample++) {
        const hour = sample / 4;
        let value = 6.25
          + 0.24 * Math.sin((hour - 5) * Math.PI / 6)
          + bump(hour, 8.3 + (profileDay % 3) * 0.15, 0.72, 1.25 + (profileDay % 4) * 0.18)
          + bump(hour, 13.1, 0.85, profileDay === 3 || profileDay === 11 ? 3.5 : 1.05)
          + bump(hour, 19.4 + (profileDay % 2) * 0.3, 1.18, profileDay < 11 ? 3.2 + (profileDay % 4) * 0.42 : 1.75)
          + (pseudo(day, sample) - 0.5) * 0.36;
        if ([2, 5, 10].includes(profileDay)) {
          const dip = profileDay === 5 ? 3.4 : (profileDay === 2 ? 3.0 : 2.8);
          value -= bump(hour, 3.15, 0.62, dip);
        }
        if (profileDay === 8) value += bump(hour, 22.4, 0.95, 3.1);
        if (day < 14) value -= 0.18;
        value = Math.max(2.6, Math.min(14.8, value));
        const minutes = sample * 15;
        const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
        const mm = String(minutes % 60).padStart(2, "0");
        records.push({ displayTime: `${date}T${hh}:${mm}:00`, valueMmol: value });
      }
    });
    return records;
  }

  function displayParts(record) {
    const displayTime = String(record.displayTime || "");
    const match = displayTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
    if (!match || !Number.isFinite(Number(record.valueMmol))) return null;
    return {
      date: match[1],
      minute: Number(match[2]) * 60 + Number(match[3]),
      value: Number(record.valueMmol)
    };
  }

  function buildProfile(records, suppliedAverage, isSample, requestedPeriodOffset = 0) {
    const parsed = records.map(displayParts).filter(Boolean);
    const grouped = new Map();
    parsed.forEach(point => {
      if (!grouped.has(point.date)) grouped.set(point.date, []);
      grouped.get(point.date).push(point);
    });
    const availableDates = [...grouped.keys()].sort();
    const endDate = availableDates[availableDates.length - 1] || isoDate(new Date());
    const oldestDate = availableDates[0] || endDate;
    const historySpanDays = Math.max(
      1,
      Math.round(
        (new Date(`${endDate}T12:00:00Z`) - new Date(`${oldestDate}T12:00:00Z`)) / 86400000
      ) + 1
    );
    const availablePeriodCount = Math.max(
      1,
      Math.min(HISTORY_PERIODS, Math.ceil(historySpanDays / DAYS_PER_PERIOD))
    );
    const periodOffset = Math.max(
      0,
      Math.min(availablePeriodCount - 1, requestedPeriodOffset)
    );
    const periodEnd = new Date(`${endDate}T12:00:00Z`);
    periodEnd.setUTCDate(periodEnd.getUTCDate() - periodOffset * DAYS_PER_PERIOD);
    const dates = dateRangeEnding(isoDate(periodEnd), DAYS_PER_PERIOD);
    const previousEnd = new Date(`${dates[0]}T12:00:00Z`);
    previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
    const previousDates = dateRangeEnding(isoDate(previousEnd), DAYS_PER_PERIOD);
    const currentDateSet = new Set(dates);
    const previousDateSet = new Set(previousDates);
    const days = dates.map(date => (grouped.get(date) || []).sort((a, b) => a.minute - b.minute));
    const values = parsed.filter(point => currentDateSet.has(point.date)).map(point => point.value);
    const previousValues = parsed.filter(point => previousDateSet.has(point.date)).map(point => point.value);
    const hasSuppliedAverage = suppliedAverage !== null
      && suppliedAverage !== undefined
      && Number.isFinite(Number(suppliedAverage));
    const average = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : (!parsed.length && hasSuppliedAverage ? Number(suppliedAverage) : null);
    const previousAverage = previousValues.length
      ? previousValues.reduce((sum, value) => sum + value, 0) / previousValues.length
      : null;
    const inRangeReadings = values.filter(value => value >= LOW_MMOL && value <= HIGH_MMOL).length;
    const timeInRange = values.length ? (inRangeReadings / values.length) * 100 : null;
    return {
      dates,
      days,
      average,
      previousAverage,
      timeInRange,
      isSample,
      periodOffset,
      availablePeriodCount,
      availableDayCount: days.filter(day => day.length).length
    };
  }

  function loadHistory(records, suppliedAverage, isSample, resetPeriod = true) {
    historyRecords = records;
    historyAverage = suppliedAverage;
    historyIsSample = isSample;
    if (resetPeriod) currentPeriodOffset = 0;
    currentProfile = buildProfile(
      historyRecords,
      historyAverage,
      historyIsSample,
      currentPeriodOffset
    );
    currentPeriodOffset = currentProfile.periodOffset;
    maxPeriodOffset = currentProfile.availablePeriodCount - 1;
  }

  function showHistoryPeriod(nextOffset) {
    const boundedOffset = Math.max(0, Math.min(maxPeriodOffset, nextOffset));
    if (periodSwitching || boundedOffset === currentPeriodOffset) return false;
    periodSwitching = true;
    currentPeriodOffset = boundedOffset;
    currentProfile = buildProfile(
      historyRecords,
      historyAverage,
      historyIsSample,
      currentPeriodOffset
    );
    mobileSelectedDay = null;
    clearCurrentDay();
    draw();
    stage.classList.remove("is-period-arriving");
    void stage.offsetWidth;
    stage.classList.add("is-period-arriving");
    window.setTimeout(() => {
      stage.classList.remove("is-period-arriving");
      periodSwitching = false;
    }, 360);
    return true;
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function smoothPath(points) {
    if (points.length < 2) return "";
    let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
    for (let index = 1; index < points.length - 1; index++) {
      const mid = midpoint(points[index], points[index + 1]);
      path += ` Q${points[index].x.toFixed(2)},${points[index].y.toFixed(2)} ${mid.x.toFixed(2)},${mid.y.toFixed(2)}`;
    }
    const last = points[points.length - 1];
    return `${path} L${last.x.toFixed(2)},${last.y.toFixed(2)}`;
  }

  function closedSmoothPath(points) {
    if (points.length < 3) return smoothPath(points);
    const start = midpoint(points[points.length - 1], points[0]);
    let path = `M${start.x.toFixed(2)},${start.y.toFixed(2)}`;
    points.forEach((point, index) => {
      const end = midpoint(point, points[(index + 1) % points.length]);
      path += ` Q${point.x.toFixed(2)},${point.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`;
    });
    return `${path} Z`;
  }

  function chunksFor(points) {
    if (!points.length) return [];
    const chunks = [[points[0]]];
    for (let index = 1; index < points.length; index++) {
      const current = chunks[chunks.length - 1];
      if (points[index].minute - points[index - 1].minute > 20) chunks.push([]);
      chunks[chunks.length - 1].push(points[index]);
    }
    return chunks.filter(chunk => chunk.length >= 2);
  }

  function zone(value) {
    if (value < LOW_MMOL) return "low";
    if (value > HIGH_MMOL) return "high";
    return "quiet";
  }

  function hasSustainedZone(points, zoneName) {
    let consecutive = 0;
    let previous = null;
    for (const point of points) {
      if (previous && point.minute - previous.minute > 20) consecutive = 0;
      consecutive = zone(point.value) === zoneName ? consecutive + 1 : 0;
      if (consecutive >= 2) return true;
      previous = point;
    }
    return false;
  }

  function coloredRuns(points) {
    const runs = [];
    let current = null;
    points.forEach((point, index) => {
      const nextZone = zone(point.value);
      if (nextZone === "quiet") {
        if (current) runs.push(current);
        current = null;
        return;
      }
      if (!current || current.zone !== nextZone) {
        if (current) runs.push(current);
        current = { zone: nextZone, start: index, end: index };
      } else {
        current.end = index;
      }
    });
    if (current) runs.push(current);
    return runs.filter(run => run.end - run.start >= 1);
  }

  function shapedPoints(points, cx, cy, radius, gap, intensity = 1) {
    return points.map(point => {
      const angle = (point.minute / 1440) * Math.PI * 2 - Math.PI / 2;
      const offset = Math.tanh((point.value - TARGET_MMOL) / 3.3) * gap * 3.0 * intensity;
      const shapedRadius = radius + offset;
      return {
        x: cx + shapedRadius * Math.cos(angle),
        y: cy + shapedRadius * Math.sin(angle),
        value: point.value,
        minute: point.minute
      };
    });
  }

  function interpolatePoints(from, to, mix) {
    return from.map((point, index) => ({
      x: point.x + (to[index].x - point.x) * mix,
      y: point.y + (to[index].y - point.y) * mix,
      value: to[index].value,
      minute: to[index].minute
    }));
  }

  function drawConnectIntro() {
    introConnectOrbits.replaceChildren();
    if (!currentProfile || !currentProfile.days.length) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cx = 120;
    const cy = 120;
    const sourceDays = currentProfile.days.slice(-4);
    sourceDays.forEach((day, index) => {
      const generic = shapedPoints(day, cx, cy, 81, 11, 0);
      const resolved = shapedPoints(day, cx, cy, 64 + index * 12, 11, 0.9);
      const emerging = interpolatePoints(generic, resolved, 0.28);
      const paths = [generic, emerging, resolved].map(closedSmoothPath);
      const path = svgElement("path", {
        d: reducedMotion ? paths[2] : paths[0],
        class: `intro-sugar-orbit orbit-${index + 1}`,
        opacity: reducedMotion ? (index ? 0.62 : 0.86) : (index ? 0 : 0.9)
      });
      if (!reducedMotion) {
        path.appendChild(svgElement("animate", {
          attributeName: "d",
          values: paths.join(";"),
          keyTimes: "0;0.34;1",
          dur: "1.45s",
          begin: `${0.04 + index * 0.07}s`,
          fill: "freeze",
          calcMode: "spline",
          keySplines: "0.4 0 0.2 1;0.22 1 0.36 1"
        }));
        path.appendChild(svgElement("animate", {
          attributeName: "opacity",
          values: index ? "0;0;0.7" : "0.9;0.86;0.72",
          keyTimes: "0;0.2;1",
          dur: "1.45s",
          begin: `${0.04 + index * 0.07}s`,
          fill: "freeze"
        }));
      }
      introConnectOrbits.appendChild(path);
    });
  }

  function deformationGap(width, orbitGap) {
    // Seven visible rings need wider spacing, but their glucose deformation
    // should retain the restrained character of the original fourteen-ring view.
    return Math.min(orbitGap, width * 0.014);
  }

  function introRingPoints(points, width, height, dayIndex, dayCount, intensity = 1) {
    const cx = width / 2;
    const cy = height / 2 + 3;
    const innerRadius = Math.max(60, width * 0.215);
    const outerRadius = width * 0.39;
    const gap = (outerRadius - innerRadius) / Math.max(1, dayCount - 1);
    return shapedPoints(
      points,
      cx,
      cy,
      innerRadius + dayIndex * gap,
      deformationGap(width, gap),
      intensity
    );
  }

  function appendIntroMorph(parent, frames, className, begin, duration, finalOpacity) {
    const paths = frames.map(smoothPath);
    if (paths.some(path => !path)) return;
    const path = svgElement("path", {
      d: paths[0],
      class: className,
      opacity: 0,
      pathLength: 1,
      "stroke-dasharray": 1,
      "stroke-dashoffset": 1
    });
    path.appendChild(svgElement("animate", {
      attributeName: "d",
      values: paths.join(";"),
      keyTimes: "0;0.52;1",
      dur: `${duration}s`,
      begin: `${begin}s`,
      fill: "freeze",
      calcMode: "spline",
      keySplines: "0.4 0 0.2 1;0.4 0 0.2 1"
    }));
    path.appendChild(svgElement("animate", {
      attributeName: "opacity",
      values: `0;1;0.94;${finalOpacity}`,
      keyTimes: "0;0.10;0.72;1",
      dur: `${duration}s`,
      begin: `${begin}s`,
      fill: "freeze"
    }));
    path.appendChild(svgElement("animate", {
      attributeName: "stroke-dashoffset",
      values: "1;0;0",
      keyTimes: "0;0.34;1",
      dur: `${duration}s`,
      begin: `${begin}s`,
      fill: "freeze"
    }));
    parent.appendChild(path);
  }

  function drawIntroData(width, height) {
    introDataSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    introDataSvg.replaceChildren();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sequenceLayer = svgElement("g", { class: "intro-sequence-layer" });
    const guideLayer = svgElement("g", { class: "intro-generic-layer" });
    const introCx = width / 2;
    const introCy = height / 2 + 3;
    const introInnerRadius = Math.max(60, width * 0.215);
    const introOuterRadius = width * 0.39;
    const dayCount = currentProfile.days.length;
    const introGap = (introOuterRadius - introInnerRadius) / Math.max(1, dayCount - 1);
    currentProfile.days.forEach((day, dayIndex) => {
      const guide = svgElement("circle", {
        cx: introCx,
        cy: introCy,
        r: introInnerRadius + dayIndex * introGap,
        class: "intro-generic-orbit"
      });
      if (!reducedMotion) {
        guide.appendChild(svgElement("animate", {
          attributeName: "opacity",
          values: "0;0.58;0.42;0.04",
          keyTimes: "0;0.08;0.42;1",
          dur: "3.4s",
          fill: "freeze"
        }));
      }
      guideLayer.appendChild(guide);
    });
    currentProfile.days.forEach((day, dayIndex) => {
      const group = svgElement("g", {
        class: `intro-data-day intro-day-${dayIndex + 1}`
      });
      chunksFor(day).forEach(chunk => {
        const circle = introRingPoints(chunk, width, height, dayIndex, dayCount, 0);
        const softened = introRingPoints(chunk, width, height, dayIndex, dayCount, 0.32);
        const ring = introRingPoints(chunk, width, height, dayIndex, dayCount, 1);
        const begin = 0.14 + dayIndex * 0.025;
        const duration = 2.85;
        if (reducedMotion) {
          group.appendChild(svgElement("path", {
            d: smoothPath(ring),
            class: "intro-data-profile"
          }));
        } else {
          appendIntroMorph(group, [circle, softened, ring], "intro-data-profile", begin, duration, 1);
        }
        coloredRuns(chunk).forEach(run => {
          const start = Math.max(0, run.start - 1);
          const end = Math.min(chunk.length - 1, run.end + 1);
          const className = `intro-data-arc is-${run.zone}`;
          if (reducedMotion) {
            group.appendChild(svgElement("path", {
              d: smoothPath(ring.slice(start, end + 1)),
              class: className
            }));
          } else {
            appendIntroMorph(
              group,
              [circle.slice(start, end + 1), softened.slice(start, end + 1), ring.slice(start, end + 1)],
              className,
              begin + 0.72,
              2.05,
              1
            );
          }
        });
      });
      sequenceLayer.appendChild(group);
    });
    introDataSvg.append(guideLayer, sequenceLayer);
  }

  function averageDailyProfile(days) {
    const bins = Array.from({ length: 96 }, () => []);
    days.forEach(day => {
      day.forEach(point => {
        const index = Math.min(95, Math.floor(point.minute / 15));
        bins[index].push(point.value);
      });
    });
    const averages = bins.map(values => values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null);
    if (!averages.some(Number.isFinite)) return [];
    return averages.map((value, index) => {
      if (Number.isFinite(value)) return { minute: index * 15 + 7.5, value };
      for (let distance = 1; distance < averages.length; distance++) {
        const before = averages[(index - distance + averages.length) % averages.length];
        const after = averages[(index + distance) % averages.length];
        const nearby = [before, after].filter(Number.isFinite);
        if (nearby.length) {
          return {
            minute: index * 15 + 7.5,
            value: nearby.reduce((sum, item) => sum + item, 0) / nearby.length
          };
        }
      }
      return { minute: index * 15 + 7.5, value: TARGET_MMOL };
    });
  }

  function smoothDailyProfile(profile) {
    if (profile.length < 5) return profile;
    const weights = [1, 2, 3, 2, 1];
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    return profile.map((point, index) => {
      const value = weights.reduce((sum, weight, offset) => {
        const neighbor = profile[(index + offset - 2 + profile.length) % profile.length];
        return sum + neighbor.value * weight;
      }, 0) / weightTotal;
      return { ...point, value };
    });
  }

  function averageProfilePoints(profile, cx, cy, radius, width) {
    return profile.map(point => {
      const angle = (point.minute / 1440) * Math.PI * 2 - Math.PI / 2;
      const offset = Math.tanh((point.value - TARGET_MMOL) / 3.1) * width * 0.052;
      const shapedRadius = radius + offset;
      return {
        x: cx + shapedRadius * Math.cos(angle),
        y: cy + shapedRadius * Math.sin(angle),
        minute: point.minute,
        value: point.value
      };
    });
  }

  function representativePatternProfile(days, patterns, fallbackProfile) {
    const bins = Array.from({ length: 96 }, () => []);
    days.forEach(day => {
      day.forEach(point => {
        const index = Math.min(95, Math.floor(point.minute / 15));
        bins[index].push(point.value);
      });
    });
    const candidates = fallbackProfile.map((fallback, index) => {
      const values = bins[index];
      const options = patterns.map(pattern => {
        if (fallback.minute < pattern.startMinute || fallback.minute >= pattern.endMinute) return null;
        const outside = values.filter(value => (
          pattern.zone === "high" ? value > HIGH_MMOL : value < LOW_MMOL
        ));
        if (!outside.length) return null;
        const value = outside.reduce((sum, item) => sum + item, 0) / outside.length;
        const threshold = pattern.zone === "high" ? HIGH_MMOL : LOW_MMOL;
        return {
          zone: pattern.zone,
          value,
          rate: pattern.rate,
          score: pattern.rate * (1 + Math.abs(value - threshold) / 4)
        };
      }).filter(Boolean).sort((a, b) => b.score - a.score);
      return options[0] || null;
    });
    const softenedCandidates = candidates.map((candidate, index) => {
      if (!candidate) return null;
      const neighborhood = [-2, -1, 0, 1, 2]
        .map((offset, weightIndex) => ({
          candidate: candidates[index + offset],
          weight: [1, 2, 3, 2, 1][weightIndex]
        }))
        .filter(item => item.candidate && item.candidate.zone === candidate.zone);
      const weightTotal = neighborhood.reduce((sum, item) => sum + item.weight, 0);
      return {
        ...candidate,
        value: neighborhood.reduce((sum, item) => sum + item.candidate.value * item.weight, 0) / weightTotal
      };
    });
    const profile = fallbackProfile.map(point => ({ ...point }));

    let start = 0;
    while (start < softenedCandidates.length) {
      if (!softenedCandidates[start]) {
        start += 1;
        continue;
      }
      let end = start;
      while (
        end + 1 < softenedCandidates.length
        && softenedCandidates[end + 1]
        && softenedCandidates[end + 1].zone === softenedCandidates[start].zone
      ) end += 1;
      const threshold = softenedCandidates[start].zone === "high" ? HIGH_MMOL : LOW_MMOL;
      for (let index = start; index <= end; index += 1) {
        const edgeDistance = Math.min(index - start, end - index);
        const blend = Math.min(1, edgeDistance / 2);
        profile[index].value = threshold + (softenedCandidates[index].value - threshold) * blend;
      }
      start = end + 1;
    }

    return profile;
  }

  function timeInRangeForDay(points) {
    if (!points.length) return null;
    const inRange = points.filter(point => point.value >= LOW_MMOL && point.value <= HIGH_MMOL).length;
    return (inRange / points.length) * 100;
  }

  function previousPeriodTrend(current, previous) {
    if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
    const delta = current - previous;
    if (Math.abs(delta) < 0.05) {
      return { className: "is-steady", text: `→ previous week ${previous.toFixed(1)}` };
    }
    return {
      className: delta > 0 ? "is-up" : "is-down",
      text: `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)} · previous week ${previous.toFixed(1)}`
    };
  }

  function eventWindowSummary(days) {
    const windows = Array.from({ length: 8 }, (_, index) => ({
      startMinute: index * 180,
      endMinute: (index + 1) * 180,
      highCount: 0,
      lowCount: 0,
      highDays: 0,
      lowDays: 0,
      periodDays: days.length,
      availableDays: 0
    }));
    days.forEach(day => {
      const highWindows = new Set();
      const lowWindows = new Set();
      windows.forEach(window => {
        if (day.some(point => point.minute >= window.startMinute && point.minute < window.endMinute)) {
          window.availableDays += 1;
        }
      });
      let run = null;
      const finishRun = () => {
        if (!run || run.count < 2 || run.zone === "quiet") return;
        const windowIndex = Math.min(7, Math.floor(run.startMinute / 180));
        if (run.zone === "high") {
          windows[windowIndex].highCount += 1;
          highWindows.add(windowIndex);
        }
        if (run.zone === "low") {
          windows[windowIndex].lowCount += 1;
          lowWindows.add(windowIndex);
        }
      };
      day.forEach((point, index) => {
        const nextZone = zone(point.value);
        const previous = index ? day[index - 1] : null;
        const gap = previous && point.minute - previous.minute > 20;
        if (gap || !run || run.zone !== nextZone) {
          finishRun();
          run = { zone: nextZone, startMinute: point.minute, count: 1 };
        } else {
          run.count += 1;
        }
      });
      finishRun();
      windows.forEach((window, index) => {
        const points = day.filter(point => point.minute >= window.startMinute && point.minute < window.endMinute);
        if (hasSustainedZone(points, "high")) highWindows.add(index);
        if (hasSustainedZone(points, "low")) lowWindows.add(index);
      });
      highWindows.forEach(index => { windows[index].highDays += 1; });
      lowWindows.forEach(index => { windows[index].lowDays += 1; });
    });
    return windows;
  }

  function detectPatterns(windows) {
    const candidates = [];
    windows.forEach((window, index) => {
      const minimumCoverage = Math.min(5, Math.max(3, window.periodDays - 2));
      if (window.availableDays < minimumCoverage) return;
      const highRate = window.highDays / Math.max(1, window.periodDays);
      const lowRate = window.lowDays / Math.max(1, window.periodDays);
      const minimumHighDays = window.periodDays <= 7 ? 3 : 4;
      const minimumLowDays = window.periodDays <= 7 ? 2 : 3;
      if (window.highDays >= minimumHighDays && highRate >= 0.36) {
        candidates.push({ ...window, index, zone: "high", dayCount: window.highDays, rate: highRate });
      }
      if (window.lowDays >= minimumLowDays && lowRate >= 0.25) {
        candidates.push({ ...window, index, zone: "low", dayCount: window.lowDays, rate: lowRate });
      }
    });
    return candidates
      .sort((a, b) => (b.rate + (b.zone === "low" ? 0.035 : 0)) - (a.rate + (a.zone === "low" ? 0.035 : 0)))
      .slice(0, 3);
  }

  function arcPath(cx, cy, radius, startMinute, endMinute) {
    const startAngle = (startMinute / 1440) * Math.PI * 2 - Math.PI / 2;
    const endAngle = (endMinute / 1440) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = endMinute - startMinute > 720 ? 1 : 0;
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${radius.toFixed(2)},${radius.toFixed(2)} 0 ${largeArc} 1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
  }

  function windowSectorPath(cx, cy, innerRadius, outerRadius, startMinute, endMinute) {
    const startAngle = (startMinute / 1440) * Math.PI * 2 - Math.PI / 2;
    const endAngle = (endMinute / 1440) * Math.PI * 2 - Math.PI / 2;
    const outerStart = {
      x: cx + outerRadius * Math.cos(startAngle),
      y: cy + outerRadius * Math.sin(startAngle)
    };
    const outerEnd = {
      x: cx + outerRadius * Math.cos(endAngle),
      y: cy + outerRadius * Math.sin(endAngle)
    };
    const innerEnd = {
      x: cx + innerRadius * Math.cos(endAngle),
      y: cy + innerRadius * Math.sin(endAngle)
    };
    const innerStart = {
      x: cx + innerRadius * Math.cos(startAngle),
      y: cy + innerRadius * Math.sin(startAngle)
    };
    const largeArc = endMinute - startMinute > 720 ? 1 : 0;
    return [
      `M${outerStart.x.toFixed(2)},${outerStart.y.toFixed(2)}`,
      `A${outerRadius.toFixed(2)},${outerRadius.toFixed(2)} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)},${outerEnd.y.toFixed(2)}`,
      `L${innerEnd.x.toFixed(2)},${innerEnd.y.toFixed(2)}`,
      `A${innerRadius.toFixed(2)},${innerRadius.toFixed(2)} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)},${innerStart.y.toFixed(2)}`,
      "Z"
    ].join(" ");
  }

  function formatClock(minute) {
    if (minute === 1440) return "24:00";
    const hours = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  function formatDate(dateString, includeMonth = true) {
    const date = new Date(`${dateString}T12:00:00Z`);
    return new Intl.DateTimeFormat("en-GB", includeMonth
      ? { day: "numeric", month: "short" }
      : { day: "numeric" }).format(date);
  }

  function describeDay(points) {
    const hasHigh = points.some(point => point.value > HIGH_MMOL);
    const hasLow = points.some(point => point.value < LOW_MMOL);
    if (hasHigh && hasLow) return "glow · dip";
    if (hasHigh) return "outward glow";
    if (hasLow) return "inward dip";
    return "quiet orbit";
  }

  function artRing(day, dayIndex, cx, cy, radius, shapeGap) {
        const layer = svgElement("g", { class: "art-ring", "aria-hidden": "true" });
        const defs = svgElement("defs", {});
        layer.appendChild(defs);
        const mask = svgElement("mask", {
          id: `art-mask-${dayIndex}`, maskUnits: "userSpaceOnUse",
          x: 0, y: 0, width: cx * 2, height: cx * 2
        });
        defs.appendChild(mask);
        const colors = svgElement("g", { mask: `url(#art-mask-${dayIndex})` });
        layer.appendChild(colors);
        let segmentId = 0;
        chunksFor(day).forEach(chunk => {
          const points = shapedPoints(chunk, cx, cy, radius, shapeGap);
          // One continuous silhouette per data chunk avoids a scalloped edge
          // from hundreds of independently capped gradient strokes.
          mask.appendChild(svgElement("path", {
            d: smoothPath(points), fill: "none", stroke: "white",
            "stroke-width": 1.9, "stroke-linecap": "round", "stroke-linejoin": "round"
          }));
          let start = points[0];
          for (let i = 1; i < points.length; i++) {
            const control = points[i];
            const end = i < points.length - 1
              ? { ...midpoint(control, points[i + 1]), value: (control.value + points[i + 1].value) / 2 }
              : control;
            const id = `art-${dayIndex}-${segmentId++}`;
            const gradient = svgElement("linearGradient", {
              id, gradientUnits: "userSpaceOnUse",
              x1: start.x, y1: start.y, x2: end.x, y2: end.y
            });
            [0, 0.5, 1].forEach(t => {
              const value = i < points.length - 1
                ? (1 - t) ** 2 * start.value + 2 * (1 - t) * t * control.value + t ** 2 * end.value
                : start.value + (end.value - start.value) * t;
              gradient.appendChild(svgElement("stop", { offset: t, "stop-color": SugarOrbitPalette.color(value) }));
            });
            defs.appendChild(gradient);
            const d = `M${start.x.toFixed(2)},${start.y.toFixed(2)}` + (i < points.length - 1
              ? ` Q${control.x.toFixed(2)},${control.y.toFixed(2)} ${end.x.toFixed(2)},${end.y.toFixed(2)}`
              : ` L${end.x.toFixed(2)},${end.y.toFixed(2)}`);
            colors.appendChild(svgElement("path", { d, stroke: `url(#${id})`, class: "art-segment" }));
            start = end;
          }
        });
        layer.style.setProperty("--ring-delay", `${dayIndex * 75}ms`);
        return layer;
  }

  let revealTimer;
  function revealArt() {
    if (viewMode !== "art" || !introVortex.hidden) return;
    stage.classList.remove("is-art-revealing");
    void stage.offsetWidth;
    stage.classList.add("is-art-revealing");
    window.clearTimeout(revealTimer);
    revealTimer = window.setTimeout(() => stage.classList.remove("is-art-revealing"), 1800);
  }

  function draw() {
    if (!currentProfile) return;
    const width = Math.max(280, Math.min(720, stage.clientWidth));
    const height = width;
    const cx = width / 2;
    const cy = height / 2 + 3;
    const innerRadius = Math.max(60, width * 0.215);
    const outerRadius = width * 0.39;
    const dayCount = currentProfile.days.length;
    const lastDayIndex = dayCount - 1;
    const gap = (outerRadius - innerRadius) / Math.max(1, lastDayIndex);
    const shapeGap = deformationGap(width, gap);
    const labelRadius = outerRadius + (
      roundDisplayLayout.matches ? Math.max(16, width * 0.026) : Math.max(28, width * 0.06)
    );
    drawIntroData(width, height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("height", String(height));
    svg.replaceChildren();

    const title = svgElement("title", { id: "radial-title" });
    title.textContent = "Seven days of Dexcom glucose shaped into concentric profiles";
    const description = svgElement("desc", { id: "radial-description" });
    description.textContent = "Time moves clockwise through seven daily rings and recurring trends. Higher glucose pushes outward and lower glucose pulls inward.";
    const interactionBackdrop = svgElement("rect", {
      x: 0,
      y: 0,
      width,
      height,
      class: "days-hover-backdrop",
      "aria-hidden": "true"
    });
    svg.append(title, description, interactionBackdrop);
    const daysLayer = svgElement("g", { class: "view-layer days-layer" });
    const patternsLayer = svgElement("g", { class: "view-layer patterns-layer" });
    const artLayer = svgElement("g", { class: "view-layer art-layer" });
    const artBreathing = svgElement("g", { class: "art-breathing" });
    artLayer.appendChild(artBreathing);
    let artBuilt = false;
    svg.append(artLayer, daysLayer, patternsLayer);

    const clockLabels = [
      { angle: -Math.PI / 2, label: "night", anchor: "middle", dx: 0, dy: 4 },
      { angle: 0, label: "morning", anchor: "end", dx: -4, dy: 4 },
      { angle: Math.PI / 2, label: "noon", anchor: "middle", dx: 0, dy: 12 },
      { angle: Math.PI, label: "evening", anchor: "start", dx: 4, dy: 4 }
    ];
    [daysLayer, patternsLayer].forEach(layer => {
      clockLabels.forEach(item => addText(
        layer,
        cx + labelRadius * Math.cos(item.angle) + item.dx,
        cy + labelRadius * Math.sin(item.angle) + item.dy,
        "clock-label",
        item.anchor,
        item.label
      ));
    });

    currentProfile.days.forEach((day, dayIndex) => {
      const radius = innerRadius + dayIndex * gap;
      const group = svgElement("g", {
        class: `radial-day${dayIndex >= Math.max(0, lastDayIndex - 2) ? " is-newer" : ""}`
      });
      const guide = svgElement("circle", { cx, cy, r: radius, class: "orbit-guide" });
      group.appendChild(guide);
      const targetReference = svgElement("circle", {
        cx,
        cy,
        r: radius,
        class: "target-reference",
        "aria-hidden": "true"
      });
      group.appendChild(targetReference);

      chunksFor(day).forEach(chunk => {
        const shaped = shapedPoints(chunk, cx, cy, radius, shapeGap);
        const profilePath = svgElement("path", { d: smoothPath(shaped), class: "profile-line" });
        group.appendChild(profilePath);
        coloredRuns(shaped).forEach(run => {
          const start = Math.max(0, run.start - 1);
          const end = Math.min(shaped.length - 1, run.end + 1);
          group.appendChild(svgElement("path", {
            d: smoothPath(shaped.slice(start, end + 1)),
            class: `glucose-arc is-${run.zone}`
          }));
        });
      });

      daysLayer.appendChild(group);
    });

    const averageWindows = eventWindowSummary(currentProfile.days);
    const averageProfile = smoothDailyProfile(averageDailyProfile(currentProfile.days));
    const averageRadius = width * 0.315;

    let showPatternDetail = () => {};
    let clearPatternDetail = () => {};
    const detectedPatterns = detectPatterns(averageWindows);
    const patternProfile = representativePatternProfile(currentProfile.days, detectedPatterns, averageProfile);
    const trendRadius = averageRadius;
    const trendMeanPoints = averageProfilePoints(averageProfile, cx, cy, trendRadius, width);
    const trendPoints = averageProfilePoints(patternProfile, cx, cy, trendRadius, width);
    const trendWindowGroups = [];

    detectedPatterns.forEach(pattern => {
      const washInnerRadius = pattern.zone === "high" ? trendRadius : innerRadius - gap * 1.7;
      const washOuterRadius = pattern.zone === "high" ? outerRadius + gap * 1.8 : trendRadius;
      const hitInnerRadius = pattern.zone === "high" ? trendRadius - gap * 0.5 : innerRadius - gap * 2.2;
      const hitOuterRadius = pattern.zone === "high" ? outerRadius + gap * 2.3 : trendRadius + gap * 0.5;
      const group = svgElement("g", {
        class: `trend-window is-${pattern.zone}`,
        "aria-label": `${pattern.zone === "high" ? "Recurring highs" : "Recurring lows"}, ${formatClock(pattern.startMinute)} to ${formatClock(pattern.endMinute)}, ${pattern.dayCount} of ${pattern.periodDays} days`
      });
      group.appendChild(svgElement("path", {
        d: windowSectorPath(
          cx,
          cy,
          washInnerRadius,
          washOuterRadius,
          pattern.startMinute + 4,
          pattern.endMinute - 4
        ),
        class: "trend-window-wash",
        opacity: (0.025 + pattern.rate * 0.07).toFixed(3),
        "aria-hidden": "true"
      }));
      const hit = svgElement("path", {
        d: windowSectorPath(
          cx,
          cy,
          hitInnerRadius,
          hitOuterRadius,
          pattern.startMinute + 2,
          pattern.endMinute - 2
        ),
        class: "trend-window-hit"
      });
      const activate = () => showPatternDetail(pattern, group);
      hit.addEventListener("pointerenter", activate);
      hit.addEventListener("pointermove", activate);
      hit.addEventListener("pointerdown", activate);
      group.appendChild(hit);
      patternsLayer.appendChild(group);
      trendWindowGroups.push(group);
    });

    const chorusLayer = svgElement("g", {
      class: "trend-chorus",
      "aria-hidden": "true"
    });
    currentProfile.days.forEach((day, dayIndex) => {
      const radius = innerRadius + dayIndex * gap;
      chunksFor(day).forEach(chunk => {
        chorusLayer.appendChild(svgElement("path", {
          d: smoothPath(shapedPoints(chunk, cx, cy, radius, shapeGap)),
          class: "trend-day-profile"
        }));
      });
      detectedPatterns.forEach(pattern => {
        const windowPoints = day.filter(point => (
          point.minute >= pattern.startMinute && point.minute < pattern.endMinute
        ));
        chunksFor(windowPoints).forEach(chunk => {
          const shaped = shapedPoints(chunk, cx, cy, radius, shapeGap);
          coloredRuns(shaped)
            .filter(run => run.zone === pattern.zone)
            .forEach(run => {
              const start = Math.max(0, run.start - 1);
              const end = Math.min(shaped.length - 1, run.end + 1);
              chorusLayer.appendChild(svgElement("path", {
                d: smoothPath(shaped.slice(start, end + 1)),
                class: `trend-day-event is-${run.zone}`,
                opacity: (0.2 + pattern.rate * 0.28).toFixed(3)
              }));
            });
        });
      });
    });
    patternsLayer.appendChild(chorusLayer);

    const summaryLayer = svgElement("g", {
      class: "trend-summary",
      "aria-hidden": "true"
    });
    summaryLayer.appendChild(svgElement("circle", {
      cx,
      cy,
      r: trendRadius,
      class: "trend-target-orbit"
    }));
    if (trendMeanPoints.length) {
      summaryLayer.appendChild(svgElement("path", {
        d: closedSmoothPath(trendMeanPoints),
        class: "trend-mean-orbit"
      }));
    }
    if (trendPoints.length) {
      summaryLayer.appendChild(svgElement("path", {
        d: closedSmoothPath(trendPoints),
        class: "trend-summary-profile"
      }));
      coloredRuns(trendPoints).forEach(run => {
        const midpointIndex = Math.floor((run.start + run.end) / 2);
        const midpointMinute = trendPoints[midpointIndex].minute;
        const matchingPattern = detectedPatterns.find(pattern => (
          pattern.zone === run.zone
          && midpointMinute >= pattern.startMinute
          && midpointMinute < pattern.endMinute
        ));
        const start = Math.max(0, run.start - 1);
        const end = Math.min(trendPoints.length - 1, run.end + 1);
        summaryLayer.appendChild(svgElement("path", {
          d: smoothPath(trendPoints.slice(start, end + 1)),
          class: `trend-summary-arc is-${run.zone}`,
          "stroke-width": (3.2 + (matchingPattern ? matchingPattern.rate : 0.3) * 2.2).toFixed(1)
        }));
      });
      summaryLayer.appendChild(svgElement("path", {
        d: closedSmoothPath(trendPoints),
        class: "trend-summary-profile is-overlay"
      }));
    }
    patternsLayer.appendChild(summaryLayer);

    const shutdownTitleHit = svgElement("circle", {
      cx,
      cy,
      r: Math.max(54, innerRadius * 0.58),
      class: "shutdown-title-hit",
      "aria-hidden": "true"
    });
    svg.appendChild(shutdownTitleHit);
    const centerBrand = addText(svg, cx, cy - 50, "center-brand", "middle", "Sugar Orbits");
    const centerValue = Number.isFinite(currentProfile.average) ? currentProfile.average.toFixed(1) : "—";
    const centerValueText = addText(svg, cx, cy - 7, "center-value", "middle", centerValue);
    const centerUnitText = addText(svg, cx, cy + 17, "center-unit", "middle", "MMOL/L");
    const centerLabelText = addText(svg, cx, cy + 39, "center-label", "middle", currentProfile.isSample ? "SAMPLE · 7-DAY AVG" : "7-DAY AVERAGE");
    const trend = previousPeriodTrend(currentProfile.average, currentProfile.previousAverage);
    const centerTrendText = addText(
      svg,
      cx,
      cy + 62,
      `center-trend${trend ? ` ${trend.className}` : ""}`,
      "middle",
      trend ? trend.text : ""
    );
    const centerPeriodText = addText(svg, cx, cy + 82, "center-period", "middle", "");

    const groups = [...daysLayer.querySelectorAll(".radial-day")];
    let activeDay = null;
    const defaultTitle = `${formatDate(currentProfile.dates[0])} — ${formatDate(currentProfile.dates[lastDayIndex])}`;
    const historyPosition = `week ${currentProfile.periodOffset + 1} of ${currentProfile.availablePeriodCount}`;
    const historyBuildNote = currentProfile.availablePeriodCount < HISTORY_PERIODS
      ? ` · building toward ${HISTORY_PERIODS}`
      : "";
    const defaultNote = currentProfile.isSample
      ? `sample · ${historyPosition} · newest day outside`
      : currentProfile.periodOffset === 0
        ? `${historyPosition}${historyBuildNote} · pinch inward with 3 fingers for older`
        : `${historyPosition} · pinch outward with 3 fingers for newer`;
    periodTitle.textContent = defaultTitle;
    periodNote.textContent = defaultNote;

    const showDefaultCenter = () => {
      centerValueText.setAttribute("class", "center-value");
      centerValueText.textContent = centerValue;
      centerUnitText.textContent = "MMOL/L";
      centerLabelText.textContent = currentProfile.isSample ? "SAMPLE · 7-DAY AVG" : "7-DAY AVERAGE";
      centerTrendText.textContent = trend ? trend.text : "";
      centerTrendText.setAttribute("class", `center-trend${trend ? ` ${trend.className}` : ""}`);
      centerPeriodText.textContent = `${defaultTitle.toUpperCase()} · ${historyPosition.toUpperCase()}`;
    };
    const showPatternDefault = () => {
      centerValueText.setAttribute("class", "center-value");
      centerValueText.textContent = String(detectedPatterns.length);
      centerUnitText.textContent = detectedPatterns.length === 1 ? "RECURRING WINDOW" : "RECURRING WINDOWS";
      centerLabelText.textContent = "VISIBLE WEEK";
      centerTrendText.setAttribute("class", "center-trend");
      centerTrendText.textContent = detectedPatterns.length ? "TOUCH COLOR TO EXPLORE" : "NO STRONG REPEAT DETECTED";
      centerPeriodText.textContent = defaultTitle.toUpperCase();
    };
    const syncDayDial = () => {
      const hasSelection = Number.isInteger(mobileSelectedDay);
      const selectedIndex = hasSelection ? mobileSelectedDay : lastDayIndex;
      dayDial.max = String(lastDayIndex);
      dayDial.value = String(selectedIndex);
      dayDialAll.classList.toggle("is-active", !hasSelection);
      dayDialAll.setAttribute("aria-pressed", String(!hasSelection));
      if (hasSelection) {
        dayDialLabel.textContent = `day ${selectedIndex + 1} · ${formatDate(currentProfile.dates[selectedIndex])}`;
        dayDial.setAttribute(
          "aria-valuetext",
          `Day ${selectedIndex + 1} of ${dayCount}, ${formatDate(currentProfile.dates[selectedIndex])}`
        );
      } else {
        dayDialLabel.textContent = "all 7 · average";
        dayDial.setAttribute("aria-valuetext", "All seven days");
      }
    };
    showPatternDetail = (pattern, activeGroup) => {
      if (viewMode !== "patterns") return;
      trendWindowGroups.forEach(group => {
        group.classList.toggle("is-active", group === activeGroup);
        group.classList.toggle("is-dimmed", group !== activeGroup);
      });
      centerValueText.setAttribute("class", `center-value is-${pattern.zone}`);
      centerValueText.textContent = `${pattern.dayCount}/${pattern.periodDays}`;
      centerUnitText.textContent = pattern.zone === "high" ? "HIGH DAYS" : "LOW DAYS";
      centerLabelText.textContent = `${formatClock(pattern.startMinute)}–${formatClock(pattern.endMinute)}`;
      centerTrendText.setAttribute("class", "center-trend");
      centerTrendText.textContent = `RECURS ON ${Math.round(pattern.rate * 100)}% OF DAYS`;
      centerPeriodText.textContent = defaultTitle.toUpperCase();
    };
    clearPatternDetail = () => {
      trendWindowGroups.forEach(group => group.classList.remove("is-active", "is-dimmed"));
      if (viewMode === "patterns") showPatternDefault();
    };
    patternsLayer.addEventListener("pointerleave", event => {
      if (event.pointerType !== "touch") clearPatternDetail();
    });
    const selectDay = index => {
      if (viewMode !== "days") return;
      if (activeDay === index) return;
      activeDay = index;
      groups.forEach((group, groupIndex) => {
        group.classList.toggle("is-selected", groupIndex === index);
        group.classList.toggle("is-dimmed", groupIndex !== index);
      });
      const dayTimeInRange = timeInRangeForDay(currentProfile.days[index]);
      centerValueText.setAttribute("class", "center-value");
      centerValueText.textContent = Number.isFinite(dayTimeInRange) ? `${Math.round(dayTimeInRange)}%` : "—";
      centerUnitText.textContent = "TIME IN RANGE";
      centerLabelText.textContent = formatDate(currentProfile.dates[index]).toUpperCase();
      centerTrendText.textContent = "";
      centerPeriodText.textContent = "";
    };
    const clearDay = () => {
      activeDay = null;
      groups.forEach(group => group.classList.remove("is-selected", "is-dimmed"));
      showDefaultCenter();
    };
    clearCurrentDay = clearDay;
    dayDial.oninput = () => {
      mobileSelectedDay = Number(dayDial.value);
      selectDay(mobileSelectedDay);
      syncDayDial();
    };
    dayDial.onpointerdown = () => {
      if (Number.isInteger(mobileSelectedDay)) return;
      mobileSelectedDay = Number(dayDial.value);
      selectDay(mobileSelectedDay);
      syncDayDial();
    };
    dayDialAll.onclick = () => {
      mobileSelectedDay = null;
      clearDay();
      syncDayDial();
    };
    syncDayDial();
    const handleOrbitPointer = event => {
      if (viewMode !== "days") return;
      if (threeFingerGestureActive) return;
      if (phoneLayout.matches && event.pointerType === "touch") return;
      const transform = svg.getScreenCTM();
      if (!transform) return;
      const pointer = svg.createSVGPoint();
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const local = pointer.matrixTransform(transform.inverse());
      const distance = Math.hypot(local.x - cx, local.y - cy);
      if (distance < innerRadius - gap * 3 || distance > outerRadius + gap * 3) {
        if (activeDay !== null) clearDay();
        return;
      }
      const candidate = Math.max(0, Math.min(lastDayIndex, Math.round((distance - innerRadius) / gap)));
      if (activeDay !== null && candidate !== activeDay) {
        const currentDistance = Math.abs(distance - (innerRadius + activeDay * gap));
        const candidateDistance = Math.abs(distance - (innerRadius + candidate * gap));
        if (candidateDistance + gap * 0.14 >= currentDistance) return;
      }
      selectDay(candidate);
    };
    let shutdownHoldTimer = null;
    let shutdownHoldPointer = null;
    const cancelShutdownHold = () => {
      if (shutdownHoldTimer) window.clearTimeout(shutdownHoldTimer);
      shutdownHoldTimer = null;
      shutdownHoldPointer = null;
      shutdownTitleHit.classList.remove("is-holding");
    };
    const pointerDistanceFromCenter = event => {
      const transform = svg.getScreenCTM();
      if (!transform) return Infinity;
      const pointer = svg.createSVGPoint();
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      const local = pointer.matrixTransform(transform.inverse());
      return Math.hypot(local.x - cx, local.y - cy);
    };
    const beginShutdownHold = event => {
      if (!shutdownEnabled || shutdownRequested || !shutdownDialog.hidden) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (pointerDistanceFromCenter(event) > innerRadius * 0.68) return;
      cancelShutdownHold();
      shutdownHoldPointer = event.pointerId;
      shutdownTitleHit.classList.add("is-holding");
      shutdownHoldTimer = window.setTimeout(() => {
        cancelShutdownHold();
        showShutdownDialog();
      }, 1800);
    };
    const trackShutdownHold = event => {
      if (event.pointerId !== shutdownHoldPointer) return;
      if (pointerDistanceFromCenter(event) > innerRadius * 0.75) cancelShutdownHold();
    };
    stage.onpointermove = event => {
      handleOrbitPointer(event);
      trackShutdownHold(event);
    };
    stage.onpointerdown = event => {
      handleOrbitPointer(event);
      beginShutdownHold(event);
    };
    stage.onpointerup = cancelShutdownHold;
    stage.onpointerleave = event => {
      cancelShutdownHold();
      if (viewMode === "days" && event.pointerType !== "touch") clearDay();
    };
    stage.onpointercancel = stage.onpointerleave;
    svg.oncontextmenu = event => {
      if (phoneLayout.matches || pointerDistanceFromCenter(event) <= innerRadius * 0.75) event.preventDefault();
    };

    applyViewMode = () => {
      const showArt = viewMode === "art";
      document.body.classList.toggle("art-view", showArt);
      centerBrand.setAttribute("y", String(showArt ? cy : cy - 50));
      centerBrand.setAttribute("dominant-baseline", showArt ? "middle" : "auto");
      if (showArt && !artBuilt) {
        currentProfile.days.forEach((day, index) => {
          artBreathing.appendChild(artRing(day, index, cx, cy, innerRadius + index * gap, shapeGap));
        });
        artBuilt = true;
      }
      artLayer.classList.toggle("is-hidden", !showArt);
      const showDays = viewMode === "days";
      const showPatterns = viewMode === "patterns";
      activeDay = null;
      stage.dataset.view = viewMode;
      mobileOrbitControls.dataset.view = viewMode;
      dayDialPanel.hidden = !showDays;
      daysLayer.classList.toggle("is-hidden", !showDays);
      patternsLayer.classList.toggle("is-hidden", !showPatterns);
      viewOptions.forEach(option => {
        const isActive = option.dataset.view === viewMode;
        option.classList.toggle("is-active", isActive);
        option.setAttribute("aria-pressed", String(isActive));
      });
      groups.forEach(group => group.classList.remove("is-selected", "is-dimmed"));
      trendWindowGroups.forEach(group => group.classList.remove("is-active", "is-dimmed"));
      if (showPatterns) {
        periodTitle.textContent = "Recurring trends";
        periodNote.textContent = detectedPatterns.length
          ? `seven traces · ${historyPosition} · color reveals repetition`
          : `no strong recurring window · ${historyPosition}`;
        showPatternDefault();
      } else {
        periodTitle.textContent = defaultTitle;
        periodNote.textContent = defaultNote;
        showDefaultCenter();
        if (phoneLayout.matches && Number.isInteger(mobileSelectedDay)) {
          selectDay(mobileSelectedDay);
        }
      }
      syncDayDial();
    };
    applyViewMode();
  }

  function showMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("is-error", isError);
    message.hidden = !text;
  }

  function beginIntro() {
    if (viewMode === "art") {
      introVortex.hidden = true;
      return Promise.resolve();
    }
    mobileOrbitControls.hidden = true;
    introVortex.classList.remove("is-leaving");
    introConnect.hidden = false;
    introConnect.classList.remove("is-leaving");
    introCurves.hidden = true;
    introCurves.classList.remove("is-active");
    introVortex.hidden = false;
    drawConnectIntro();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 180 : 1750;
    return new Promise(resolve => window.setTimeout(resolve, duration));
  }

  function beginCurveIntro() {
    if (viewMode === "art") return Promise.resolve();
    const width = Math.max(280, Math.min(720, stage.clientWidth));
    drawIntroData(width, width);
    introCurves.hidden = false;
    window.requestAnimationFrame(() => {
      introConnect.classList.add("is-leaving");
      introCurves.classList.add("is-active");
    });
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 450 : 3500;
    return new Promise(resolve => window.setTimeout(resolve, duration));
  }

  function endIntro() {
    introVortex.hidden = true;
    mobileOrbitControls.hidden = false;
    introVortex.classList.remove("is-leaving");
    introConnect.classList.remove("is-leaving");
    introCurves.classList.remove("is-active");
    introCurves.hidden = true;
    revealArt();
  }

  async function fetchJSON(url, options) {
    const response = await fetch(url, { ...options, headers: { Accept: "application/json", ...(options || {}).headers } });
    const payload = await response.json();
    if (!response.ok) {
      const error = new Error(payload.message || payload.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.code = payload.error;
      throw error;
    }
    return payload;
  }

  function renderSample() {
    const records = sampleRecords();
    loadHistory(records, null, true);
    mobileSelectedDay = null;
    freshness.textContent = "preview data";
    draw();
  }

  async function loadDexcomData() {
    statusText.textContent = "Loading Dexcom…";
    try {
      const payload = await fetchJSON(`/api/glucose?days=${HISTORY_FETCH_DAYS}`);
      loadHistory(payload.records, payload.averageMmol, false, false);
      mobileSelectedDay = null;
      draw();
      statusText.textContent = payload.syncError ? "Dexcom data cached" : "Dexcom Share live";
      const last = payload.lastAvailableDisplayTime
        ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(payload.lastAvailableDisplayTime))
        : "no readings available";
      const historyNote = payload.availableDays < DAYS_PER_PERIOD * HISTORY_PERIODS
        ? ` · building history ${payload.availableDays}/${DAYS_PER_PERIOD * HISTORY_PERIODS} days`
        : "";
      const syncNote = payload.syncError ? " · sync needs attention" : "";
      freshness.textContent = `last available ${last}${historyNote}${syncNote}`;
      // Automatic collection is the normal path. Keep the manual action out of
      // the interface unless it is useful for recovering from an actual error.
      syncButton.hidden = !payload.syncError;
      showMessage(payload.syncError || "", Boolean(payload.syncError));
    } catch (error) {
      statusText.textContent = "Dexcom needs attention";
      syncButton.hidden = false;
      showMessage(error.message, true);
    }
  }

  async function initialize() {
    const connectMinimum = beginIntro();
    try {
      const status = await fetchJSON("/api/status");
      shutdownEnabled = Boolean(status.shutdownEnabled);
      if (!status.configured) {
        viewMode = "days";
        renderSample();
        statusText.textContent = "Dexcom Share setup needed";
        showMessage("Add your private Dexcom Share username and password to .env, then restart Sugar Orbits.");
        return;
      }
      dexcomConfigured = true;
      await loadDexcomData();
    } catch (error) {
      statusText.textContent = "App unavailable";
      showMessage(error.message, true);
    } finally {
      if (!currentProfile) {
        viewMode = "days";
        renderSample();
      }
      await connectMinimum;
      await beginCurveIntro();
      endIntro();
    }
  }

  syncButton.addEventListener("click", async () => {
    syncButton.disabled = true;
    statusText.textContent = "Syncing Dexcom…";
    try {
      await fetchJSON("/api/sync", { method: "POST" });
      await loadDexcomData();
    } catch (error) {
      showMessage(error.message, true);
      statusText.textContent = "Dexcom needs attention";
    } finally {
      syncButton.disabled = false;
    }
  });

  // The server contacts Dexcom every five minutes. Read its local cache more
  // frequently so the screen picks up the completed refresh instead of racing
  // the collector on the same five-minute boundary.
  window.setInterval(() => {
    if (!document.hidden && dexcomConfigured) loadDexcomData();
  }, 60000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && dexcomConfigured) loadDexcomData();
  });

  window.addEventListener("pageshow", () => {
    if (dexcomConfigured) loadDexcomData();
  });

  viewOptions.forEach(option => {
    option.addEventListener("click", () => {
      viewMode = option.dataset.view || "days";
      applyViewMode();
      revealArt();
    });
  });

  let lastInteraction = performance.now();
  let idleTimer;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function updateArtMotion() {
    document.body.classList.toggle("art-motion-paused",
      document.hidden || reducedMotion.matches || performance.now() - lastInteraction >= 120000);
  }
  function recordInteraction(event) {
    const wasIdle = performance.now() - lastInteraction >= 120000;
    lastInteraction = performance.now();
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(updateArtMotion, 120050);
    updateArtMotion();
    if (wasIdle && event.type === "pointerdown") revealArt();
  }
  document.addEventListener("pointerdown", recordInteraction, { capture: true, passive: true });
  document.addEventListener("pointermove", recordInteraction, { passive: true });
  document.addEventListener("keydown", recordInteraction);
  document.addEventListener("visibilitychange", updateArtMotion);
  reducedMotion.addEventListener("change", updateArtMotion);
  idleTimer = window.setTimeout(updateArtMotion, 120050);
  updateArtMotion();

  let swipeStart = null;
  const activeTouchPoints = new Map();
  let historyPinch = null;

  function touchSpread(pointerIds) {
    const points = pointerIds.map(pointerId => activeTouchPoints.get(pointerId)).filter(Boolean);
    if (points.length !== pointerIds.length) return 0;
    let distanceTotal = 0;
    let pairs = 0;
    points.forEach((point, index) => {
      points.slice(index + 1).forEach(other => {
        distanceTotal += Math.hypot(point.x - other.x, point.y - other.y);
        pairs += 1;
      });
    });
    return pairs ? distanceTotal / pairs : 0;
  }

  function endHistoryPinch(pointerId) {
    activeTouchPoints.delete(pointerId);
    if (!historyPinch) {
      if (!activeTouchPoints.size) {
        threeFingerGestureActive = false;
        stage.classList.remove("is-history-pinching");
      }
      return;
    }
    if (!historyPinch.pointerIds.includes(pointerId)) return;
    if (historyPinch.pointerIds.every(id => activeTouchPoints.has(id))) return;
    historyPinch = null;
    if (!activeTouchPoints.size) {
      threeFingerGestureActive = false;
      stage.classList.remove("is-history-pinching");
    }
  }

  stage.addEventListener("pointerdown", event => {
    if (!roundDisplayLayout.matches || event.pointerType !== "touch" || !introVortex.hidden) return;
    activeTouchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activeTouchPoints.size > 1) swipeStart = null;
    if (!historyPinch && activeTouchPoints.size === 3) {
      const pointerIds = [...activeTouchPoints.keys()].slice(0, 3);
      historyPinch = {
        pointerIds,
        startSpread: touchSpread(pointerIds),
        triggered: false
      };
      threeFingerGestureActive = true;
      mobileSelectedDay = null;
      clearCurrentDay();
      swipeStart = null;
      stage.classList.add("is-history-pinching");
      event.preventDefault();
    }
  }, { passive: false });

  stage.addEventListener("pointermove", event => {
    if (!activeTouchPoints.has(event.pointerId)) return;
    activeTouchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!historyPinch || !historyPinch.pointerIds.includes(event.pointerId)) return;
    event.preventDefault();
    if (historyPinch.triggered || historyPinch.startSpread < 24) return;
    const ratio = touchSpread(historyPinch.pointerIds) / historyPinch.startSpread;
    let changed = false;
    if (ratio <= 0.82) {
      historyPinch.triggered = true;
      changed = showHistoryPeriod(currentPeriodOffset + 1);
    } else if (ratio >= 1.18) {
      historyPinch.triggered = true;
      changed = showHistoryPeriod(currentPeriodOffset - 1);
    }
    if (historyPinch.triggered && navigator.vibrate) {
      navigator.vibrate(changed ? 16 : [7, 24, 7]);
    }
  }, { passive: false });

  stage.addEventListener("pointerup", event => endHistoryPinch(event.pointerId));
  stage.addEventListener("pointercancel", event => endHistoryPinch(event.pointerId));

  stage.addEventListener("pointerdown", event => {
    if (!introVortex.hidden) return;
    // Some kiosk touch drivers deliver mouse-like pointer events.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Only a single finger may switch views; reserve multi-touch for history.
    if (event.isPrimary === false || activeTouchPoints.size > 1) {
      swipeStart = null;
      return;
    }
    // Capture on the persistent stage so releases cannot disappear when the
    // SVG is refreshed or a finger leaves the painted curve.
    if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
    swipeStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now()
    };
  });
  stage.addEventListener("pointerup", event => {
    if (!swipeStart || event.pointerId !== swipeStart.pointerId) return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    const elapsed = performance.now() - swipeStart.time;
    swipeStart = null;
    if (elapsed > 2000 || Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    const modes = ["art", "days", "patterns"];
    const nextIndex = (modes.indexOf(viewMode) + (deltaX < 0 ? 1 : -1) + modes.length) % modes.length;
    const nextMode = modes[nextIndex];
    if (nextMode === viewMode) return;
    viewMode = nextMode;
    applyViewMode();
    revealArt();
    if (navigator.vibrate) navigator.vibrate(12);
  });
  stage.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  window.addEventListener("keydown", event => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const modes = ["art", "days", "patterns"];
      const index = Math.max(0, Math.min(2, modes.indexOf(viewMode) + (event.key === "ArrowRight" ? 1 : -1)));
      viewMode = modes[index];
      applyViewMode();
      revealArt();
      event.preventDefault();
    }
    if (event.key === "PageDown") showHistoryPeriod(currentPeriodOffset + 1);
    if (event.key === "PageUp") showHistoryPeriod(currentPeriodOffset - 1);
  });

  roundDisplayLayout.addEventListener("change", () => {
    syncDisplayLayout();
    draw();
  });

  const observer = new ResizeObserver(draw);
  observer.observe(stage);
  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }
  initialize();
})();
