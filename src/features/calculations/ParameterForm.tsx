import { Alert, Form, InputNumber, Radio, Tag } from "antd";
import type { CalcItemInput, ResultRow } from "../../api/types";
import {
  baselineInfo,
  coefficientContext,
  inputErrors,
  type EditorItem,
} from "./model";

export function ParameterForm({
  item,
  index,
  onChange,
  readOnly = false,
  result,
}: {
  item: EditorItem;
  index: number;
  onChange?: (patch: Partial<CalcItemInput>) => void;
  readOnly?: boolean;
  result?: ResultRow;
}) {
  const { coefficient, input } = item;
  const baseline = baselineInfo(coefficient);
  const errors = inputErrors(input);
  // 变量字段随基础库表达式展示，保持用户输入口径交给服务端解析和计算。
  const variables = (coefficient.coefficient || "").toUpperCase();

  function field(
    name: keyof Pick<
      CalcItemInput,
      | "baseline_amount"
      | "work_hours"
      | "collection_efficiency"
      | "air_volume"
      | "s_value"
      | "a_value"
      | "treatment_efficiency"
      | "discharge_concentration"
    >,
    label: string,
    unit: string,
    disabled = false,
  ) {
    return (
      <Form.Item
        label={label}
        validateStatus={errors[name] ? "error" : undefined}
        help={errors[name]}
        className="numeric-field"
      >
        <InputNumber
          aria-label={`${index + 1} ${coefficient.pollutant_name} ${label}`}
          value={input[name]}
          disabled={readOnly || disabled}
          placeholder="请输入"
          controls={false}
          suffix={<span className="unit">{unit}</span>}
          onChange={(value) => onChange?.({ [name]: value })}
        />
      </Form.Item>
    );
  }

  return (
    <article className="parameter-card">
      <div className="parameter-heading">
        <span className="item-index">{String(index + 1).padStart(2, "0")}</span>
        <strong>{coefficient.pollutant_name}</strong>
        <span className="muted small">
          {coefficient.coefficient ?? "系数未提供"} {coefficient.unit}
        </span>
        <span className="muted small context">
          {coefficientContext(coefficient)}
        </span>
        {result && (
          <Tag
            color={
              result.item_status === 1
                ? "success"
                : result.item_status === 2
                  ? "warning"
                  : "error"
            }
          >
            {result.item_status === 1
              ? "已完成"
              : result.item_status === 2
                ? "待补充"
                : "校验失败"}
          </Tag>
        )}
      </div>
      <Form layout="vertical" component="div" className="parameter-body">
        <div className="common-parameters">
          {field("baseline_amount", baseline.label, baseline.unit)}
          {field("work_hours", "年工作时间", "h/a")}
          {field("collection_efficiency", "收集效率", "%")}
          {field("air_volume", "风量", "Nm³/h")}
          {variables.includes("S") && field("s_value", "S 值", "依系数来源")}
          {variables.includes("A") && field("a_value", "A 值", "依系数来源")}
        </div>
        <Radio.Group
          aria-label={`${index + 1} 计算依据`}
          value={input.calc_basis}
          disabled={readOnly}
          onChange={(event) => onChange?.({ calc_basis: event.target.value })}
          className="basis-options"
        >
          <div
            className={`basis-option ${input.calc_basis === 1 ? "active" : ""}`}
          >
            <Radio value={1}>按处理效率</Radio>
            {field(
              "treatment_efficiency",
              "处理效率",
              "%",
              input.calc_basis !== 1,
            )}
          </div>
          <div
            className={`basis-option ${input.calc_basis === 2 ? "active" : ""}`}
          >
            <Radio value={2}>按处理后排放浓度</Radio>
            {field(
              "discharge_concentration",
              "处理后排放浓度",
              "mg/m³",
              input.calc_basis !== 2,
            )}
          </div>
        </Radio.Group>
        {(variables.includes("S") || variables.includes("A")) && (
          <p className="muted small variable-hint">
            请按该系数来源规定的口径填写 S / A，输入值直接参与服务端计算。
          </p>
        )}
        {!coefficient.coefficient && (
          <Alert
            type="warning"
            title="当前记录缺少系数元数据，请联系服务方补齐详情响应。"
            showIcon
          />
        )}
        {result?.fail_message && (
          <Alert
            type={result.item_status === 3 ? "error" : "warning"}
            title={result.fail_message}
            showIcon
          />
        )}
      </Form>
    </article>
  );
}
