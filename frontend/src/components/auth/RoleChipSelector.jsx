"use client";

import { FINANCIAL_ROLES } from "../../lib/constants";

function CheckmarkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/**
 * RoleChipSelector Component
 * Interactive chip selector for user roles / financial disciplines during account creation.
 */
export default function RoleChipSelector({
  selectedRole,
  onSelectRole,
  roles = FINANCIAL_ROLES,
  label = "Primary Financial Role",
}) {
  return (
    <div className="form-field-group">
      <div className="form-label-row">
        <label className="form-label">{label}</label>
        <span className="role-active-indicator">{selectedRole}</span>
      </div>
      <div className="role-chips-grid">
        {roles.map((role) => {
          const isSelected = selectedRole === role;
          return (
            <button
              key={role}
              type="button"
              className={`role-chip ${isSelected ? "selected" : ""}`}
              onClick={() => onSelectRole(role)}
            >
              {isSelected && (
                <span className="chip-check-icon">
                  <CheckmarkIcon />
                </span>
              )}
              <span>{role}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

