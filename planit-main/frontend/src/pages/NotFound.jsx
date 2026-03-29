import React from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  const containerStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    backgroundColor: "#ffffff",
    color: "#202124", // Google's primary text color
    fontFamily: "'Roboto', arial, sans-serif",
    textAlign: "center",
    padding: "20px",
  };

  const errorCodeStyle = {
    fontSize: "24px",
    fontWeight: "400",
    margin: "0 0 10px 0",
  };

  const messageStyle = {
    fontSize: "16px",
    lineHeight: "1.5",
    color: "#3c4043",
    maxWidth: "500px",
  };

  const pathStyle = {
    fontWeight: "bold",
    color: "#000",
  };

  const linkContainerStyle = {
    marginTop: "24px",
    display: "flex",
    gap: "15px",
  };

  const linkStyle = {
    color: "#1a73e8",
    textDecoration: "none",
    fontSize: "14px",
    cursor: "pointer",
  };

  return (
    <div style={containerStyle}>
      {/* Optional: Placeholder for your logo */}
      <div style={{ marginBottom: "30px", fontWeight: "700", fontSize: "22px" }}>
        PLANIT
      </div>

      <h1 style={errorCodeStyle}>
        <b>404.</b> <span style={{ color: "#70757a" }}>That’s an error.</span>
      </h1>

      <div style={messageStyle}>
        <p>
          The requested URL <span style={pathStyle}>{location.pathname}</span>{" "}
          was not found on this server.
        </p>
        <p style={{ marginTop: "10px" }}>That’s all we know.</p>
      </div>

      <div style={linkContainerStyle}>
        <button
          onClick={() => navigate(-1)}
          style={{
            ...linkStyle,
            background: "none",
            border: "none",
            padding: 0,
            font: "inherit",
          }}
        >
          &larr; Go back to the Previous Page
        </button>
        <span style={{ color: "#dadce0" }}>|</span>
        <Link to="/help" style={linkStyle}>
          Visit Help Center
        </Link>
        <span style={{ color: "#dadce0" }}>|</span>
        <Link to="/" style={linkStyle}>
          Home
        </Link>
      </div>

      {/* Global font import for the Google feel */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
        body { margin: 0; }
      `}</style>
    </div>
  );
}
