import { createStore } from 'zustand/vanilla';

// Which list row is swiped open, if any. As in UITableView, only one row is
// open at a time: swiping another row, scrolling, or touching anywhere else
// closes it, and a tap that closes a row does nothing else. `SwipeToDeleteRow`
// reports its own swipes and touches here; `Screen` reports the rest.

type OpenRow = {
  id: string;
  close: () => void;
};

type OpenSwipeRowState = {
  open: OpenRow | null;
  /** The row the current touch began in. Rows hear of a touch before `Screen` does. */
  touchedRowId: string | null;
  /** The current touch closed an open row, so it shouldn't also tap the row under it. */
  touchClosedRow: boolean;
};

const store = createStore<OpenSwipeRowState>()(() => ({
  open: null,
  touchedRowId: null,
  touchClosedRow: false,
}));

/** A row is opening (being dragged open, or springing open): any other open row closes. */
export function swipeRowWillOpen(id: string, close: () => void): void {
  const { open } = store.getState();
  if (open && open.id !== id) open.close();
  store.setState({ open: { id, close } });
}

/** A row is closing, being deleted, or gone. */
export function swipeRowDidClose(id: string): void {
  if (store.getState().open?.id === id) store.setState({ open: null });
}

/** Closes the open row, if there is one. True if it did. */
export function closeOpenSwipeRow(): boolean {
  const { open } = store.getState();
  if (!open) return false;
  store.setState({ open: null });
  open.close();
  return true;
}

/** A touch began inside a row (its own row's `onTouchStart`). */
export function swipeRowTouched(id: string): void {
  store.setState({ touchedRowId: id });
}

/** A touch began anywhere on the screen: closes the open row unless the touch is on it. */
export function screenTouched(): void {
  const { open, touchedRowId } = store.getState();
  const closes = open !== null && open.id !== touchedRowId;
  store.setState({ touchedRowId: null, touchClosedRow: closes });
  if (closes) closeOpenSwipeRow();
}

/**
 * Call when a row is tapped. True when the tap only closes an open row and
 * shouldn't do anything else, as in iOS.
 */
export function tapClosesOpenSwipeRow(): boolean {
  const { touchClosedRow } = store.getState();
  store.setState({ touchClosedRow: false });
  // A row still open here means the touch never reached `Screen`: close it now.
  return closeOpenSwipeRow() || touchClosedRow;
}

/** True while a row is swiped open. */
export function hasOpenSwipeRow(): boolean {
  return store.getState().open !== null;
}
