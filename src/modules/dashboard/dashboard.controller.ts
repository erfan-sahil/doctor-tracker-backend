import { requireUser } from "../../middlewares/authenticate.middleware.js";
import { apiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import type { DashboardQuery } from "./dashboard.schema.js";
import { getDashboard } from "./dashboard.service.js";

export const getDashboardHandler = asyncHandler(async (req, res) => {
  const dashboard = await getDashboard(
    requireUser(req),
    req.query as unknown as DashboardQuery,
  );
  res.status(200).json(apiResponse("Dashboard retrieved", dashboard));
});
