/**
 * Generic OAuth Token Exchanger
 * Handles token exchange for Microsoft and Google OAuth
 * Takes credentials as input, returns tokens (no persistent storage)
 */

import type { AuthToken, AuthUser } from "./provider-loader.js";

export interface OAuthTokenRequest {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationCode: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
}

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
}

/**
 * Microsoft OAuth Token Exchanger
 */
export async function exchangeMicrosoftToken(request: OAuthTokenRequest): Promise<AuthToken | null> {
  try {
    const params = new URLSearchParams({
      client_id: request.clientId,
      client_secret: request.clientSecret,
      code: request.authorizationCode,
      redirect_uri: request.redirectUri,
      grant_type: "authorization_code"
    });

    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    if (!response.ok) {
      // Don't log response details as they might contain secrets
      return null;
    }

    const data: OAuthTokenResponse = await response.json();
    if (!data.access_token) return null;

    return {
      value: data.access_token,
      providerId: "microsoft",
      issuedAt: new Date().toISOString(),
      expiresAt: data.expires_in 
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined
    };
  } catch (error) {
    // Don't log the actual error as it may contain secrets
    return null;
  }
}

/**
 * Google OAuth Token Exchanger
 */
export async function exchangeGoogleToken(request: OAuthTokenRequest): Promise<AuthToken | null> {
  try {
    const params = new URLSearchParams({
      client_id: request.clientId,
      client_secret: request.clientSecret,
      code: request.authorizationCode,
      redirect_uri: request.redirectUri,
      grant_type: "authorization_code"
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });

    if (!response.ok) {
      // Don't log response details as they might contain secrets
      return null;
    }

    const data: OAuthTokenResponse = await response.json();
    if (!data.access_token) return null;

    return {
      value: data.access_token,
      providerId: "google",
      issuedAt: new Date().toISOString(),
      expiresAt: data.expires_in 
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : undefined
    };
  } catch (error) {
    // Don't log the actual error as it may contain secrets
    return null;
  }
}

/**
 * Get user info from Microsoft using access token
 */
export async function getMicrosoftUserInfo(accessToken: string): Promise<OAuthUserInfo | null> {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: data.id || data.mail,
      email: data.mail,
      name: data.displayName
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get user info from Google using access token
 */
export async function getGoogleUserInfo(accessToken: string): Promise<OAuthUserInfo | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: data.id || data.email,
      email: data.email,
      name: data.name
    };
  } catch (error) {
    return null;
  }
}
