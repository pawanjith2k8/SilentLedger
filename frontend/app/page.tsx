"use client";

import { useState } from "react";
import { apiGet } from "@/lib/api";
import EncryptedRouteVisual from "@/components/EncryptedRouteVisual";

export default function Home() {
  const [status, setStatus] = useState("");

  async function checkBackend() {
    try {
      const data = await apiGet<{
        status: string;
        project: string;
        version: string;
      }>("/api/health");

      setStatus(`${data.project} backend is ${data.status} (v${data.version})`);
    } catch {
      setStatus("Could not connect to backend.");
    }
  }

  return (
    <div className="page homepage">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">PRIVATE BITCOIN INFRASTRUCTURE</p>

          <h1 className="brand-title">
            Silent
            <br />
            Ledger
          </h1>

          <p className="tagline">
            A privacy-first Bitcoin payment layer.
          </p>

          <p className="hero-description">
            Discover fresh payment addresses privately using Nostr,
            while reducing address reuse and unnecessary exposure.
          </p>

          <div className="hero-actions">
            <button
              className="check-button"
              onClick={checkBackend}
            >
              Explore Dashboard →
            </button>

            <span className="status-text">{status}</span>
          </div>
        </div>

        <div className="hero-visual">
          <EncryptedRouteVisual />
        </div>
      </section>

      <section className="connection-panel">
        <div>
          <p className="section-label">SYSTEM STATUS</p>
          <p className="status-text">
            Privacy layer ready
          </p>
        </div>

        <span className="btc-mark">₿</span>
      </section>
    </div>
  );
}