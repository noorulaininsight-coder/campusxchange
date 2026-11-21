import { useEffect, useState } from "react";
export function useDebounce<T>(value: T, delay = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setV(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return v;
}
