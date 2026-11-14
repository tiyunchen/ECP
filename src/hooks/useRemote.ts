import { useEffect, useRef, useState } from "react";
import { errorMessage } from "../api/client";

export function useRemote<T>(
  load: (signal: AbortSignal) => Promise<T>,
  key: string,
) {
  const loader = useRef(load);
  loader.current = load;
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setLoading(true);
    setError("");
    // 条件变化或离开页面后丢弃旧请求，避免旧数据覆盖新的筛选结果。
    loader
      .current(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(errorMessage(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [key, version]);

  return {
    data,
    loading,
    error,
    reload: () => setVersion((value) => value + 1),
  };
}
