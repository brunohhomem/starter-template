import { CookieService, CookieConfig } from './cookie.service';
import { Response } from 'express';

interface MockResponse {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

interface MockRequest {
  cookies: Record<string, string> | undefined;
}

describe('CookieService', () => {
  let cookieService: CookieService;
  let mockResponse: MockResponse;
  let mockRequest: MockRequest;

  const config: CookieConfig = {
    secure: false,
    accessTtlMinutes: 15,
    refreshTtlDays: 7,
  };

  beforeEach(() => {
    cookieService = new CookieService(config);
    mockResponse = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };
    mockRequest = { cookies: {} };
  });

  describe('setAuthCookies', () => {
    it('define access_token cookie com flags corretas', () => {
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-456';

      cookieService.setAuthCookies(mockResponse as unknown as Response, accessToken, refreshToken);

      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);

      const accessCookieCall = mockResponse.cookie.mock.calls.find(
        (call) => call[0] === 'access_token',
      );
      expect(accessCookieCall).toBeDefined();
      expect(accessCookieCall?.[1]).toBe(accessToken);
      expect(accessCookieCall?.[2]).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 15 * 60 * 1000,
      });
    });

    it('define refresh_token cookie com path /api/auth', () => {
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-456';

      cookieService.setAuthCookies(mockResponse as unknown as Response, accessToken, refreshToken);

      const refreshCookieCall = mockResponse.cookie.mock.calls.find(
        (call) => call[0] === 'refresh_token',
      );
      expect(refreshCookieCall).toBeDefined();
      expect(refreshCookieCall?.[1]).toBe(refreshToken);
      expect(refreshCookieCall?.[2]).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api/auth',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    });

    it('usa secure=true quando configurado', () => {
      const secureService = new CookieService({ ...config, secure: true });
      const accessToken = 'access-token-123';
      const refreshToken = 'refresh-token-456';

      secureService.setAuthCookies(mockResponse as unknown as Response, accessToken, refreshToken);

      const accessCookieCall = mockResponse.cookie.mock.calls.find(
        (call) => call[0] === 'access_token',
      );
      expect(accessCookieCall?.[2].secure).toBe(true);

      const refreshCookieCall = mockResponse.cookie.mock.calls.find(
        (call) => call[0] === 'refresh_token',
      );
      expect(refreshCookieCall?.[2].secure).toBe(true);
    });
  });

  describe('clearAuthCookies', () => {
    it('limpa ambos os cookies com flags corretas', () => {
      cookieService.clearAuthCookies(mockResponse as unknown as Response);

      expect(mockResponse.clearCookie).toHaveBeenCalledTimes(2);

      const accessClearCall = mockResponse.clearCookie.mock.calls.find(
        (call) => call[0] === 'access_token',
      );
      expect(accessClearCall).toBeDefined();
      expect(accessClearCall?.[1]).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
      });

      const refreshClearCall = mockResponse.clearCookie.mock.calls.find(
        (call) => call[0] === 'refresh_token',
      );
      expect(refreshClearCall).toBeDefined();
      expect(refreshClearCall?.[1]).toEqual({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/api/auth',
      });
    });

    it('usa secure=true quando configurado', () => {
      const secureService = new CookieService({ ...config, secure: true });
      secureService.clearAuthCookies(mockResponse as unknown as Response);

      const accessClearCall = mockResponse.clearCookie.mock.calls.find(
        (call) => call[0] === 'access_token',
      );
      expect(accessClearCall?.[1].secure).toBe(true);

      const refreshClearCall = mockResponse.clearCookie.mock.calls.find(
        (call) => call[0] === 'refresh_token',
      );
      expect(refreshClearCall?.[1].secure).toBe(true);
    });
  });

  describe('getAccessToken', () => {
    it('retorna access_token do cookie', () => {
      const accessTokenCookie: Record<string, string> = { ['access_token']: 'my-access-token' };
      mockRequest.cookies = accessTokenCookie;

      const token = cookieService.getAccessToken(mockRequest);

      expect(token).toBe('my-access-token');
    });

    it('retorna undefined se cookie não existir', () => {
      mockRequest.cookies = {};

      const token = cookieService.getAccessToken(mockRequest);

      expect(token).toBeUndefined();
    });

    it('retorna undefined se cookies for undefined', () => {
      const reqNoCookies: MockRequest = { cookies: undefined };

      const token = cookieService.getAccessToken(reqNoCookies);

      expect(token).toBeUndefined();
    });
  });

  describe('getRefreshToken', () => {
    it('retorna refresh_token do cookie', () => {
      const refreshTokenCookie: Record<string, string> = { ['refresh_token']: 'my-refresh-token' };
      mockRequest.cookies = refreshTokenCookie;

      const token = cookieService.getRefreshToken(mockRequest);

      expect(token).toBe('my-refresh-token');
    });

    it('retorna undefined se cookie não existir', () => {
      mockRequest.cookies = {};

      const token = cookieService.getRefreshToken(mockRequest);

      expect(token).toBeUndefined();
    });
  });
});
