// 跨组件的「未保存修改」离开拦截标志。
// 编辑器在 dirty 变化时通过 setLeaveDirty 上报，导航入口（左侧菜单 / 面包屑）在离开前通过 isLeaveDirty 检查。
let dirty = false;

export function setLeaveDirty(value) {
  dirty = Boolean(value);
}

export function isLeaveDirty() {
  return dirty;
}

export function resetLeaveDirty() {
  dirty = false;
}
