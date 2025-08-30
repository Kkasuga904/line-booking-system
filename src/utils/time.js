/**
 * 時間関連ユーティリティモジュール
 * @module utils/time
 */

/**
 * あらゆる形式の時刻をHH:mm形式に正規化
 * @param {string|number} v - 時刻値
 * @returns {string} HH:mm形式の時刻
 */
export function normalizeHHMMAny(v) {
  if (v == null || v === "") return "";

  // 数値: 分単位 or 時のみ
  if (typeof v === "number" && Number.isFinite(v)) {
    if (v <= 24 && Number.isInteger(v)) return String(v).padStart(2, "0") + ":00";
    const h = Math.floor(v / 60), m = v % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  let s = String(v).trim();

  // 全角コロン/中点/ダッシュなどを吸収
  s = s.replace(/[：]/g, ":").replace(/[．。]/g, ".").replace(/[ｰー‐\-]/g, ":");

  // HH:mm / H:mm / HH.mm / H.mm
  let m = s.match(/^(\d{1,2})[:\.](\d{1,2})$/);
  if (m) {
    const h = Math.min(23, Math.max(0, +m[1]));
    const mm = Math.min(59, Math.max(0, +m[2]));
    return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }

  // 9時30分 / 9時 / 9時半
  m = s.match(/^(\d{1,2})時(?:(\d{1,2})分?)?$/);
  if (m) {
    const h = Math.min(23, Math.max(0, +m[1]));
    const mm = m[2] ? Math.min(59, Math.max(0, +m[2])) : 0;
    return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }
  m = s.match(/^(\d{1,2})時半$/);
  if (m) return String(+m[1]).padStart(2, "0") + ":30";

  // 0900 / 900 → 09:00
  if (/^\d{3,4}$/.test(s)) {
    const hm = s.padStart(4, "0");
    const h = +hm.slice(0, 2), mm = +hm.slice(2);
    if (h <= 23 && mm <= 59) return hm.slice(0, 2) + ":" + hm.slice(2);
  }

  // HH / H → HH:00
  if (/^\d{1,2}$/.test(s)) return s.padStart(2, "0") + ":00";

  // 既に HH:mm
  if (/^\d{2}:\d{2}$/.test(s)) return s;

  return "";
}

/**
 * ルールオブジェクトから時刻を抽出
 * @param {Object} rule - ルールオブジェクト
 * @param {string[]} keys - 検索するキーのリスト
 * @returns {string} 正規化された時刻
 */
export function pickTimeFrom(rule, keys) {
  for (const k of keys) {
    const v = k.split(".").reduce((o, p) => (o ? o[p] : undefined), rule);
    const t = normalizeHHMMAny(v);
    if (t) return t;
  }
  return "";
}

/**
 * ルールから開始・終了時刻を解決
 * @param {Object} rule - ルールオブジェクト
 * @returns {{s: string, e: string, isAllDay: boolean}}
 */
export function resolveTimes(rule) {
  const startKeys = [
    "startTime", "start", "from", "time.start", "timeStart",
    "start_minutes", "startMinute", "startMin", "start_time_minutes",
    "startAt", "start_at", "begin", "beginTime"
  ];
  const endKeys = [
    "endTime", "end", "to", "time.end", "timeEnd",
    "end_minutes", "endMinute", "endMin", "end_time_minutes",
    "endAt", "end_at", "finish", "finishTime"
  ];
  const s = pickTimeFrom(rule, startKeys);
  const e = pickTimeFrom(rule, endKeys);
  const isAllDay = rule?.dateMode === "allday" || rule?.allDay === true;
  return { s, e, isAllDay };
}