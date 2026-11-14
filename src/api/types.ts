export interface Page<T> {
  total: number;
  page: number;
  page_size: number;
  list: T[];
}

export interface Coefficient {
  id: string;
  pollutant_name: string;
  industry_name: string | null;
  product_name: string | null;
  process_name: string | null;
  material_name: string | null;
  coefficient: string | null;
  unit: string | null;
  source: string | null;
}

export interface CalcItemInput {
  sort_no: number;
  coeff_id: string;
  baseline_amount: number | null;
  work_hours: number | null;
  collection_efficiency: number | null;
  air_volume: number | null;
  s_value: number | null;
  a_value: number | null;
  calc_basis: 1 | 2 | null;
  treatment_efficiency: number | null;
  discharge_concentration: number | null;
}

export interface ResultRow extends Omit<Coefficient, "id"> {
  sort_no: number;
  coeff_id: string;
  baseline_type: 1 | 2;
  calc_basis: 1 | 2 | null;
  item_status: 1 | 2 | 3;
  fail_message: string | null;
  actual_k: number | null;
  g_amount: number | null;
  org_produce_amount: number | null;
  org_produce_rate: number | null;
  org_produce_conc: number | null;
  org_discharge_amount: number | null;
  org_discharge_rate: number | null;
  org_discharge_conc: number | null;
  unorg_discharge_amount: number | null;
  unorg_discharge_rate: number | null;
  total_discharge: number | null;
  auto_corrected: number;
}

export interface CalcResult {
  completed_count: number;
  pending_count: number;
  failed_count: number;
  auto_corrected: number;
  auto_correct_message: string | null;
  list: ResultRow[];
  by_treatment_efficiency: ResultRow[];
  by_discharge_concentration: ResultRow[];
}

export interface SaveRequest {
  id: string | null;
  status: 1 | 2;
  project_name: string;
  items: CalcItemInput[];
}

export interface ProjectSummary {
  id: string;
  project_name: string;
  pollutant_names: string;
  status: 1 | 2;
  create_by: string;
  gmt_create: string;
  gmt_modified: string;
  completed_count: number;
  pending_count: number;
}

export interface ProjectDetail extends ProjectSummary {
  auto_corrected: number;
  auto_correct_message: string | null;
  input: SaveRequest;
  result: CalcResult | null;
}

export interface CoefficientQuery {
  industry_name?: string;
  product_name?: string;
  process_name?: string;
  material_name?: string;
  pollutant_name?: string;
  page: number;
  page_size: number;
}

export type CoefficientFilterField =
  "industry_name" | "product_name" | "process_name" | "material_name";

// 选项接口契约待后端补齐，value 与现有系数分页的精确匹配参数保持一致。
export interface CoefficientOptionsQuery {
  field: CoefficientFilterField;
  industry_name?: string;
  process_name?: string;
  product_name?: string;
}

export interface CoefficientOptions {
  list: { label: string; value: string }[];
}

export interface ProjectQuery {
  keyword?: string;
  status?: 1 | 2;
  modified_from?: string;
  modified_to?: string;
  page: number;
  page_size: number;
}
