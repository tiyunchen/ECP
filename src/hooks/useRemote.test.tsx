// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRemote } from "./useRemote";

afterEach(cleanup);

it("条件变化后取消旧请求，并忽略迟到响应", async () => {
  let resolveFirst!: (value: string) => void;
  let firstSignal!: AbortSignal;
  const load = vi.fn((signal: AbortSignal) => {
    if (!firstSignal) {
      firstSignal = signal;
      return new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });
    }
    return Promise.resolve("new");
  });
  const hook = renderHook(({ key }) => useRemote(load, key), {
    initialProps: { key: "old" },
  });
  hook.rerender({ key: "new" });
  await waitFor(() => expect(hook.result.current.data).toBe("new"));
  expect(firstSignal.aborted).toBe(true);
  await act(async () => resolveFirst("old"));
  expect(hook.result.current.data).toBe("new");
});

it("错误可以重试，成功后清除错误", async () => {
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error("连接失败"))
    .mockResolvedValueOnce("ready");
  const hook = renderHook(() => useRemote<string>(load, "query"));
  await waitFor(() => expect(hook.result.current.error).toBe("连接失败"));
  act(() => hook.result.current.reload());
  await waitFor(() => expect(hook.result.current.data).toBe("ready"));
  expect(hook.result.current.error).toBe("");
});
