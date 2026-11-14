import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("tool API 请求契约", () => {
  it("系数查询中文自动编码并使用同源代理路径", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 0,
            data: { list: [], total: 0, page: 1, page_size: 8 },
          }),
        ),
      );
    vi.stubGlobal("fetch", fetch);
    await api.coefficients({ pollutant_name: "颗粒物", page: 1, page_size: 8 });
    const url = new URL(fetch.mock.calls[0][0], "http://localhost");
    expect(url.pathname).toBe("/api/tool/pollutant_coefficient/page");
    expect(url.searchParams.get("pollutant_name")).toBe("颗粒物");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("HTTP 400 和 HTTP 200 业务错误都保留后端原因", async () => {
    for (const status of [200, 400]) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              JSON.stringify({ code: 101, message: "系数不存在: xxx" }),
              { status },
            ),
          ),
      );
      await expect(api.preview([])).rejects.toThrow("系数不存在: xxx");
    }
  });

  it("兼容鉴权、参数校验和非 JSON 网关错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ detail: "缺少Token" }), {
            status: 401,
          }),
        ),
    );
    await expect(api.projects({ page: 1, page_size: 10 })).rejects.toThrow(
      "缺少Token",
    );
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              detail: [{ loc: ["body", "items"], msg: "Field required" }],
            }),
            { status: 422 },
          ),
        ),
    );
    await expect(api.preview([])).rejects.toThrow("body.items Field required");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>Bad Gateway</html>", { status: 502 }),
        ),
    );
    await expect(api.preview([])).rejects.toThrow("HTTP 502");
  });

  it("保存和删除不自动重试，保留请求载荷和返回 ID", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 0, data: { id: "saved-id" } })),
      );
    vi.stubGlobal("fetch", fetch);
    const payload = {
      id: null,
      status: 1 as const,
      project_name: "测试记录",
      items: [],
    };
    expect((await api.save(payload)).id).toBe("saved-id");
    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(payload);
    fetch.mockResolvedValue(
      new Response(JSON.stringify({ code: 0, data: null })),
    );
    expect(await api.remove("saved-id")).toBeNull();
    expect(fetch.mock.calls[1][1].method).toBe("DELETE");
  });
});
