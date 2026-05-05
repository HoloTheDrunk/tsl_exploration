import type { Box3JSON } from 'three';
import { Las } from 'copc';

export module 'LASLoader';

export default class LASLoader {
  constructor();

  async parseFile(
    data: ArrayBuffer,
    options: Partial<{ colorDepth: 8 | 16 }> = {},
  ): Promise<{
    attributes: Record<string, TypedArray>,
    box: Box3JSON,
    header: Las.Header,
  }>;
}
