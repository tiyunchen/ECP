// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, ConfigProvider } from "antd";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { CalcResult, ProjectDetail, ResultRow } from "../../api/types";
import { api } from "../../api/client";
import { CalculationPage } from "./CalculationPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: {
    detail: vi.fn(),
    preview: vi.fn(),
    save: vi.fn(),
    coefficientOptions: vi.fn(),
    coefficients: vi.fn(),
  },
}));

const row: ResultRow = {
  coeff_id: "coeff-1",
  sort_no: 1,
  pollutant_name: "颗粒物",
  industry_name: "铸造",
  product_name: null,
  process_name: "砂处理",
  material_name: null,
  coefficient: "0.192",
  unit: "kg/t-原料",
  source: "手册",
  baseline_type: 2,
  calc_basis: 1,
  item_status: 1,
  fail_message: null,
  actual_k: 0.192,
  g_amount: 0.96,
  org_produce_amount: 0.768,
  org_produce_rate: 0.32,
  org_produce_conc: 40,
  org_discharge_amount: 0.192,
  org_discharge_rate: 0.08,
  org_discharge_conc: 10,
  unorg_discharge_amount: 0.192,
  unorg_discharge_rate: 0.08,
  total_discharge: 0.384,
  auto_corrected: 0,
};
const result: CalcResult = {
  completed_count: 1,
  pending_count: 0,
  failed_count: 0,
  auto_corrected: 0,
  auto_correct_message: null,
  list: [row],
  by_treatment_efficiency: [row],
  by_discharge_concentration: [],
};
const detail: ProjectDetail = {
  id: "project-1",
  project_name: "测试项目",
  status: 1,
  pollutant_names: "颗粒物",
  create_by: "tester",
  gmt_create: "2026-11-14 10:00:00",
  gmt_modified: "2026-11-14 10:00:00",
  completed_count: 1,
  pending_count: 0,
  auto_corrected: 0,
  auto_correct_message: null,
  result,
  input: {
    id: null,
    project_name: "测试项目",
    status: 1,
    items: [
      {
        sort_no: 1,
        coeff_id: "coeff-1",
        baseline_amount: 5000,
        work_hours: 2400,
        collection_efficiency: 80,
        air_volume: 8000,
        calc_basis: 1,
        treatment_efficiency: 75,
        discharge_concentration: null,
        s_value: null,
        a_value: null,
      },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  const getComputedStyle = window.getComputedStyle;
  // JSDOM 没有伪元素布局，表格测量滚动条时使用普通元素样式。
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    getComputedStyle(element),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.mocked(api.detail).mockResolvedValue(structuredClone(detail));
  vi.mocked(api.preview).mockResolvedValue(structuredClone(result));
  vi.mocked(api.coefficientOptions).mockImplementation(async (query) => ({
    list: (query.field === "industry_name"
      ? ["行业一", "行业二"]
      : query.field === "process_name"
        ? ["工艺一"]
        : query.field === "product_name"
          ? ["产品一"]
          : ["原料一"]
    ).map((value) => ({ label: value, value })),
  }));
  vi.mocked(api.save).mockResolvedValue({
    ...structuredClone(detail),
    id: "saved-project",
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mount(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/calculations/new", element: <CalculationPage /> },
      { path: "/calculations/:id/edit", element: <CalculationPage /> },
      { path: "/calculations/:id", element: <CalculationPage readOnly /> },
      { path: "/calculations", element: <div>计算记录列表</div> },
    ],
    { initialEntries: [path] },
  );
  render(
    <ConfigProvider theme={{ hashed: false }}>
      <App>
        <RouterProvider router={router} />
      </App>
    </ConfigProvider>,
  );
  return router;
}

describe("计算页面正常入口", () => {
  it("恢复可搜索下拉，按行业和工艺加载选项，上游变化清空下游", async () => {
    mount("/calculations/project-1/edit");
    await screen.findByDisplayValue("测试项目");
    expect(screen.queryByRole("textbox", { name: "行业" })).toBeNull();
    expect(api.coefficientOptions).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("combobox", { name: "工艺" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "行业" }));
    fireEvent.click(
      await screen.findByText("行业一", {
        selector: ".ant-select-item-option-content",
      }),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("combobox", { name: "工艺" }) as HTMLInputElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "工艺" }));
    fireEvent.click(
      await screen.findByText("工艺一", {
        selector: ".ant-select-item-option-content",
      }),
    );
    expect(api.coefficientOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "process_name",
        industry_name: "行业一",
      }),
      expect.any(AbortSignal),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("combobox", { name: "产品" }) as HTMLInputElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "产品" }));
    fireEvent.click(
      await screen.findByText("产品一", {
        selector: ".ant-select-item-option-content",
      }),
    );
    expect(api.coefficientOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "product_name",
        industry_name: "行业一",
        process_name: "工艺一",
      }),
      expect.any(AbortSignal),
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "原料" }));
    fireEvent.click(
      await screen.findByText("原料一", {
        selector: ".ant-select-item-option-content",
      }),
    );
    expect(api.coefficientOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        field: "material_name",
        product_name: "产品一",
      }),
      expect.any(AbortSignal),
    );
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "行业" }));
    fireEvent.click(
      await screen.findByText("行业二", {
        selector: ".ant-select-item-option-content",
      }),
    );
    await waitFor(() =>
      expect(
        (screen.getByRole("combobox", { name: "产品" }) as HTMLInputElement)
          .disabled,
      ).toBe(true),
    );
    expect(
      (screen.getByRole("combobox", { name: "原料" }) as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(
      screen.getByRole("combobox", { name: "产品" }).closest(".ant-select")
        ?.textContent,
    ).not.toContain("产品一");
    expect(
      screen.getByRole("combobox", { name: "原料" }).closest(".ant-select")
        ?.textContent,
    ).not.toContain("原料一");
    expect(screen.getByRole("button", { name: "保存并关闭" })).toBeTruthy();
  }, 15000);

  it("下拉选项接口失败时明确显示缺失能力", async () => {
    vi.mocked(api.coefficientOptions).mockRejectedValue(new Error("HTTP 404"));
    mount("/calculations/new");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "行业" }));
    await screen.findByText("选项接口尚未接入或暂时不可用");
    expect(screen.getByText("HTTP 404")).toBeTruthy();
  });

  it("修改合法零值后禁用完成保存，试算成功后重新启用", async () => {
    mount("/calculations/project-1/edit");
    const save = await screen.findByRole("button", { name: "保存并关闭" });
    expect((save as HTMLButtonElement).disabled).toBe(false);
    const efficiency = screen.getByRole("spinbutton", {
      name: "1 颗粒物 收集效率",
    });
    fireEvent.change(efficiency, { target: { value: "0" } });
    fireEvent.blur(efficiency);
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "计算（1 项）" }));
    await waitFor(() =>
      expect(api.preview).toHaveBeenCalledWith([
        expect.objectContaining({ collection_efficiency: 0 }),
      ]),
    );
    await waitFor(() =>
      expect((save as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("复制后暂存使用空项目 ID，并进入新记录编辑页", async () => {
    const router = mount("/calculations/new?copy=project-1");
    await screen.findByDisplayValue("测试项目");
    expect(
      (screen.getByRole("button", { name: "保存并关闭" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /暂\s*存/ }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: null, status: 1 }),
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        "/calculations/saved-project/edit",
      ),
    );
  });

  it("存在修改时返回列表需要确认，取消后保留表单", async () => {
    const router = mount("/calculations/project-1/edit");
    fireEvent.change(await screen.findByDisplayValue("测试项目"), {
      target: { value: "修改后的项目" },
    });
    fireEvent.click(screen.getByRole("button", { name: /返回列表/ }));
    await screen.findByText("存在未保存的修改");
    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(router.state.location.pathname).toBe("/calculations/project-1/edit");
    expect(screen.getByDisplayValue("修改后的项目")).toBeTruthy();
    await act(async () => {
      await router.navigate("/calculations");
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "退出且不保存" }),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/calculations"),
    );
  });

  it("试算处理中锁定参数和清空操作，防止迟到结果覆盖新参数", async () => {
    let resolve!: (value: CalcResult) => void;
    vi.mocked(api.preview).mockReturnValue(
      new Promise((value) => {
        resolve = value;
      }),
    );
    mount("/calculations/project-1/edit");
    await screen.findByDisplayValue("测试项目");
    fireEvent.click(screen.getByRole("button", { name: "计算（1 项）" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("spinbutton", {
            name: "1 颗粒物 收集效率",
          }) as HTMLInputElement
        ).disabled,
      ).toBe(true),
    );
    expect(
      (screen.getByRole("button", { name: "全部清空" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await act(async () => resolve(result));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("spinbutton", {
            name: "1 颗粒物 收集效率",
          }) as HTMLInputElement
        ).disabled,
      ).toBe(false),
    );
  });

  it("保存失败保留输入和当前路由", async () => {
    vi.mocked(api.save).mockRejectedValue(new Error("保存失败"));
    const router = mount("/calculations/project-1/edit");
    fireEvent.change(await screen.findByDisplayValue("测试项目"), {
      target: { value: "尚未保存的内容" },
    });
    fireEvent.click(screen.getByRole("button", { name: /暂\s*存/ }));
    await screen.findByText("保存失败");
    expect(screen.getByDisplayValue("尚未保存的内容")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/calculations/project-1/edit");
  });

  it("保存并关闭提交完成状态并返回记录列表", async () => {
    const router = mount("/calculations/project-1/edit");
    fireEvent.click(await screen.findByRole("button", { name: "保存并关闭" }));
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: "project-1", status: 2 }),
      ),
    );
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/calculations"),
    );
  });
});
