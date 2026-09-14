/**
 * Customer authentication feature exports.
 */

export { customerSignInAction, type CustomerSignInActionResult } from './actions/sign-in';
export { customerSignOutAction } from './actions/sign-out';
export { customerSignUpAction, type CustomerSignUpActionResult } from './actions/sign-up';
export {
  requestPasswordResetAction,
  type RequestPasswordResetActionResult,
} from './actions/request-password-reset';
export { updatePasswordAction, type UpdatePasswordActionResult } from './actions/update-password';
export { CustomerAccountMenu } from './components/customer-account-menu';
export { CustomerAuthPanel } from './components/customer-auth-panel';
export { CustomerForgotPasswordForm } from './components/customer-forgot-password-form';
export { CustomerLoginForm } from './components/customer-login-form';
export { CustomerResetPasswordView } from './components/customer-reset-password-form';
export { CustomerSignupForm } from './components/customer-signup-form';
export { PasswordStrength } from './components/password-strength';
export { evaluatePasswordStrength, PASSWORD_CRITERIA } from './lib/password-strength';
export {
  customerPasswordSchema,
  customerResetPasswordSchema,
  customerSignUpSchema,
  resetPasswordRequestSchema,
  signInCredentialsSchema,
  type CustomerResetPasswordInput,
  type CustomerSignUpInput,
  type ResetPasswordRequest,
  type SignInCredentials,
} from './validations/credentials';
