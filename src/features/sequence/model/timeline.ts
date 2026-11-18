import type { Document } from "../../../shared/types";
import { clamp } from "../../../shared/document";
export function seek(doc: Document, index: number) {
  doc.playing = false;
  doc.step = clamp(index, 0, doc.steps.length - 1);
  doc.angles = { ...doc.steps[doc.step]!.angles };
  const c = doc.paper.creases[doc.step - 1];
  if (c) doc.selected = c.id;
}
export function captureStep(doc: Document) {
  // 播放中的插值形态只是临时观察：先暂停定格，保存的才是用户明确看到的形态。
  doc.playing = false;
  const step = doc.steps[doc.step];
  if (step) {
    step.angles = { ...doc.angles };
    step.note = "已保存当前折叠形态，可随时还原。";
  }
}
