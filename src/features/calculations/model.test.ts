import { describe, expect, it } from "vitest";
import type {
  CalcResult,
  Coefficient,
  ProjectDetail,
  ResultRow,
} from "../../api/types";
import {
  baselineInfo,
  canComplete,
  createItem,
  editItem,
  emptyEditor,
  hydrateEditor,
  inputErrors,
  savePayload,
  selectCoefficients,
  serializeItems,
} from "./model";

const coefficient: Coefficient = {
  id: "first",
  pollutant_name: "颗粒物",
  industry_name: "铸造",
  product_name: "铸件",
  process_name: "砂处理",
  material_name: null,
  coefficient: "0.192",
  unit: "kg/t-原料",
  source: "系数手册",
};
const first = createItem(coefficient, 0);
const secondCoefficient = { ...coefficient, id: "second" };
const row: ResultRow = {
  ...coefficient,
  coeff_id: "first",
  item_status: 1,
  calc_basis: 1,
  sort_no: 1,
  baseline_type: 2,
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

describe("计算项与记录状态", () => {
  it("跨页勾选保留旧参数，重复记录不会再次加入", () => {
    const populated = {
      ...first,
      input: { ...first.input, baseline_amount: 5000 },
    };
    const items = selectCoefficients(
      [populated],
      [secondCoefficient, coefficient, coefficient],
      ["first", "second"],
    );
    expect(items).toHaveLength(2);
    expect(items[0].input.baseline_amount).toBe(5000);
    expect(items[1].input.sort_no).toBe(2);
  });

  it("取消勾选后只移除对应主键并重新排序", () => {
    const items = selectCoefficients(
      [first, createItem(secondCoefficient, 1)],
      [],
      ["second"],
    );
    expect(items.map((item) => item.input.coeff_id)).toEqual(["second"]);
    expect(items[0].input.sort_no).toBe(1);
  });

  it("0% 收集和处理效率保留为有效值", () => {
    const input = {
      ...first.input,
      calc_basis: 1 as const,
      collection_efficiency: 0,
      treatment_efficiency: 0,
      s_value: 0,
    };
    expect(inputErrors(input)).toEqual({});
    expect(serializeItems([{ ...first, input }])[0]).toMatchObject({
      collection_efficiency: 0,
      treatment_efficiency: 0,
      s_value: 0,
    });
    expect(first.input.collection_efficiency).toBeNull();
  });

  it("只提交当前计算依据对应的参数", () => {
    const input = {
      ...first.input,
      calc_basis: 2 as const,
      treatment_efficiency: 80,
      discharge_concentration: 0,
    };
    expect(serializeItems([{ ...first, input }])[0]).toMatchObject({
      treatment_efficiency: null,
      discharge_concentration: 0,
    });
  });

  it("校验效率、负值和浓度边界，缺失值留给后端判定待补充", () => {
    expect(inputErrors(first.input)).toEqual({});
    expect(
      inputErrors({
        ...first.input,
        calc_basis: 2,
        collection_efficiency: 101,
        discharge_concentration: 1000,
        baseline_amount: -1,
      }),
    ).toMatchObject({
      collection_efficiency: expect.any(String),
      discharge_concentration: expect.any(String),
      baseline_amount: expect.any(String),
    });
    expect(
      inputErrors({
        ...first.input,
        calc_basis: 2,
        collection_efficiency: 100,
        discharge_concentration: 999.9,
      }),
    ).toEqual({});
  });

  it("修改参数后立即失效旧试算，阻止完成保存", () => {
    const state = {
      ...emptyEditor,
      items: [first],
      result,
      resultCurrent: true,
    };
    expect(canComplete(state)).toBe(true);
    const edited = editItem(state, "first", { collection_efficiency: 0 });
    expect(edited.resultCurrent).toBe(false);
    expect(canComplete(edited)).toBe(false);
  });

  it("待补充、失败、空记录和不匹配结果不能完成保存", () => {
    expect(canComplete(emptyEditor)).toBe(false);
    for (const item_status of [2, 3] as const) {
      expect(
        canComplete({
          ...emptyEditor,
          items: [first],
          resultCurrent: true,
          result: { ...result, list: [{ ...row, item_status }] },
        }),
      ).toBe(false);
    }
    expect(
      canComplete({
        ...emptyEditor,
        items: [first, createItem(secondCoefficient, 1)],
        resultCurrent: true,
        result,
      }),
    ).toBe(false);
  });

  it("复制记录清除历史结果，保存载荷不携带原项目 ID", () => {
    const detail = {
      id: "original",
      project_name: "测试",
      input: { items: [first.input] },
      result,
    } as ProjectDetail;
    const copy = hydrateEditor(detail, true);
    expect(copy.items[0].coefficient.id).toBe("first");
    expect(copy.result).toBeNull();
    expect(copy.resultCurrent).toBe(false);
    expect(savePayload(copy, null, 1).id).toBeNull();
  });

  it("历史缺失字段使用空值回显，系数元数据使用保存的结果快照", () => {
    const detail = {
      project_name: "历史记录",
      input: { items: [{ coeff_id: "first" }] },
      result,
    } as ProjectDetail;
    const hydrated = hydrateEditor(detail);
    expect(hydrated.items[0].input.collection_efficiency).toBeNull();
    expect(hydrated.items[0].coefficient.coefficient).toBe("0.192");
  });

  it("空名称兼容现有必填接口，更新保留当前 ID", () => {
    expect(savePayload(emptyEditor, null, 1).project_name).toBe("未命名计算");
    expect(savePayload(emptyEditor, "existing", 1).id).toBe("existing");
  });

  it("单位从原始数据提取，缺失时明确提示", () => {
    expect(baselineInfo(coefficient)).toEqual({
      label: "原料用量",
      unit: "t/a",
    });
    expect(baselineInfo({ ...coefficient, unit: "kg/m³-原料" }).unit).toBe(
      "m³/a",
    );
    expect(baselineInfo({ ...coefficient, unit: null }).unit).toBe(
      "单位未提供",
    );
  });
});
