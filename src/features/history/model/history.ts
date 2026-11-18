import { computed, shallowReactive } from "vue";
import type { Document, Paper, Step } from "../../../shared/types";

/**
 * 历史只追踪会改变作品结果的切片。
 * 播放中的插值角度、相机视角属于临时观察，不进入历史。
 */
export interface Snapshot {
  paper?: Paper;
  selected?: string;
  angles?: Record<string, number>;
  directions?: Record<string, number>;
  steps?: Step[];
  step?: number;
  front?: string;
  back?: string;
  texture?: string;
}
export type TrackedField = keyof Snapshot;

export interface HistoryEntry {
  label: string;
  before: Snapshot;
  after: Snapshot;
}

const LIMIT = 100;

const cloneSteps = (steps: Step[]): Step[] =>
  steps.map((s) => ({ ...s, angles: { ...s.angles } }));

/** 只复制操作声明触及的字段，作品再大也不会整份克隆。 */
function capture(doc: Document, fields: TrackedField[]): Snapshot {
  const snap: Snapshot = {};
  for (const f of fields) {
    switch (f) {
      case "angles":
        snap.angles = { ...doc.angles };
        break;
      case "directions":
        snap.directions = { ...doc.directions };
        break;
      case "steps":
        snap.steps = cloneSteps(doc.steps);
        break;
      case "paper":
        snap.paper = doc.paper;
        break;
      case "selected":
        snap.selected = doc.selected;
        break;
      case "step":
        snap.step = doc.step;
        break;
      case "front":
        snap.front = doc.front;
        break;
      case "back":
        snap.back = doc.back;
        break;
      case "texture":
        snap.texture = doc.texture;
        break;
    }
  }
  return snap;
}

/**
 * 回退直接写回当时记录的精确数值（角度在写入前已取整），
 * 不做“反向旋转”这类会累积误差的逆运算，因此可以精确重现。
 */
function restore(doc: Document, snap: Snapshot) {
  doc.playing = false;
  if (snap.paper !== undefined) doc.paper = snap.paper;
  if (snap.selected !== undefined) doc.selected = snap.selected;
  if (snap.angles !== undefined) doc.angles = { ...snap.angles };
  if (snap.directions !== undefined)
    doc.directions = { ...snap.directions };
  if (snap.steps !== undefined) doc.steps = cloneSteps(snap.steps);
  if (snap.step !== undefined) doc.step = snap.step;
  if (snap.front !== undefined) doc.front = snap.front;
  if (snap.back !== undefined) doc.back = snap.back;
  if (snap.texture !== undefined) doc.texture = snap.texture;
}

const eqRecord = (a: Record<string, number>, b: Record<string, number>) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
};
const eqMaybeRecord = (
  a?: Record<string, number>,
  b?: Record<string, number>,
) => a === b || (!!a && !!b && eqRecord(a, b));
const eqMaybeSteps = (a?: Step[], b?: Step[]) =>
  a === b ||
  (!!a &&
    !!b &&
    a.length === b.length &&
    a.every((s, i) => {
      const t = b[i]!;
      return (
        s.id === t.id &&
        s.title === t.title &&
        s.note === t.note &&
        s.duration === t.duration &&
        eqRecord(s.angles, t.angles)
      );
    }));

/** before/after 取自同一字段集，逐项比对即可识别无效操作。 */
function sameSnapshot(a: Snapshot, b: Snapshot): boolean {
  return (
    a.paper === b.paper &&
    a.selected === b.selected &&
    a.step === b.step &&
    a.front === b.front &&
    a.back === b.back &&
    a.texture === b.texture &&
    eqMaybeRecord(a.angles, b.angles) &&
    eqMaybeRecord(a.directions, b.directions) &&
    eqMaybeSteps(a.steps, b.steps)
  );
}

export function useHistory(doc: Document) {
  const past = shallowReactive<HistoryEntry[]>([]);
  const future = shallowReactive<HistoryEntry[]>([]);
  /** 进行中的连续手势（如拖动滑杆）：期间所有预览变化合并为一笔。 */
  let tx: {
    label: string;
    fields: TrackedField[];
    before: Snapshot;
  } | null = null;

  function push(entry: HistoryEntry) {
    past.push(entry);
    if (past.length > LIMIT) past.shift();
    // 分支编辑：一旦出现新操作，失效的重做分支整体丢弃。
    future.length = 0;
  }

  /**
   * 记录一次原子操作。若同名手势事务正在进行，变化累积进该事务，
   * 不新增条目——一次拖动无论触发多少次预览都只占一次操作。
   */
  function mutate(label: string, fields: TrackedField[], fn: () => void) {
    if (tx) {
      if (tx.label === label) {
        fn();
        return;
      }
      end();
    }
    const before = capture(doc, fields);
    fn();
    const after = capture(doc, fields);
    if (!sameSnapshot(before, after)) push({ label, before, after });
  }

  /** 开始连续手势：只在起点取一次快照，指针移动期间零复制。 */
  function begin(label: string, fields: TrackedField[]) {
    if (tx) end();
    tx = { label, fields, before: capture(doc, fields) };
  }

  /** 结束手势：与起点快照比对，有实际变化才落一笔。 */
  function end() {
    if (!tx) return;
    const { label, fields, before } = tx;
    tx = null;
    const after = capture(doc, fields);
    if (!sameSnapshot(before, after)) push({ label, before, after });
  }

  function undo() {
    end();
    const entry = past.pop();
    if (!entry) return;
    restore(doc, entry.before);
    future.push(entry);
  }

  function redo() {
    end();
    const entry = future.pop();
    if (!entry) return;
    restore(doc, entry.after);
    past.push(entry);
  }

  return {
    mutate,
    begin,
    end,
    undo,
    redo,
    canUndo: computed(() => past.length > 0),
    canRedo: computed(() => future.length > 0),
    undoLabel: computed(() => past[past.length - 1]?.label ?? ""),
    redoLabel: computed(() => future[future.length - 1]?.label ?? ""),
  };
}
