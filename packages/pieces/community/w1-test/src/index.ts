import { PieceAuth, createPiece } from '@activepieces/pieces-framework';
import { echoAction } from './lib/actions/echo';

export const w1Test = createPiece({
  displayName: 'W1 Test',
  description: 'Test piece for W1_DevSystem integration verification',
  minimumSupportedRelease: '0.30.0',
  logoUrl: 'https://cdn.activepieces.com/pieces/custom.png',
  auth: PieceAuth.None(),
  categories: [],
  authors: ['w1-dev'],
  actions: [echoAction],
  triggers: [],
});
