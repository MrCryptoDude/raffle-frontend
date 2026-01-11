"use client";

import * as React from "react";

export function MoneyRain({ trigger }: { trigger: number }) {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    if (trigger === 0) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!show) return null;

  const bills = Array.from({ length: 18 }).map((_, i) => (
    <div key={i} className="bill" style={{ left: `${(i * 100) / 18}%`, animationDelay: `${(i % 6) * 0.12}s` }} />
  ));

  return <div className="moneyRain">{bills}</div>;
}
