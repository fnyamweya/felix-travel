import type { DateTimeString } from './common.js';
import type { UserRole } from './auth.js';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  role: UserRole;
  isActive: boolean;
  createdAt: DateTimeString;
  updatedAt: DateTimeString;
}

export interface UserProfile {
  userId: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  bio: string | null;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  providerId?: string;
}
