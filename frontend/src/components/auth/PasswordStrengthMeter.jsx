"use client";

/**
 * PasswordStrengthMeter Component
 * Renders real-time 4-segment strength bar and animated criteria checklist badges.
 */
export default function PasswordStrengthMeter({ strength, passwordCriteria }) {
  if (!strength || !passwordCriteria) return null;

  return (
    <div className="password-meter-box">
      <div className="password-meter-bars">
        <div className={`meter-segment ${strength.score >= 1 ? `filled ${strength.colorClass}` : ""}`} />
        <div className={`meter-segment ${strength.score >= 2 ? `filled ${strength.colorClass}` : ""}`} />
        <div className={`meter-segment ${strength.score >= 3 ? `filled ${strength.colorClass}` : ""}`} />
        <div className={`meter-segment ${strength.score >= 4 ? `filled ${strength.colorClass}` : ""}`} />
      </div>
      <div className="password-criteria-badges">
        <span className={`criterion-pill ${passwordCriteria.minLength ? "met" : ""}`}>
          {passwordCriteria.minLength ? "✓" : "○"} 8+ chars
        </span>
        <span className={`criterion-pill ${passwordCriteria.hasUpper ? "met" : ""}`}>
          {passwordCriteria.hasUpper ? "✓" : "○"} Uppercase
        </span>
        <span className={`criterion-pill ${passwordCriteria.hasNumber ? "met" : ""}`}>
          {passwordCriteria.hasNumber ? "✓" : "○"} Number
        </span>
        <span className={`criterion-pill ${passwordCriteria.hasSpecial ? "met" : ""}`}>
          {passwordCriteria.hasSpecial ? "✓" : "○"} Symbol
        </span>
      </div>
    </div>
  );
}

