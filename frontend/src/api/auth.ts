import client from './client';

export interface AuthResponse {
  user: { id: string; name: string; email: string; avatar?: string | null };
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    client.post<AuthResponse>('/auth/register', { name, email, password }).then((r) => r.data),

  login: (email: string, password: string) =>
    client.post<AuthResponse>('/auth/login', { email, password }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    client.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) =>
    client.post('/auth/logout', { refreshToken }),

  getMe: () =>
    client.get<{ id: string; name: string; email: string; avatar?: string | null; createdAt: string }>('/auth/me').then((r) => r.data),

  updateMe: (data: { name?: string; avatar?: string | null }) =>
    client.put<{ id: string; name: string; email: string; avatar?: string | null }>('/auth/me', data).then((r) => r.data),
};
