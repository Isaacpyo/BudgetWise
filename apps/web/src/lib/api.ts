import { createApiClient } from './api-client';
import { createApiStatusStore } from './api-status';
import { config } from './config';
import { auth } from './firebase';

export const apiStatus = createApiStatusStore();

export const api = createApiClient({
  baseUrl: config.apiUrl,
  getToken: async () => (auth.currentUser ? auth.currentUser.getIdToken() : null),
  status: apiStatus,
});

export { ApiError, errorMessage } from './api-client';
