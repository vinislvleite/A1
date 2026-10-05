export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface CreateUserDTO {
  name: string;
  email: string;
  username?: string;
  password: string;
}

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  username?: string;
  loginAt: string;
}
