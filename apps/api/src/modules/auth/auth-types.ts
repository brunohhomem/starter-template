export type AuthUserResponse = {
  user: {
    id: string;
    email: string;
    role: string;
    mustChangePassword: boolean;
    emailVerified: boolean;
  };
};
