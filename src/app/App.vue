<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import {
  Layers,
  RotateCcw,
  ArrowUpRight,
  HelpCircle,
  Leaf,
  Undo2,
  Redo2,
} from "lucide-vue-next";
import { createDocument } from "../shared/document";
import {
  PaperPanel,
  papers,
  replacePaper,
  setMaterial,
  setTexture,
} from "../features/paper";
import {
  CreasePanel,
  selectCrease,
  toggleDirection,
  selectedCrease,
} from "../features/creases";
import {
  FoldPanel,
  solvePose,
  hingePositions,
  changeAngle,
  flatten,
  applyTarget,
} from "../features/fold";
import {
  SequencePanel,
  makeSteps,
  seek,
  captureStep,
  usePlayer,
} from "../features/sequence";
import { Viewport, ObservePanel, setView } from "../features/observe";
import { useHistory } from "../features/history";
const doc = reactive(createDocument(papers[0]!, makeSteps(papers[0]!)));
const pose = computed(() => solvePose(doc.paper, doc.angles)),
  hinges = computed(() => hingePositions(doc.paper, pose.value));
const { toggle } = usePlayer(doc);
const history = useHistory(doc);
const help = ref(false),
  toast = ref("");
function notify(s: string) {
  toast.value = s;
  setTimeout(() => (toast.value = ""), 2400);
}
function choosePaper(id: string) {
  const p = papers.find((p) => p.id === id);
  if (p) {
    // 纸张身份、选中折痕与步骤作为一个整体入历史，撤销可完整恢复旧纸结构。
    history.mutate(
      "切换纸张 · " + p.name,
      ["paper", "selected", "angles", "directions", "steps", "step"],
      () => {
        replacePaper(doc, p);
        doc.steps = makeSteps(p);
      },
    );
    setView(doc, "iso");
  }
}
function reset() {
  history.mutate("重新开始", ["angles", "steps", "step"], () => {
    flatten(doc);
    doc.steps = makeSteps(doc.paper);
  });
  setView(doc, "iso");
  notify("已回到平展纸张");
}
function capture() {
  history.mutate("保存当前步骤", ["steps"], () => captureStep(doc));
  notify("当前形态已保存到步骤 " + (doc.step + 1));
}
function onAngle(value: number) {
  history.mutate("调整折叠角度", ["angles"], () => changeAngle(doc, value));
}
function onDirection() {
  history.mutate("切换折叠方向", ["directions", "angles"], () =>
    toggleDirection(doc),
  );
}
function onTarget() {
  history.mutate("折至建议角度", ["angles"], () => applyTarget(doc));
}
function onMaterial(front: string, back: string) {
  history.mutate("调整纸张颜色", ["front", "back"], () =>
    setMaterial(doc, front, back),
  );
}
function onTexture(texture: string) {
  history.mutate("调整表面纹理", ["texture"], () =>
    setTexture(doc, texture),
  );
}
function onKeydown(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  const editable =
    el &&
    (el.isContentEditable ||
      el.tagName === "TEXTAREA" ||
      (el.tagName === "INPUT" &&
        !["range", "checkbox", "radio", "button"].includes(
          (el as HTMLInputElement).type,
        )));
  if (editable || !(e.ctrlKey || e.metaKey)) return;
  const key = e.key.toLowerCase();
  if (key === "z") {
    e.preventDefault();
    if (e.shiftKey) history.redo();
    else history.undo();
  } else if (key === "y") {
    e.preventDefault();
    history.redo();
  }
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));
</script>
<template>
  <div class="workspace">
    <header class="topbar">
      <a class="brand" href="#"
        ><span class="brand-mark">◩</span><strong>折间<span>ORI</span></strong
        ><i></i><small>三维折纸工作室</small></a
      >
      <nav>
        <span class="project-indicator"></span> 未命名的纸间探索
        <span class="local-badge">本次会话</span>
      </nav>
      <div class="header-actions">
        <div class="history-controls">
          <button
            class="icon-button"
            aria-label="撤销"
            :disabled="!history.canUndo.value"
            :title="
              history.canUndo.value
                ? '撤销：' + history.undoLabel.value + '（Ctrl/⌘+Z）'
                : '没有可撤销的操作'
            "
            @click="history.undo()"
          >
            <Undo2 :size="18" /></button
          ><button
            class="icon-button"
            aria-label="重做"
            :disabled="!history.canRedo.value"
            :title="
              history.canRedo.value
                ? '重做：' + history.redoLabel.value + '（Ctrl/⌘+Shift+Z）'
                : '没有可重做的操作'
            "
            @click="history.redo()"
          >
            <Redo2 :size="18" />
          </button>
        </div>
        <button class="icon-button" aria-label="帮助" @click="help = !help">
          <HelpCircle :size="18" /></button
        ><button class="reset" @click="reset">
          <RotateCcw :size="14" />重新开始</button
        ><button class="primary" @click="seek(doc, doc.steps.length - 1)">
          观察成品 <ArrowUpRight :size="15" />
        </button>
      </div>
    </header>
    <main>
      <div class="page-title">
        <div>
          <div class="eyebrow">THE ART OF FOLDING</div>
          <h1>一张纸，无限可能<span>。</span></h1>
          <p>沿着折痕，让平面生长成空间。</p>
        </div>
        <div class="session-note">
          <Leaf :size="16" /><span>放慢一点，折出自己的节奏。</span>
        </div>
      </div>
      <div class="studio">
        <aside class="left-sidebar">
          <PaperPanel
            :doc="doc"
            @paper="choosePaper"
            @material="onMaterial"
            @texture="onTexture"
          /><CreasePanel
            :doc="doc"
            @select="selectCrease(doc, $event)"
          />
          <div class="sidebar-footer">
            <Layers :size="13" /> 单张纸 ·
            {{ doc.paper.faces.length }} 个关联纸面
          </div>
        </aside>
        <div class="center">
          <div class="canvas-label">
            <span
              >{{ doc.paper.name }}
              <small
                >/
                {{
                  doc.paper.id === "shelter" ? "PAPER GARDEN" : "VALLEY WALK"
                }}</small
              ></span
            ><span class="difficulty"
              >入门探索 <i></i><i></i><i class="empty"></i
            ></span>
          </div>
          <Viewport
            :doc="doc"
            :pose="pose"
            :hinges="hinges"
            @select="selectCrease(doc, $event)"
          />
          <div class="instruction">
            <span class="instruction-number">0{{ doc.step + 1 }}</span>
            <div>
              <b>{{ doc.steps[doc.step]?.title }}</b>
              <p>{{ doc.steps[doc.step]?.note }}</p>
            </div>
            <span class="step-count"
              >{{ doc.step + 1 }} / {{ doc.steps.length }}</span
            >
          </div>
        </div>
        <aside class="right-sidebar">
          <div class="selected-heading">
            <span class="eyebrow">当前折痕</span>
            <h2>{{ selectedCrease(doc)?.name }}</h2>
            <p>{{ selectedCrease(doc)?.description }}</p>
          </div>
          <FoldPanel
            :doc="doc"
            @angle="onAngle"
            @angle-begin="history.begin('调整折叠角度', ['angles'])"
            @angle-end="history.end()"
            @direction="onDirection"
            @target="onTarget"
          /><ObservePanel :doc="doc" />
        </aside>
      </div>
      <SequencePanel
        :doc="doc"
        @seek="seek(doc, $event)"
        @play="toggle"
        @capture="capture"
      />
      <footer>
        <span>ORI / 折间 <i>用折叠，重新认识一张纸。</i></span
        ><span
          ><i class="status-dot"></i> 全部计算于浏览器本地
          <small>© 2026 ORI STUDIO</small></span
        >
      </footer>
    </main>
    <div v-if="toast" role="status" class="toast">✓ {{ toast }}</div>
    <div v-if="help" class="modal-backdrop" @click.self="help = false">
      <section class="help-modal">
        <button class="close" @click="help = false">×</button>
        <div class="eyebrow">A SMALL GUIDE</div>
        <h2>从第一道折痕开始</h2>
        <p>
          选择纸张与颜色，点选折痕后拖动角度滑杆。父纸面转动时，关联纸面会一起运动。
        </p>
        <p>
          下方步骤可还原对应形态，也可保存当前角度后播放。拖动画面旋转视角，滚轮缩放，下载按钮可保存当前观察图。
        </p>
        <p>
          折错了不必重来：Ctrl/⌘+Z 撤销、Ctrl/⌘+Shift+Z
          重做，纸张、折向、步骤与材质的调整都可以回退。播放中的形态只是临时观察，不计入历史。
        </p>
        <p>作品保留在本次会话中，刷新会重新开始。</p>
        <button class="primary" @click="help = false">开始探索 ↗</button>
      </section>
    </div>
  </div>
</template>
