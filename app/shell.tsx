"use client";

import * as React from "react";
import { Header } from "../components/Header";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
    </>
  );
}
