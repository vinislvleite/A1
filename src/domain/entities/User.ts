export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  loginAt: string;
}
