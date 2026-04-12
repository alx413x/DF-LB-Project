import { useContext } from "react";
import { LendingContext } from "./LendingContext.jsx";

export function useLendingContext() {
  const ctx = useContext(LendingContext);
  if (!ctx) {
    throw new Error("useLendingContext must be used within a LendingProvider");
  }
  return ctx;
}
