"use client";

import { useEffect } from "react";

export default function ProfileModal({ isOpen, onClose, currentUser }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fullName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "Donald Trump";

  const initials = fullName
    ? fullName
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "DT";

  const email = currentUser?.email || "donald.trump@docintel.io";
  const role = currentUser?.user_metadata?.role || "Senior Financial Analyst";
  const userId = currentUser?.id || "usr_8f92e01a4c";
  const provider =
    currentUser?.app_metadata?.provider ||
    (currentUser?.identities?.[0]?.provider) ||
    "Google OAuth";
  const createdAt = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "October 18, 2026";

  return (
    <div className="modal-backdrop" onClick={onClose} aria-label="Close modal backdrop">
      <div
        className="modal-container profile-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h2 id="profile-modal-title" className="modal-title">User Profile</h2>
              <p className="modal-subtitle">DocIntel Multi-Tenant Account &amp; Credentials</p>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            title="Close profile"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="modal-body profile-modal-body">
          {/* Hero Profile Card */}
          <div className="profile-hero-card">
            <div className="profile-avatar-large">
              {currentUser?.user_metadata?.avatar_url ? (
                <img
                  src={currentUser.user_metadata.avatar_url}
                  alt={fullName}
                  className="profile-avatar-img"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div className="profile-hero-info">
              <div className="profile-name-row">
                <h3 className="profile-hero-name">{fullName}</h3>
                <span className="profile-tier-badge">Pro Analyst</span>
              </div>
              <span className="profile-hero-email">{email}</span>
              <div className="profile-status-indicator">
                <span className="status-indicator-dot online" />
                <span>Active &amp; Authenticated</span>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="profile-details-grid">
            <div className="profile-detail-card">
              <span className="profile-detail-label">Display Name</span>
              <span className="profile-detail-value">{fullName}</span>
            </div>

            <div className="profile-detail-card">
              <span className="profile-detail-label">Email Address</span>
              <span className="profile-detail-value">{email}</span>
            </div>

            <div className="profile-detail-card">
              <span className="profile-detail-label">Assigned Role</span>
              <span className="profile-detail-value">{role}</span>
            </div>

            <div className="profile-detail-card">
              <span className="profile-detail-label">Authentication Method</span>
              <span className="profile-detail-value" style={{ textTransform: "capitalize" }}>
                {provider}
              </span>
            </div>

            <div className="profile-detail-card">
              <span className="profile-detail-label">DocIntel User ID</span>
              <span className="profile-detail-value font-mono" style={{ fontSize: "0.78rem" }}>
                {userId}
              </span>
            </div>

            <div className="profile-detail-card">
              <span className="profile-detail-label">Member Since</span>
              <span className="profile-detail-value">{createdAt}</span>
            </div>
          </div>

          {/* Permissions / Access Scope Callout */}
          <div className="profile-access-callout">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <strong>Full Tenant Privileges Granted:</strong>
              <p>
                Authorized for SEC 10-K document queries, custom PDF table parsing, high-dimensional vector embeddings, and cross-company comparative analysis.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-primary"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

