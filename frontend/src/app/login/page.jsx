"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/browser";
import { FINANCIAL_ROLES } from "../../lib/constants";
import RoleChipSelector from "../../components/auth/RoleChipSelector";
import PasswordStrengthMeter from "../../components/auth/PasswordStrengthMeter";

// Helper: Extract Initials for Dynamic Avatar
function getInitials(name) {
  if (!name || !name.trim()) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Icons
function EyeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState(FINANCIAL_ROLES[0]);
  const [agreedToTerms, setAgreedToTerms] = useState(true);

  // Interactive Visibility Toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setErrorMessage(errorParam);
    }
  }, [searchParams]);

  // Real-time password criteria
  const passwordCriteria = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
  }, [password]);

  // Real-time password strength calculation
  const strength = useMemo(() => {
    if (!password) {
      return { score: 0, label: "Enter Password", colorClass: "none" };
    }
    const score =
      (passwordCriteria.minLength ? 1 : 0) +
      (passwordCriteria.hasUpper ? 1 : 0) +
      (passwordCriteria.hasNumber ? 1 : 0) +
      (passwordCriteria.hasSpecial ? 1 : 0);

    if (score <= 1) return { score: 1, label: "Weak", colorClass: "weak" };
    if (score === 2) return { score: 2, label: "Fair", colorClass: "fair" };
    if (score === 3) return { score: 3, label: "Good", colorClass: "good" };
    return { score: 4, label: "Strong", colorClass: "strong" };
  }, [password, passwordCriteria]);

  // Real-time email validation
  const isEmailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  // Confirm password match check
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return false;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  // Avatar Initials
  const initials = useMemo(() => getInitials(fullName), [fullName]);

  // Handle Google OAuth
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const supabase = createClient();
      const redirectOrigin = window.location.origin;
      const redirectTo = `${redirectOrigin}/auth/callback?next=/workspace`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          scopes: "email profile openid",
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
      }
    } catch (err) {
      setErrorMessage(err.message || "Failed to initiate Google sign-in.");
      setLoading(false);
    }
  };

  // Handle Classic Email & Password
  const handleEmailPasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    if (!isEmailValid) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }

    if (mode === "signup") {
      if (password.length < 8) {
        setErrorMessage("Password must be at least 8 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please re-enter.");
        return;
      }

      if (!agreedToTerms) {
        setErrorMessage("Please accept the SEC citation governance terms to continue.");
        return;
      }
    } else {
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters long.");
        return;
      }
    }

    setLoading(true);

    try {
      const supabase = createClient();

      if (mode === "signin") {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) {
          setErrorMessage(error.message || "Invalid email or password.");
          setLoading(false);
          return;
        }

        if (data?.session) {
          window.location.href = "/workspace";
        }
      } else {
        // Sign Up with custom metadata (Full Name & Financial Role)
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim() || undefined,
              role: selectedRole,
            },
          },
        });

        if (error) {
          setErrorMessage(error.message || "Failed to create account.");
          setLoading(false);
          return;
        }

        if (data?.session) {
          // Instant session granted
          window.location.href = "/workspace";
        } else if (data?.user) {
          // Email confirmation or pending verification
          setSuccessMessage(
            `Account successfully registered for ${fullName.trim() || cleanEmail}! If email verification is enabled in your Supabase dashboard, check your inbox. Otherwise, click Sign In below.`
          );
          setMode("signin");
          setLoading(false);
        }
      }
    } catch (err) {
      setErrorMessage(err.message || "An unexpected authentication error occurred.");
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Brand Header */}
        <div className="login-brand-header">
          <div className="login-brand-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <h1 className="login-app-title">DocIntel Terminal</h1>
          <p className="login-app-subtitle">
            {mode === "signin"
              ? "SEC 10-K Financial Intelligence & Audited Verification Platform"
              : "Create an analyst account with encrypted SEC citation memory"}
          </p>
        </div>

        {/* Auth Mode Tabs (Sign In vs Create Account) */}
        <div className="auth-mode-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            className={`auth-tab-btn ${mode === "signin" ? "active" : ""}`}
            onClick={() => {
              setMode("signin");
              setErrorMessage("");
              setSuccessMessage("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            className={`auth-tab-btn ${mode === "signup" ? "active" : ""}`}
            onClick={() => {
              setMode("signup");
              setErrorMessage("");
              setSuccessMessage("");
            }}
          >
            Create Account
          </button>
        </div>

        {/* Success Alert Display */}
        {successMessage && (
          <div className="login-success-alert" role="status">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert Display */}
        {errorMessage && (
          <div className="login-error-alert" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Email & Password Form */}
        <form onSubmit={handleEmailPasswordSubmit} className="classic-auth-form">
          {/* Interactive Sign-Up Fields */}
          {mode === "signup" && (
            <>
              {/* Full Name with Live Initials Avatar Badge */}
              <div className="form-field-group">
                <div className="form-label-row">
                  <label className="form-label" htmlFor="fullName">Full Name</label>
                  {fullName && (
                    <span className="live-avatar-tag">
                      Initials: <strong>{initials}</strong>
                    </span>
                  )}
                </div>
                <div className="avatar-input-container">
                  <div className={`avatar-live-preview ${initials ? "has-initials" : ""}`} aria-hidden="true">
                    {initials || (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    )}
                  </div>
                  <input
                    id="fullName"
                    type="text"
                    placeholder="e.g. John Doe"
                    className="form-input with-avatar-padding"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Interactive Financial Role Selector Chips */}
              <RoleChipSelector
                selectedRole={selectedRole}
                onSelectRole={setSelectedRole}
                roles={FINANCIAL_ROLES}
              />
            </>
          )}

          {/* Work Email Field */}
          <div className="form-field-group">
            <div className="form-label-row">
              <label className="form-label" htmlFor="email">Work Email</label>
              {email && (
                <span className={`email-validation-badge ${isEmailValid ? "valid" : "invalid"}`}>
                  {isEmailValid ? "✓ Valid format" : "Enter valid email"}
                </span>
              )}
            </div>
            <div className="input-with-icon-wrapper">
              <input
                id="email"
                type="email"
                placeholder="analyst@work.com"
                className={`form-input ${email ? (isEmailValid ? "input-valid" : "") : ""}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          {/* Password Field with Eye Toggle */}
          <div className="form-field-group">
            <div className="form-label-row">
              <label className="form-label" htmlFor="password">Password</label>
              {mode === "signup" && password && (
                <span className={`password-strength-tag ${strength.colorClass}`}>
                  {strength.label}
                </span>
              )}
            </div>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="form-input password-field"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
              />
              <button
                type="button"
                className="btn-password-eye"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Hide password" : "Show password"}
                aria-label="Toggle password visibility"
                tabIndex={-1}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            {/* Interactive Password Strength Meter (Sign-Up Only) */}
            {mode === "signup" && (
              <PasswordStrengthMeter
                strength={strength}
                passwordCriteria={passwordCriteria}
              />
            )}
          </div>

          {/* Confirm Password Field with Live Match Indicator (Sign-Up Only) */}
          {mode === "signup" && (
            <div className="form-field-group">
              <div className="form-label-row">
                <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
                {confirmPassword && (
                  <span className={`confirm-match-tag ${passwordsMatch ? "matched" : "mismatched"}`}>
                    {passwordsMatch ? "✓ Passwords match" : "✕ Must match password"}
                  </span>
                )}
              </div>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className={`form-input password-field ${
                    confirmPassword ? (passwordsMatch ? "input-valid" : "input-invalid") : ""
                  }`}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="btn-password-eye"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label="Toggle confirm password visibility"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
          )}

          {/* Interactive Checkbox for Governance Agreement */}
          {mode === "signup" && (
            <div className="terms-agreement-row">
              <label className="checkbox-label" htmlFor="termsCheck">
                <input
                  id="termsCheck"
                  type="checkbox"
                  className="custom-terms-checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span className="checkbox-text">
                  I acknowledge authorized SEC 10-K financial intelligence access with audited citation tracking.
                </span>
              </label>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            className="btn-primary-auth"
            disabled={loading}
          >
            {loading ? (
              <span className="oauth-loading-spinner light" />
            ) : mode === "signin" ? (
              "Sign In with Email"
            ) : (
              "Create Free Analyst Account →"
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* Google OAuth Action Button */}
        <div className="login-action-box">
          <button
            type="button"
            className="btn-google-oauth"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <span className="oauth-loading-spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{mode === "signin" ? "Continue with Google" : "Sign up with Google"}</span>
          </button>
        </div>

        {/* Dynamic Mode Switcher Footer */}
        <div className="auth-switch-footer">
          {mode === "signin" ? (
            <p>
              Don't have an analyst account yet?{" "}
              <button
                type="button"
                className="link-switch-mode"
                onClick={() => {
                  setMode("signup");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              >
                Create Account
              </button>
            </p>
          ) : (
            <p>
              Already registered?{" "}
              <button
                type="button"
                className="link-switch-mode"
                onClick={() => {
                  setMode("signin");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              >
                Sign In
              </button>
            </p>
          )}
        </div>

        {/* Feature Highlights (Sign In view) */}
        {mode === "signin" && (
          <div className="login-features-list">
            <div className="login-feature-item">
              <span className="feature-check">✓</span>
              <span>Enterprise bcrypt hashing &amp; OAuth 2.0 session tokens</span>
            </div>
            <div className="login-feature-item">
              <span className="feature-check">✓</span>
              <span>Row-level PostgreSQL security isolated to your verified user ID</span>
            </div>
            <div className="login-feature-item">
              <span className="feature-check">✓</span>
              <span>Real-time SEC citation ledger &amp; audited formula tracing</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="login-page-wrapper"><div className="login-card-container">Loading authentication...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
