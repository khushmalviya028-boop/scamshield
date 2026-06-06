import path from 'path';
import { RBIDataset } from '../../../engine/src/types';

const DATASET_PATH = path.join(__dirname, '..', '..', 'data', 'rbi_dla_dataset.json');

let cachedDataset: RBIDataset | null = null;

export function getRBIDataset(): RBIDataset {
  if (cachedDataset) return cachedDataset;

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const raw = require(DATASET_PATH) as RBIDataset;
  cachedDataset = raw;
  return cachedDataset;
}
