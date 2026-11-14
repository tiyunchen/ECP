import { useState } from "react";
import {
  Button,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { api } from "../../api/client";
import type {
  Coefficient,
  CoefficientQuery,
  CoefficientFilterField,
} from "../../api/types";
import { useRemote } from "../../hooks/useRemote";
import { RequestError } from "../../components/RequestError";
import { coefficientContext, type EditorItem } from "./model";
import { CoefficientFilter } from "./CoefficientFilter";

const filterFields = [
  ["industry_name", "行业"],
  ["product_name", "产品"],
  ["process_name", "工艺"],
  ["material_name", "原料"],
] as const;

export function CoefficientDetails({
  coefficient,
  close,
}: {
  coefficient: Coefficient | null;
  close: () => void;
}) {
  // 当前没有独立详情接口，复用候选记录或历史结果中的系数快照。
  return (
    <Modal
      title="产污系数详情"
      open={!!coefficient}
      onCancel={close}
      footer={<Button onClick={close}>关闭</Button>}
    >
      {coefficient && (
        <Descriptions
          bordered
          column={1}
          size="small"
          items={[
            { key: "id", label: "系数记录 ID", children: coefficient.id },
            {
              key: "pollutant",
              label: "污染物",
              children: coefficient.pollutant_name,
            },
            ...filterFields.map(([key, label]) => ({
              key,
              label,
              children: coefficient[key] || "未提供",
            })),
            {
              key: "coefficient",
              label: "产污系数",
              children: coefficient.coefficient ?? "未提供",
            },
            {
              key: "unit",
              label: "单位",
              children: coefficient.unit || "单位未提供",
            },
            {
              key: "source",
              label: "数据来源",
              children: coefficient.source || "未提供",
            },
          ]}
        />
      )}
    </Modal>
  );
}

function CandidateTable({
  query,
  items,
  onSelection,
  onPage,
}: {
  query: CoefficientQuery;
  items: EditorItem[];
  onSelection: (candidates: Coefficient[], ids: string[]) => void;
  onPage: (page: number) => void;
}) {
  const remote = useRemote(
    (signal) => api.coefficients(query, signal),
    JSON.stringify(query),
  );
  const columns: TableColumnsType<Coefficient> = [
    { title: "污染物", dataIndex: "pollutant_name", width: 130 },
    {
      title: "行业",
      dataIndex: "industry_name",
      width: 160,
      render: (value) => value || "—",
    },
    {
      title: "产品",
      dataIndex: "product_name",
      width: 130,
      render: (value) => value || "—",
    },
    {
      title: "工艺 / 原料",
      width: 230,
      render: (_, record) =>
        [record.process_name, record.material_name]
          .filter(Boolean)
          .join(" / ") || "—",
    },
    {
      title: "产污系数 / 来源",
      width: 260,
      render: (_, record) => (
        <>
          <div>
            {record.coefficient ?? "未提供"}{" "}
            <span>{record.unit || "单位未提供"}</span>
          </div>
          <div className="muted small">来源 {record.source || "未提供"}</div>
        </>
      ),
    },
  ];
  return (
    <div className="candidate-table">
      <RequestError error={remote.error} retry={remote.reload} />
      <Table<Coefficient>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={remote.data?.list || []}
        loading={remote.loading}
        scroll={{ x: 950 }}
        locale={{
          emptyText: remote.error
            ? "暂时无法获取系数"
            : "未找到匹配系数，请调整条件后检索",
        }}
        rowSelection={{
          preserveSelectedRowKeys: true,
          selectedRowKeys: items.map((item) => item.input.coeff_id),
          onChange: (keys) =>
            onSelection(remote.data?.list || [], keys.map(String)),
        }}
        pagination={{
          current: query.page,
          pageSize: 8,
          total: remote.data?.total || 0,
          showSizeChanger: false,
          showTotal: (total) => `共 ${total} 条系数记录 · 8 条/页`,
          onChange: onPage,
        }}
      />
    </div>
  );
}

export function CoefficientPicker({
  items,
  onSelection,
  onRemove,
  readOnly = false,
}: {
  items: EditorItem[];
  onSelection?: (candidates: Coefficient[], ids: string[]) => void;
  onRemove?: (id: string) => void;
  readOnly?: boolean;
}) {
  const [form] = Form.useForm<CoefficientQuery>();
  const [query, setQuery] = useState<CoefficientQuery | null>(null);
  const [detail, setDetail] = useState<Coefficient | null>(null);
  const values: Partial<CoefficientQuery> = Form.useWatch([], form) || {};

  function changeFilter(name: (typeof filterFields)[number][0]) {
    // 行业、工艺确定候选范围；上游变化后清空依赖字段，已选计算项继续保留。
    const downstream: Record<CoefficientFilterField, CoefficientFilterField[]> =
      {
        industry_name: ["process_name", "product_name", "material_name"],
        process_name: ["product_name", "material_name"],
        product_name: ["material_name"],
        material_name: [],
      };
    form.setFields(
      downstream[name].map((field) => ({ name: field, value: undefined })),
    );
    setQuery(null);
  }

  return (
    <>
      {!readOnly && (
        <Form
          form={form}
          onFinish={(values) => setQuery({ ...values, page: 1, page_size: 8 })}
        >
          <div className="coefficient-filters">
            {filterFields.map(([name, label]) => (
              <Form.Item name={name} key={name}>
                <CoefficientFilter
                  label={label}
                  query={{
                    field: name,
                    industry_name:
                      name !== "industry_name"
                        ? values.industry_name
                        : undefined,
                    process_name:
                      name === "product_name" || name === "material_name"
                        ? values.process_name
                        : undefined,
                    product_name:
                      name === "material_name"
                        ? values.product_name
                        : undefined,
                  }}
                  disabled={
                    name === "process_name"
                      ? !values.industry_name
                      : name !== "industry_name" &&
                        (!values.industry_name || !values.process_name)
                  }
                  onChange={() => changeFilter(name)}
                />
              </Form.Item>
            ))}
            <Button
              onClick={() => {
                form.resetFields();
                setQuery(null);
              }}
            >
              重置
            </Button>
          </div>
          <p className="muted small filter-hint">
            先选择行业与工艺，再选择产品、原料。下拉框支持搜索已加载选项。
          </p>
          <div className="pollutant-search">
            <Form.Item name="pollutant_name">
              <Input
                aria-label="污染物名称"
                size="large"
                allowClear
                placeholder="输入废气污染物，如颗粒物、VOCs、二氧化硫、氮氧化物、氟化物"
                onChange={() => setQuery(null)}
              />
            </Form.Item>
            <Button type="primary" size="large" htmlType="submit">
              检索指标
            </Button>
          </div>
        </Form>
      )}
      {!readOnly &&
        (query ? (
          <CandidateTable
            query={query}
            items={items}
            onSelection={onSelection!}
            onPage={(page) => setQuery({ ...query, page })}
          />
        ) : (
          <div className="search-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="设置筛选条件，点击「检索指标」查询基础库"
            />
          </div>
        ))}
      <div className="selected-heading">
        <strong>
          {readOnly ? "计算项" : "已选"}（{items.length}）
        </strong>
        <span className="muted small">每项使用一条基础库系数记录</span>
      </div>
      {items.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="尚未选择计算项"
        />
      )}
      <div className="selected-list">
        {items.map(({ coefficient, input }, index) => (
          <div className="selected-row" key={input.coeff_id}>
            <div>
              <div>
                <span className="item-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <strong>{coefficient.pollutant_name}</strong>
              </div>
              <div className="muted small">
                {coefficientContext(coefficient)}
              </div>
            </div>
            <div>
              <div>产污系数 {coefficient.coefficient ?? "未提供"}</div>
              <div className="muted small">
                单位 {coefficient.unit || "未提供"}
              </div>
              <Typography.Text className="source-text" type="secondary">
                来源 {coefficient.source || "未提供"}
              </Typography.Text>
            </div>
            <Space orientation="vertical" size={0} align="end">
              {!readOnly && (
                <Button
                  type="link"
                  danger
                  size="small"
                  onClick={() => onRemove?.(input.coeff_id)}
                >
                  移除指标
                </Button>
              )}
              <Button
                type="link"
                size="small"
                onClick={() => setDetail(coefficient)}
              >
                查看系数详情
              </Button>
            </Space>
          </div>
        ))}
      </div>
      <CoefficientDetails coefficient={detail} close={() => setDetail(null)} />
    </>
  );
}
