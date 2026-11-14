import type {
  CalcItemInput,
  CalcResult,
  Coefficient,
  ProjectDetail,
  SaveRequest,
} from "../../api/types";

export interface EditorItem {
  coefficient: Coefficient;
  input: CalcItemInput;
}

export interface EditorState {
  projectName: string;
  items: EditorItem[];
  result: CalcResult | null;
  resultCurrent: boolean;
}

export const emptyEditor: EditorState = {
  projectName: "",
  items: [],
  result: null,
  resultCurrent: false,
};

export function createItem(
  coefficient: Coefficient,
  index: number,
): EditorItem {
  return {
    coefficient,
    input: {
      sort_no: index + 1,
      coeff_id: coefficient.id,
      baseline_amount: null,
      work_hours: null,
      collection_efficiency: null,
      air_volume: null,
      s_value: null,
      a_value: null,
      calc_basis: null,
      treatment_efficiency: null,
      discharge_concentration: null,
    },
  };
}

// 按系数主键保存已选项，翻页和再次命中同一记录时保留已填写的参数。
export function selectCoefficients(
  items: EditorItem[],
  candidates: Coefficient[],
  selectedIds: string[],
): EditorItem[] {
  const selected = new Set(selectedIds);
  const next = items.filter((item) => selected.has(item.input.coeff_id));
  const existing = new Set(next.map((item) => item.input.coeff_id));
  for (const coefficient of candidates) {
    if (selected.has(coefficient.id) && !existing.has(coefficient.id)) {
      next.push(createItem(coefficient, next.length));
      existing.add(coefficient.id);
    }
  }
  return next.map((item, index) => ({
    ...item,
    input: { ...item.input, sort_no: index + 1 },
  }));
}

export function serializeItems(items: EditorItem[]): CalcItemInput[] {
  return items.map(({ input }, index) => ({
    ...input,
    sort_no: index + 1,
    // 隐藏分支的旧值不参与提交，效率为 0 时保持有效数值。
    treatment_efficiency:
      input.calc_basis === 1 ? input.treatment_efficiency : null,
    discharge_concentration:
      input.calc_basis === 2 ? input.discharge_concentration : null,
  }));
}

export function savePayload(
  state: EditorState,
  id: string | null,
  status: 1 | 2,
): SaveRequest {
  return {
    id,
    status,
    project_name: state.projectName.trim() || "未命名计算",
    items: serializeItems(state.items),
  };
}

export function hydrateEditor(
  detail: ProjectDetail,
  copy = false,
): EditorState {
  const rows = new Map(
    (detail.result?.list || []).map((row) => [row.coeff_id, row]),
  );
  return {
    projectName: detail.project_name || "",
    items: (detail.input.items || []).map((input, index) => {
      const row = rows.get(input.coeff_id);
      const coefficient: Coefficient = {
        id: input.coeff_id,
        pollutant_name: row?.pollutant_name || `系数 ${input.coeff_id}`,
        industry_name: row?.industry_name ?? null,
        product_name: row?.product_name ?? null,
        process_name: row?.process_name ?? null,
        material_name: row?.material_name ?? null,
        coefficient: row?.coefficient ?? null,
        unit: row?.unit ?? null,
        source: row?.source ?? null,
      };
      return {
        coefficient,
        input: {
          ...createItem(coefficient, index).input,
          ...input,
          sort_no: index + 1,
        },
      };
    }),
    // 复制只沿用参数，必须重新试算后才能保存为完成记录。
    result: copy ? null : detail.result,
    resultCurrent: !copy && !!detail.result,
  };
}

export function canComplete(state: EditorState): boolean {
  const rows = state.result?.list || [];
  return (
    state.resultCurrent &&
    state.items.length > 0 &&
    rows.length === state.items.length &&
    new Set(rows.map((row) => row.coeff_id)).size === state.items.length &&
    state.items.every((item) =>
      rows.some(
        (row) => row.coeff_id === item.input.coeff_id && row.item_status === 1,
      ),
    )
  );
}

export function inputErrors(
  input: CalcItemInput,
): Partial<Record<keyof CalcItemInput, string>> {
  const errors: Partial<Record<keyof CalcItemInput, string>> = {};
  const fields = [
    "baseline_amount",
    "work_hours",
    "air_volume",
    "s_value",
    "a_value",
    "collection_efficiency",
  ] as const;
  for (const field of fields) {
    const value = input[field];
    if (value !== null && (!Number.isFinite(value) || value < 0))
      errors[field] = "请输入非负有效数值";
  }
  const efficiencies = [
    "collection_efficiency",
    "treatment_efficiency",
  ] as const;
  for (const field of efficiencies) {
    if (field === "treatment_efficiency" && input.calc_basis !== 1) continue;
    const value = input[field];
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100))
      errors[field] = "有效范围为 0–100%";
  }
  const concentration = input.discharge_concentration;
  if (
    input.calc_basis === 2 &&
    concentration !== null &&
    (!Number.isFinite(concentration) ||
      concentration < 0 ||
      concentration >= 1000)
  ) {
    errors.discharge_concentration = "请输入非负数，整数部分最多 3 位";
  }
  return errors;
}

export function editItem(
  state: EditorState,
  id: string,
  patch: Partial<CalcItemInput>,
): EditorState {
  return {
    ...state,
    resultCurrent: false,
    items: state.items.map((item) =>
      item.input.coeff_id === id
        ? { ...item, input: { ...item.input, ...patch } }
        : item,
    ),
  };
}

export function coefficientContext(coefficient: Coefficient): string {
  return (
    [
      coefficient.industry_name,
      coefficient.product_name,
      coefficient.process_name,
      coefficient.material_name,
    ]
      .filter(Boolean)
      .join(" · ") || "基础库未提供适用条件"
  );
}

export function baselineInfo(coefficient: Coefficient) {
  const unit = coefficient.unit || "";
  // 仅从基础库的单位提取分母，不推断缺失单位或进行额外的单位换算。
  const denominator = unit
    .split("/")
    .slice(1)
    .join("/")
    .replace(/[-－·]?(产品|原料).*$/, "")
    .trim();
  return {
    label: unit.includes("原料") ? "原料用量" : "产品用量",
    unit: denominator ? `${denominator}/a` : "单位未提供",
  };
}
