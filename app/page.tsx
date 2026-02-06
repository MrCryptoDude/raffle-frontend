"use client";

import Link from "next/link";
import * as React from "react";

export default function HomePage() {
  const [scrollY, setScrollY] = React.useState(0);
  const [activeSection, setActiveSection] = React.useState(0);

  // Track scroll position
  React.useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
      const vh = window.innerHeight;
      const section = Math.floor((window.scrollY + vh * 0.5) / vh);
      setActiveSection(Math.min(section, 3));
    };
    
    handleScroll(); // Initial call
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div style={{ 
      background: "linear-gradient(180deg, #0a0a0a 0%, #0d1a0f 50%, #0a0a0a 100%)",
      minHeight: "400vh",
    }}>
      {/* Fixed background effects */}
      <div style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `radial-gradient(circle at 50% ${30 + activeSection * 20}%, rgba(0,255,140,0.08) 0%, transparent 50%)`,
        pointerEvents: "none",
        transition: "background 0.8s ease",
        zIndex: 0,
      }} />

      {/* Floating particles */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", pointerEvents: "none", zIndex: 1 }}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "rgba(0,255,140,0.3)",
              left: `${10 + (i * 17) % 80}%`,
              top: `${(i * 23 + scrollY * 0.1 * (i % 3 + 1)) % 100}%`,
              opacity: 0.3 + (i % 5) * 0.1,
              transition: "top 0.1s linear",
            }}
          />
        ))}
      </div>

      {/* SECTION 0: Hero */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        zIndex: 10,
      }}>
        <div style={{
          transform: `translateY(${Math.min(scrollY * 0.3, 100)}px)`,
          opacity: Math.max(0, 1 - scrollY / 400),
          transition: "opacity 0.1s",
        }}>
          <h1 style={{
            fontSize: "clamp(32px, 8vw, 72px)",
            fontWeight: 900,
            textAlign: "center",
            background: "linear-gradient(135deg, #00ff8c 0%, #00cc70 50%, #00ff8c 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0 0 60px rgba(0,255,140,0.3)",
            letterSpacing: "-2px",
          }}>
            MONEY PRINTER GO BRRR
          </h1>
          
          <p style={{
            fontSize: "clamp(12px, 2vw, 16px)",
            color: "rgba(255,255,255,0.6)",
            textAlign: "center",
            marginTop: 16,
            letterSpacing: 2,
          }}>
            A MEME-DRIVEN PREDICTION ARCADE • WINNERS GET PAID • STAKERS GET THE BRRR CUT
          </p>

          {/* Video Section */}
          <div style={{
            marginTop: 40,
            borderRadius: 16,
            overflow: "hidden",
            border: "1px solid rgba(0,255,140,0.2)",
            boxShadow: "0 0 40px rgba(0,255,140,0.1)",
            maxWidth: 600,
            margin: "40px auto 0",
          }}>
            <div style={{ position: "relative" }}>
              <video
                src="/media/brrr.mp4"
                autoPlay
                loop
                playsInline
                muted
                style={{ width: "100%", display: "block" }}
              />
              {/* Watermark cover */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: 120,
                height: 40,
                background: "linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 50%, transparent 100%)",
                borderBottomRightRadius: 20,
              }} />
            </div>
          </div>

          {/* Scroll indicator */}
          <div style={{
            marginTop: 60,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            animation: "bounce 2s infinite",
          }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>SCROLL TO EXPLORE</p>
            <div style={{
              width: 24,
              height: 40,
              borderRadius: 12,
              border: "2px solid rgba(0,255,140,0.3)",
              display: "flex",
              justifyContent: "center",
              paddingTop: 8,
            }}>
              <div style={{
                width: 4,
                height: 8,
                borderRadius: 2,
                background: "rgba(0,255,140,0.6)",
                animation: "scrollDot 2s infinite",
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: Gas Prediction Market */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        zIndex: 10,
      }}>
        <ProductCard
          icon="⛽"
          title="GAS PREDICTION MARKET"
          subtitle="BET ON ETHEREUM'S HEARTBEAT"
          description="Predict if L1 gas fees will go up or down. First bet sets the strike price. 20 blocks later, Chainlink settles the game. Simple. Fast. Addictive."
          features={["📈 Long if gas goes up", "📉 Short if gas goes down", "⚡ 20-block rounds", "🔗 Chainlink automated"]}
          buttonText="START PREDICTING"
          href="/gas"
          color="rgba(0,255,140,0.9)"
          glowColor="rgba(0,255,140,0.15)"
        />
      </section>

      {/* SECTION 2: Raffle */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        zIndex: 10,
      }}>
        <ProductCard
          icon="🎰"
          title="RAFFLE"
          subtitle="THE ORIGINAL BRRR GAME"
          description="Buy tickets with USDC. The pot fills. Winners take 50/30/10. And 10% goes to stakers — the BRRR cut. Four sizes from micro to mega."
          features={["🎫 Buy tickets, win big", "💰 50/30/10 split", "💎 Stakers earn fees", "🎲 Chainlink VRF random"]}
          buttonText="ENTER RAFFLE"
          href="/play"
          color="rgba(255,200,100,0.9)"
          glowColor="rgba(255,200,100,0.15)"
        />
      </section>

      {/* SECTION 3: RPS */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        position: "relative",
        zIndex: 10,
      }}>
        <ProductCard
          icon="✊"
          title="ROCK PAPER SCISSORS"
          subtitle="CLASSIC GAME, CRYPTO STAKES"
          description="Challenge anyone to RPS. Commit your move, reveal when ready. Winner takes all minus the BRRR cut. No luck — pure strategy and timing."
          features={["✊ Rock crushes scissors", "✋ Paper covers rock", "✌️ Scissors cuts paper", "🏆 Winner takes pot"]}
          buttonText="PLAY RPS"
          href="/rps"
          color="rgba(140,180,255,0.9)"
          glowColor="rgba(140,180,255,0.15)"
        />
      </section>

      {/* Footer */}
      <section style={{
        padding: "60px 20px",
        textAlign: "center",
        position: "relative",
        zIndex: 10,
      }}>
        <div style={{
          maxWidth: 600,
          margin: "0 auto",
          padding: 32,
          borderRadius: 16,
          background: "rgba(0,0,0,0.4)",
          border: "1px solid rgba(0,255,140,0.1)",
        }}>
          <h3 style={{ fontSize: 24, fontWeight: 800, color: "rgba(0,255,140,0.9)" }}>STAKE BRRR, EARN REWARDS</h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", marginTop: 12 }}>
            All games feed the staking pool. Stake your BRRR tokens and earn a cut from every game played.
          </p>
          <Link href="/stake" style={{
            display: "inline-block",
            marginTop: 24,
            padding: "14px 32px",
            borderRadius: 12,
            background: "linear-gradient(135deg, rgba(0,255,140,0.2) 0%, rgba(0,255,140,0.1) 100%)",
            border: "1px solid rgba(0,255,140,0.4)",
            color: "rgba(0,255,140,0.95)",
            fontWeight: 700,
            fontSize: 14,
            textDecoration: "none",
            transition: "all 0.2s",
          }}>
            GO TO STAKING →
          </Link>
        </div>

        <p style={{ marginTop: 40, fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
          TIP: MAKE SURE YOUR WALLET IS ON BASE SEPOLIA
        </p>
      </section>

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes bounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
        @keyframes scrollDot {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(16px); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .product-card {
          animation: fadeInUp 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

// Product Card Component - Simplified
function ProductCard({ 
  icon, 
  title, 
  subtitle, 
  description, 
  features, 
  buttonText, 
  href, 
  color, 
  glowColor 
}: {
  icon: string;
  title: string;
  subtitle: string;
  description: string;
  features: string[];
  buttonText: string;
  href: string;
  color: string;
  glowColor: string;
}) {
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    setIsMobile(window.innerWidth < 600);
    
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600);
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div 
      className="product-card"
      style={{
        maxWidth: 700,
        width: "100%",
        padding: isMobile ? 24 : 40,
        borderRadius: isMobile ? 16 : 24,
        background: "rgba(0,0,0,0.5)",
        border: `1px solid ${color.replace("0.9", "0.2")}`,
        boxShadow: `0 0 60px ${glowColor}`,
      }}>
      {/* Icon */}
      <div style={{
        width: isMobile ? 60 : 80,
        height: isMobile ? 60 : 80,
        borderRadius: isMobile ? 14 : 20,
        background: glowColor,
        border: `1px solid ${color.replace("0.9", "0.3")}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: isMobile ? 28 : 40,
        marginBottom: isMobile ? 16 : 24,
      }}>
        {icon}
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: "clamp(22px, 5vw, 42px)",
        fontWeight: 900,
        color: color,
        letterSpacing: "-1px",
      }}>
        {title}
      </h2>

      <p style={{
        fontSize: isMobile ? 11 : 14,
        color: "rgba(255,255,255,0.5)",
        marginTop: 8,
        letterSpacing: isMobile ? 1 : 2,
        textTransform: "uppercase",
      }}>
        {subtitle}
      </p>

      {/* Description */}
      <p style={{
        fontSize: isMobile ? 14 : 16,
        color: "rgba(255,255,255,0.75)",
        marginTop: isMobile ? 14 : 20,
        lineHeight: 1.6,
      }}>
        {description}
      </p>

      {/* Features */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
        gap: isMobile ? 8 : 12,
        marginTop: isMobile ? 16 : 24,
      }}>
        {features.map((feature, i) => (
          <div key={i} style={{
            padding: isMobile ? "10px 12px" : "12px 16px",
            borderRadius: 10,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: isMobile ? 12 : 13,
            color: "rgba(255,255,255,0.7)",
          }}>
            {feature}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Link href={href} style={{
        display: "inline-block",
        marginTop: isMobile ? 24 : 32,
        padding: isMobile ? "14px 28px" : "16px 40px",
        borderRadius: isMobile ? 10 : 14,
        background: `linear-gradient(135deg, ${color.replace("0.9", "0.25")} 0%, ${color.replace("0.9", "0.15")} 100%)`,
        border: `2px solid ${color.replace("0.9", "0.5")}`,
        color: color,
        fontWeight: 800,
        fontSize: isMobile ? 13 : 15,
        textDecoration: "none",
        letterSpacing: 1,
        transition: "all 0.2s",
        boxShadow: `0 0 30px ${glowColor}`,
      }}>
        {buttonText} →
      </Link>
    </div>
  );
}
