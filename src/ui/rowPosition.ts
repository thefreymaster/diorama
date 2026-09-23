import { createContext, useContext } from 'react';

type RowPosition = {
  /** First row in its section: no separator above it. */
  isFirst: boolean;
};

/**
 * `InsetGroupedSection` tells each row where it sits, so rows can draw their
 * own separator without the screen passing an index down.
 */
export const RowPositionContext = createContext<RowPosition>({ isFirst: true });

export function useRowPosition(): RowPosition {
  return useContext(RowPositionContext);
}
