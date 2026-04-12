import { LendingContext } from "./LendingContext.jsx";
// import useLending from "../hooks/useLending";

export function LendingProvider({ children }) {
  const lending = useLending();
  return (
    <LendingContext.Provider value={lending}>
      {children}
    </LendingContext.Provider>
  );
}
