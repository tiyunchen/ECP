import { useState } from "react";
import { Alert, Button, Empty, Space, Table, Tag } from "antd";
import type { TableColumnsType } from "antd";
import type { CalcResult, Coefficient, ResultRow } from "../../api/types";
import { CoefficientDetails } from "./CoefficientPicker";

function numericColumn(
  title: string,
  unit: string,
  field: keyof ResultRow,
  precision = 3,
) {
  return {
    title: (
      <>
        {title}
        <br />
        <span className="small">({unit})</span>
      </>
    ),
    dataIndex: field,
    width: 100,
    align: "center" as const,
    render: (value: number | null) =>
      value == null ? "—" : value.toFixed(precision),
  };
}

export function ResultsTable({
  result,
  current,
}: {
  result: CalcResult | null;
  current: boolean;
}) {
  const [detail, setDetail] = useState<Coefficient | null>(null);
  if (!result)
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="选择系数并填写参数后，点击「计算」查看结果"
      />
    );

  const successful = [...result.list]
    .filter((row) => row.item_status === 1)
    .sort(
      (a, b) =>
        (a.calc_basis || 0) - (b.calc_basis || 0) || a.sort_no - b.sort_no,
    );
  const columns: TableColumnsType<ResultRow> = [
    {
      title: "计算依据",
      width: 110,
      align: "center",
      render: (_, row) => (row.calc_basis === 1 ? "按处理效率" : "按排放浓度"),
      onCell: (row, index = 0) => {
        if (index > 0 && successful[index - 1].calc_basis === row.calc_basis)
          return { rowSpan: 0 };
        return {
          rowSpan: successful.filter(
            (item) => item.calc_basis === row.calc_basis,
          ).length,
          className:
            row.calc_basis === 1 ? "efficiency-cell" : "concentration-cell",
        };
      },
    },
    {
      title: "污染物",
      width: 150,
      render: (_, row) => (
        <>
          <Button
            type="link"
            size="small"
            onClick={() => setDetail({ ...row, id: row.coeff_id })}
          >
            {String(row.sort_no).padStart(2, "0")} {row.pollutant_name}
          </Button>
          <div className="small muted">
            {row.coefficient} {row.unit}
          </div>
        </>
      ),
    },
    {
      title: "产生情况",
      children: [numericColumn("产生量", "t/a", "g_amount")],
    },
    {
      title: "有组织产生情况",
      children: [
        numericColumn("产生量", "t/a", "org_produce_amount"),
        numericColumn("产生速率", "kg/h", "org_produce_rate"),
        numericColumn("产生浓度", "mg/m³", "org_produce_conc", 1),
      ],
    },
    {
      title: "有组织排放情况",
      children: [
        numericColumn("排放量", "t/a", "org_discharge_amount"),
        numericColumn("排放速率", "kg/h", "org_discharge_rate"),
        numericColumn("排放浓度", "mg/m³", "org_discharge_conc", 1),
      ],
    },
    {
      title: "无组织排放情况",
      children: [
        numericColumn("排放量", "t/a", "unorg_discharge_amount"),
        numericColumn("排放速率", "kg/h", "unorg_discharge_rate"),
      ],
    },
    {
      title: "合计",
      children: [numericColumn("排放量", "t/a", "total_discharge")],
    },
  ];

  return (
    <div className="results-content">
      <Space wrap>
        <Tag color="success">{result.completed_count} 项已完成</Tag>
        <Tag color="warning">{result.pending_count} 项待补充</Tag>
        <Tag color={result.failed_count ? "error" : "default"}>
          {result.failed_count} 项校验失败
        </Tag>
      </Space>
      {!current && (
        <Alert
          type="warning"
          showIcon
          title="参数已修改，以下结果需要重新计算。"
        />
      )}
      {result.auto_corrected === 1 && (
        <Alert
          type="success"
          showIcon
          title="已自动修正"
          description={result.auto_correct_message || "服务端已修正舍入误差"}
        />
      )}
      {result.list
        .filter((row) => row.item_status !== 1)
        .map((row) => (
          <Alert
            key={row.coeff_id}
            type={row.item_status === 3 ? "error" : "warning"}
            showIcon
            title={`${row.sort_no} ${row.pollutant_name} · ${row.item_status === 2 ? "待补充" : "校验失败"}`}
            description={row.fail_message || "请检查参数后重新计算"}
          />
        ))}
      <Table<ResultRow>
        className="results-table"
        rowKey="coeff_id"
        bordered
        size="small"
        columns={columns}
        dataSource={successful}
        pagination={false}
        scroll={{ x: 1260 }}
        locale={{ emptyText: "暂无计算成功的项目" }}
      />
      <CoefficientDetails coefficient={detail} close={() => setDetail(null)} />
    </div>
  );
}
