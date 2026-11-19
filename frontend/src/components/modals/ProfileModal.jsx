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

  const isGuest = !currentUser;
  const fullName =
    currentUser?.user_metadata?.full_name ||
    currentUser?.email?.split("@")[0] ||
    "Guest Explorer";

  const initials = isGuest
    ? "GE"
    : fullName
    ? fullName
        .split(/\s+/)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "GE";

  const email = currentUser?.email || "guest@docintel.local";
  const role = isGuest ? "Explore Mode (Read & Query)" : (currentUser?.user_metadata?.role || "Senior Financial Analyst");
  const userId = currentUser?.id || "guest_session";
  const provider = isGuest
    ? "Anonymous Session"
    : currentUser?.app_metadata?.provider ||
      currentUser?.identities?.[0]?.provider ||
      "Email / Password";
  const createdAt = currentUser?.created_at
    ? new Date(currentUser.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Active Session";

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
                <span className="profile-tier-badge">{isGuest ? "Guest Mode" : "Pro Analyst"}</span>
              </div>
              <span className="profile-hero-email">{email}</span>
              <div className="profile-status-indicator">
                <span className={`status-indicator-dot ${isGuest ? "guest" : "online"}`} />
                <span>{isGuest ? "Explore Mode • SEC 10-K Public Access" : "Active & Authenticated"}</span>
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
              <strong>{isGuest ? "Guest Access Granted:" : "Full Tenant Privileges Granted:"}</strong>
              <p>
                {isGuest
                  ? "Authorized for SEC 10-K document queries (AAPL, MSFT, AMZN, META), interactive citation inspection, and multi-company matrices. Sign in to upload custom documents."
                  : "Authorized for SEC 10-K document queries, custom PDF table parsing, high-dimensional vector embeddings, and cross-company comparative analysis."}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          {isGuest && (
            <a
              href="/login"
              className="btn-modal-primary"
              style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span>Sign In / Create Account</span>
            </a>
          )}
          <button
            type="button"
            className={isGuest ? "btn-modal-secondary" : "btn-modal-primary"}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

