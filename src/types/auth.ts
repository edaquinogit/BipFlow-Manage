export interface RequestResetPayload {
  email: string
}

export interface ConfirmResetPayload {
  token: string
  password: string
}
