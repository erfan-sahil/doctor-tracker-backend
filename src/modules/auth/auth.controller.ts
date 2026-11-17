import { apiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "../../utils/cookie.js";
import { requireUser } from "../../middlewares/authenticate.middleware.js";
import {
  getCurrentUser,
  loginUser,
  revokeRefreshToken,
  rotateRefreshToken,
} from "./auth.service.js";

export const login = asyncHandler(async (req, res) => {
  const result = await loginUser(req.body);
  setRefreshCookie(res, result.refreshToken);

  res.status(200).json(
    apiResponse("Logged in", {
      accessToken: result.accessToken,
      user: result.user,
    }),
  );
});

export const refresh = asyncHandler(async (req, res) => {
  try {
    const result = await rotateRefreshToken(readRefreshCookie(req));
    setRefreshCookie(res, result.refreshToken);
    res.status(200).json(
      apiResponse("Access token refreshed", {
        accessToken: result.accessToken,
      }),
    );
  } catch (error) {
    clearRefreshCookie(res);
    throw error;
  }
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(requireUser(req).id);
  res.status(200).json(apiResponse("Current user", user));
});

export const logout = asyncHandler(async (req, res) => {
  await revokeRefreshToken(readRefreshCookie(req));
  clearRefreshCookie(res);
  res.status(200).json(apiResponse("Logged out", null));
});
