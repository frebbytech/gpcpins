import { useSyncExternalStore } from "react";

/**
 * Which account the page is showing. UI state only: the service never trusts it, every call
 * carries the id and the service checks it belongs to the signed-in user.
 */
let selected;
const listeners = new Set();

export function getSelectedAccountId() {
  return selected;
}

export function setSelectedAccountId(id) {
  if (selected === id) return;
  selected = id;
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useSelectedAccountId = () => useSyncExternalStore(subscribe, getSelectedAccountId, () => undefined);
