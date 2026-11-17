export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
};

export function apiResponse<T>(message: string, data: T): ApiSuccess<T> {
  return {
    success: true,
    message,
    data,
  };
}
