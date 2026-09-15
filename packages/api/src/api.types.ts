export interface ApiEnvelope<T> {
  success: true;
  data: T;
  request_id: string;
  timestamp: string;
}

export interface ApiFailureEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
  };
  request_id: string;
  timestamp: string;
}
